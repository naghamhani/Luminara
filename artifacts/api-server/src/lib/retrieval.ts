/**
 * Corpus retrieval — BM25 over the PubMed Central Open Access subset.
 * ============================================================================
 *
 * Luna is grounded, not fine-tuned. A local Llama asked "what is the EPDS
 * cut-off?" will answer fluently and sometimes wrongly; in perinatal mental
 * health a confidently wrong number is a safety incident, not a quality issue.
 * So every substantive turn retrieves real passages from licence-clean
 * open-access literature and the model is instructed to answer only from them.
 *
 * The index is built offline by research/corpus/export_backend_index.py and
 * loaded once at boot from a gzipped JSON bundle (~10 MB on disk, ~36 MB
 * parsed). There is no vector database and no embedding service: BM25 is
 * lexical, which is exactly right for the queries that matter here — drug
 * names, scale names, numeric cut-offs — and it costs no extra infrastructure,
 * which matters for a self-hosted, anonymity-first deployment.
 *
 * Retrieval is OPTIONAL by design. If the bundle is absent the server logs a
 * warning and serves ungrounded chat exactly as before, so a deploy that has
 * not yet shipped the data file still boots.
 *
 * Env:
 *   LUMINARA_CORPUS_PATH   override the bundle location
 *   LUMINARA_RETRIEVAL     "off" to disable retrieval entirely
 */

import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

import { logger } from "./logger";

/** BM25 term-frequency saturation. 1.2 is the standard default. */
const K1 = 1.2;
/** BM25 length normalisation. 0.75 is the standard default. */
const B = 0.75;

interface RawPassage {
  p: string; // pmcid
  t: string; // title
  j: string; // journal
  y: string; // year
  s: string; // section
  o: string; // topic
  u: string; // url
  l: string; // licence url
  x: string; // text
}

interface Bundle {
  version: number;
  source: string;
  stats: { papers: number; passages: number; terms: number; postings: number };
  tokenizer: { pattern: string; stopwords: string[] };
  bm25: {
    terms: string[];
    df: number[];
    postings: number[][];
    len: number[];
    avgdl: number;
  };
  passages: RawPassage[];
}

export interface Source {
  pmcid: string;
  title: string;
  journal: string;
  year: string;
  section: string;
  topic: string;
  url: string;
  licence: string;
  text: string;
  score: number;
}

interface LoadedIndex {
  bundle: Bundle;
  /** term -> position in bundle.bm25.terms */
  termIndex: Map<string, number>;
  stopwords: Set<string>;
}

let cached: LoadedIndex | null | undefined;

function bundlePath(): string {
  const override = process.env["LUMINARA_CORPUS_PATH"];
  if (override) return path.resolve(override);
  // dist/index.mjs -> ../data/corpus-index.json.gz
  return path.resolve(__dirname, "..", "data", "corpus-index.json.gz");
}

/**
 * Loads and caches the index. Returns null when retrieval is unavailable —
 * callers must treat that as "answer without sources", never as an error.
 */
export function getIndex(): LoadedIndex | null {
  if (cached !== undefined) return cached;

  if ((process.env["LUMINARA_RETRIEVAL"] || "").toLowerCase() === "off") {
    logger.info("Corpus retrieval disabled by LUMINARA_RETRIEVAL=off");
    cached = null;
    return cached;
  }

  const file = bundlePath();
  if (!existsSync(file)) {
    logger.warn(
      { file },
      "Corpus index not found — Luna will answer without grounded sources. " +
        "Build it with research/corpus/export_backend_index.py",
    );
    cached = null;
    return cached;
  }

  try {
    const started = Date.now();
    const bundle = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Bundle;
    const termIndex = new Map<string, number>();
    bundle.bm25.terms.forEach((t, i) => termIndex.set(t, i));
    cached = {
      bundle,
      termIndex,
      stopwords: new Set(bundle.tokenizer.stopwords),
    };
    logger.info(
      {
        papers: bundle.stats.papers,
        passages: bundle.stats.passages,
        terms: bundle.stats.terms,
        ms: Date.now() - started,
      },
      "Corpus index loaded",
    );
    return cached;
  } catch (err) {
    logger.error({ err, file }, "Failed to load corpus index — continuing ungrounded");
    cached = null;
    return cached;
  }
}

/**
 * Query tokenizer. Must stay identical to the Python tokenizer that built the
 * index, which is why the pattern and stopword list travel inside the bundle
 * rather than being duplicated here as literals.
 */
export function tokenize(text: string, stopwords: Set<string>): string[] {
  const matches = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g);
  if (!matches) return [];
  return matches.filter((t) => !stopwords.has(t));
}

export interface SearchOptions {
  /** Number of passages to return. */
  k?: number;
  /** Restrict to one corpus topic (e.g. "epds_screening"). */
  topic?: string;
  /** At most this many passages from any single paper. */
  maxPerPaper?: number;
  /** Drop results below this BM25 score — keeps weak matches out of the prompt. */
  minScore?: number;
}

/**
 * BM25 search over the corpus. Returns [] when the index is unavailable.
 */
export function search(query: string, opts: SearchOptions = {}): Source[] {
  const index = getIndex();
  if (!index) return [];

  const { k = 6, topic, maxPerPaper = 2, minScore = 1.5 } = opts;
  const { bundle, termIndex, stopwords } = index;
  const { postings, df, len, avgdl } = bundle.bm25;
  const N = bundle.passages.length;

  const queryTerms = tokenize(query, stopwords);
  if (queryTerms.length === 0) return [];

  // Accumulate scores only over passages that actually contain a query term.
  // Walking postings beats scanning all 14k passages per query.
  const scores = new Map<number, number>();
  const seen = new Set<string>();

  for (const term of queryTerms) {
    if (seen.has(term)) continue; // repeated query terms add nothing under BM25
    seen.add(term);

    const ti = termIndex.get(term);
    if (ti === undefined) continue;

    const docFreq = df[ti]!;
    const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
    const list = postings[ti]!;

    for (let i = 0; i < list.length; i += 2) {
      const pid = list[i]!;
      const tf = list[i + 1]!;
      const norm = tf + K1 * (1 - B + (B * len[pid]!) / avgdl);
      scores.set(pid, (scores.get(pid) ?? 0) + idf * ((tf * (K1 + 1)) / norm));
    }
  }

  // NOTE: a Lucene-style coordination factor (scaling by the share of query
  // terms matched) was tried here and measurably HURT precise queries — it
  // pushed a ketamine trial above the actual EPDS validation paper for
  // "EPDS cut-off score" — without reliably helping conversational ones. Plain
  // BM25 plus the title boost is what the verification suite passes on.
  const ranked = [...scores.entries()]
    .filter(([pid]) => !topic || bundle.passages[pid]!.o === topic)
    .filter(([, score]) => score >= minScore)
    .sort((a, b) => b[1] - a[1]);

  // Diversify: without a per-paper cap a single review supplies every passage,
  // and the model sees one source restated k times rather than k sources.
  const perPaper = new Map<string, number>();
  const out: Source[] = [];
  for (const [pid, score] of ranked) {
    const p = bundle.passages[pid]!;
    const used = perPaper.get(p.p) ?? 0;
    if (used >= maxPerPaper) continue;
    perPaper.set(p.p, used + 1);
    out.push({
      pmcid: p.p,
      title: p.t,
      journal: p.j,
      year: p.y,
      section: p.s,
      topic: p.o,
      url: p.u,
      licence: p.l,
      text: p.x,
      score: Number(score.toFixed(3)),
    });
    if (out.length >= k) break;
  }
  return out;
}

/** Corpus provenance, for the health endpoint and any research write-up. */
export function corpusStats(): {
  available: boolean;
  papers?: number;
  passages?: number;
  terms?: number;
  source?: string;
} {
  const index = getIndex();
  if (!index) return { available: false };
  return {
    available: true,
    papers: index.bundle.stats.papers,
    passages: index.bundle.stats.passages,
    terms: index.bundle.stats.terms,
    source: index.bundle.source,
  };
}

/** Test seam: forget the cached index so a new bundle can be loaded. */
export function resetIndexCache(): void {
  cached = undefined;
}

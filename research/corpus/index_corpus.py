"""
Luminara corpus index — build and query, with no third-party dependencies
=========================================================================

Turns `chunks.jsonl` from fetch_pmc_corpus.py into a searchable index Luna can
retrieve from, and gives you a CLI to sanity-check what it returns before you
wire it into the chat route.

Two backends:

  ollama  Embeddings from the same self-hosted Ollama instance the chatbot
          already uses (OLLAMA_BASE_URL), so no text ever leaves your
          infrastructure. Semantic — matches "I can't bond with my baby" to
          literature on mother-infant attachment. Default model
          nomic-embed-text; pull it with `ollama pull nomic-embed-text`.

  tfidf   Pure-NumPy TF-IDF with sublinear term weighting. No model needed,
          builds in seconds, works offline. Lexical only, so it misses
          paraphrase — good enough to validate the pipeline, and a sensible
          fallback when Ollama is unavailable.

Retrieval combines both when the embedding index exists: dense scores are
blended with TF-IDF (`--alpha`), because pure dense retrieval reliably loses
exact-term queries like "EPDS cut-off 13" or "brexanolone".

Usage
-----
    python3 index_corpus.py build --backend tfidf
    python3 index_corpus.py build --backend ollama          # needs Ollama running
    python3 index_corpus.py query "does a c-section raise the risk of PPD?"
    python3 index_corpus.py query "EPDS cutoff" --topic epds_screening -k 5
    python3 index_corpus.py trends --topic ppd_risk_factors
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict

import numpy as np

DEFAULT_DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OLLAMA = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

STOPWORDS = set("""
a about above after again against all am an and any are as at be because been before being below
between both but by can cannot could did do does doing down during each few for from further had
has have having he her here hers herself him himself his how i if in into is it its itself me more
most my myself no nor not of off on once only or other our ours out over own same she should so
some such than that the their theirs them themselves then there these they this those through to
too under until up very was we were what when where which while who whom why will with you your
study studies results result method methods conclusion conclusions background objective aim aims
using used use also may can significant significantly however associated association
""".split())

TOKEN = re.compile(r"[a-z][a-z0-9\-]{2,}")


def tokenize(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOPWORDS]


def load_chunks(data_dir: str) -> list[dict]:
    path = os.path.join(data_dir, "chunks.jsonl")
    if not os.path.exists(path):
        sys.exit(f"no chunks at {path} — run fetch_pmc_corpus.py first")
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


# ---------------------------------------------------------------------------
# TF-IDF
# ---------------------------------------------------------------------------

def build_tfidf(chunks: list[dict], data_dir: str, min_df: int = 3) -> None:
    df: Counter = Counter()
    tokenized = []
    for c in chunks:
        toks = tokenize(c["text"])
        tokenized.append(toks)
        df.update(set(toks))

    vocab = {t: i for i, t in enumerate(sorted(t for t, n in df.items() if n >= min_df))}
    n_docs = len(chunks)
    idf = np.zeros(len(vocab), dtype=np.float32)
    for term, i in vocab.items():
        idf[i] = math.log((1 + n_docs) / (1 + df[term])) + 1.0

    # Sparse CSR built by hand — the matrix is ~50M cells dense, ~1% occupied.
    indptr = [0]
    indices: list[int] = []
    values: list[float] = []
    for toks in tokenized:
        tf = Counter(t for t in toks if t in vocab)
        row_idx, row_val = [], []
        for term, count in tf.items():
            i = vocab[term]
            row_idx.append(i)
            # Sublinear tf damps the effect of a term repeated 40 times in a
            # methods section.
            row_val.append((1.0 + math.log(count)) * idf[i])
        norm = math.sqrt(sum(v * v for v in row_val)) or 1.0
        indices.extend(row_idx)
        values.extend(v / norm for v in row_val)
        indptr.append(len(indices))

    np.savez_compressed(
        os.path.join(data_dir, "index_tfidf.npz"),
        indptr=np.array(indptr, dtype=np.int64),
        indices=np.array(indices, dtype=np.int32),
        values=np.array(values, dtype=np.float32),
        idf=idf,
        vocab=np.array(list(vocab), dtype=object),
    )
    print(f"tfidf index: {n_docs:,} chunks x {len(vocab):,} terms, "
          f"{len(values):,} non-zeros")


def tfidf_scores(query: str, idx: dict) -> np.ndarray:
    vocab = {t: i for i, t in enumerate(idx["vocab"])}
    idf = idx["idf"]
    tf = Counter(t for t in tokenize(query) if t in vocab)
    if not tf:
        return np.zeros(len(idx["indptr"]) - 1, dtype=np.float32)

    q = {}
    for term, count in tf.items():
        i = vocab[term]
        q[i] = (1.0 + math.log(count)) * idf[i]
    norm = math.sqrt(sum(v * v for v in q.values())) or 1.0
    q = {i: v / norm for i, v in q.items()}

    indptr, indices, values = idx["indptr"], idx["indices"], idx["values"]
    scores = np.zeros(len(indptr) - 1, dtype=np.float32)
    for row in range(len(indptr) - 1):
        s = 0.0
        for p in range(indptr[row], indptr[row + 1]):
            w = q.get(int(indices[p]))
            if w is not None:
                s += w * values[p]
        scores[row] = s
    return scores


# ---------------------------------------------------------------------------
# Ollama embeddings
# ---------------------------------------------------------------------------

def embed(texts: list[str], model: str) -> np.ndarray:
    out = []
    for i, text in enumerate(texts):
        body = json.dumps({"model": model, "prompt": text}).encode()
        req = urllib.request.Request(
            f"{OLLAMA}/api/embeddings", data=body,
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            out.append(json.loads(resp.read())["embedding"])
        if (i + 1) % 200 == 0:
            print(f"  embedded {i + 1}/{len(texts)}")
    arr = np.array(out, dtype=np.float32)
    arr /= (np.linalg.norm(arr, axis=1, keepdims=True) + 1e-9)
    return arr


def build_dense(chunks: list[dict], data_dir: str, model: str) -> None:
    print(f"embedding {len(chunks):,} chunks with {model} via {OLLAMA}…")
    vecs = embed([c["text"] for c in chunks], model)
    np.savez_compressed(os.path.join(data_dir, "index_dense.npz"),
                        vectors=vecs, model=np.array([model], dtype=object))
    print(f"dense index: {vecs.shape[0]:,} x {vecs.shape[1]}")


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

def search(query: str, chunks: list[dict], data_dir: str, k: int,
           topic: str | None, alpha: float, min_year: int | None) -> list[tuple[float, dict]]:
    scores = np.zeros(len(chunks), dtype=np.float32)

    tfidf_path = os.path.join(data_dir, "index_tfidf.npz")
    dense_path = os.path.join(data_dir, "index_dense.npz")
    have_dense = os.path.exists(dense_path)

    if os.path.exists(tfidf_path):
        idx = np.load(tfidf_path, allow_pickle=True)
        lex = tfidf_scores(query, idx)
        scores += (1 - alpha if have_dense else 1.0) * lex

    if have_dense:
        d = np.load(dense_path, allow_pickle=True)
        qv = embed([query], str(d["model"][0]))[0]
        scores += alpha * (d["vectors"] @ qv)

    if not scores.any():
        sys.exit("no index found — run `build` first")

    # Filters are applied as a mask rather than a pre-slice so the score array
    # stays aligned with `chunks`.
    mask = np.ones(len(chunks), dtype=bool)
    if topic:
        mask &= np.array([c["topic"] == topic for c in chunks])
    if min_year:
        mask &= np.array([(c["year"] or "0").isdigit() and int(c["year"]) >= min_year
                          for c in chunks])
    scores = np.where(mask, scores, -np.inf)

    top = np.argsort(-scores)[:k]
    return [(float(scores[i]), chunks[i]) for i in top if np.isfinite(scores[i])]


def cmd_trends(chunks: list[dict], topic: str | None) -> None:
    """Corpus-level view: what the literature covers and how it has grown.

    This is the 'notice trends' surface — it describes the *corpus*, not
    patients. Use it to spot coverage gaps before Luna hits them in production.
    """
    sel = [c for c in chunks if not topic or c["topic"] == topic]
    by_doc = {}
    for c in sel:
        by_doc[c["pmcid"]] = c
    print(f"{len(by_doc):,} papers / {len(sel):,} passages"
          f"{f' in {topic}' if topic else ''}\n")

    years = Counter(d["year"] for d in by_doc.values() if (d["year"] or "").isdigit())
    print("papers by year")
    for year in sorted(years)[-15:]:
        print(f"  {year}  {'#' * min(60, years[year]):<60} {years[year]}")

    if not topic:
        print("\npapers by topic")
        topics = Counter(d["topic"] for d in by_doc.values())
        for name, n in topics.most_common():
            print(f"  {name:34s} {n:4d}")

    print("\njournals")
    for name, n in Counter(d["journal"] for d in by_doc.values()).most_common(12):
        print(f"  {n:4d}  {name}")

    # Terms that are distinctive to recent work — a cheap emerging-topic signal.
    recent, older = [], []
    for c in sel:
        if not (c["year"] or "").isdigit():
            continue
        (recent if int(c["year"]) >= 2022 else older).append(c["text"])
    if recent and older:
        rc, oc = Counter(), Counter()
        for t in recent:
            rc.update(set(tokenize(t)))
        for t in older:
            oc.update(set(tokenize(t)))
        rn, on = len(recent), len(older)
        # Laplace smoothing on both rates. Dividing by a bare epsilon instead
        # makes every term that simply never appeared in the older set rank
        # first with a meaningless five-figure ratio.
        lift = {}
        for t, count in rc.items():
            if count < max(8, rn * 0.02):   # ignore long-tail noise
                continue
            r_rate = (count + 1) / (rn + 2)
            o_rate = (oc[t] + 1) / (on + 2)
            lift[t] = r_rate / o_rate
        print(f"\nterms rising in 2022+ ({rn:,} passages) vs earlier ({on:,})")
        for term, ratio in sorted(lift.items(), key=lambda kv: -kv[1])[:20]:
            print(f"  {ratio:5.2f}x  {term}  ({rc[term]} vs {oc[term]})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["build", "query", "trends"])
    ap.add_argument("text", nargs="?", default="")
    ap.add_argument("--data", default=DEFAULT_DATA)
    ap.add_argument("--backend", choices=["tfidf", "ollama", "both"], default="tfidf")
    ap.add_argument("--embed-model", default="nomic-embed-text")
    ap.add_argument("-k", type=int, default=8)
    ap.add_argument("--topic", default=None)
    ap.add_argument("--min-year", type=int, default=None)
    ap.add_argument("--alpha", type=float, default=0.65,
                    help="dense weight when both indexes exist")
    args = ap.parse_args()

    chunks = load_chunks(args.data)

    if args.command == "build":
        if args.backend in ("tfidf", "both"):
            build_tfidf(chunks, args.data)
        if args.backend in ("ollama", "both"):
            build_dense(chunks, args.data, args.embed_model)
        return

    if args.command == "trends":
        cmd_trends(chunks, args.topic)
        return

    if not args.text:
        sys.exit("query needs some text")
    hits = search(args.text, chunks, args.data, args.k, args.topic,
                  args.alpha, args.min_year)
    for score, c in hits:
        print(f"\n[{score:.3f}] {c['title'][:95]}")
        print(f"        {c['journal']} {c['year']} · {c['section']} · {c['topic']}")
        print(f"        {c['url']}")
        body = c["text"]
        print("        " + (body[:420] + "…" if len(body) > 420 else body))


if __name__ == "__main__":
    main()

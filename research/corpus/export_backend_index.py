"""
Export a deployable retrieval index for the Luminara API server.
================================================================

`chunks.jsonl` is ~200 MB and is a *research* artifact — it holds every passage
of every paper, including methods detail that is useless for grounding a chat
reply. This script distils it into a single compressed bundle the Node backend
loads at boot:

    artifacts/api-server/data/corpus-index.json.gz

Two decisions do the work:

1. **Section selection.** Only answer-bearing sections are kept — abstract,
   discussion, conclusion, then introduction/background as a fallback. A Methods
   passage describing a recruitment protocol in Uganda retrieves well on keyword
   overlap and tells a user nothing.

2. **Per-paper cap.** At most `--per-doc` passages per paper. Without a cap a
   single long review dominates every result list for its topic, and the model
   sees four paraphrases of one source instead of four independent ones.

The bundle also carries the tokenizer's stopword list, so the TypeScript query
tokenizer cannot silently drift from the Python one that built the index.

Usage:
    python3 export_backend_index.py --per-doc 4
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.abspath(os.path.join(
    HERE, "..", "..", "artifacts", "api-server", "data", "corpus-index.json.gz"))

# Ranked preference. Lower number = kept first when the per-doc cap bites.
SECTION_PRIORITY = [
    (re.compile(r"^abstract", re.I), 0),
    (re.compile(r"^(conclusion|conclusions)", re.I), 1),
    (re.compile(r"^\d*\.?\s*(discussion)", re.I), 2),
    (re.compile(r"^(background|introduction)", re.I), 3),
    (re.compile(r"^(results|findings)", re.I), 4),
]

# Imported verbatim from index_corpus.py — the two tokenizers must agree.
STOPWORDS = sorted(set("""
a about above after again against all am an and any are as at be because been before being below
between both but by can cannot could did do does doing down during each few for from further had
has have having he her here hers herself him himself his how i if in into is it its itself me more
most my myself no nor not of off on once only or other our ours out over own same she should so
some such than that the their theirs them themselves then there these they this those through to
too under until up very was we were what when where which while who whom why will with you your
study studies results result method methods conclusion conclusions background objective aim aims
using used use also may can significant significantly however associated association
""".split()))

TOKEN = re.compile(r"[a-z][a-z0-9\-]{2,}")


def section_rank(heading: str) -> int | None:
    for pattern, rank in SECTION_PRIORITY:
        if pattern.match(heading.strip()):
            return rank
    return None


def tokenize(text: str, stop: set[str]) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in stop]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunks", default=os.path.join(HERE, "data", "chunks.jsonl"))
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--per-doc", type=int, default=4)
    ap.add_argument("--min-df", type=int, default=2)
    ap.add_argument("--title-weight", type=int, default=3,
                    help="how many times to count each title term")
    ap.add_argument("--max-words", type=int, default=260,
                    help="truncate passages to keep the bundle small")
    args = ap.parse_args()

    stop = set(STOPWORDS)

    # --- select ---------------------------------------------------------------
    by_doc: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    total = 0
    with open(args.chunks, encoding="utf-8") as fh:
        for line in fh:
            c = json.loads(line)
            total += 1
            rank = section_rank(c["section"])
            if rank is None:
                continue
            by_doc[c["pmcid"]].append((rank, c))

    passages: list[dict] = []
    for pmcid, items in by_doc.items():
        items.sort(key=lambda rc: rc[0])
        for _, c in items[:args.per_doc]:
            words = c["text"].split()
            passages.append({
                "p": pmcid,
                "t": c["title"],
                "j": c["journal"],
                "y": c["year"],
                "s": c["section"],
                "o": c["topic"],
                "u": c["url"],
                "l": c["licence_url"],
                "x": " ".join(words[:args.max_words]),
            })

    print(f"{total:,} research passages -> {len(passages):,} deployable "
          f"({len(by_doc):,} papers, cap {args.per_doc}/paper)")

    # --- BM25 postings --------------------------------------------------------
    # Title terms are folded into the term frequencies at a weight, without
    # appearing in the displayed text. Body-only indexing ranks a passing
    # mention of "EPDS" inside a ketamine trial's discussion above a paper
    # actually titled "Validation of the Edinburgh Postnatal Depression Scale" —
    # the title is the strongest available signal of what a paper is *about*.
    df: Counter = Counter()
    tokenized: list[Counter] = []
    lengths: list[int] = []
    for p in passages:
        toks = tokenize(p["x"], stop)
        tf = Counter(toks)
        for term in tokenize(p["t"], stop):
            tf[term] += args.title_weight
        tokenized.append(tf)
        # Length normalisation uses the BODY length only. Counting the boosted
        # title tokens here would cancel the boost back out through BM25's
        # length penalty.
        lengths.append(len(toks))
        df.update(tf.keys())

    terms = sorted(t for t, n in df.items() if n >= args.min_df)
    term_index = {t: i for i, t in enumerate(terms)}

    # Flat [passageIdx, tf, passageIdx, tf, …] per term: compact in JSON and
    # cheap to walk in JS without allocating objects per posting.
    postings: list[list[int]] = [[] for _ in terms]
    for pid, tf in enumerate(tokenized):
        for term, count in tf.items():
            i = term_index.get(term)
            if i is not None:
                postings[i].append(pid)
                postings[i].append(count)

    bundle = {
        "version": 1,
        "source": "PubMed Central Open Access subset (NCBI E-utilities)",
        "stats": {
            "papers": len(by_doc),
            "passages": len(passages),
            "terms": len(terms),
            "postings": sum(len(p) // 2 for p in postings),
        },
        "tokenizer": {"pattern": "[a-z][a-z0-9\\-]{2,}", "stopwords": STOPWORDS},
        "bm25": {
            "terms": terms,
            "df": [df[t] for t in terms],
            "postings": postings,
            "len": lengths,
            "avgdl": sum(lengths) / max(1, len(lengths)),
        },
        "passages": passages,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    raw = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.open(args.out, "wb", compresslevel=9) as fh:
        fh.write(raw)

    size = os.path.getsize(args.out)
    print(f"{len(terms):,} terms, {bundle['stats']['postings']:,} postings")
    print(f"wrote {args.out}  ({size / 1e6:.1f} MB gzipped, "
          f"{len(raw) / 1e6:.1f} MB raw)")

    # Topic coverage, so a thin topic is visible before it surprises you in prod.
    counts = Counter(p["o"] for p in passages)
    print("\npassages per topic")
    for topic, n in counts.most_common():
        print(f"  {topic:34s} {n:5d}")


if __name__ == "__main__":
    main()

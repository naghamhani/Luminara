"""
Luminara chatbot corpus builder — PubMed Central Open Access subset
===================================================================

Downloads real, license-clean, full-text research papers in Luminara's domain and
turns them into a retrieval corpus Luna can be grounded on.

Why PMC OA and not "scrape some PDFs":
  * The OA subset is explicitly licensed for redistribution and bulk download
    (CC-BY / CC-BY-NC / CC0 / public domain). Every document keeps its licence
    string, so you can always prove what you are allowed to ship.
  * NCBI E-utilities give structured XML, so sections, abstracts and references
    are separable — you can drop the reference list instead of letting it pollute
    your embeddings.
  * Articles carry a stable PMCID, so every chatbot answer can cite a real source.

Output (in --out, default ./data):
  documents.jsonl  one row per paper: metadata + abstract + cleaned full text
  chunks.jsonl     retrieval-ready passages with citation metadata attached
  manifest.csv     pmcid, title, journal, year, licence, topic, word count
  skipped.csv      anything rejected, with the reason (usually a closed licence)

Usage:
  python3 fetch_pmc_corpus.py --per-topic 120 --out ./data
  NCBI_API_KEY=xxxx python3 fetch_pmc_corpus.py --per-topic 400   # 10 req/s

NCBI asks for a contact address on automated requests; set --email.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Iterable

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
TOOL = "luminara-corpus-builder"

# ---------------------------------------------------------------------------
# Topics — each becomes a `topic` tag on every document it retrieves, so the
# retriever can be filtered ("only answer PPD questions from PPD literature").
# Queries are written against PubMed syntax; MeSH terms are resolved by NCBI.
# ---------------------------------------------------------------------------
TOPICS: dict[str, str] = {
    # --- core: the predictive model's subject matter -------------------------
    "ppd_epidemiology":
        '"depression, postpartum"[MeSH] AND (prevalence OR incidence OR epidemiology)',
    "ppd_risk_factors":
        '"depression, postpartum"[MeSH] AND ("risk factors"[MeSH] OR predictors OR "risk factor")',
    "ppd_prediction_ml":
        '"depression, postpartum"[MeSH] AND ("machine learning" OR "predictive model" OR '
        '"prediction model" OR "artificial intelligence" OR "risk score")',
    "epds_screening":
        '("Edinburgh Postnatal Depression Scale" OR EPDS) AND (validation OR screening OR '
        '"cut-off" OR psychometric)',
    "perinatal_screening_guidelines":
        '("perinatal mental health" OR "maternal mental health") AND (guideline OR '
        '"clinical practice" OR recommendation OR screening)',

    # --- treatment & support: what Luna will actually be asked about ---------
    "ppd_treatment":
        '"depression, postpartum"[MeSH] AND (treatment OR therapy OR intervention OR '
        '"cognitive behavioral" OR brexanolone OR zuranolone OR SSRI)',
    "perinatal_anxiety":
        '("perinatal anxiety" OR "postpartum anxiety" OR "pregnancy related anxiety")',
    "postpartum_psychosis":
        '"postpartum psychosis" OR ("puerperal disorders"[MeSH] AND psychosis)',
    "maternal_suicide_selfharm":
        '(maternal OR perinatal OR postpartum) AND ("suicidal ideation" OR "self harm" OR '
        '"suicide" OR "maternal mortality" AND mental)',
    "social_support_ipv":
        '(postpartum OR perinatal) AND ("social support" OR "intimate partner violence" OR '
        '"partner support")',

    # --- physiology the app tracks ------------------------------------------
    "sleep_postpartum":
        '(postpartum OR perinatal) AND ("sleep deprivation"[MeSH] OR "sleep quality" OR insomnia)',
    "breastfeeding_mental_health":
        '(breastfeeding OR lactation) AND (depression OR "mental health" OR "mood")',
    "thyroid_postpartum":
        '"postpartum thyroiditis" OR (thyroid AND postpartum AND (depression OR mood))',
    "hormones_mood":
        '(estradiol OR progesterone OR allopregnanolone OR oxytocin) AND (postpartum OR '
        'perinatal) AND (mood OR depression)',
    "obstetric_outcomes":
        '("cesarean section"[MeSH] OR "premature birth"[MeSH] OR preeclampsia OR '
        '"gestational diabetes") AND (depression OR "mental health")',

    # --- broader women's health the app also covers --------------------------
    "menstrual_cycle_health":
        '("menstrual cycle"[MeSH] OR "basal body temperature" OR "cycle tracking") AND '
        '(health OR fertility OR tracking)',
    "pmdd_pms":
        '"premenstrual dysphoric disorder" OR "premenstrual syndrome"',
    "menopause_mood":
        '(menopause OR perimenopause) AND (depression OR mood OR "mental health")',

    # --- how to build this responsibly ---------------------------------------
    "digital_health_apps":
        '("mobile health" OR "mHealth" OR "smartphone app") AND (maternal OR postpartum OR '
        '"women\'s health") AND (depression OR "mental health")',
    "ai_chatbot_mental_health":
        '(chatbot OR "conversational agent" OR "large language model") AND "mental health"',
}

# Licences that permit redistribution of the full text. Anything else is kept in
# skipped.csv rather than silently dropped, so the exclusion is auditable.
ALLOWED_LICENCE_PATTERNS = (
    "creativecommons.org/licenses/by",
    "creativecommons.org/publicdomain",
    "creativecommons.org/licenses/by-nc",
    "creativecommons.org/licenses/by-nc-nd",
    "creativecommons.org/licenses/by-nc-sa",
    "creativecommons.org/licenses/by-sa",
)

# Sections that add noise to a retrieval index rather than signal.
DROP_SECTIONS = re.compile(
    r"^(references?|bibliography|acknowledge?ments?|author contributions?|"
    r"conflicts? of interest|competing interests?|funding|supplementary|"
    r"data availability|abbreviations)",
    re.I,
)


class Throttle:
    """NCBI allows 3 requests/second, or 10 with an API key."""

    def __init__(self, per_second: float) -> None:
        self.interval = 1.0 / per_second
        self._last = 0.0

    def wait(self) -> None:
        delta = time.monotonic() - self._last
        if delta < self.interval:
            time.sleep(self.interval - delta)
        self._last = time.monotonic()


def _get(url: str, params: dict, throttle: Throttle, retries: int = 4) -> bytes:
    params = {k: v for k, v in params.items() if v is not None}
    full = f"{url}?{urllib.parse.urlencode(params)}"
    for attempt in range(retries):
        throttle.wait()
        try:
            req = urllib.request.Request(full, headers={"User-Agent": TOOL})
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read()
        except Exception as exc:  # noqa: BLE001 - network flakiness is expected
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"    retry {attempt + 1}/{retries - 1} in {wait}s ({exc})", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def esearch(query: str, retmax: int, throttle: Throttle, key: str | None,
            email: str | None) -> list[str]:
    raw = _get(f"{EUTILS}/esearch.fcgi", {
        "db": "pmc",
        "term": f'({query}) AND "open access"[filter]',
        "retmax": retmax,
        "retmode": "json",
        "sort": "relevance",
        "api_key": key,
        "tool": TOOL,
        "email": email,
    }, throttle)
    return json.loads(raw)["esearchresult"].get("idlist", [])


def efetch(pmcids: Iterable[str], throttle: Throttle, key: str | None,
           email: str | None) -> ET.Element:
    raw = _get(f"{EUTILS}/efetch.fcgi", {
        "db": "pmc",
        "id": ",".join(pmcids),
        "retmode": "xml",
        "api_key": key,
        "tool": TOOL,
        "email": email,
    }, throttle)
    return ET.fromstring(raw)


# Tags that are block-level in JATS: a space must be inserted at their
# boundaries, otherwise `itertext()` welds neighbours together ("ABSTRACTAim").
_BLOCK_TAGS = {"title", "p", "sec", "abstract", "list-item", "list", "caption",
               "td", "th", "tr", "def", "term", "disp-quote"}


def _text(node: ET.Element | None) -> str:
    """Flatten an element to plain text, keeping inline markup content but
    inserting whitespace at block boundaries."""
    if node is None:
        return ""
    parts: list[str] = []

    def walk(el: ET.Element) -> None:
        block = el.tag.rsplit("}", 1)[-1] in _BLOCK_TAGS
        if block:
            parts.append(" ")
        if el.text:
            parts.append(el.text)
        for child in el:
            walk(child)
            if child.tail:
                parts.append(child.tail)
        if block:
            parts.append(" ")

    walk(node)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


# Wrappers whose contents linearise into unreadable token soup. A JATS table
# flattens to a run of bare numbers that scores well on keyword overlap and
# reads as gibberish in a chatbot answer, so it is excluded outright.
_NOISE_WRAPPERS = {"table-wrap", "fig", "graphic", "media", "disp-formula",
                   "inline-formula", "supplementary-material", "table"}


def _is_mostly_numeric(text: str, threshold: float = 0.35) -> bool:
    """True when a passage is dominated by figures — a table that escaped the
    structural filter, or an inline results dump."""
    tokens = text.split()
    if len(tokens) < 20:
        return False
    numeric = sum(1 for t in tokens if re.search(r"\d", t))
    return numeric / len(tokens) > threshold


def _section_paragraphs(sec: ET.Element) -> list[str]:
    """Paragraph text from a section, skipping anything inside a table, figure
    or formula wrapper."""
    skip: set[int] = set()
    for parent in sec.iter():
        if parent.tag.rsplit("}", 1)[-1] in _NOISE_WRAPPERS:
            for descendant in parent.iter():
                skip.add(id(descendant))

    out = []
    for p in sec.iter("p"):
        if id(p) in skip:
            continue
        text = _text(p)
        if text and not _is_mostly_numeric(text):
            out.append(text)
    return out


def _licence(article: ET.Element) -> tuple[str, str]:
    """Return (licence_url, licence_text) from <permissions>."""
    for lic in article.iter("license"):
        href = ""
        for key in ("{http://www.w3.org/1999/xlink}href", "href", "xlink:href"):
            if key in lic.attrib:
                href = lic.attrib[key]
                break
        if not href:
            for ext in lic.iter("ext-link"):
                href = ext.attrib.get("{http://www.w3.org/1999/xlink}href", "")
                if href:
                    break
        return href, _text(lic)[:400]
    return "", ""


def parse_article(article: ET.Element, topic: str = "unknown") -> dict | None:
    meta = article.find(".//front/article-meta")
    if meta is None:
        return None

    ids = {i.attrib.get("pub-id-type"): _text(i) for i in meta.iter("article-id")}
    # PMC tags these as "pmcid" (PMC-prefixed) and "pmcaid" (bare numeric,
    # which is what esearch returns). "pmc" does not exist — assuming it did is
    # what silently unset every topic tag on the first run.
    pmcid = ids.get("pmcid") or ids.get("pmc") or ""
    numeric_id = ids.get("pmcaid") or ids.get("pmcaiid") or ""
    if not pmcid and numeric_id:
        pmcid = f"PMC{numeric_id}"
    if pmcid and not pmcid.upper().startswith("PMC"):
        pmcid = f"PMC{pmcid}"
    if not numeric_id:
        numeric_id = pmcid.upper().removeprefix("PMC")

    title = _text(meta.find(".//title-group/article-title"))
    journal = _text(article.find(".//front/journal-meta//journal-title"))

    year = ""
    for pd in meta.iter("pub-date"):
        y = _text(pd.find("year"))
        if y:
            year = y
            break

    authors = []
    for contrib in meta.iter("contrib"):
        if contrib.attrib.get("contrib-type") not in (None, "author"):
            continue
        surname = _text(contrib.find(".//surname"))
        given = _text(contrib.find(".//given-names"))
        if surname:
            authors.append(f"{given} {surname}".strip())

    abstract = " ".join(
        _text(a) for a in meta.iter("abstract")
    ).strip()

    keywords = [_text(k) for k in meta.iter("kwd") if _text(k)]

    # --- body, section by section, dropping boilerplate ----------------------
    sections: list[dict] = []
    body = article.find(".//body")
    if body is not None:
        for sec in body.findall("./sec"):
            heading = _text(sec.find("./title"))
            if heading and DROP_SECTIONS.match(heading):
                continue
            content = " ".join(_section_paragraphs(sec))
            if len(content) < 40:
                continue
            sections.append({"heading": heading or "Body", "text": content})
        if not sections:  # some articles have no <sec>, just loose <p>
            loose = " ".join(_text(p) for p in body.findall("./p") if _text(p))
            if len(loose) > 200:
                sections.append({"heading": "Body", "text": loose})

    licence_url, licence_text = _licence(article)
    full_text = "\n\n".join(f"{s['heading']}\n{s['text']}" for s in sections)

    return {
        "pmcid": pmcid,
        "_numeric_id": numeric_id,
        "pmid": ids.get("pmid", ""),
        "doi": ids.get("doi", ""),
        "title": title,
        "journal": journal,
        "year": year,
        "authors": authors[:25],
        "keywords": keywords,
        "topic": topic,
        "licence_url": licence_url,
        "licence_text": licence_text,
        "url": f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/" if pmcid else "",
        "abstract": abstract,
        "sections": sections,
        "full_text": full_text,
        "word_count": len(full_text.split()),
    }


def licence_ok(doc: dict) -> bool:
    url = (doc.get("licence_url") or "").lower()
    if any(pat in url for pat in ALLOWED_LICENCE_PATTERNS):
        return True
    text = (doc.get("licence_text") or "").lower()
    return "creative commons" in text and "no-cc" not in text


def chunk_document(doc: dict, size: int, overlap: int) -> list[dict]:
    """Split into overlapping passages, never crossing a section boundary.

    Section-aware chunking matters here: a passage that straddles Methods and
    Results produces answers that attribute a finding to the wrong context.
    """
    chunks: list[dict] = []
    units: list[tuple[str, str]] = []
    if doc["abstract"]:
        units.append(("Abstract", doc["abstract"]))
    units += [(s["heading"], s["text"]) for s in doc["sections"]]

    for heading, text in units:
        words = text.split()
        if not words:
            continue
        step = max(1, size - overlap)
        for start in range(0, len(words), step):
            piece = " ".join(words[start:start + size])
            if len(piece.split()) < 40:  # trailing scraps carry no meaning
                continue
            if _is_mostly_numeric(piece):  # residual table debris
                continue
            chunks.append({
                "chunk_id": f"{doc['pmcid']}:{heading[:24]}:{start}",
                "pmcid": doc["pmcid"],
                "title": doc["title"],
                "journal": doc["journal"],
                "year": doc["year"],
                "topic": doc["topic"],
                "section": heading,
                "url": doc["url"],
                "licence_url": doc["licence_url"],
                "text": piece,
            })
    return chunks


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-topic", type=int, default=120,
                    help="max papers to retrieve per topic (default 120)")
    ap.add_argument("--out", default="data")
    ap.add_argument("--email", default=None, help="contact address for NCBI")
    ap.add_argument("--batch", type=int, default=50, help="efetch batch size")
    ap.add_argument("--chunk-size", type=int, default=280, help="chunk size in words")
    ap.add_argument("--chunk-overlap", type=int, default=60)
    ap.add_argument("--topics", nargs="*", default=None,
                    help="subset of topic slugs (default: all)")
    ap.add_argument("--min-words", type=int, default=400,
                    help="drop papers with less full text than this")
    args = ap.parse_args()

    key = os.environ.get("NCBI_API_KEY")
    throttle = Throttle(9.0 if key else 2.8)
    os.makedirs(args.out, exist_ok=True)

    topics = {k: v for k, v in TOPICS.items()
              if args.topics is None or k in args.topics}

    # --- 1. search -----------------------------------------------------------
    print(f"searching {len(topics)} topics "
          f"({'with' if key else 'without'} an API key)…")
    id_to_topic: dict[str, str] = {}
    for slug, query in topics.items():
        ids = esearch(query, args.per_topic, throttle, key, args.email)
        new = 0
        for pmcid in ids:
            if pmcid not in id_to_topic:  # first topic to claim it wins
                id_to_topic[pmcid] = slug
                new += 1
        print(f"  {slug:34s} {len(ids):4d} hits, {new:4d} new")

    all_ids = list(id_to_topic)
    print(f"\n{len(all_ids)} unique articles to fetch\n")

    # --- 2. fetch and parse --------------------------------------------------
    docs: list[dict] = []
    skipped: list[dict] = []
    for i in range(0, len(all_ids), args.batch):
        batch = all_ids[i:i + args.batch]
        try:
            root = efetch(batch, throttle, key, args.email)
        except Exception as exc:  # noqa: BLE001
            print(f"  batch {i // args.batch + 1} failed: {exc}", file=sys.stderr)
            continue
        for article in root.iter("article"):
            doc = parse_article(article)
            if doc is None:
                continue
            # Bind the topic from whichever id form esearch handed back.
            doc["topic"] = (id_to_topic.get(doc["_numeric_id"])
                            or id_to_topic.get(doc["pmcid"])
                            or id_to_topic.get(doc["pmcid"].upper().removeprefix("PMC"))
                            or "unknown")
            doc.pop("_numeric_id", None)
            if not licence_ok(doc):
                skipped.append({"pmcid": doc["pmcid"], "title": doc["title"],
                                "reason": "licence not redistributable",
                                "licence": doc["licence_url"] or doc["licence_text"][:80]})
                continue
            if doc["word_count"] < args.min_words:
                skipped.append({"pmcid": doc["pmcid"], "title": doc["title"],
                                "reason": f"full text too short ({doc['word_count']}w)",
                                "licence": doc["licence_url"]})
                continue
            docs.append(doc)
        done = min(i + args.batch, len(all_ids))
        print(f"  fetched {done}/{len(all_ids)} — kept {len(docs)}, skipped {len(skipped)}")

    # --- 3. write ------------------------------------------------------------
    doc_path = os.path.join(args.out, "documents.jsonl")
    with open(doc_path, "w", encoding="utf-8") as fh:
        for doc in docs:
            fh.write(json.dumps(doc, ensure_ascii=False) + "\n")

    chunk_path = os.path.join(args.out, "chunks.jsonl")
    n_chunks = 0
    with open(chunk_path, "w", encoding="utf-8") as fh:
        for doc in docs:
            for chunk in chunk_document(doc, args.chunk_size, args.chunk_overlap):
                fh.write(json.dumps(chunk, ensure_ascii=False) + "\n")
                n_chunks += 1

    with open(os.path.join(args.out, "manifest.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["pmcid", "year", "topic", "journal", "words", "licence", "title", "url"])
        for d in sorted(docs, key=lambda d: (d["topic"], d["year"])):
            w.writerow([d["pmcid"], d["year"], d["topic"], d["journal"], d["word_count"],
                        d["licence_url"], d["title"], d["url"]])

    if skipped:
        with open(os.path.join(args.out, "skipped.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["pmcid", "reason", "licence", "title"])
            for s in skipped:
                w.writerow([s["pmcid"], s["reason"], s["licence"], s["title"]])

    words = sum(d["word_count"] for d in docs)
    print(f"\n{len(docs)} papers, {words:,} words, {n_chunks:,} chunks")
    print(f"skipped {len(skipped)} (see skipped.csv)")
    print(f"written to {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()

# Luminara chatbot corpus

Real, license-clean, full-text research papers for grounding **Luna**, plus a
dependency-free retrieval index and a corpus-trends tool.

Nothing here is scraped. Every document comes from the **PubMed Central Open
Access subset** via NCBI E-utilities, and carries its licence URL, PMCID, journal
and year — so every answer Luna gives can cite a real, checkable source, and you
can always prove what you are permitted to redistribute.

## Quick start

```bash
python3 research/corpus/fetch_pmc_corpus.py --per-topic 250 --email you@example.com
```

```bash
python3 research/corpus/index_corpus.py build --backend tfidf
```

```bash
python3 research/corpus/index_corpus.py query "does a c-section raise PPD risk?"
```

Set `NCBI_API_KEY` to raise the rate limit from 3 to 10 requests/second
([free from NCBI](https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/)).

## What gets downloaded

20 topic queries spanning the app's actual domain — PPD epidemiology, risk
factors, ML prediction, EPDS validation, screening guidelines, treatment,
perinatal anxiety, postpartum psychosis, maternal suicide risk, social support
and IPV, postpartum sleep, breastfeeding and mood, postpartum thyroiditis,
reproductive hormones and mood, obstetric outcomes, menstrual cycle health, PMDD,
menopause and mood, maternal digital health, and mental-health chatbots.

Each topic tags its documents, so retrieval can be scoped: Luna answering an EPDS
question should not be pulling passages from the menopause literature.

## Files produced (in `corpus/data/`)

| File | Contents |
|---|---|
| `documents.jsonl` | One row per paper: PMCID, DOI, title, journal, year, authors, keywords, licence, abstract, section-split full text |
| `chunks.jsonl` | Retrieval passages (~280 words, 60-word overlap) with citation metadata attached to every chunk |
| `manifest.csv` | Human-readable inventory — grep it, open it in Excel, put it in your thesis appendix |
| `skipped.csv` | Everything rejected **and why** — closed licence or too-short full text |
| `index_tfidf.npz` / `index_dense.npz` | Built by `index_corpus.py` |

Generated data is gitignored. Re-run the fetcher to reproduce it; results shift
slightly over time as PMC adds articles.

## Design decisions worth knowing

**Licence filtering is enforced, not assumed.** Only CC-BY / CC-BY-NC / CC-BY-SA
/ CC0 / public-domain articles are kept. Anything else lands in `skipped.csv`
with its licence recorded, so the exclusion is auditable rather than invisible.

**References, funding and conflict-of-interest sections are dropped.** A
reference list is 40% of a paper's word count and pure noise in an embedding
index — it retrieves on author surnames and journal titles, never on meaning.

**Chunks never straddle a section boundary.** A passage spanning Methods into
Results makes Luna attribute a finding to the wrong context, which in this domain
is a safety problem, not a quality problem.

**Tables and figures are excluded.** JATS tables linearise into unreadable
token soup that scores well on keyword overlap and reads as gibberish.

**Block-aware text flattening.** XML `itertext()` welds adjacent elements
together (`"ABSTRACTAim"`); the parser inserts whitespace at block boundaries.

## Retrieval

`index_corpus.py` has two backends and no third-party dependencies beyond NumPy.

- **`tfidf`** — pure NumPy, hand-rolled sparse CSR, sublinear term weighting.
  Builds in seconds, runs offline, and beats dense retrieval on exact-term
  queries (`"EPDS cut-off 13"`, `"brexanolone"`).
- **`ollama`** — embeddings from the same self-hosted Ollama the chatbot already
  uses (`OLLAMA_BASE_URL`), so no text leaves your infrastructure — consistent
  with Luminara's anonymity stance. Needs `ollama pull nomic-embed-text`.

When both indexes exist, scores are blended (`--alpha`, default 0.65 dense).
Hybrid matters here: dense retrieval alone reliably loses drug names and
numeric cut-offs, which is most of what users actually ask about.

```bash
python3 index_corpus.py query "EPDS cutoff" --topic epds_screening -k 5
python3 index_corpus.py query "can't bond with my baby" --min-year 2020
```

## Spotting trends

```bash
python3 research/corpus/index_corpus.py trends
python3 research/corpus/index_corpus.py trends --topic ppd_risk_factors
```

Shows papers per year, per topic, per journal, and terms whose frequency rose in
2022+ relative to earlier work — a cheap emerging-topic signal.

**Read this as a description of the corpus, not of your users.** It tells you
what the literature covers and where your coverage is thin, so you can find gaps
before Luna hits them in production. Trends in *patient* data are a different
question, answered from the tables in `../synthetic/` and, later, from
`research_submissions`.

## Deploying it (this is wired up and running)

`export_backend_index.py` distils the research corpus into a single 10 MB
gzipped bundle the API server loads at boot:

```bash
python3 research/corpus/export_backend_index.py --per-doc 4
```

It writes `artifacts/api-server/data/corpus-index.json.gz` — 3,781 papers,
14,617 passages, 25,197 terms, loaded in ~135 ms at startup. Ship that one file
with the server; the 508 MB research corpus stays on your machine.

Backend pieces:

| Where | What |
|---|---|
| `src/lib/retrieval.ts` | BM25 search, no vector DB, no new dependencies |
| `src/lib/prompts.ts` | `buildSourceBlock()` renders `[S1] [S2] …` into the system prompt |
| `src/routes/chat.ts` | Retrieves per turn, returns structured `sources[]` alongside the reply |
| `GET /api/corpus/stats` | Confirms a deploy actually shipped the index |
| `GET /api/corpus/search?q=…` | Retrieval without the LLM — shows whether a bad answer is retrieval or generation |
| `pnpm run verify:retrieval` | 7 assertions over known queries; exits non-zero, so it can gate a deploy |

Env: `LUMINARA_CORPUS_PATH` to relocate the bundle, `LUMINARA_RETRIEVAL=off` to
disable. A missing bundle logs a warning and serves ungrounded chat — a deploy
without the data file still boots.

Design points worth keeping:

- **The crisis path runs ahead of retrieval.** A message matching the crisis
  detector skips retrieval entirely and gets fixed resource text prepended.
- **Retrieval failure never fails the request.** An ungrounded reply is degraded;
  a 500 is broken.
- **Sources are returned as structured data**, not parsed out of the model's
  prose, so the client renders real PMCID links rather than tags the model may
  have invented.
- **Title terms are indexed at 3× weight.** Body-only indexing ranked a ketamine
  trial above the actual EPDS validation paper for "EPDS cut-off".
- **A Lucene-style coordination factor was tried and reverted** — it measurably
  hurt precise queries without helping conversational ones.

### Known retrieval limits

Ranking is strong on topical and keyword queries ("EPDS cut-off", "postpartum
psychosis", "repeat caesarean and PPD") and **weaker on long conversational
messages**, where filler terms dilute the signal and the best paper can land 4th
or 5th instead of 1st. Two consequences to keep in mind: the model sometimes
cites a plausible neighbouring source rather than the most on-point one, and
medication-safety questions can surface low-evidence sources (a homeopathy case
report ranks highly for "is sertraline safe while breastfeeding"). The system
prompt forbids turning any study finding into treatment advice, but this is a
mitigation, not a fix — an evidence-quality signal in ranking is the real
answer, and it is not built.

Two things retrieval does not fix: research literature reports population
averages, and Luna must never restate one as a statement about the individual
user; and a retrieved passage is evidence about a study, not clinical advice for
a specific person. Both belong in the system prompt as explicit constraints.

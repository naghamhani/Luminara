# Luminara — Data Strategy for the Chatbot and the Predictive Model

Scope: the two AI components in this repo — **Luna**, the grounded conversational
assistant (`artifacts/api-server/src/lib/ollama.ts`, `prompts.ts`), and the
**PPD risk model** (`artifacts/api-server/src/lib/ppdModel.ts`). Both are anchored
to the data the app actually collects: `PpdFeatures`, and the `AnonymizedBundle`
produced by `artifacts/mobile/utils/anonymize.ts`.

---

## 1. External data discovery & literature review

### 1.1 The anchor result

The framing already in the codebase is the right one. Mass General Brigham's 2024
PPD model showed that routine peripartum record data identifies elevated-risk
patients well, with **prenatal EPDS providing the largest single lift**. The
closest published, reproducible analogue is the UK CPRD study of **266,544 women**,
which reports **AUC 0.805 from EHR features alone, rising to 0.844 once the EPDS
score is added** — the two numbers to benchmark against.
([Estimation of PPD risk from EHR, 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8447665/))

Supporting evidence, all consistent with the app's current feature list:

| Study | Cohort | Best result | Why it matters here |
|---|---|---|---|
| [Predicting depressive symptoms postpartum with ML](https://www.nature.com/articles/s41598-021-86368-y) (Sci Rep 2021) | BASIC, Sweden | AUC 0.79, acc 72% (Extremely Randomized Trees) | Rich psychometric + journal variables; validates a *screening*, not diagnostic, framing |
| [ML models for PPD prediction, cohort study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7226048/) (JMIR 2020) | Prospective cohort | Comparison across model families | Establishes that tree ensembles ≈ logistic regression at this signal level |
| [Multiple ML models for PPD](https://link.springer.com/article/10.1186/s12967-025-06289-6) (J Transl Med 2025) | Multi-site | Model dev + external validation | Current template for reporting/validation structure |
| [Predictive analysis of PPD using ML](https://pmc.ncbi.nlm.nih.gov/articles/PMC12026879/) (Healthcare 2025) | K-ECEC-P panel (public) | RF 77.0%, AdaBoost 76.9%, LR 75.5% | Demonstrates a **public panel dataset** route |
| [Predicting women with PPD symptoms](https://www.mdpi.com/2227-7390/10/23/4570) (Mathematics 2022) | Survey data | Classifier comparison | Feature-importance rankings map onto `PpdFeatures` |

**Practical takeaway:** an AUC in the **0.78–0.85** band is the honest target.
Anything materially above it on your own data is a leakage signal, not a win.

### 1.2 Unstructured corpora for the chatbot

Luna should be **retrieval-grounded, not fine-tuned on patient text.** Fine-tuning a
local Llama on clinical content risks memorised, unattributable claims in a domain
where a wrong sentence is a safety incident. Build a RAG index instead, and reserve
fine-tuning for *tone and refusal behaviour* only.

**Tier A — clinical ground truth (RAG corpus; authoritative, freely redistributable):**
- NICE CG192 *Antenatal and postnatal mental health* — the strongest single guideline for this app.
- ACOG Committee Opinion 757 / Clinical Practice Guideline on perinatal mental health screening.
- WHO *Thinking Healthy* manual + WHO maternal mental health guidance.
- CDC *Hear Her* campaign materials and PRAMS documentation (urgent-maternal-warning-signs list — directly reusable for Luna's escalation rules).
- MedlinePlus / NIH consumer health pages (plain-language register, close to the tone you want).
- PubMed Central **Open Access subset** filtered to perinatal mental health — licence-clean full text, unlike general PubMed.

**Tier B — conversational style and empathy (tone tuning / few-shot exemplars):**
- [MentalChat16K](https://github.com/PennShenLab/MentalChat16K) — 16,113 QA pairs (9.7K synthetic + 6.3K real PISCES trial transcripts), purpose-built for evaluating conversational mental-health assistants. The best available style anchor.
- **CounselChat** — ~3.6K therapist answers to real questions; licence is scrape-derived, so treat as style reference, not redistributable training data.
- **ESConv** (Emotional Support Conversation) — annotated support strategies; useful as a *strategy taxonomy* for Luna's response planning.
- **EmpatheticDialogues** (Facebook AI) — general empathetic register, CC-licensed.

**Tier C — lived-experience language (vocabulary only, never verbatim):**
Public perinatal forum text (r/beyondthebump, r/Mommit, BabyCenter). Value is
*how women phrase symptoms* — "I don't feel like myself", "I can't put him down".
Use it to build query-expansion synonyms for retrieval. Do **not** ingest posts into
the index: consent is absent and re-identification risk is real.

### 1.2b What is actually on disk

The Tier A corpus is **built, not just cited** — see [`corpus/`](corpus/README.md).
`corpus/fetch_pmc_corpus.py` pulled the PubMed Central Open Access subset across
20 domain queries:

| | |
|---|---|
| Papers | **3,800** full-text, licence-clean |
| Words | **18.3 million** |
| Retrieval passages | **95,573** |
| Rejected (closed licence / too short) | 275, logged in `skipped.csv` |
| Top journals | BMC Pregnancy & Childbirth (292), BMC Psychiatry (174), IJERPH (128), PLoS ONE (125), BMJ Open (107), Archives of Women's Mental Health (99) |
| Coverage | 110 papers on PPD prediction/ML, 238 PPD epidemiology, 221 EPDS validation, 208 treatment, 177 maternal suicide/self-harm, 156 postpartum psychosis |

Every document keeps its PMCID, licence URL and journal, so Luna can cite sources
and you can prove redistribution rights. `corpus/index_corpus.py` builds the
retrieval index (pure NumPy TF-IDF, or Ollama embeddings for semantic search) and
has a `trends` mode for corpus-level analysis.

**Explicitly out of scope:** MIMIC-IV / MIMIC-IV-Note. Credentialed access forbids
sending the data to an LLM without a specific DUA amendment, and its obstetric
coverage is thin anyway.

### 1.3 Safety layer (non-negotiable, and cheap)
Ground Luna's crisis path in fixed, non-generated text: 988 Suicide & Crisis Lifeline,
Postpartum Support International (1-800-944-4773), and a locale-configurable
equivalent. Every EPDS item-10 (self-harm) positive must bypass the LLM entirely.

---

## 2. Tabular prediction data strategy

### 2.1 Existing public datasets — and their real limits

| Source | Access | Feature overlap with `PpdFeatures` | Verdict |
|---|---|---|---|
| [Kaggle "PostPartum Depression"](https://www.kaggle.com/datasets/parvezalmuqtadir2348/postpartum-depression) (1,503 respondents) | Open | Symptom items (sadness, irritability, sleep, concentration, appetite, guilt, bonding, self-harm) ≈ EPDS constructs | **Best immediate smoke-test.** Symptom-level, not risk-factor-level. Small, single-site, unclear provenance. Use for pipeline shakedown only. |
| **PRAMS** (CDC, 40+ US jurisdictions) | Public + restricted tiers | Delivery mode, preterm, NICU, unintended pregnancy, IPV, financial strain, social support, postpartum depressive symptoms | **Highest-value real data.** Closest match to your feature set at population scale. |
| **K-ECEC-P** (Korean panel, used in Healthcare 2025) | Public on request | Longitudinal maternal mood + socioeconomic | Good external-validity check; different population. |
| **NHANES / DHS (Demographic & Health Surveys)** | Open | Demographics + EPDS-adjacent items in some rounds | Useful for calibrating *marginal prevalences*, not for training. |
| **UK CPRD** | Licensed, fee | Near-complete overlap; this is the 266K-women source | The gold standard, but licensing + cost + IRB put it beyond an app-stage project. |

**Honest conclusion:** no open dataset covers your full 22-feature vector *and*
carries a 6-month PPD outcome label. Nothing here substitutes for your own
consented research pipeline. The plan below is therefore three-phase, not
"download a dataset".

### 2.2 The three-phase plan

**Phase 1 — synthetic (now).** Generate literature-calibrated data (§3) to build and
test the whole pipeline: schema, ingestion, training code, calibration plots,
fairness slices, dashboards. Nothing about this phase requires real users.
*Ship the plumbing before the data exists.*

**Phase 2 — public anchoring (next).** Pull PRAMS microdata and refit the subset of
coefficients its variables cover. This converts hand-set betas into
partially empirical ones and gives a defensible external reference. Keep the
literature priors for the features PRAMS lacks.

**Phase 3 — recalibration on real consented data (ongoing).** The `ppd_assessments`
table already stores the full feature vector alongside the outcome-relevant score,
by design. Once you have roughly **10 events per predictor** — ~220 confirmed PPD
cases at a 13% base rate, so on the order of **1,700 consented participants with
follow-up** — refit and bump `MODEL_VERSION`. Below that threshold, do not refit;
shrink toward the literature priors instead.

### 2.3 Synthesis methodology (why the generator is built the way it is)

The generator is **not** a resampling of the app's own scoring function — that would
produce a dataset on which the model is trivially perfect and learns nothing.
Instead it uses a **latent-variable structural model**:

1. **Correlated risk factors.** Prevalences from the literature, then conditional
   dependencies imposed: prior PPD implies prior depression and requires multiparity;
   preterm birth and multiples drive NICU admission; NICU drives infant health problems
   and breastfeeding difficulty; psychiatric medication is conditional on a psychiatric history.
2. **A latent depression propensity** = weighted sum of factors, **plus interactions the
   additive app model structurally cannot represent** (low support × financial strain;
   depression history × severe sleep deprivation), **plus N(0, 0.85) unobserved
   heterogeneity** standing in for genetics, culture, and care quality.
3. **EPDS as a noisy measurement** of that latent state, through a logistic link that
   reproduces the scale's right skew and floor at 0, with measurement error σ = 3.4.
   EPDS is therefore *strongly predictive but not deterministic* — exactly its real behaviour.
4. **Outcome** drawn from the latent propensity, with the intercept solved numerically
   so the base rate lands on a target 13%. Adding or reweighting a factor can never
   silently shift the prevalence.
5. **MAR missingness** on optional fields, scaled with postpartum week, because
   engagement decays and real app users skip questions.

**Validation — the generated data reproduces the published benchmarks:**

| Metric | Synthetic (n=5,000) | Literature |
|---|---|---|
| PPD prevalence | 13.0% | 10–15% (CDC/WHO) |
| EPDS ≥ 13 | 11.8% | 10–20% |
| AUC, EPDS alone | 0.743 | ~0.72–0.76 |
| AUC, full feature logistic fit | **0.802** | **0.805** (CPRD, EHR-only) |
| AUC ceiling (true propensity) | 0.840 | **0.844** (CPRD, EHR + EPDS) |

The irreducible-noise ceiling matching the published EHR+EPDS AUC is the key
property: a model that scores 0.95 on this data has a bug.

### 2.4 Limits you must state in any write-up
Synthetic data can only reproduce the structure you encoded. It will **not** surface
an unknown risk factor, and it cannot support a fairness audit — the demographic
disparities in real PPD outcomes are not in the generative process, and inventing
them would be worse than omitting them. Use it for engineering and for statistical
power planning. Never quote a synthetic AUC as evidence the app works.

---

## 3. Synthetic dataset schema & generator

Generator: [`synthetic/generate_synthetic_ppd.py`](synthetic/generate_synthetic_ppd.py)
(NumPy + Pandas, no other dependencies).

```bash
python3 research/synthetic/generate_synthetic_ppd.py --n 5000 --seed 42 --out research/synthetic/out
```

Three CSVs are written, one per collection the app actually gathers.

### 3.1 `participants.csv` — mirrors `PpdFeatures` + label

| Column | Type | Distribution / values | Notes |
|---|---|---|---|
| `participantPseudonym` | string | `P000000`… | Anonymous key, matches the app's pseudonym design |
| `postpartumWeeksAtDayZero` | int | Gamma(2, 7), 0–104 | Coarse week count, as in `AnonymizedBundle` |
| `ageYears` | int | N(29.5, 5.4), clipped 15–46 | 5% missing |
| `epdsScore` | int | 0–30, logistic-linked to latent + N(0, 3.4) | **Dominant predictor.** 18% missing |
| `epdsIsPrenatal` | bool | Bernoulli(0.55) | Prenatal screens weight higher |
| `historyOfDepression` | bool | 0.20 | Forced to 1 when prior PPD = 1 |
| `historyOfAnxiety` | bool | 0.22 → 0.55 given depression | Comorbidity encoded |
| `priorPostpartumDepression` | bool | 0.12 among multiparous, else 0 | Strongest binary factor (β 1.20) |
| `historyOfBipolar` | bool | 0.02 | 12% missing |
| `currentlyOnPsychiatricMedication` | bool | 0.30 given psych history, else 0.01 | |
| `firstPregnancy` | bool | 0.41 (0.68 if age < 24) | |
| `unintendedPregnancy` | bool | 0.30 | 15% missing |
| `lowSocialSupport` | bool | 0.18 | Interacts with financial strain |
| `financialStrain` | bool | 0.25 | |
| `intimatePartnerViolence` | bool | 0.06 | 22% missing — sensitive, under-disclosed |
| `recentStressfulLifeEvent` | bool | 0.28 | |
| `pregnancyComplications` | bool | 0.22 | |
| `cesareanDelivery` | bool | 0.32 | |
| `pretermBirth` | bool | 0.10 | |
| `multiplePregnancy` | bool | 0.03 | |
| `nicuAdmission` | bool | 0.04 + 0.45·preterm + 0.25·multiples | Derived, not independent |
| `infantHealthProblems` | bool | 0.06 + 0.35·NICU + 0.10·preterm | Derived |
| `breastfeedingDifficulty` | bool | 0.28 + 0.25·preterm + 0.15·cesarean | Derived |
| `severeSleepDeprivation` | bool | 0.30 | Interacts with depression history |
| `_true_probability` | float | 0–1 | **Oracle. Drop before training** — for calibration study only |
| `ppd_within_6mo` | **target** | Bernoulli, 13% positive | Binary label |

**Sample (12 rows, abridged columns):**

| participantPseudonym | ageYears | epdsScore | epdsIsPrenatal | historyOfDepression | priorPostpartumDepression | lowSocialSupport | financialStrain | cesareanDelivery | nicuAdmission | severeSleepDeprivation | ppd_within_6mo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P000000 | 31 | 10 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 |
| P000001 | 24 | 3 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| P000002 | 34 | 5 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| P000003 | 35 | 2 | 1 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |
| P000004 |  | 9 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| P000005 | 22 |  | 0 | 1 | 0 | 0 |  | 1 | 0 | 1 | 0 |
| P000006 | 30 | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| P000007 | 28 | 5 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 |
| P000008 | 29 | 5 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |
| P000009 | 25 | 1 | 1 | 0 | 0 |  | 1 | 1 | 0 | 1 | 0 |
| P000010 | 34 |  | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| P000011 | 34 |  | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 |

(Blank cells are genuine MAR missingness, not generation errors.)

### 3.2 `checkins.csv` — mirrors `AnonymizedBundle.checkIns`

One row per participant-day. Logging cadence is itself Gamma-distributed (median
~18 days of ~90), because engagement is heterogeneous and dropout is informative.
Ratings track the participant's latent severity plus a slow per-participant trend
(recovery or deterioration). `riskScore` is computed with an exact port of
`computeRiskScore` from `artifacts/mobile/context/AppContext.tsx`, so the column is
consistent with what the app itself would have written.

| Column | Type | Range |
|---|---|---|
| `participantPseudonym` | string | FK to participants |
| `dayOffset` | int | 0–89, relative to day 0 — never an absolute date |
| `mood` | int | 1–5, centred 4.2 − 2.2·severity |
| `sleep` | float | hours, 0–12, half-hour resolution |
| `anxiety` | int | 1–5, centred 1.9 + 2.2·severity |
| `appetite` / `bonding` / `support` | int | 1–5 |
| `riskScore` | int | 0–100, exact port of the app's formula |

| participantPseudonym | dayOffset | mood | sleep | anxiety | appetite | bonding | support | riskScore |
|---|---|---|---|---|---|---|---|---|
| P000000 | 8 | 4 | 2.5 | 2 | 3 | 3 | 4 | 36 |
| P000000 | 14 | 5 | 6.5 | 1 | 3 | 5 | 3 | 10 |
| P000000 | 15 | 5 | 6.0 | 2 | 4 | 5 | 3 | 14 |
| P000000 | 16 | 3 | 5.5 | 1 | 4 | 4 | 3 | 26 |
| P000000 | 19 | 5 | 8.0 | 2 | 5 | 4 | 4 | 12 |
| P000000 | 21 | 4 | 7.0 | 1 | 4 | 5 | 5 | 9 |
| P000000 | 26 | 3 | 5.5 | 3 | 4 | 5 | 4 | 32 |
| P000000 | 29 | 4 | 4.5 | 3 | 5 | 4 | 3 | 31 |
| P000000 | 37 | 4 | 3.0 | 2 | 4 | 4 | 5 | 26 |
| P000000 | 41 | 5 | 5.0 | 2 | 4 | 5 | 2 | 19 |

### 3.3 `partner_observations.csv` — mirrors `AnonymizedBundle.partnerObservations`

Present for ~35% of participants (partner-portal enrolment). Ratings are
deliberately **attenuated and biased upward** relative to the participant's own —
partners systematically under-detect distress, and a model trained on partner data
that ignores this will be over-optimistic. Columns: `dayOffset`, `mood`, `energy`,
`sleepQuality`, `overallWellbeing` (all 1–5), `stressFactorCount` and
`supportActivityCount` (0–8 counts, matching the app's controlled vocabularies).

### 3.4 The two components, side by side

| | Chatbot (Luna) | Predictive model |
|---|---|---|
| Data | 3,800 real OA papers, 18.3M words (`corpus/`) | Synthetic tabular, literature-calibrated (`synthetic/`) |
| Status | **Downloaded and indexed** | **Generated and validated** |
| Method | Retrieval-grounded, no fine-tuning on clinical text | Logistic baseline, refit on real data at Phase 3 |
| Ceiling | Answer quality bounded by the corpus | AUC ~0.80–0.84 |

### 3.5 Suggested next step

Train on `participants.csv` with `_true_probability` dropped, group-split by
`participantPseudonym`, and confirm you land near AUC 0.80. Then add
aggregate check-in features (mean/slope of `riskScore` over the first 14 days) and
verify the lift is modest — if it is large, the aggregation is leaking the label.

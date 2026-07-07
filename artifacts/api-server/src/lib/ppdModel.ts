/**
 * Postpartum-depression (PPD) risk model — transparent, literature-calibrated.
 * ============================================================================
 *
 * Inspired by the Mass General Brigham machine-learning PPD model
 * (https://www.massgeneralbrigham.org/en/about/newsroom/press-releases/
 *  machine-learning-model-helps-identify-patients-at-risk-of-postpartum-depression,
 *  Feb 2024), which showed that a model built from information routinely
 *  available in the medical record around delivery — demographics, medical /
 *  psychiatric history, and especially *prenatal* Edinburgh Postnatal
 *  Depression Scale (EPDS) scores — can identify patients at elevated PPD risk
 *  roughly 2–3x better than population base-rate alone, with a high negative
 *  predictive value (good at ruling PPD *out*).
 *
 * The MGB model itself is proprietary and not published. This module is an
 * INDEPENDENT, fully transparent re-implementation of the same *idea*: a
 * logistic-regression risk score whose coefficients are hand-set from the
 * published PPD risk-factor literature (EPDS being by far the largest term,
 * mirroring the paper's key finding). It is:
 *
 *   - NOT the MGB model, and NOT validated against their cohort;
 *   - NOT a diagnosis and NOT a substitute for clinical screening;
 *   - deterministic and inspectable (same input -> same output), so every
 *     score can be explained by its per-feature contributions.
 *
 * The design intent is that, as anonymized data accumulates on the backend
 * (see research_submissions / ppd_assessments tables), these coefficients can
 * be re-fit from real outcomes and the MODEL_VERSION bumped.
 */

export const MODEL_VERSION = "ppd-logit-1.0.0";

/**
 * De-identified model inputs. Everything here is a number or boolean — there
 * is deliberately no free text and no PII, so a feature vector is safe to
 * persist in the research dataset.
 */
export interface PpdFeatures {
  /** Edinburgh Postnatal Depression Scale total, 0–30. Prenatal preferred. */
  epdsScore?: number;
  /** Whether the EPDS was taken prenatally (adds predictive weight per paper). */
  epdsIsPrenatal?: boolean;

  // Psychiatric history ----------------------------------------------------
  historyOfDepression?: boolean;
  historyOfAnxiety?: boolean;
  priorPostpartumDepression?: boolean;
  historyOfBipolar?: boolean;
  currentlyOnPsychiatricMedication?: boolean;

  // Demographic / social ----------------------------------------------------
  ageYears?: number;
  firstPregnancy?: boolean;
  unintendedPregnancy?: boolean;
  lowSocialSupport?: boolean;
  financialStrain?: boolean;
  intimatePartnerViolence?: boolean;
  recentStressfulLifeEvent?: boolean;

  // Obstetric / delivery ----------------------------------------------------
  pregnancyComplications?: boolean; // e.g. preeclampsia, gestational diabetes
  cesareanDelivery?: boolean;
  pretermBirth?: boolean;
  multiplePregnancy?: boolean; // twins/triplets
  nicuAdmission?: boolean;
  infantHealthProblems?: boolean;

  // Postpartum context ------------------------------------------------------
  breastfeedingDifficulty?: boolean;
  severeSleepDeprivation?: boolean;
}

interface Term {
  key: keyof PpdFeatures;
  label: string;
  /** log-odds contribution per unit (booleans are treated as 0/1). */
  beta: number;
  /** Maps the raw feature to a modelled numeric value. */
  value: (f: PpdFeatures) => number;
}

const bool = (v: boolean | undefined): number => (v ? 1 : 0);

/**
 * Baseline log-odds. Population PPD prevalence is ~13%, so an all-negative,
 * no-EPDS profile should land near that base rate.
 *   logit(0.12) = ln(0.12 / 0.88) ≈ -1.99
 */
const INTERCEPT = -1.99;

/**
 * Coefficients (log-odds). Magnitudes reflect the relative strength of each
 * factor in the PPD literature; EPDS dominates, consistent with the MGB paper.
 */
const TERMS: Term[] = [
  {
    key: "epdsScore",
    label: "Prenatal mood screening (EPDS)",
    // ~0.16 per point: an EPDS of 13 (common "probable depression" cut-off)
    // adds ~+2.1 log-odds; a prenatal screen is weighted slightly higher.
    beta: 0.16,
    value: (f) => {
      const s = clamp(f.epdsScore ?? 0, 0, 30);
      return s * (f.epdsIsPrenatal ? 1.15 : 1);
    },
  },
  { key: "priorPostpartumDepression", label: "Prior postpartum depression", beta: 1.1, value: (f) => bool(f.priorPostpartumDepression) },
  { key: "historyOfDepression", label: "History of depression", beta: 0.9, value: (f) => bool(f.historyOfDepression) },
  { key: "historyOfBipolar", label: "History of bipolar disorder", beta: 0.75, value: (f) => bool(f.historyOfBipolar) },
  { key: "intimatePartnerViolence", label: "Intimate partner violence", beta: 0.9, value: (f) => bool(f.intimatePartnerViolence) },
  { key: "lowSocialSupport", label: "Low social support", beta: 0.7, value: (f) => bool(f.lowSocialSupport) },
  { key: "historyOfAnxiety", label: "History of anxiety", beta: 0.6, value: (f) => bool(f.historyOfAnxiety) },
  { key: "financialStrain", label: "Financial strain", beta: 0.5, value: (f) => bool(f.financialStrain) },
  { key: "recentStressfulLifeEvent", label: "Recent stressful life event", beta: 0.45, value: (f) => bool(f.recentStressfulLifeEvent) },
  { key: "severeSleepDeprivation", label: "Severe sleep deprivation", beta: 0.45, value: (f) => bool(f.severeSleepDeprivation) },
  { key: "nicuAdmission", label: "Infant NICU admission", beta: 0.4, value: (f) => bool(f.nicuAdmission) },
  { key: "unintendedPregnancy", label: "Unintended pregnancy", beta: 0.4, value: (f) => bool(f.unintendedPregnancy) },
  { key: "currentlyOnPsychiatricMedication", label: "Current psychiatric medication", beta: 0.35, value: (f) => bool(f.currentlyOnPsychiatricMedication) },
  { key: "pretermBirth", label: "Preterm birth", beta: 0.35, value: (f) => bool(f.pretermBirth) },
  { key: "breastfeedingDifficulty", label: "Breastfeeding difficulty", beta: 0.3, value: (f) => bool(f.breastfeedingDifficulty) },
  { key: "infantHealthProblems", label: "Infant health problems", beta: 0.3, value: (f) => bool(f.infantHealthProblems) },
  { key: "pregnancyComplications", label: "Pregnancy complications", beta: 0.3, value: (f) => bool(f.pregnancyComplications) },
  { key: "multiplePregnancy", label: "Multiple pregnancy (twins+)", beta: 0.2, value: (f) => bool(f.multiplePregnancy) },
  { key: "cesareanDelivery", label: "Cesarean delivery", beta: 0.15, value: (f) => bool(f.cesareanDelivery) },
  { key: "firstPregnancy", label: "First pregnancy", beta: 0.15, value: (f) => bool(f.firstPregnancy) },
  {
    key: "ageYears",
    label: "Younger maternal age",
    // Younger age carries modestly higher risk; encode as a 0/1 "under 20"
    // style ramp rather than a linear age term.
    beta: 0.5,
    value: (f) => {
      const age = f.ageYears;
      if (age === undefined) return 0;
      if (age <= 18) return 1;
      if (age >= 25) return 0;
      return (25 - age) / 7; // linear ramp 25 -> 18
    },
  },
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export type RiskTier = "low" | "moderate" | "high";

export interface RiskContribution {
  key: string;
  label: string;
  /** Share of the total positive log-odds contributed by this factor (0–1). */
  share: number;
  /** Raw log-odds contribution (beta * value). */
  logOdds: number;
}

export interface PpdRiskResult {
  modelVersion: string;
  /** Estimated probability of PPD within ~6 months, 0–1. */
  probability: number;
  /** 0–100, same orientation as the app's wellness score (higher = more risk). */
  riskScore: number;
  tier: RiskTier;
  /** Baseline population probability the estimate is compared against. */
  baselineProbability: number;
  /** How many times the population base rate this estimate represents. */
  relativeRisk: number;
  /** Ranked non-zero contributors (most influential first). */
  topContributors: RiskContribution[];
  /** Plain-language, non-diagnostic framing (mirrors the paper's NPV/PPV language). */
  interpretation: string;
  disclaimer: string;
}

// Tier cut-offs. Calibrated so the "high" band corresponds to the ~30% PPV
// region the paper reports for its high-risk group, and "low" to the high-NPV
// (good at ruling out) region.
const LOW_MAX = 0.15;
const HIGH_MIN = 0.35;
const BASELINE = 0.12;

function tierFor(p: number): RiskTier {
  if (p < LOW_MAX) return "low";
  if (p < HIGH_MIN) return "moderate";
  return "high";
}

function interpretationFor(tier: RiskTier, relativeRisk: number): string {
  switch (tier) {
    case "low":
      return (
        "This screen places you in a lower-risk range. Models like this are best " +
        "at ruling postpartum depression *out* — a low result is reassuring, but it " +
        "is not a guarantee, and it's still worth mentioning any changes in mood to " +
        "your provider."
      );
    case "moderate":
      return (
        `This screen places you in an intermediate range — roughly ${relativeRisk.toFixed(1)}x ` +
        "the general population rate. Many people in this range never develop PPD, but " +
        "it's a good moment to line up extra support and keep checking in."
      );
    case "high":
      return (
        `This screen places you in a higher-risk range — roughly ${relativeRisk.toFixed(1)}x ` +
        "the general population rate. In research cohorts, a meaningful share of people " +
        "flagged this way go on to experience PPD. This is not a diagnosis, but it is a " +
        "strong signal to talk with a healthcare provider soon about a fuller assessment " +
        "and support options."
      );
  }
}

const DISCLAIMER =
  "Luminara's PPD risk estimate is a transparent, research-calibrated screening " +
  "aid — not the proprietary Mass General Brigham model, and not a medical " +
  "diagnosis. Only a qualified clinician can diagnose postpartum depression. If " +
  "you are having thoughts of harming yourself or your baby, contact emergency " +
  "services or a crisis line immediately.";

/**
 * Score a de-identified feature vector. Pure and deterministic.
 */
export function scorePpdRisk(features: PpdFeatures): PpdRiskResult {
  let logit = INTERCEPT;
  const rawContribs: { key: string; label: string; logOdds: number }[] = [];

  for (const term of TERMS) {
    const contribution = term.beta * term.value(features);
    logit += contribution;
    if (contribution > 0) {
      rawContribs.push({ key: term.key, label: term.label, logOdds: contribution });
    }
  }

  const probability = sigmoid(logit);
  const tier = tierFor(probability);
  const relativeRisk = probability / BASELINE;

  const totalPositive = rawContribs.reduce((s, c) => s + c.logOdds, 0);
  const topContributors: RiskContribution[] = rawContribs
    .sort((a, b) => b.logOdds - a.logOdds)
    .slice(0, 5)
    .map((c) => ({
      key: c.key,
      label: c.label,
      logOdds: round(c.logOdds, 3),
      share: totalPositive > 0 ? round(c.logOdds / totalPositive, 3) : 0,
    }));

  return {
    modelVersion: MODEL_VERSION,
    probability: round(probability, 4),
    riskScore: Math.round(probability * 100),
    tier,
    baselineProbability: BASELINE,
    relativeRisk: round(relativeRisk, 2),
    topContributors,
    interpretation: interpretationFor(tier, relativeRisk),
    disclaimer: DISCLAIMER,
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// EPDS helper
// ---------------------------------------------------------------------------

/**
 * The Edinburgh Postnatal Depression Scale is 10 items, each scored 0–3, for a
 * 0–30 total. Item 10 ("thoughts of harming myself") is the self-harm item —
 * any non-zero response should trigger a crisis-support prompt regardless of
 * the total. This helper validates and sums a raw response array.
 */
export function scoreEpds(responses: number[]): {
  total: number;
  selfHarmFlag: boolean;
} {
  if (responses.length !== 10) {
    throw new Error("EPDS requires exactly 10 item responses (0–3 each).");
  }
  let total = 0;
  for (const r of responses) {
    if (!Number.isInteger(r) || r < 0 || r > 3) {
      throw new Error("Each EPDS response must be an integer 0–3.");
    }
    total += r;
  }
  return { total, selfHarmFlag: (responses[9] ?? 0) > 0 };
}

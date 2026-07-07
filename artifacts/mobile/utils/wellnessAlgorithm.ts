import type { CheckIn } from "@/context/AppContext";
import { calculateRiskScore } from "@/context/AppContext";
import {
  addDays,
  daysBetween,
  toDateString,
  type CoreFactors,
  type CycleEntry,
  type FlowLevel,
  type LabMarker,
  type Medication,
  type PartnerCorrelation,
  type PartnerObservation,
  type Recommendation,
  type ReproductivePhase,
  type RiskWindow,
  type WellnessContribution,
  type WellnessInput,
  type WellnessResult,
} from "@/types/health";
import type { CyclePrediction } from "@/types/health";

/**
 * Reproductive wellness algorithm — heuristic model, not a diagnostic tool.
 *
 * This module is a pure, side-effect-free heuristic layer on top of the raw
 * health data. It does NOT make medical diagnoses and none of its outputs
 * should be presented to users as clinical fact — always pair phase/score/
 * recommendation output with a gentle disclaimer to review with a healthcare
 * provider. Everything here is deterministic (same input -> same output) so
 * it is easy to test and reason about.
 *
 * ---------------------------------------------------------------------------
 * Model summary
 * ---------------------------------------------------------------------------
 *
 * calculateWellnessScore extends the legacy 6-factor PPD risk model
 * (mood .27, anxiety .25, sleep .15, appetite .10, bonding .13, support .10 —
 * see calculateRiskScore in context/AppContext.tsx) with three optional
 * weighted terms so the two stay compatible when only check-in factors are
 * supplied:
 *   - labs      weight .08  (share of hormone/thyroid/blood markers flagged)
 *   - partner   weight .10  (inverted partner-rated mood/wellbeing average)
 *   - symptoms  weight .05  (breadth of recently logged cycle symptoms)
 * All present weights are renormalized to sum to 1 before combining, so the
 * six base terms alone reproduce calculateRiskScore's output (±3 pts). A
 * small additive phase modifier (luteal +4, menstrual +3, postpartum +2,
 * otherwise 0) is applied after weighting, then the score is clamped 0-100.
 * Risk level thresholds are unchanged from the legacy app: <=35 low,
 * <=65 moderate, else high.
 *
 * detectPhase / predictCycle implement a standard calendar + fertility-sign
 * cycle model (period-start detection via flow runs, ovulation estimated as
 * next-period-minus-14 and refined by ovulation tests / BBT shift, cycle
 * length confidence graded by sample count + variance).
 *
 * predictRiskWindows and correlateWithPartner surface simple descriptive
 * statistics (weekday deltas, matched-day averages) — they flag patterns for
 * the user's own reflection, not predictions of clinical outcomes.
 */

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  const variance = avg(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function isFlowActive(flow: FlowLevel | undefined): boolean {
  return flow === "light" || flow === "medium" || flow === "heavy";
}

function todayOr(today?: string): string {
  return today ?? toDateString(new Date());
}

/** Sort a copy of cycle entries ascending by date (oldest first). */
function ascByDate(entries: CycleEntry[]): CycleEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Period-start detection (shared by detectPhase & predictCycle)
// ---------------------------------------------------------------------------

interface PeriodRun {
  /** YYYY-MM-DD of the first flow day in the run. */
  start: string;
  /** YYYY-MM-DD of the last consecutive flow day in the run. */
  end: string;
  /** Number of consecutive flow days. */
  length: number;
}

/**
 * Find "period starts": the first day of a run of flow>=light entries that
 * follows a gap of at least 2 days since the previous flow day (or is the
 * very first flow entry on record).
 */
function findPeriodRuns(entries: CycleEntry[]): PeriodRun[] {
  const flowDays = ascByDate(entries)
    .filter((e) => isFlowActive(e.flow))
    .map((e) => e.date);

  if (flowDays.length === 0) return [];

  const runs: PeriodRun[] = [];
  let runStart = flowDays[0];
  let runEnd = flowDays[0];
  let runLength = 1;

  for (let i = 1; i < flowDays.length; i++) {
    const prev = flowDays[i - 1];
    const cur = flowDays[i];
    const gap = daysBetween(prev, cur);
    if (gap <= 1) {
      // consecutive (or same-day duplicate) flow day — extend current run
      runEnd = cur;
      if (gap === 1) runLength += 1;
    } else {
      // gap of 2+ days => previous run closes, new run begins
      runs.push({ start: runStart, end: runEnd, length: runLength });
      runStart = cur;
      runEnd = cur;
      runLength = 1;
    }
  }
  runs.push({ start: runStart, end: runEnd, length: runLength });

  return runs;
}

// ---------------------------------------------------------------------------
// detectPhase
// ---------------------------------------------------------------------------

export function detectPhase(args: {
  birthDate?: string | null;
  cycleEntries: CycleEntry[];
  today?: string;
}): ReproductivePhase {
  const today = todayOr(args.today);
  const entries = ascByDate(args.cycleEntries);

  // --- Postpartum: birthDate within last 9 months (~274 days) and no
  // flow>=light entries after it. Checked BEFORE the pregnancy signal so
  // that a birthDate on/before `today` (baby already born) always takes
  // precedence over a stale/older positive pregnancy test — otherwise
  // someone who has since given birth would keep showing as "pregnant".
  // ----------------------------------------------------------------------
  if (args.birthDate) {
    const daysSinceBirth = daysBetween(args.birthDate, today);
    if (daysSinceBirth >= 0 && daysSinceBirth <= 274) {
      const flowAfterBirth = entries.some(
        (e) => isFlowActive(e.flow) && e.date >= args.birthDate!
      );
      if (!flowAfterBirth) {
        return "postpartum";
      }
    }
  }

  // --- Pregnancy: positive pregnancy test within last 280 days with no
  // flow entry (light/medium/heavy) after it. ---------------------------
  const positiveTests = entries.filter(
    (e) => e.pregnancyTest === "positive" && daysBetween(e.date, today) <= 280 && daysBetween(e.date, today) >= 0
  );
  if (positiveTests.length > 0) {
    const latestPositive = positiveTests[positiveTests.length - 1];
    const flowAfter = entries.some(
      (e) => isFlowActive(e.flow) && e.date > latestPositive.date
    );
    if (!flowAfter) {
      return "pregnancy";
    }
  }

  // --- Menopause: cycle data spans >= 12 months with zero flow entries,
  // and no birthDate in the last 12 months. -------------------------------
  if (entries.length > 0) {
    const spanDays = daysBetween(entries[0].date, entries[entries.length - 1].date);
    const anyFlow = entries.some((e) => isFlowActive(e.flow));
    const birthWithinYear =
      !!args.birthDate && daysBetween(args.birthDate, today) >= 0 && daysBetween(args.birthDate, today) <= 365;
    if (spanDays >= 365 && !anyFlow && !birthWithinYear) {
      return "menopause";
    }
  }

  // --- Cycle-based phases ------------------------------------------------
  const runs = findPeriodRuns(entries);
  if (runs.length === 0) {
    return "unknown";
  }

  const lastRun = runs[runs.length - 1];

  // If flow is still ongoing (last run's end is today or very recent and
  // there's no evidence the run has closed), we are in menstrual phase.
  const daysSinceRunEnd = daysBetween(lastRun.end, today);
  const daysSinceRunStart = daysBetween(lastRun.start, today);

  if (daysSinceRunStart < 0) {
    // Last recorded period start is in the future relative to `today`
    // (shouldn't normally happen) — treat as unknown.
    return "unknown";
  }

  // Still bleeding: today falls within [start, end] of the last run, or the
  // run ended fewer than 1 day ago (i.e. still ongoing as of `today`).
  if (today >= lastRun.start && today <= lastRun.end) {
    return "menstrual";
  }

  // Grace window: don't flicker out of "menstrual" just because today's
  // flow hasn't been logged yet. Treat the phase as still menstrual for up
  // to 2 days after the last logged flow entry, bounded by a sanity check
  // against the average logged period length (a run that was already at or
  // past the typical length is less plausibly "still ongoing").
  const avgPeriodLengthSoFar = avg(runs.map((r) => r.length));
  const graceDays = lastRun.length < avgPeriodLengthSoFar ? 2 : 1;
  if (daysSinceRunEnd >= 1 && daysSinceRunEnd <= graceDays) {
    return "menstrual";
  }

  // Determine avg cycle length from available period starts (fallback 28).
  const starts = runs.map((r) => r.start);
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push(daysBetween(starts[i - 1], starts[i]));
  }
  const rawAvgCycle = gaps.length > 0 ? avg(gaps) : 28;
  const avgCycleLength = clamp(rawAvgCycle, 21, 40);

  // Estimated ovulation day offset from period start.
  let ovulationOffset = avgCycleLength - 14;

  // Refine with a positive ovulation test after the last period start.
  const ovTestAfter = entries.find(
    (e) => e.date > lastRun.start && e.ovulationTest === "positive"
  );
  if (ovTestAfter) {
    ovulationOffset = daysBetween(lastRun.start, ovTestAfter.date);
  } else {
    // Refine with a sustained BBT rise >= 0.2C over the prior 6-day average.
    const bbtAfter = entries.filter((e) => e.date > lastRun.start && e.bbt !== undefined);
    for (let i = 0; i < bbtAfter.length; i++) {
      const priorWindow = bbtAfter.slice(Math.max(0, i - 6), i);
      if (priorWindow.length >= 3) {
        const priorAvg = avg(priorWindow.map((e) => e.bbt!));
        if (bbtAfter[i].bbt! - priorAvg >= 0.2) {
          ovulationOffset = daysBetween(lastRun.start, bbtAfter[i].date);
          break;
        }
      }
    }
  }

  const ovulationDay = addDays(lastRun.start, ovulationOffset);
  const dayOffset = daysBetween(lastRun.start, today);
  const ovulationWindowStart = ovulationOffset - 1;
  const ovulationWindowEnd = ovulationOffset + 1;

  if (dayOffset >= ovulationWindowStart && dayOffset <= ovulationWindowEnd) {
    return "ovulation";
  }
  if (dayOffset < ovulationWindowStart) {
    return "follicular";
  }
  return "luteal";
}

// ---------------------------------------------------------------------------
// predictCycle
// ---------------------------------------------------------------------------

export function predictCycle(cycleEntries: CycleEntry[], today?: string): CyclePrediction {
  const entries = ascByDate(cycleEntries);
  const runs = findPeriodRuns(entries);
  const now = todayOr(today);

  if (runs.length === 0) {
    return { confidence: "none" };
  }

  const starts = runs.map((r) => r.start);
  const lastStart = starts[starts.length - 1];

  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push(daysBetween(starts[i - 1], starts[i]));
  }

  let avgCycleLength: number;
  let confidence: CyclePrediction["confidence"];

  if (starts.length === 1) {
    avgCycleLength = 28; // fall back to a 28-day assumption
    confidence = "low";
  } else {
    avgCycleLength = clamp(avg(gaps), 21, 40);
    if (starts.length >= 4) {
      const sd = stdDev(gaps);
      confidence = sd <= 3 ? "high" : "medium";
    } else {
      confidence = "medium";
    }
  }

  const avgPeriodLength = avg(runs.map((r) => r.length));

  const roundedCycleLength = Math.round(avgCycleLength);
  let nextPeriodStart = addDays(lastStart, roundedCycleLength);
  let cyclesProjected = 1;

  // Roll forward if the period is overdue: when the naive prediction has
  // already passed relative to `now` without a new logged cycle start,
  // keep advancing by the average cycle length until we reach a
  // future-or-today date, instead of returning a stale past-dated
  // prediction (which would also make downstream risk-window logic stale).
  while (nextPeriodStart < now) {
    nextPeriodStart = addDays(nextPeriodStart, roundedCycleLength);
    cyclesProjected += 1;
  }

  // Projecting multiple cycles forward with no new data is a weaker
  // prediction, not a stronger one — downgrade confidence accordingly
  // rather than leaving it at the value derived from historical variance.
  if (cyclesProjected > 1) {
    if (confidence === "high") confidence = "medium";
    else if (confidence === "medium") confidence = "low";
  }

  const ovulationDate = addDays(nextPeriodStart, -14);
  const fertileWindowStart = addDays(ovulationDate, -5);
  const fertileWindowEnd = addDays(ovulationDate, 1);
  const currentCycleDay = daysBetween(lastStart, now) + 1;

  return {
    nextPeriodStart,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    avgCycleLength: Math.round(avgCycleLength * 10) / 10,
    avgPeriodLength: Math.round(avgPeriodLength * 10) / 10,
    currentCycleDay,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// calculateWellnessScore
// ---------------------------------------------------------------------------

const HORMONE_THYROID_BLOOD = new Set(["hormone", "thyroid", "blood"]);

function getRiskLevelLocal(score: number): "low" | "moderate" | "high" {
  if (score <= 35) return "low";
  if (score <= 65) return "moderate";
  return "high";
}

function coreFactorImpacts(factors: CoreFactors): Record<
  "mood" | "anxiety" | "sleep" | "appetite" | "bonding" | "support",
  number
> {
  const moodFactor = (5 - factors.mood) / 4;
  const anxietyFactor = (factors.anxiety - 1) / 4;
  const sleepHours = clamp(factors.sleep, 0, 12);
  const sleepFactor = sleepHours < 6 ? Math.max(0, (6 - sleepHours) / 6) : 0;
  const appetiteFactor = (5 - factors.appetite) / 4;
  const bondingFactor = (5 - factors.bonding) / 4;
  const supportFactor = (5 - factors.support) / 4;

  return {
    mood: clamp(moodFactor, 0, 1),
    anxiety: clamp(anxietyFactor, 0, 1),
    sleep: clamp(sleepFactor, 0, 1),
    appetite: clamp(appetiteFactor, 0, 1),
    bonding: clamp(bondingFactor, 0, 1),
    support: clamp(supportFactor, 0, 1),
  };
}

function phaseModifier(phase: ReproductivePhase): number {
  switch (phase) {
    case "luteal":
      return 4;
    case "menstrual":
      return 3;
    case "postpartum":
      return 2;
    default:
      return 0;
  }
}

export function calculateWellnessScore(input: WellnessInput): WellnessResult {
  const contributions: WellnessContribution[] = [];

  // Base weights for the six legacy factors.
  const baseWeights = {
    mood: 0.27,
    anxiety: 0.25,
    sleep: 0.15,
    appetite: 0.1,
    bonding: 0.13,
    support: 0.1,
  };

  if (input.factors) {
    const impacts = coreFactorImpacts(input.factors);
    contributions.push(
      { key: "mood", label: "Mood", weight: baseWeights.mood, impact: impacts.mood },
      { key: "anxiety", label: "Anxiety", weight: baseWeights.anxiety, impact: impacts.anxiety },
      { key: "sleep", label: "Sleep", weight: baseWeights.sleep, impact: impacts.sleep },
      { key: "appetite", label: "Appetite", weight: baseWeights.appetite, impact: impacts.appetite },
      { key: "bonding", label: "Bonding", weight: baseWeights.bonding, impact: impacts.bonding },
      { key: "support", label: "Support", weight: baseWeights.support, impact: impacts.support }
    );
  }

  // --- Extra term: labs ---------------------------------------------------
  if (input.labMarkers && input.labMarkers.length > 0) {
    const relevant = input.labMarkers; // caller passes hormone/thyroid/blood markers
    const flagged = relevant.filter((m) => m.flag === "low" || m.flag === "high");
    const impact = relevant.length > 0 ? flagged.length / relevant.length : 0;
    contributions.push({ key: "labs", label: "Lab markers", weight: 0.08, impact });
  }

  // --- Extra term: partner -------------------------------------------------
  if (input.partnerObservations && input.partnerObservations.length > 0) {
    const ratings = input.partnerObservations.map(
      (o) => (o.mood + o.overallWellbeing) / 2
    );
    const avgRating = avg(ratings);
    const impact = clamp((5 - avgRating) / 4, 0, 1);
    contributions.push({ key: "partner", label: "Partner-observed wellbeing", weight: 0.1, impact });
  }

  // --- Extra term: symptoms -------------------------------------------------
  if (input.recentSymptoms && input.recentSymptoms.length > 0) {
    const uniqueCount = new Set(input.recentSymptoms).size;
    const impact = clamp(uniqueCount / 6, 0, 1);
    contributions.push({ key: "symptoms", label: "Recent symptoms", weight: 0.05, impact });
  }

  // Renormalize weights to sum to 1.
  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  let rawScore = 0;
  const normalizedContributions: WellnessContribution[] = contributions.map((c) => {
    const normWeight = totalWeight > 0 ? c.weight / totalWeight : 0;
    rawScore += normWeight * c.impact;
    return { ...c, weight: normWeight };
  });

  let score = rawScore * 100;
  score += phaseModifier(input.phase);
  score = Math.round(clamp(score, 0, 100));

  return {
    score,
    level: getRiskLevelLocal(score),
    contributions: normalizedContributions,
  };
}

// ---------------------------------------------------------------------------
// predictRiskWindows
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function weekdayOf(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

export function predictRiskWindows(
  checkIns: CheckIn[],
  cycleEntries: CycleEntry[],
  today?: string
): RiskWindow[] {
  const now = todayOr(today);
  const windows: RiskWindow[] = [];

  // --- (1) Premenstrual mood-sensitivity watch window ---------------------
  const prediction = predictCycle(cycleEntries, now);
  if (prediction.confidence !== "none" && prediction.nextPeriodStart) {
    const windowStart = addDays(prediction.nextPeriodStart, -5);
    const windowEnd = addDays(prediction.nextPeriodStart, -1);

    const last14 = [...checkIns]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
    const avgRecentRisk = last14.length > 0 ? avg(last14.map((c) => c.riskScore)) : 0;
    const severity: RiskWindow["severity"] = avgRecentRisk > 50 ? "elevated" : "watch";

    windows.push({
      start: windowStart,
      end: windowEnd,
      reason:
        "The days before your period can bring premenstrual mood sensitivity — a gentle heads up so you can plan extra rest and support.",
      severity,
    });
  }

  // --- (2) Weekday pattern watch window ------------------------------------
  if (checkIns.length > 0) {
    const overallAvg = avg(checkIns.map((c) => c.riskScore));

    const byWeekday: Record<number, number[]> = {};
    for (const c of checkIns) {
      const wd = weekdayOf(c.date);
      if (!byWeekday[wd]) byWeekday[wd] = [];
      byWeekday[wd].push(c.riskScore);
    }

    let flaggedWeekday: number | null = null;
    let flaggedAvg = 0;
    for (const wdKey of Object.keys(byWeekday)) {
      const wd = Number(wdKey);
      const samples = byWeekday[wd];
      if (samples.length >= 3) {
        const wdAvg = avg(samples);
        if (wdAvg - overallAvg >= 12) {
          if (flaggedWeekday === null || wdAvg - overallAvg > flaggedAvg - overallAvg) {
            flaggedWeekday = wd;
            flaggedAvg = wdAvg;
          }
        }
      }
    }

    if (flaggedWeekday !== null) {
      // Find the next occurrence of that weekday on/after `now`.
      let candidate = now;
      while (weekdayOf(candidate) !== flaggedWeekday) {
        candidate = addDays(candidate, 1);
      }
      // Ensure it's strictly upcoming (today counts if it matches).
      windows.push({
        start: candidate,
        end: candidate,
        reason: `${WEEKDAY_NAMES[flaggedWeekday]}s have historically shown higher check-in scores than your average — worth noticing if anything about that day of the week is harder for you.`,
        severity: "watch",
      });
    }
  }

  return windows;
}

// ---------------------------------------------------------------------------
// getRecommendations
// ---------------------------------------------------------------------------

interface CatalogItem extends Recommendation {}

const CATALOG: Record<string, CatalogItem> = {
  sleep_hygiene: {
    id: "sleep_hygiene",
    title: "Protect your sleep window",
    body:
      "Try a consistent wind-down routine and dim lights an hour before bed — even short, protected sleep windows can ease mood and anxiety symptoms.",
    category: "sleep",
    priority: 2,
  },
  gentle_movement: {
    id: "gentle_movement",
    title: "Take a gentle walk",
    body:
      "A short daily walk, even 10-15 minutes, is one of the best-supported ways to lift mood and reduce stress hormones.",
    category: "exercise",
    priority: 2,
  },
  mindfulness_breathing: {
    id: "mindfulness_breathing",
    title: "Try a short breathing practice",
    body:
      "A few minutes of slow breathing or guided mindfulness can calm the nervous system when anxiety is running high.",
    category: "mindfulness",
    priority: 2,
  },
  iron_rich_nutrition: {
    id: "iron_rich_nutrition",
    title: "Consider iron-rich foods",
    body:
      "Your recent labs flagged a low hemoglobin marker. Iron-rich foods (leafy greens, legumes, lean meats) paired with vitamin C can help — check with your provider before starting supplements.",
    category: "nutrition",
    priority: 2,
  },
  thyroid_follow_up: {
    id: "thyroid_follow_up",
    title: "Follow up on your thyroid results",
    body:
      "Your TSH marker was flagged outside the reference range. Thyroid changes can affect mood, energy, and sleep — it's worth a follow-up conversation with your provider.",
    category: "medical",
    priority: 1,
  },
  professional_support: {
    id: "professional_support",
    title: "Reach out for professional support",
    body:
      "Your recent check-ins suggest you may be carrying a heavy load right now. Please consider talking with a healthcare provider or counselor — you don't have to navigate this alone. This is not a diagnosis, just a gentle nudge to get more support.",
    category: "medical",
    priority: 1,
  },
  partner_communication: {
    id: "partner_communication",
    title: "Open a conversation with your partner",
    body:
      "Your partner's observations suggest they're noticing more strain than you've reported yourself. A short, honest check-in together could help you both feel more supported.",
    category: "support",
    priority: 2,
  },
  phase_luteal_care: {
    id: "phase_luteal_care",
    title: "Extra self-care in your luteal phase",
    body:
      "Hormone shifts in the luteal phase can amplify mood and sleep symptoms. Small, consistent self-care habits this week may take some edge off.",
    category: "mindfulness",
    priority: 3,
  },
  phase_postpartum_rest: {
    id: "phase_postpartum_rest",
    title: "Prioritize rest where you can",
    body:
      "The postpartum period is demanding on body and mind. Accepting help and resting when the baby rests, even briefly, supports recovery.",
    category: "sleep",
    priority: 3,
  },
  phase_pregnancy_checkins: {
    id: "phase_pregnancy_checkins",
    title: "Keep up with prenatal check-ins",
    body:
      "Regular prenatal visits are a good place to raise any mood, sleep, or physical changes you're noticing — nothing is too small to mention.",
    category: "medical",
    priority: 3,
  },

  // --- Care-profile-aware items (opt-in, population-level, non-diagnostic) ---
  vitamin_d_check: {
    id: "vitamin_d_check",
    title: "Ask about a vitamin D check",
    body:
      "Vitamin D deficiency is more common with deeper skin tones, covered clothing, or limited sun exposure — and low vitamin D is linked to mood and fatigue. A simple blood test with your provider can tell you where you stand. This is population-level guidance, not a diagnosis.",
    category: "nutrition",
    priority: 2,
  },
  hemoglobinopathy_screen: {
    id: "hemoglobinopathy_screen",
    title: "Low hemoglobin isn't always iron deficiency",
    body:
      "Inherited traits like thalassemia and sickle cell trait are more common in people of Middle Eastern, North African, Mediterranean, African, and South or Southeast Asian ancestry, and can look like iron-deficiency anemia on a basic panel. Before starting long-term iron, ask your provider whether a hemoglobinopathy screen makes sense for you.",
    category: "medical",
    priority: 1,
  },
  fibroid_awareness: {
    id: "fibroid_awareness",
    title: "Heavy periods are worth a conversation",
    body:
      "You've logged several heavy-flow days recently. Uterine fibroids are common and disproportionately affect Black women, often underdiagnosed for years. Persistent heavy bleeding deserves a proper workup — you know your body; don't let it be dismissed.",
    category: "medical",
    priority: 2,
  },
  gd_screening_awareness: {
    id: "gd_screening_awareness",
    title: "Stay on top of glucose screening",
    body:
      "Gestational diabetes is more common in several communities, including South Asian, Hispanic/Latina, Black, Indigenous, Pacific Islander, and Middle Eastern populations. Make sure your prenatal plan includes glucose screening at the recommended weeks, and ask about earlier screening if you have other risk factors.",
    category: "medical",
    priority: 2,
  },
};

/** Backgrounds with higher population-level rates of vitamin D deficiency. */
const VITAMIN_D_BACKGROUNDS = new Set(["black_african", "south_asian", "swana"]);
/** Backgrounds with higher carrier rates of thalassemia / sickle cell trait. */
const HEMOGLOBINOPATHY_BACKGROUNDS = new Set([
  "swana",
  "black_african",
  "south_asian",
  "southeast_asian",
]);
/** Backgrounds with higher population-level gestational diabetes rates. */
const GD_BACKGROUNDS = new Set([
  "south_asian",
  "hispanic_latina",
  "black_african",
  "indigenous",
  "pacific_islander",
  "swana",
  "east_asian",
]);

export function getRecommendations(
  input: WellnessInput & { result: WellnessResult }
): Recommendation[] {
  const recs: Recommendation[] = [];
  const add = (id: string) => {
    if (CATALOG[id] && !recs.some((r) => r.id === id)) {
      recs.push(CATALOG[id]);
    }
  };

  // Highest priority: professional support when overall risk is high.
  if (input.result.level === "high") {
    add("professional_support");
  }

  // Lab-driven recommendations.
  const lowHemoglobin = (input.labMarkers ?? []).some(
    (m: LabMarker) => m.name.toLowerCase().includes("hemoglobin") && m.flag === "low"
  );
  if (input.labMarkers && input.labMarkers.length > 0) {
    if (lowHemoglobin) add("iron_rich_nutrition");

    const flaggedTsh = input.labMarkers.some(
      (m: LabMarker) => m.name.toLowerCase().includes("tsh") && m.flag !== "normal"
    );
    if (flaggedTsh) add("thyroid_follow_up");
  }

  // Care-profile-aware guidance. Only fires for signals the user explicitly
  // self-described, and always framed as population-level, non-diagnostic.
  const care = input.careProfile;
  if (care) {
    const backgrounds = new Set(care.backgrounds);
    const hasAny = (set: Set<string>) => [...backgrounds].some((b) => set.has(b));

    // Deeper skin tones synthesize less vitamin D; covered clothing or limited
    // sun exposure compounds it. Skip if a recent vitamin D lab already exists.
    const hasRecentVitDLab = (input.labMarkers ?? []).some((m) =>
      m.name.toLowerCase().includes("vitamin d")
    );
    if ((care.limitedSunExposure || hasAny(VITAMIN_D_BACKGROUNDS)) && !hasRecentVitDLab) {
      add("vitamin_d_check");
    }

    // Low hemoglobin + relevant ancestry: iron alone may be the wrong answer.
    if (lowHemoglobin && hasAny(HEMOGLOBINOPATHY_BACKGROUNDS)) {
      add("hemoglobinopathy_screen");
    }

    // Sustained heavy flow + higher fibroid prevalence.
    if ((input.recentHeavyFlowDays ?? 0) >= 3 && backgrounds.has("black_african")) {
      add("fibroid_awareness");
    }

    // Pregnancy + higher gestational diabetes prevalence.
    if (input.phase === "pregnancy" && hasAny(GD_BACKGROUNDS)) {
      add("gd_screening_awareness");
    }
  }

  // Partner-driven recommendation: partner-observed wellbeing notably lower
  // than self-reported.
  if (input.partnerObservations && input.partnerObservations.length > 0 && input.factors) {
    const partnerAvgWellbeing = avg(input.partnerObservations.map((o) => o.overallWellbeing));
    // Map self mood (1-5) as a rough proxy for self-reported wellbeing.
    const selfProxy = input.factors.mood;
    if (partnerAvgWellbeing <= selfProxy - 1.25) {
      add("partner_communication");
    }
  }

  // Phase-aware recommendations.
  if (input.phase === "luteal") add("phase_luteal_care");
  if (input.phase === "postpartum") add("phase_postpartum_rest");
  if (input.phase === "pregnancy") add("phase_pregnancy_checkins");

  // General evidence-informed staples, always considered, in priority order.
  add("mindfulness_breathing");
  add("gentle_movement");
  add("sleep_hygiene");

  // Sort by priority (1 highest) while keeping stable relative order.
  const sorted = [...recs].sort((a, b) => a.priority - b.priority);

  // Clamp to 3-6 items: if we somehow have fewer than 3 (shouldn't happen
  // since the 3 staples are always added), pad is unnecessary; if more than
  // 6, keep the highest-priority ones.
  return sorted.slice(0, 6);
}

// ---------------------------------------------------------------------------
// correlateWithPartner
// ---------------------------------------------------------------------------

function mapSleepHoursTo5(hours: number): number {
  return clamp(hours / 2, 1, 5);
}

function mapWellbeingTo5(riskScore: number): number {
  return clamp((100 - riskScore) / 25 + 1, 1, 5);
}

function insufficientMetric(metric: PartnerCorrelation["metric"], note: string): PartnerCorrelation {
  return {
    metric,
    selfAvg: null,
    partnerAvg: null,
    delta: null,
    agreement: "insufficient_data",
    note,
  };
}

export function correlateWithPartner(
  checkIns: CheckIn[],
  partnerObservations: PartnerObservation[]
): PartnerCorrelation[] {
  const metrics: PartnerCorrelation["metric"][] = ["mood", "sleep", "wellbeing", "energy"];

  if (checkIns.length === 0 || partnerObservations.length === 0) {
    return metrics.map((m) =>
      insufficientMetric(m, "Not enough matched check-in and partner observation days yet.")
    );
  }

  // Consider only the most recent 30 days of overlap.
  const today = [...checkIns, ...partnerObservations]
    .map((e) => e.date)
    .sort((a, b) => b.localeCompare(a))[0];
  const cutoff = addDays(today, -29);

  const checkInByDate = new Map<string, CheckIn>();
  for (const c of checkIns) {
    if (c.date >= cutoff && c.date <= today) checkInByDate.set(c.date, c);
  }
  const partnerByDate = new Map<string, PartnerObservation>();
  for (const p of partnerObservations) {
    if (p.date >= cutoff && p.date <= today) partnerByDate.set(p.date, p);
  }

  const matchedDates = [...checkInByDate.keys()].filter((d) => partnerByDate.has(d));

  if (matchedDates.length < 3) {
    return metrics.map((m) =>
      insufficientMetric(
        m,
        `Only ${matchedDates.length} matched day(s) in the last 30 — need at least 3 to compare.`
      )
    );
  }

  const results: PartnerCorrelation[] = [];

  // --- mood ---
  {
    const selfVals = matchedDates.map((d) => checkInByDate.get(d)!.mood);
    const partnerVals = matchedDates.map((d) => partnerByDate.get(d)!.mood);
    const selfAvg = avg(selfVals);
    const partnerAvg = avg(partnerVals);
    const delta = Math.round((partnerAvg - selfAvg) * 10) / 10;
    const agreement = Math.abs(delta) < 0.75 ? "aligned" : delta > 0 ? "partner_higher" : "partner_lower";
    results.push({
      metric: "mood",
      selfAvg: Math.round(selfAvg * 10) / 10,
      partnerAvg: Math.round(partnerAvg * 10) / 10,
      delta,
      agreement,
      note:
        agreement === "aligned"
          ? "You and your partner see your mood similarly on shared days."
          : agreement === "partner_lower"
          ? "Your partner has been rating your mood lower than you rate it yourself."
          : "Your partner has been rating your mood higher than you rate it yourself.",
    });
  }

  // --- sleep ---
  {
    const selfVals = matchedDates.map((d) => mapSleepHoursTo5(checkInByDate.get(d)!.sleep));
    const partnerVals = matchedDates.map((d) => partnerByDate.get(d)!.sleepQuality);
    const selfAvg = avg(selfVals);
    const partnerAvg = avg(partnerVals);
    const delta = Math.round((partnerAvg - selfAvg) * 10) / 10;
    const agreement = Math.abs(delta) < 0.75 ? "aligned" : delta > 0 ? "partner_higher" : "partner_lower";
    results.push({
      metric: "sleep",
      selfAvg: Math.round(selfAvg * 10) / 10,
      partnerAvg: Math.round(partnerAvg * 10) / 10,
      delta,
      agreement,
      note:
        agreement === "aligned"
          ? "Your reported sleep hours and your partner's sense of your sleep quality line up well."
          : agreement === "partner_lower"
          ? "Your partner perceives your sleep quality as lower than your logged hours suggest."
          : "Your partner perceives your sleep quality as higher than your logged hours suggest.",
    });
  }

  // --- wellbeing ---
  {
    const selfVals = matchedDates.map((d) => mapWellbeingTo5(checkInByDate.get(d)!.riskScore));
    const partnerVals = matchedDates.map((d) => partnerByDate.get(d)!.overallWellbeing);
    const selfAvg = avg(selfVals);
    const partnerAvg = avg(partnerVals);
    const delta = Math.round((partnerAvg - selfAvg) * 10) / 10;
    const agreement = Math.abs(delta) < 0.75 ? "aligned" : delta > 0 ? "partner_higher" : "partner_lower";
    results.push({
      metric: "wellbeing",
      selfAvg: Math.round(selfAvg * 10) / 10,
      partnerAvg: Math.round(partnerAvg * 10) / 10,
      delta,
      agreement,
      note:
        agreement === "aligned"
          ? "Your overall wellbeing and your partner's read on it are closely aligned."
          : agreement === "partner_lower"
          ? "Your partner senses lower overall wellbeing than your check-ins reflect."
          : "Your partner senses higher overall wellbeing than your check-ins reflect.",
    });
  }

  // --- energy (proxy metric, explicitly noted) ---
  {
    const selfVals = matchedDates.map((d) => {
      const c = checkInByDate.get(d)!;
      return (c.mood + mapSleepHoursTo5(c.sleep)) / 2;
    });
    const partnerVals = matchedDates.map((d) => partnerByDate.get(d)!.energy);
    const selfAvg = avg(selfVals);
    const partnerAvg = avg(partnerVals);
    const delta = Math.round((partnerAvg - selfAvg) * 10) / 10;
    const agreement = Math.abs(delta) < 0.75 ? "aligned" : delta > 0 ? "partner_higher" : "partner_lower";
    results.push({
      metric: "energy",
      selfAvg: Math.round(selfAvg * 10) / 10,
      partnerAvg: Math.round(partnerAvg * 10) / 10,
      delta,
      agreement,
      note:
        (agreement === "aligned"
          ? "Your energy levels and your partner's perception are closely aligned. "
          : agreement === "partner_lower"
          ? "Your partner perceives your energy as lower than your own proxy suggests. "
          : "Your partner perceives your energy as higher than your own proxy suggests. ") +
        "(Self energy is a proxy derived from mood and sleep, since check-ins don't track energy directly.)",
    });
  }

  return results;
}

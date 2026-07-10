import type { CheckIn } from "@/context/AppContext";

/**
 * A single computed "wellness signal correlation" insight — a plain-language
 * summary of a real relationship found in the user's own check-in history
 * (e.g. anxiety on poor-sleep nights vs. well-rested nights). Never a
 * hardcoded string: the numbers are always derived from the check-ins passed
 * in, and the function returns null when there isn't enough data to say
 * anything meaningful.
 */
export interface WellnessSignalInsight {
  /** Short plain-language summary, e.g. "Poor sleep nights show 2.1x higher anxiety this month." */
  headline: string;
  /** One extra sentence of context/caveat to display under the headline. */
  detail: string;
  /** Average anxiety (1–5) on nights classified as poor sleep. */
  poorSleepAvgAnxiety: number;
  /** Average anxiety (1–5) on nights classified as well-rested sleep. */
  restfulSleepAvgAnxiety: number;
  /** How many poor-sleep and well-rested nights were compared. */
  poorSleepNights: number;
  restfulSleepNights: number;
  /** poorSleepAvgAnxiety / restfulSleepAvgAnxiety, rounded to 1 decimal. */
  ratio: number;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Computes a sleep-vs-anxiety correlation insight from the last `windowDays`
 * days of check-ins (default 30). "Poor sleep" is <= poorSleepThreshold
 * hours; "restful sleep" is >= restfulSleepThreshold hours. Nights that fall
 * between the two thresholds are excluded from the comparison so the two
 * groups stay clearly separated.
 *
 * Returns null when there isn't at least `minNightsPerGroup` check-ins in
 * both the poor-sleep and restful-sleep groups — with sparse data the
 * comparison would be noise, not signal.
 */
export function computeSleepAnxietyCorrelation(
  checkIns: CheckIn[],
  options?: {
    windowDays?: number;
    poorSleepThreshold?: number;
    restfulSleepThreshold?: number;
    minNightsPerGroup?: number;
  }
): WellnessSignalInsight | null {
  const windowDays = options?.windowDays ?? 30;
  const poorSleepThreshold = options?.poorSleepThreshold ?? 5;
  const restfulSleepThreshold = options?.restfulSleepThreshold ?? 7;
  const minNightsPerGroup = options?.minNightsPerGroup ?? 3;

  const recent = checkIns.slice(0, windowDays);

  const poorSleepNights = recent.filter((c) => c.sleep <= poorSleepThreshold);
  const restfulSleepNights = recent.filter((c) => c.sleep >= restfulSleepThreshold);

  if (
    poorSleepNights.length < minNightsPerGroup ||
    restfulSleepNights.length < minNightsPerGroup
  ) {
    return null;
  }

  const poorSleepAvgAnxiety = Math.round(avg(poorSleepNights.map((c) => c.anxiety)) * 10) / 10;
  const restfulSleepAvgAnxiety =
    Math.round(avg(restfulSleepNights.map((c) => c.anxiety)) * 10) / 10;

  // Guard against division by ~0 — anxiety is on a 1-5 scale so this should
  // only happen with essentially no anxiety on restful nights.
  const ratio =
    restfulSleepAvgAnxiety > 0
      ? Math.round((poorSleepAvgAnxiety / restfulSleepAvgAnxiety) * 10) / 10
      : poorSleepAvgAnxiety > 0
      ? Infinity
      : 1;

  const higher = poorSleepAvgAnxiety >= restfulSleepAvgAnxiety;
  const ratioText = Number.isFinite(ratio) ? `${ratio}x` : "far";

  const headline = higher
    ? `Poor sleep nights show ${ratioText} higher anxiety this month.`
    : `Well-rested nights show similar or lower anxiety than poor sleep nights this month.`;

  const detail = `Based on ${poorSleepNights.length} night(s) with ${poorSleepThreshold}h or less of sleep (avg anxiety ${poorSleepAvgAnxiety}/5) vs. ${restfulSleepNights.length} night(s) with ${restfulSleepThreshold}h+ (avg anxiety ${restfulSleepAvgAnxiety}/5).`;

  return {
    headline,
    detail,
    poorSleepAvgAnxiety,
    restfulSleepAvgAnxiety,
    poorSleepNights: poorSleepNights.length,
    restfulSleepNights: restfulSleepNights.length,
    ratio: Number.isFinite(ratio) ? ratio : poorSleepAvgAnxiety,
  };
}

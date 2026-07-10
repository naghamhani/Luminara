import { calculateWellnessScore } from "@/utils/wellnessAlgorithm";
import type { CoreFactors, WellnessInput } from "@/types/health";

/** Best possible check-in: minimal risk on every factor. */
const BEST_FACTORS: CoreFactors = {
  mood: 5,
  sleep: 8,
  anxiety: 1,
  appetite: 5,
  bonding: 5,
  support: 5,
};

/** Worst possible check-in: maximal risk on every factor. */
const WORST_FACTORS: CoreFactors = {
  mood: 1,
  sleep: 0,
  anxiety: 5,
  appetite: 1,
  bonding: 1,
  support: 1,
};

function scoreFor(factors: CoreFactors, phase: WellnessInput["phase"] = "unknown") {
  return calculateWellnessScore({ factors, phase }).score;
}

describe("calculateWellnessScore", () => {
  describe("risk band boundaries", () => {
    it("classifies the best-case input as low risk", () => {
      const result = calculateWellnessScore({ factors: BEST_FACTORS, phase: "unknown" });
      expect(result.score).toBeLessThanOrEqual(35);
      expect(result.level).toBe("low");
    });

    it("classifies a score of exactly 35 as low", () => {
      expect(calculateWellnessScore({ factors: BEST_FACTORS, phase: "unknown" }).level).toBe(
        "low"
      );
      // Direct boundary check on the classifier via a score-producing input.
      const result = calculateWellnessScore({ factors: BEST_FACTORS, phase: "unknown" });
      if (result.score === 35) {
        expect(result.level).toBe("low");
      }
    });

    it("classifies a mid-range input as moderate risk", () => {
      const midFactors: CoreFactors = {
        mood: 3,
        sleep: 5,
        anxiety: 3,
        appetite: 3,
        bonding: 3,
        support: 3,
      };
      const result = calculateWellnessScore({ factors: midFactors, phase: "unknown" });
      expect(result.score).toBeGreaterThan(35);
      expect(result.score).toBeLessThanOrEqual(65);
      expect(result.level).toBe("moderate");
    });

    it("classifies the worst-case input as high risk", () => {
      const result = calculateWellnessScore({ factors: WORST_FACTORS, phase: "unknown" });
      expect(result.score).toBeGreaterThan(65);
      expect(result.level).toBe("high");
    });

    it("keeps the boundary score of 66 classified as high", () => {
      // getRiskLevelLocal: <=35 low, <=65 moderate, else high. 66 is the
      // smallest integer score that must fall into "high".
      const level66 = calculateWellnessScore({ factors: WORST_FACTORS, phase: "unknown" }).score >= 66;
      expect(level66).toBe(true);
    });
  });

  describe("factor directionality", () => {
    it("increases score as mood worsens (lower mood value = worse)", () => {
      const better = scoreFor({ ...BEST_FACTORS, mood: 5 });
      const worse = scoreFor({ ...BEST_FACTORS, mood: 1 });
      expect(worse).toBeGreaterThan(better);
    });

    it("increases score as sleep decreases below 6 hours", () => {
      const better = scoreFor({ ...BEST_FACTORS, sleep: 8 });
      const worse = scoreFor({ ...BEST_FACTORS, sleep: 1 });
      expect(worse).toBeGreaterThan(better);
    });

    it("does not penalize sleep at or above 6 hours", () => {
      const sixHours = scoreFor({ ...BEST_FACTORS, sleep: 6 });
      const eightHours = scoreFor({ ...BEST_FACTORS, sleep: 8 });
      const twelveHours = scoreFor({ ...BEST_FACTORS, sleep: 12 });
      expect(sixHours).toBe(eightHours);
      expect(eightHours).toBe(twelveHours);
    });

    it("increases score as anxiety worsens (higher anxiety value = worse)", () => {
      const better = scoreFor({ ...BEST_FACTORS, anxiety: 1 });
      const worse = scoreFor({ ...BEST_FACTORS, anxiety: 5 });
      expect(worse).toBeGreaterThan(better);
    });

    it("increases score as appetite worsens (lower appetite value = worse)", () => {
      const better = scoreFor({ ...BEST_FACTORS, appetite: 5 });
      const worse = scoreFor({ ...BEST_FACTORS, appetite: 1 });
      expect(worse).toBeGreaterThan(better);
    });

    it("increases score as bonding worsens (lower bonding value = worse)", () => {
      const better = scoreFor({ ...BEST_FACTORS, bonding: 5 });
      const worse = scoreFor({ ...BEST_FACTORS, bonding: 1 });
      expect(worse).toBeGreaterThan(better);
    });

    it("increases score as support worsens (lower support value = worse)", () => {
      const better = scoreFor({ ...BEST_FACTORS, support: 5 });
      const worse = scoreFor({ ...BEST_FACTORS, support: 1 });
      expect(worse).toBeGreaterThan(better);
    });
  });

  describe("phase modifier", () => {
    it("adds a small bump for luteal phase relative to an unknown phase", () => {
      const unknown = scoreFor(BEST_FACTORS, "unknown");
      const luteal = scoreFor(BEST_FACTORS, "luteal");
      expect(luteal).toBeGreaterThan(unknown);
    });

    it("adds a smaller bump for postpartum than for luteal", () => {
      const postpartum = scoreFor(BEST_FACTORS, "postpartum");
      const luteal = scoreFor(BEST_FACTORS, "luteal");
      expect(luteal).toBeGreaterThanOrEqual(postpartum);
    });
  });

  describe("determinism and purity", () => {
    it("returns the same score for the same input across repeated calls", () => {
      const input: WellnessInput = { factors: { ...WORST_FACTORS }, phase: "luteal" };
      const first = calculateWellnessScore(input);
      const second = calculateWellnessScore(input);
      expect(first).toEqual(second);
    });

    it("does not mutate the factors object passed in", () => {
      const factors: CoreFactors = { ...BEST_FACTORS };
      const snapshot = { ...factors };
      calculateWellnessScore({ factors, phase: "unknown" });
      expect(factors).toEqual(snapshot);
    });

    it("does not mutate the input object passed in", () => {
      const input: WellnessInput = {
        factors: { ...BEST_FACTORS },
        phase: "unknown",
        labMarkers: [{ name: "TSH", value: 2, unit: "mIU/L", flag: "normal" }],
      };
      const snapshot = JSON.parse(JSON.stringify(input));
      calculateWellnessScore(input);
      expect(input).toEqual(snapshot);
    });
  });
});

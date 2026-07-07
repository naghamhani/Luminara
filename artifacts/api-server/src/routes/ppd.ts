import { Router, type IRouter } from "express";
import { z } from "zod";

import { logger } from "../lib/logger";
import { getDb } from "../lib/store";
import { scoreEpds, scorePpdRisk, type PpdFeatures } from "../lib/ppdModel";

const router: IRouter = Router();

const featuresSchema = z
  .object({
    epdsScore: z.number().int().min(0).max(30).optional(),
    epdsResponses: z.array(z.number().int().min(0).max(3)).length(10).optional(),
    epdsIsPrenatal: z.boolean().optional(),

    historyOfDepression: z.boolean().optional(),
    historyOfAnxiety: z.boolean().optional(),
    priorPostpartumDepression: z.boolean().optional(),
    historyOfBipolar: z.boolean().optional(),
    currentlyOnPsychiatricMedication: z.boolean().optional(),

    ageYears: z.number().int().min(10).max(70).optional(),
    firstPregnancy: z.boolean().optional(),
    unintendedPregnancy: z.boolean().optional(),
    lowSocialSupport: z.boolean().optional(),
    financialStrain: z.boolean().optional(),
    intimatePartnerViolence: z.boolean().optional(),
    recentStressfulLifeEvent: z.boolean().optional(),

    pregnancyComplications: z.boolean().optional(),
    cesareanDelivery: z.boolean().optional(),
    pretermBirth: z.boolean().optional(),
    multiplePregnancy: z.boolean().optional(),
    nicuAdmission: z.boolean().optional(),
    infantHealthProblems: z.boolean().optional(),

    breastfeedingDifficulty: z.boolean().optional(),
    severeSleepDeprivation: z.boolean().optional(),
  })
  .strict();

const requestSchema = z.object({
  /** Anonymous participant pseudonym (no PII). */
  participantPseudonym: z.string().max(128).optional(),
  /** Persist this assessment to the research dataset (requires consent + DB). */
  store: z.boolean().optional(),
  features: featuresSchema,
});

/**
 * POST /api/ppd-risk
 * Score a de-identified feature vector against the transparent PPD risk model.
 */
router.post("/ppd-risk", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { participantPseudonym, store, features } = parsed.data;

  // Derive EPDS total (and self-harm flag) from raw responses when provided.
  let epdsScore = features.epdsScore;
  let selfHarmFlag = false;
  if (features.epdsResponses) {
    try {
      const scored = scoreEpds(features.epdsResponses);
      epdsScore = scored.total;
      selfHarmFlag = scored.selfHarmFlag;
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
  }

  const modelFeatures: PpdFeatures = { ...features, epdsScore };
  delete (modelFeatures as Record<string, unknown>)["epdsResponses"];

  const result = scorePpdRisk(modelFeatures);

  // Persist (best-effort) when asked and a DB is available. Never store raw
  // EPDS item responses — only the derived total lives in the dataset.
  let stored = false;
  if (store) {
    const dbmod = await getDb();
    if (dbmod) {
      try {
        await dbmod.db.insert(dbmod.ppdAssessments).values({
          participantPseudonym: participantPseudonym ?? null,
          epdsScore: epdsScore ?? null,
          features: modelFeatures,
          riskProbability: result.probability,
          riskScore: result.riskScore,
          riskTier: result.tier,
          modelVersion: result.modelVersion,
        });
        stored = true;
      } catch (err) {
        logger.error({ err }, "Failed to persist PPD assessment");
      }
    }
  }

  return res.json({ ...result, epdsScore: epdsScore ?? null, selfHarmFlag, stored });
});

export default router;

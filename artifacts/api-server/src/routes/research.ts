import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { logger } from "../lib/logger";
import { getDb, hasDatabase } from "../lib/store";

const router: IRouter = Router();

/**
 * The anonymized bundle mirrors the mobile AnonymizedBundle shape. We validate
 * the invariants that matter for de-identification (a pseudonym, a schema
 * version, offset-based entries) but keep the inner arrays permissive so the
 * mobile schema can evolve without breaking ingestion.
 */
const bundleSchema = z
  .object({
    schemaVersion: z.literal(1),
    participantId: z.string().min(1).max(128),
    postpartumWeeksAtDayZero: z.number().nullable(),
    includedDataTypes: z.array(z.string()).max(20),
  })
  .passthrough();

/**
 * POST /api/research/submissions
 * Ingest a fully de-identified research bundle built on the device.
 */
router.post("/research/submissions", async (req, res) => {
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid bundle", details: parsed.error.flatten() });
  }

  const dbmod = await getDb();
  if (!dbmod) {
    return res.status(503).json({
      error: "Research storage is not configured on this server (no database).",
    });
  }

  try {
    const [row] = await dbmod.db
      .insert(dbmod.researchSubmissions)
      .values({
        participantPseudonym: parsed.data.participantId,
        schemaVersion: parsed.data.schemaVersion,
        bundle: parsed.data,
      })
      .returning({ id: dbmod.researchSubmissions.id, createdAt: dbmod.researchSubmissions.createdAt });

    return res.status(201).json({ ok: true, submissionId: row?.id, receivedAt: row?.createdAt });
  } catch (err) {
    logger.error({ err }, "Failed to store research submission");
    return res.status(500).json({ error: "Could not store submission." });
  }
});

/**
 * GET /api/research/stats
 * Aggregate, non-identifying dataset stats — useful for a "you're contributing
 * to a dataset of N participants" message in the app.
 */
router.get("/research/stats", async (_req, res) => {
  if (!hasDatabase) {
    return res.json({ configured: false, participants: 0, submissions: 0, assessments: 0 });
  }
  const dbmod = await getDb();
  if (!dbmod) {
    return res.json({ configured: false, participants: 0, submissions: 0, assessments: 0 });
  }

  try {
    const [subs] = await dbmod.db
      .select({
        submissions: sql<number>`count(*)::int`,
        participants: sql<number>`count(distinct ${dbmod.researchSubmissions.participantPseudonym})::int`,
      })
      .from(dbmod.researchSubmissions);
    const [assess] = await dbmod.db
      .select({ assessments: sql<number>`count(*)::int` })
      .from(dbmod.ppdAssessments);

    return res.json({
      configured: true,
      participants: subs?.participants ?? 0,
      submissions: subs?.submissions ?? 0,
      assessments: assess?.assessments ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Failed to read research stats");
    return res.status(500).json({ error: "Could not read stats." });
  }
});

export default router;

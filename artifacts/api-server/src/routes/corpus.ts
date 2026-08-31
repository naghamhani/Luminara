import { Router, type IRouter } from "express";
import { z } from "zod";

import { corpusStats, search } from "../lib/retrieval";

const router: IRouter = Router();

const searchSchema = z.object({
  q: z.string().min(2).max(500),
  k: z.coerce.number().int().min(1).max(20).optional(),
  topic: z.string().max(60).optional(),
});

/**
 * GET /api/corpus/stats
 * Provenance of the grounding corpus. Also the fastest way to confirm a
 * deployment actually shipped the index file rather than silently falling back
 * to ungrounded answers.
 */
router.get("/corpus/stats", (_req, res) => {
  return res.json(corpusStats());
});

/**
 * GET /api/corpus/search?q=…&k=…&topic=…
 * Direct retrieval, without the LLM. Use it to inspect what Luna is being fed
 * for a given question — if an answer looks wrong, this shows whether the fault
 * is retrieval or generation.
 */
router.get("/corpus/search", (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  }
  const { q, k, topic } = parsed.data;
  const results = search(q, { k: k ?? 8, topic: topic ?? undefined });
  return res.json({ query: q, count: results.length, results });
});

export default router;

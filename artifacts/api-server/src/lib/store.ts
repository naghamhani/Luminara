/**
 * Lazy persistence layer.
 *
 * `@workspace/db` throws at import time when DATABASE_URL is unset. We want the
 * API server to boot and serve the pure endpoints (PPD scoring, chat via
 * Ollama) even with no database — persistence simply becomes a no-op until a
 * Postgres instance is provisioned. So the db module is imported dynamically,
 * only when a connection string is present, and cached thereafter.
 */

import { logger } from "./logger";

export const hasDatabase = Boolean(process.env["DATABASE_URL"]);

type DbModule = typeof import("@workspace/db");
let cached: DbModule | null | undefined;

export async function getDb(): Promise<DbModule | null> {
  if (cached !== undefined) return cached;
  if (!hasDatabase) {
    cached = null;
    return null;
  }
  try {
    cached = await import("@workspace/db");
  } catch (err) {
    logger.error({ err }, "Failed to initialise database; persistence disabled");
    cached = null;
  }
  return cached;
}

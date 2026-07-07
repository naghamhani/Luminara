import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Anonymized research submissions.
 *
 * The mobile app builds a fully de-identified, offset-based bundle on-device
 * (see mobile utils/anonymize.ts -> AnonymizedBundle) honoring the user's
 * per-data-type research consent. When consent is active and a backend is
 * configured, that bundle is POSTed here to build the research dataset used to
 * improve Luminara's models and support population-level women's-health study.
 *
 * By construction the payload contains no names, no free text, no providers,
 * and no absolute dates — only day offsets relative to the participant's own
 * earliest included entry. `participantPseudonym` lets repeated submissions
 * from the same anonymous participant be linked longitudinally without PII.
 */
export const researchSubmissions = pgTable("research_submissions", {
  id: serial("id").primaryKey(),
  participantPseudonym: text("participant_pseudonym").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  /** The full AnonymizedBundle payload. */
  bundle: jsonb("bundle").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertResearchSubmissionSchema = createInsertSchema(researchSubmissions).omit({
  id: true,
  createdAt: true,
});

export type ResearchSubmission = typeof researchSubmissions.$inferSelect;
export type InsertResearchSubmission = z.infer<typeof insertResearchSubmissionSchema>;

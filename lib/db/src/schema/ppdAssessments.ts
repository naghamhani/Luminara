import {
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Stored postpartum-depression (PPD) risk assessments.
 *
 * This mirrors the framing of the Mass General Brigham machine-learning PPD
 * model (Feb 2024): a risk estimate built from information available in the
 * medical record around delivery, with prenatal EPDS scores providing the
 * largest predictive lift. Luminara's implementation is a transparent,
 * literature-calibrated logistic model (see api-server src/lib/ppdModel.ts) —
 * NOT the proprietary MGB model, and NOT a diagnostic tool.
 *
 * Rows are stored against an anonymous participant pseudonym only. The raw
 * feature vector is retained (as jsonb) so the research dataset can be used to
 * recalibrate / improve the model over time — this is the "storing stuff to be
 * given to researchers" pathway, kept free of PII by construction.
 */
export const ppdAssessments = pgTable("ppd_assessments", {
  id: serial("id").primaryKey(),
  /** Anonymous participant pseudonym (no PII). */
  participantPseudonym: text("participant_pseudonym"),
  /** Edinburgh Postnatal Depression Scale total (0–30), when supplied. */
  epdsScore: integer("epds_score"),
  /** De-identified model input features (booleans/numbers only, no free text). */
  features: jsonb("features").notNull(),
  /** Model-estimated 0–1 probability of PPD within ~6 months. */
  riskProbability: real("risk_probability").notNull(),
  /** 0–100 risk score, same orientation as the app's wellness score. */
  riskScore: integer("risk_score").notNull(),
  /** "low" | "moderate" | "high" */
  riskTier: text("risk_tier").notNull(),
  /** Model version so recalibrations remain comparable across the dataset. */
  modelVersion: text("model_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPpdAssessmentSchema = createInsertSchema(ppdAssessments).omit({
  id: true,
  createdAt: true,
});

export type PpdAssessment = typeof ppdAssessments.$inferSelect;
export type InsertPpdAssessment = z.infer<typeof insertPpdAssessmentSchema>;

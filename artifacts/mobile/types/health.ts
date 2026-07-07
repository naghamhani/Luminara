import { z } from "zod";
import type { CheckIn } from "@/context/AppContext";

// ---------------------------------------------------------------------------
// Shared date validation
// ---------------------------------------------------------------------------

/** True when `s` is YYYY-MM-DD AND a real calendar date (rejects e.g. 02-31,
 *  04-31, 2025-13-01) rather than relying on JS Date's lenient rollover
 *  (`new Date("2025-02-31")` silently becomes March 3rd). */
function isRealCalendarDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** Reusable YYYY-MM-DD schema: format + real-calendar-date validation. */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine(isRealCalendarDate, "That date doesn't exist on the calendar");

// ---------------------------------------------------------------------------
// Reproductive phases
// ---------------------------------------------------------------------------

export type ReproductivePhase =
  | "menstrual"
  | "follicular"
  | "ovulation"
  | "luteal"
  | "pregnancy"
  | "postpartum"
  | "menopause"
  | "unknown";

export const REPRODUCTIVE_PHASE_LABELS: Record<ReproductivePhase, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
  pregnancy: "Pregnancy",
  postpartum: "Postpartum",
  menopause: "Menopause",
  unknown: "Not enough data",
};

// ---------------------------------------------------------------------------
// Medical records (doctor notes, imported documents)
// ---------------------------------------------------------------------------

export const MEDICAL_RECORD_TYPES = [
  "doctor_note",
  "lab_report",
  "imaging",
  "prescription",
  "discharge_summary",
  "other",
] as const;
export type MedicalRecordType = (typeof MEDICAL_RECORD_TYPES)[number];

export const MEDICAL_RECORD_TYPE_LABELS: Record<MedicalRecordType, string> = {
  doctor_note: "Doctor note",
  lab_report: "Lab report",
  imaging: "Imaging",
  prescription: "Prescription",
  discharge_summary: "Discharge summary",
  other: "Other",
};

export interface MedicalRecord {
  id: string;
  type: MedicalRecordType;
  title: string;
  /** Name of the healthcare provider the note originates from (attribution). */
  provider: string;
  facility?: string;
  /** Date of the visit / document, YYYY-MM-DD. */
  date: string;
  /** Text content of the note (typed in or transcribed from an attachment). */
  content: string;
  /** Local file/image URI of an attached photo or document, if any. */
  attachmentUri?: string;
  attachmentMime?: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
}

export const MedicalRecordInputSchema = z.object({
  type: z.enum(MEDICAL_RECORD_TYPES),
  title: z.string().trim().min(1, "Title is required").max(200),
  provider: z.string().trim().min(1, "Provider name is required").max(120),
  facility: z.string().trim().max(160).optional(),
  date: dateStringSchema,
  content: z.string().max(20000),
  attachmentUri: z.string().optional(),
  attachmentMime: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
});
export type MedicalRecordInput = z.infer<typeof MedicalRecordInputSchema>;

// ---------------------------------------------------------------------------
// Lab results
// ---------------------------------------------------------------------------

export const LAB_CATEGORIES = [
  "hormone",
  "blood",
  "thyroid",
  "vitamin",
  "metabolic",
  "other",
] as const;
export type LabCategory = (typeof LAB_CATEGORIES)[number];

export const LAB_CATEGORY_LABELS: Record<LabCategory, string> = {
  hormone: "Hormones",
  blood: "Blood work",
  thyroid: "Thyroid",
  vitamin: "Vitamins & minerals",
  metabolic: "Metabolic",
  other: "Other",
};

export type LabFlag = "low" | "normal" | "high";

export interface LabMarker {
  /** e.g. "TSH", "Estradiol", "Hemoglobin" */
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  /** Derived from value vs reference range; "normal" when no range given. */
  flag: LabFlag;
}

export interface LabResult {
  id: string;
  /** e.g. "Postpartum hormone panel" */
  testName: string;
  category: LabCategory;
  /** Collection date, YYYY-MM-DD. */
  date: string;
  provider?: string;
  markers: LabMarker[];
  notes?: string;
  createdAt: string;
}

export function computeMarkerFlag(
  value: number,
  refLow?: number,
  refHigh?: number
): LabFlag {
  if (refLow !== undefined && value < refLow) return "low";
  if (refHigh !== undefined && value > refHigh) return "high";
  return "normal";
}

export const LabMarkerInputSchema = z
  .object({
    name: z.string().trim().min(1, "Marker name is required").max(80),
    value: z.number().finite(),
    unit: z.string().trim().min(1, "Unit is required").max(30),
    refLow: z.number().finite().optional(),
    refHigh: z.number().finite().optional(),
  })
  .refine(
    (m) => m.refLow === undefined || m.refHigh === undefined || m.refLow <= m.refHigh,
    { message: "Reference range low must be ≤ high" }
  );

export const LabResultInputSchema = z.object({
  testName: z.string().trim().min(1, "Test name is required").max(160),
  category: z.enum(LAB_CATEGORIES),
  date: dateStringSchema,
  provider: z.string().trim().max(120).optional(),
  markers: z.array(LabMarkerInputSchema).min(1, "Add at least one marker"),
  notes: z.string().max(4000).optional(),
});
export type LabResultInput = z.infer<typeof LabResultInputSchema>;

// ---------------------------------------------------------------------------
// Cycle & biomarker tracking
// ---------------------------------------------------------------------------

export const FLOW_LEVELS = ["none", "spotting", "light", "medium", "heavy"] as const;
export type FlowLevel = (typeof FLOW_LEVELS)[number];

export const CERVICAL_MUCUS_TYPES = [
  "dry",
  "sticky",
  "creamy",
  "watery",
  "eggwhite",
] as const;
export type CervicalMucusType = (typeof CERVICAL_MUCUS_TYPES)[number];

export type TestOutcome = "not_taken" | "negative" | "positive";

export const CYCLE_SYMPTOMS = [
  "cramps",
  "headache",
  "bloating",
  "breast tenderness",
  "fatigue",
  "nausea",
  "back pain",
  "mood swings",
  "acne",
  "cravings",
  "insomnia",
  "hot flashes",
] as const;

export interface CycleEntry {
  id: string;
  /** YYYY-MM-DD — one entry per calendar day (upsert by date). */
  date: string;
  flow?: FlowLevel;
  /** Basal body temperature in °C (e.g. 36.55). */
  bbt?: number;
  cervicalMucus?: CervicalMucusType;
  ovulationTest?: TestOutcome;
  pregnancyTest?: TestOutcome;
  symptoms: string[];
  notes?: string;
  createdAt: string;
}

export const CycleEntryInputSchema = z.object({
  date: dateStringSchema,
  flow: z.enum(FLOW_LEVELS).optional(),
  bbt: z
    .number()
    .min(34, "BBT out of plausible range (34–42 °C)")
    .max(42, "BBT out of plausible range (34–42 °C)")
    .optional(),
  cervicalMucus: z.enum(CERVICAL_MUCUS_TYPES).optional(),
  ovulationTest: z.enum(["not_taken", "negative", "positive"]).optional(),
  pregnancyTest: z.enum(["not_taken", "negative", "positive"]).optional(),
  symptoms: z.array(z.string().trim().min(1).max(40)).max(20),
  notes: z.string().max(2000).optional(),
});
export type CycleEntryInput = z.infer<typeof CycleEntryInputSchema>;

export interface CyclePrediction {
  /** YYYY-MM-DD of predicted next period start. */
  nextPeriodStart?: string;
  ovulationDate?: string;
  fertileWindowStart?: string;
  fertileWindowEnd?: string;
  avgCycleLength?: number;
  avgPeriodLength?: number;
  /** 1-based day within the current cycle, if a cycle has been detected. */
  currentCycleDay?: number;
  confidence: "none" | "low" | "medium" | "high";
}

// ---------------------------------------------------------------------------
// Medications & supplements
// ---------------------------------------------------------------------------

export const MEDICATION_KINDS = ["medication", "supplement", "vitamin"] as const;
export type MedicationKind = (typeof MEDICATION_KINDS)[number];

export interface Medication {
  id: string;
  name: string;
  kind: MedicationKind;
  /** e.g. "50 mg" */
  dosage: string;
  /** e.g. "Once daily, with breakfast" */
  frequency: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
  providerNotes?: string;
  active: boolean;
  createdAt: string;
}

export const MedicationInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    kind: z.enum(MEDICATION_KINDS),
    dosage: z.string().trim().min(1, "Dosage is required").max(80),
    frequency: z.string().trim().min(1, "Frequency is required").max(120),
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional(),
    prescribedBy: z.string().trim().max(120).optional(),
    providerNotes: z.string().max(2000).optional(),
    active: z.boolean(),
  })
  .refine((m) => !m.endDate || m.endDate >= m.startDate, {
    message: "End date must be on or after start date",
  });
export type MedicationInput = z.infer<typeof MedicationInputSchema>;

// ---------------------------------------------------------------------------
// Partner / support-person observations
// ---------------------------------------------------------------------------

export const PARTNER_STRESS_FACTORS = [
  "work pressure",
  "financial strain",
  "sleep deprivation",
  "family conflict",
  "health worry",
  "isolation",
  "relationship tension",
  "childcare load",
] as const;

export const PARTNER_SUPPORT_ACTIVITIES = [
  "night feeds",
  "cooked meals",
  "listened / talked",
  "took over childcare",
  "encouraged rest",
  "household chores",
  "arranged help",
  "quality time together",
] as const;

export interface PartnerObservation {
  id: string;
  /** YYYY-MM-DD the observation refers to. */
  date: string;
  observerName: string;
  /** Partner-perceived ratings of the user, 1 (low) – 5 (high). */
  mood: number;
  energy: number;
  sleepQuality: number;
  overallWellbeing: number;
  stressFactors: string[];
  supportProvided: string[];
  /** Concerning behaviours or health changes noticed, if any. */
  concerns?: string;
  /** Life events / context (visitors, milestones, stressors). */
  contextNotes?: string;
  /** Whether the partner chose to make this entry visible to the user. */
  sharedWithUser: boolean;
  createdAt: string;
}

export const PartnerObservationInputSchema = z.object({
  date: dateStringSchema,
  observerName: z.string().trim().min(1).max(80),
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  sleepQuality: z.number().int().min(1).max(5),
  overallWellbeing: z.number().int().min(1).max(5),
  stressFactors: z.array(z.string().trim().min(1).max(60)).max(20),
  supportProvided: z.array(z.string().trim().min(1).max(60)).max(20),
  concerns: z.string().max(2000).optional(),
  contextNotes: z.string().max(2000).optional(),
  sharedWithUser: z.boolean(),
});
export type PartnerObservationInput = z.infer<typeof PartnerObservationInputSchema>;

export interface PartnerSettings {
  /** Whether the user has enabled the partner portal at all. */
  enabled: boolean;
  partnerName: string;
  /** SHA-256 hex digest of the partner's 4–6 digit PIN (never the raw PIN). */
  pinHash?: string;
  /** User consent: partner entries may be shown to the user in insights. */
  userCanViewObservations: boolean;
  /** User consent: partner may see the user's wellness summary (never raw entries). */
  partnerCanViewSummary: boolean;
}

export const DEFAULT_PARTNER_SETTINGS: PartnerSettings = {
  enabled: false,
  partnerName: "",
  userCanViewObservations: true,
  partnerCanViewSummary: false,
};

// ---------------------------------------------------------------------------
// Care profile (optional, inclusive personalization)
// ---------------------------------------------------------------------------

/**
 * Optional self-described background used ONLY to tailor on-device wellness
 * guidance (e.g. vitamin D, anemia-screening, or gestational-diabetes
 * awareness differs across populations). Never required, never exported in
 * research bundles, never sent anywhere — and clearable at any time.
 */
export const CARE_BACKGROUNDS = [
  "black_african",
  "east_asian",
  "south_asian",
  "southeast_asian",
  "swana",
  "hispanic_latina",
  "indigenous",
  "pacific_islander",
  "white_european",
  "mixed_other",
] as const;
export type CareBackground = (typeof CARE_BACKGROUNDS)[number];

export const CARE_BACKGROUND_LABELS: Record<CareBackground, string> = {
  black_african: "Black / African descent",
  east_asian: "East Asian",
  south_asian: "South Asian",
  southeast_asian: "Southeast Asian",
  swana: "SWANA (Middle Eastern / North African)",
  hispanic_latina: "Hispanic / Latina",
  indigenous: "Indigenous / Native",
  pacific_islander: "Pacific Islander",
  white_european: "White / European descent",
  mixed_other: "Mixed / another background",
};

export interface CareProfile {
  /** Self-described backgrounds; empty = prefer not to say (fully supported). */
  backgrounds: CareBackground[];
  /**
   * Limited sun exposure for any reason — indoor lifestyle, covered clothing,
   * high-latitude winters. Affects vitamin D guidance.
   */
  limitedSunExposure: boolean;
}

export const DEFAULT_CARE_PROFILE: CareProfile = {
  backgrounds: [],
  limitedSunExposure: false,
};

// ---------------------------------------------------------------------------
// Privacy, consent & research participation
// ---------------------------------------------------------------------------

export const DATA_TYPE_KEYS = [
  "checkIns",
  "cycle",
  "labs",
  "records",
  "medications",
  "partnerObservations",
] as const;
export type DataTypeKey = (typeof DATA_TYPE_KEYS)[number];

export const DATA_TYPE_LABELS: Record<DataTypeKey, string> = {
  checkIns: "Daily wellness check-ins",
  cycle: "Cycle & biomarker logs",
  labs: "Lab results",
  records: "Medical records",
  medications: "Medications & supplements",
  partnerObservations: "Partner observations",
};

export interface ResearchConsent {
  participating: boolean;
  /** ISO timestamp when consent was granted. */
  consentDate?: string;
  /** ISO timestamp when consent was revoked (if it was). */
  revokedDate?: string;
  /** Which data types the user has agreed to contribute (anonymized). */
  dataTypes: Record<DataTypeKey, boolean>;
  /**
   * Stable random pseudonym used as participant id in exports so repeated
   * exports can be linked without any PII. Generated on first consent.
   */
  pseudonym?: string;
}

export const DEFAULT_RESEARCH_CONSENT: ResearchConsent = {
  participating: false,
  dataTypes: {
    checkIns: false,
    cycle: false,
    labs: false,
    records: false,
    medications: false,
    partnerObservations: false,
  },
};

export interface PrivacySettings {
  /** Encrypt medical records & lab results at rest (AES, key in secure store). */
  encryptSensitiveAtRest: boolean;
  /** Auto-delete data older than N months; null = keep forever. */
  retentionMonths: number | null;
  research: ResearchConsent;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  encryptSensitiveAtRest: true,
  retentionMonths: null,
  research: DEFAULT_RESEARCH_CONSENT,
};

// ---------------------------------------------------------------------------
// Snapshot (full local export) & anonymized bundle (research export)
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  exportedAt: string;
  profile: { name: string; babyName: string; birthDate: string } | null;
  checkIns: CheckIn[];
  records: MedicalRecord[];
  labResults: LabResult[];
  cycleEntries: CycleEntry[];
  medications: Medication[];
  partnerObservations: PartnerObservation[];
}

/** All dates converted to day offsets relative to the participant's earliest
 *  included entry (day 0). No names, no free-text notes, no providers. */
export interface AnonymizedBundle {
  schemaVersion: 1;
  participantId: string;
  /** Weeks postpartum at day 0, when derivable — coarse, not a date. */
  postpartumWeeksAtDayZero: number | null;
  includedDataTypes: DataTypeKey[];
  checkIns: {
    dayOffset: number;
    mood: number;
    sleep: number;
    anxiety: number;
    appetite: number;
    bonding: number;
    support: number;
    riskScore: number;
  }[];
  cycleEntries: {
    dayOffset: number;
    flow?: FlowLevel;
    bbt?: number;
    cervicalMucus?: CervicalMucusType;
    ovulationTest?: TestOutcome;
    pregnancyTest?: TestOutcome;
    symptomCount: number;
    symptoms: string[];
  }[];
  labResults: {
    dayOffset: number;
    category: LabCategory;
    // testName is deliberately excluded: it's a free-text field the user can
    // type anything into (e.g. "Sarah's panel at Kaiser") and could identify
    // them or their provider — category already conveys the clinical grouping.
    markers: { name: string; value: number; unit: string; flag: LabFlag }[];
  }[];
  medications: {
    kind: MedicationKind;
    name: string;
    startDayOffset: number;
    endDayOffset: number | null;
  }[];
  partnerObservations: {
    dayOffset: number;
    mood: number;
    energy: number;
    sleepQuality: number;
    overallWellbeing: number;
    stressFactorCount: number;
    supportActivityCount: number;
  }[];
}

// ---------------------------------------------------------------------------
// Wellness algorithm shared types
// ---------------------------------------------------------------------------

/** The original 6 PPD factors from a daily check-in. */
export interface CoreFactors {
  mood: number;
  sleep: number;
  anxiety: number;
  appetite: number;
  bonding: number;
  support: number;
}

export interface WellnessInput {
  factors?: CoreFactors;
  phase: ReproductivePhase;
  /** Markers from recent lab results (e.g. last 90 days). */
  labMarkers?: LabMarker[];
  activeMedications?: Medication[];
  /** Partner observations from roughly the last 7 days. */
  partnerObservations?: PartnerObservation[];
  /** Symptoms logged in recent cycle entries. */
  recentSymptoms?: string[];
  /** Optional self-described background for tailored (non-diagnostic) guidance. */
  careProfile?: CareProfile;
  /** Days with medium/heavy flow logged in roughly the last 60 days. */
  recentHeavyFlowDays?: number;
}

export interface WellnessContribution {
  key: string;
  label: string;
  /** Relative weight of this factor within the final score (0–1). */
  weight: number;
  /** Normalized severity of this factor (0 = no concern, 1 = max concern). */
  impact: number;
}

export interface WellnessResult {
  /** 0 (well) – 100 (high risk). Same orientation as the legacy PPD score. */
  score: number;
  level: "low" | "moderate" | "high";
  contributions: WellnessContribution[];
}

export interface RiskWindow {
  /** YYYY-MM-DD inclusive range. */
  start: string;
  end: string;
  reason: string;
  severity: "watch" | "elevated";
}

export interface Recommendation {
  id: string;
  title: string;
  body: string;
  category: "nutrition" | "exercise" | "mindfulness" | "medical" | "sleep" | "support";
  /** 1 = highest priority. */
  priority: 1 | 2 | 3;
}

export interface PartnerCorrelation {
  metric: "mood" | "sleep" | "energy" | "wellbeing";
  selfAvg: number | null;
  partnerAvg: number | null;
  /** partnerAvg − selfAvg, null when either side has no data. */
  delta: number | null;
  agreement: "aligned" | "partner_lower" | "partner_higher" | "insufficient_data";
  note: string;
}

// ---------------------------------------------------------------------------
// Provider sharing (local-first: an audit log of generated reports)
// ---------------------------------------------------------------------------

export interface ShareLogEntry {
  id: string;
  createdAt: string;
  /** Human-readable verification code stamped into the shared report. */
  code: string;
  /** Which report sections were included. */
  sections: string[];
  recipientHint?: string;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** Local-timezone YYYY-MM-DD for a Date. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Whole days from `a` to `b` (both YYYY-MM-DD); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/** Add n days to a YYYY-MM-DD string. */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateString(d);
}

export function generateId(): string {
  return (
    Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10)
  );
}

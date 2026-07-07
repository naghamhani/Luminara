import {
  AnonymizedBundle,
  DataTypeKey,
  DATA_TYPE_KEYS,
  daysBetween,
  HealthSnapshot,
  LabFlag,
  ResearchConsent,
} from "@/types/health";

/**
 * Pure, side-effect-free anonymization engine.
 *
 * These functions never touch the network or the filesystem — they only
 * transform in-memory data. Callers (screens) are responsible for writing
 * the resulting files and sharing them, and only ever with content the user
 * explicitly chose to export.
 */

// ---------------------------------------------------------------------------
// buildAnonymizedBundle
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86400000;
/** ~24 months, used as the cutoff for deriving a coarse postpartum-week figure. */
const MAX_POSTPARTUM_MONTHS_FOR_DERIVATION = 24;

function monthsBetweenDates(a: string, b: string): number {
  // Coarse month distance, good enough for a "within 24 months" gate.
  return Math.abs(daysBetween(a, b)) / 30.44;
}

/**
 * Builds a fully anonymized, offset-based bundle from a full health snapshot,
 * honoring the user's per-data-type research consent.
 *
 * Rules enforced here (see task spec):
 * - Only data types with consent.dataTypes[key] === true are included.
 * - day 0 = the earliest date across all INCLUDED entries.
 * - Every date becomes an integer dayOffset (via daysBetween).
 * - participantId = consent.pseudonym ?? "unassigned".
 * - postpartumWeeksAtDayZero is derived from profile.birthDate only when
 *   that birth date is within ~24 months of day 0; otherwise null.
 * - No names, baby name, free-text notes/concerns/contextNotes/content,
 *   provider/facility names, attachment URIs, or absolute dates appear
 *   anywhere in the output.
 */
export function buildAnonymizedBundle(
  snapshot: HealthSnapshot,
  consent: ResearchConsent
): AnonymizedBundle {
  const includedDataTypes: DataTypeKey[] = DATA_TYPE_KEYS.filter(
    (key) => consent.dataTypes[key] === true
  );
  const included = new Set(includedDataTypes);

  const includedCheckIns = included.has("checkIns") ? snapshot.checkIns : [];
  const includedCycle = included.has("cycle") ? snapshot.cycleEntries : [];
  const includedLabs = included.has("labs") ? snapshot.labResults : [];
  const includedMeds = included.has("medications") ? snapshot.medications : [];
  const includedPartnerObs = included.has("partnerObservations")
    ? snapshot.partnerObservations
    : [];
  // "records" (medical records / doctor notes) carry no structured fields in
  // AnonymizedBundle — they are free-text/provider heavy by nature, so there
  // is intentionally no records[] collection in the output even when the
  // consent flag is on. Only the participant knows they consented to it; we
  // simply never populate anything from `records` here.

  // day 0 = earliest date across all INCLUDED entries (dates only, no times).
  const allIncludedDates: string[] = [
    ...includedCheckIns.map((c) => c.date),
    ...includedCycle.map((c) => c.date),
    ...includedLabs.map((l) => l.date),
    ...includedMeds.flatMap((m) => (m.endDate ? [m.startDate, m.endDate] : [m.startDate])),
    ...includedPartnerObs.map((p) => p.date),
  ];
  const dayZero = allIncludedDates.length > 0 ? allIncludedDates.reduce((a, b) => (a < b ? a : b)) : null;

  const toOffset = (date: string): number => (dayZero ? daysBetween(dayZero, date) : 0);

  let postpartumWeeksAtDayZero: number | null = null;
  if (dayZero && snapshot.profile?.birthDate) {
    const withinWindow =
      monthsBetweenDates(snapshot.profile.birthDate, dayZero) <= MAX_POSTPARTUM_MONTHS_FOR_DERIVATION;
    if (withinWindow) {
      const weeks = Math.floor(daysBetween(snapshot.profile.birthDate, dayZero) / 7);
      // Only a coarse, non-negative week count is kept — never the birth date itself.
      postpartumWeeksAtDayZero = weeks >= 0 ? weeks : null;
    }
  }

  const bundle: AnonymizedBundle = {
    schemaVersion: 1,
    participantId: consent.pseudonym ?? "unassigned",
    postpartumWeeksAtDayZero,
    includedDataTypes,
    checkIns: includedCheckIns.map((c) => ({
      dayOffset: toOffset(c.date),
      mood: c.mood,
      sleep: c.sleep,
      anxiety: c.anxiety,
      appetite: c.appetite,
      bonding: c.bonding,
      support: c.support,
      riskScore: c.riskScore,
    })),
    cycleEntries: includedCycle.map((c) => ({
      dayOffset: toOffset(c.date),
      flow: c.flow,
      bbt: c.bbt,
      cervicalMucus: c.cervicalMucus,
      ovulationTest: c.ovulationTest,
      pregnancyTest: c.pregnancyTest,
      symptomCount: c.symptoms.length,
      // Controlled-vocabulary strings only (see CYCLE_SYMPTOMS) — never notes.
      symptoms: c.symptoms,
    })),
    labResults: includedLabs.map((l) => ({
      dayOffset: toOffset(l.date),
      category: l.category,
      // testName is free text the user typed (can be identifying — e.g. a
      // provider or facility name) and is intentionally dropped; category
      // already conveys the clinical grouping for research purposes.
      // Keep name/value/unit/flag only — never notes, provider, or ref ranges.
      markers: l.markers.map((m) => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        flag: m.flag as LabFlag,
      })),
    })),
    medications: includedMeds.map((m) => ({
      kind: m.kind,
      // NOTE (v1 scope): medication name passes through as-given. Brand names
      // can themselves be identifying/sensitive in aggregate (e.g. rare
      // medications correlating to a small population); de-identifying drug
      // names (e.g. mapping to a generic/class) is out of scope for v1 and
      // should be revisited before wider research distribution.
      name: m.name,
      startDayOffset: toOffset(m.startDate),
      endDayOffset: m.endDate ? toOffset(m.endDate) : null,
    })),
    partnerObservations: includedPartnerObs.map((p) => ({
      dayOffset: toOffset(p.date),
      mood: p.mood,
      energy: p.energy,
      sleepQuality: p.sleepQuality,
      overallWellbeing: p.overallWellbeing,
      stressFactorCount: p.stressFactors.length,
      supportActivityCount: p.supportProvided.length,
    })),
  };

  return bundle;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export interface CSVFile {
  filename: string;
  content: string;
}

/** Escapes a single CSV cell: wraps in quotes and doubles any embedded quotes
 *  whenever the value contains a comma, quote, or newline. */
function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Converts an anonymized bundle into one CSV file per non-empty collection,
 * plus a participant.csv summarizing the export itself.
 */
export function anonymizedBundleToCSVFiles(bundle: AnonymizedBundle): CSVFile[] {
  const files: CSVFile[] = [];

  files.push({
    filename: "participant.csv",
    content: toCSV(
      ["participantId", "postpartumWeeksAtDayZero", "includedDataTypes"],
      [[bundle.participantId, bundle.postpartumWeeksAtDayZero, bundle.includedDataTypes.join("|")]]
    ),
  });

  if (bundle.checkIns.length > 0) {
    files.push({
      filename: "checkins.csv",
      content: toCSV(
        ["dayOffset", "mood", "sleep", "anxiety", "appetite", "bonding", "support", "riskScore"],
        bundle.checkIns.map((c) => [
          c.dayOffset,
          c.mood,
          c.sleep,
          c.anxiety,
          c.appetite,
          c.bonding,
          c.support,
          c.riskScore,
        ])
      ),
    });
  }

  if (bundle.cycleEntries.length > 0) {
    files.push({
      filename: "cycle_entries.csv",
      content: toCSV(
        [
          "dayOffset",
          "flow",
          "bbt",
          "cervicalMucus",
          "ovulationTest",
          "pregnancyTest",
          "symptomCount",
          "symptoms",
        ],
        bundle.cycleEntries.map((c) => [
          c.dayOffset,
          c.flow ?? "",
          c.bbt ?? "",
          c.cervicalMucus ?? "",
          c.ovulationTest ?? "",
          c.pregnancyTest ?? "",
          c.symptomCount,
          c.symptoms.join("|"),
        ])
      ),
    });
  }

  if (bundle.labResults.length > 0) {
    // Flattened one row per marker.
    const rows: (string | number)[][] = [];
    for (const lab of bundle.labResults) {
      for (const marker of lab.markers) {
        rows.push([lab.dayOffset, lab.category, marker.name, marker.value, marker.unit, marker.flag]);
      }
    }
    files.push({
      filename: "lab_markers.csv",
      content: toCSV(
        ["dayOffset", "category", "markerName", "value", "unit", "flag"],
        rows
      ),
    });
  }

  if (bundle.medications.length > 0) {
    files.push({
      filename: "medications.csv",
      content: toCSV(
        ["kind", "name", "startDayOffset", "endDayOffset"],
        bundle.medications.map((m) => [m.kind, m.name, m.startDayOffset, m.endDayOffset ?? ""])
      ),
    });
  }

  if (bundle.partnerObservations.length > 0) {
    files.push({
      filename: "partner_observations.csv",
      content: toCSV(
        [
          "dayOffset",
          "mood",
          "energy",
          "sleepQuality",
          "overallWellbeing",
          "stressFactorCount",
          "supportActivityCount",
        ],
        bundle.partnerObservations.map((p) => [
          p.dayOffset,
          p.mood,
          p.energy,
          p.sleepQuality,
          p.overallWellbeing,
          p.stressFactorCount,
          p.supportActivityCount,
        ])
      ),
    });
  }

  return files;
}

// ---------------------------------------------------------------------------
// FHIR R4 export
// ---------------------------------------------------------------------------

/** Minimal local FHIR typings — just enough structure for this export, not a
 *  full FHIR type system. Kept as plain, JSON-serializable objects. */
interface FhirExtension {
  url: string;
  valueInteger?: number;
}

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirQuantity {
  value: number;
  unit: string;
}

interface FhirPatientResource {
  resourceType: "Patient";
  id: string;
}

interface FhirObservationResource {
  resourceType: "Observation";
  id: string;
  status: "final";
  code: FhirCodeableConcept;
  subject: { reference: string };
  extension: FhirExtension[];
  valueQuantity?: FhirQuantity;
  valueInteger?: number;
  interpretation?: FhirCodeableConcept[];
}

interface FhirMedicationStatementResource {
  resourceType: "MedicationStatement";
  id: string;
  status: "active" | "completed";
  medicationCodeableConcept: FhirCodeableConcept;
  subject: { reference: string };
  extension: FhirExtension[];
}

type FhirResource =
  | FhirPatientResource
  | FhirObservationResource
  | FhirMedicationStatementResource;

interface FhirBundleEntry {
  resource: FhirResource;
}

export interface FhirBundle {
  resourceType: "Bundle";
  type: "collection";
  entry: FhirBundleEntry[];
}

const DAY_OFFSET_EXTENSION_URL = "urn:luminara:dayOffset";

function dayOffsetExtension(dayOffset: number): FhirExtension {
  return { url: DAY_OFFSET_EXTENSION_URL, valueInteger: dayOffset };
}

const LAB_FLAG_TO_INTERPRETATION: Record<LabFlag, FhirCoding> = {
  low: { system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "L", display: "Low" },
  normal: { system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "N", display: "Normal" },
  high: { system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: "H", display: "High" },
};

let fhirIdCounter = 0;
function nextFhirId(prefix: string): string {
  fhirIdCounter += 1;
  return `${prefix}-${fhirIdCounter}`;
}

/**
 * Converts an anonymized bundle into a FHIR R4 `Bundle` (type "collection")
 * containing an anonymous Patient plus Observation / MedicationStatement
 * resources. No absolute dates appear anywhere — every temporal reference is
 * carried as an integer `dayOffset` extension.
 */
export function anonymizedBundleToFHIR(bundle: AnonymizedBundle): FhirBundle {
  fhirIdCounter = 0;
  const patientId = bundle.participantId || "unassigned";
  const subject = { reference: `Patient/${patientId}` };

  const entries: FhirBundleEntry[] = [];

  const patient: FhirPatientResource = { resourceType: "Patient", id: patientId };
  entries.push({ resource: patient });

  const checkInFactor = (
    label: string,
    value: number,
    dayOffset: number
  ): FhirObservationResource => ({
    resourceType: "Observation",
    id: nextFhirId("obs"),
    status: "final",
    code: { text: label },
    subject,
    extension: [dayOffsetExtension(dayOffset)],
    valueInteger: value,
  });

  for (const c of bundle.checkIns) {
    entries.push({ resource: checkInFactor("Self-reported mood (1-5)", c.mood, c.dayOffset) });
    entries.push({ resource: checkInFactor("Self-reported sleep (hours)", c.sleep, c.dayOffset) });
    entries.push({ resource: checkInFactor("Self-reported anxiety (1-5)", c.anxiety, c.dayOffset) });
    entries.push({ resource: checkInFactor("Self-reported appetite (1-5)", c.appetite, c.dayOffset) });
    entries.push({ resource: checkInFactor("Self-reported bonding (1-5)", c.bonding, c.dayOffset) });
    entries.push({ resource: checkInFactor("Self-reported support (1-5)", c.support, c.dayOffset) });
    entries.push({
      resource: {
        resourceType: "Observation",
        id: nextFhirId("obs"),
        status: "final",
        code: { text: "Postpartum wellness risk score (0-100)" },
        subject,
        extension: [dayOffsetExtension(c.dayOffset)],
        valueInteger: c.riskScore,
      },
    });
  }

  for (const c of bundle.cycleEntries) {
    if (c.bbt !== undefined) {
      entries.push({
        resource: {
          resourceType: "Observation",
          id: nextFhirId("obs"),
          status: "final",
          code: {
            coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }],
            text: "Basal body temperature",
          },
          subject,
          extension: [dayOffsetExtension(c.dayOffset)],
          valueQuantity: { value: c.bbt, unit: "°C" },
        },
      });
    }
  }

  for (const lab of bundle.labResults) {
    for (const marker of lab.markers) {
      entries.push({
        resource: {
          resourceType: "Observation",
          id: nextFhirId("obs"),
          status: "final",
          code: { text: marker.name },
          subject,
          extension: [dayOffsetExtension(lab.dayOffset)],
          valueQuantity: { value: marker.value, unit: marker.unit },
          interpretation: [{ coding: [LAB_FLAG_TO_INTERPRETATION[marker.flag]] }],
        },
      });
    }
  }

  for (const m of bundle.medications) {
    entries.push({
      resource: {
        resourceType: "MedicationStatement",
        id: nextFhirId("medstmt"),
        status: m.endDayOffset === null ? "active" : "completed",
        medicationCodeableConcept: { text: m.name },
        subject,
        extension: [
          dayOffsetExtension(m.startDayOffset),
          ...(m.endDayOffset !== null
            ? [{ url: "urn:luminara:endDayOffset", valueInteger: m.endDayOffset }]
            : []),
        ],
      },
    });
  }

  const fhirBundle: FhirBundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: entries,
  };
  return fhirBundle;
}

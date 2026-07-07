import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useApp } from "@/context/AppContext";
import {
  CareProfile,
  CervicalMucusType,
  computeMarkerFlag,
  CycleEntry,
  CycleEntryInput,
  CycleEntryInputSchema,
  DataTypeKey,
  DEFAULT_CARE_PROFILE,
  DEFAULT_PARTNER_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  FlowLevel,
  generateId,
  HealthSnapshot,
  LabMarker,
  LabResult,
  LabResultInput,
  LabResultInputSchema,
  MedicalRecord,
  MedicalRecordInput,
  MedicalRecordInputSchema,
  Medication,
  MedicationInput,
  MedicationInputSchema,
  PartnerObservation,
  PartnerObservationInput,
  PartnerObservationInputSchema,
  PartnerSettings,
  PrivacySettings,
  toDateString,
} from "@/types/health";
import { decryptString, encryptString } from "@/utils/encryption";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const RECORDS_KEY = "@luminara_records";
const LABS_KEY = "@luminara_labs";
const CYCLE_KEY = "@luminara_cycle";
const MEDICATIONS_KEY = "@luminara_medications";
const PARTNER_OBS_KEY = "@luminara_partner_obs";
const PARTNER_SETTINGS_KEY = "@luminara_partner_settings";
const PRIVACY_KEY = "@luminara_privacy";
// Optional inclusive-personalization profile. Deliberately excluded from
// snapshots and research bundles — it exists only to tailor on-device guidance.
const CARE_PROFILE_KEY = "@luminara_care_profile";
const SEED_VERSION_KEY = "@luminara_health_seed_version";
const SEED_VERSION = "h2"; // bump this to force a fresh re-seed

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface HealthContextType {
  isLoading: boolean;
  records: MedicalRecord[];
  labResults: LabResult[];
  cycleEntries: CycleEntry[];
  medications: Medication[];
  partnerObservations: PartnerObservation[];
  partnerSettings: PartnerSettings;
  privacySettings: PrivacySettings;
  careProfile: CareProfile;
  addRecord: (input: MedicalRecordInput) => Promise<MedicalRecord>;
  updateRecord: (id: string, patch: Partial<MedicalRecordInput>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  addLabResult: (input: LabResultInput) => Promise<LabResult>;
  deleteLabResult: (id: string) => Promise<void>;
  upsertCycleEntry: (input: CycleEntryInput) => Promise<CycleEntry>;
  deleteCycleEntry: (id: string) => Promise<void>;
  addMedication: (input: MedicationInput) => Promise<Medication>;
  updateMedication: (id: string, patch: Partial<MedicationInput>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  addPartnerObservation: (
    input: PartnerObservationInput
  ) => Promise<PartnerObservation>;
  deletePartnerObservation: (id: string) => Promise<void>;
  savePartnerSettings: (s: PartnerSettings) => Promise<void>;
  savePrivacySettings: (s: PrivacySettings) => Promise<void>;
  saveCareProfile: (p: CareProfile) => Promise<void>;
  clearHealthDataType: (key: DataTypeKey) => Promise<void>;
  clearAllHealthData: () => Promise<void>;
  /** Full factory reset: storage + in-memory state, used by "Reset App Data". */
  resetAll: () => Promise<void>;
  buildSnapshot: () => HealthSnapshot;
}

const HealthContext = createContext<HealthContextType | null>(null);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
}

function monthsAgo(n: number): string {
  const d = new Date();
  // Date.setMonth silently rolls overflow days into the following month
  // (e.g. May 31 minus 1 month has no "April 31", so it becomes May 1),
  // which shifts the retention cutoff later than intended and can delete
  // several extra days of otherwise in-window data. Clamp to the last valid
  // day of the target month instead.
  const targetMonthIndex = d.getMonth() - n;
  const daysInTargetMonth = new Date(d.getFullYear(), targetMonthIndex + 1, 0).getDate();
  return toDateString(
    new Date(d.getFullYear(), targetMonthIndex, Math.min(d.getDate(), daysInTargetMonth))
  );
}

function sortByDateDesc<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Loads and parses one stored collection in isolation: a corrupted or
 * undecryptable value for THIS key falls back to an empty array rather than
 * throwing out of the shared load effect, which would otherwise abort
 * loading every other collection too.
 */
async function safeLoadCollection<T>(
  raw: string | null,
  decrypt?: (s: string) => Promise<string>
): Promise<T[]> {
  if (!raw) return [];
  try {
    const json = decrypt ? await decrypt(raw) : raw;
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Parses a stored settings object in isolation, falling back to `fallback`
 *  (merged under any partial parse) so one corrupted settings key doesn't
 *  abort loading the rest of the app's health data. */
function safeParseSettings<T extends object>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** Deterministic pseudo-random in [0, 1) so seed data is stable per day. */
function seededNoise(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Seed data — a realistic postpartum storyline for Nagham (Laila, 2025-08-06).
// Mirrors the SEED_VERSION pattern used by AppContext.
// ---------------------------------------------------------------------------

/** Period start days-ago for two complete ~29-day cycles + the current partial one. */
const SEED_CYCLE_STARTS = [9, 38, 67];
const SEED_CYCLE_LENGTH = 29;
const SEED_FLOW_BY_DAY: FlowLevel[] = ["medium", "heavy", "medium", "light", "spotting"];

function seedMucusForDay(day: number): CervicalMucusType | undefined {
  if (day <= 4) return undefined; // flow days
  if (day <= 7) return "dry";
  if (day <= 10) return "sticky";
  if (day <= 12) return "creamy";
  if (day === 13) return "watery";
  if (day === 14) return "eggwhite";
  if (day === 15) return "watery";
  if (day === 16) return "creamy";
  if (day <= 20) return "sticky";
  return "dry";
}

function buildSeedCycleEntries(): CycleEntry[] {
  const entries: CycleEntry[] = [];

  for (let offset = SEED_CYCLE_STARTS[SEED_CYCLE_STARTS.length - 1]; offset >= 0; offset--) {
    const start = SEED_CYCLE_STARTS.find(
      (s) => offset <= s && s - offset < SEED_CYCLE_LENGTH
    );
    if (start === undefined) continue;
    const day = start - offset; // 0-based day within the cycle
    const isCompleteCycle = start !== SEED_CYCLE_STARTS[0];

    // ~70% coverage: always keep flow days and the fertile peak, skip a
    // deterministic ~30% of the rest.
    const mustInclude = day <= 2 || (isCompleteCycle && day >= 13 && day <= 15);
    const probability = day <= 4 ? 0.85 : 0.68;
    if (!mustInclude && seededNoise(offset * 17 + 2) > probability) continue;

    const date = daysAgo(offset);
    const flow = day <= 4 ? SEED_FLOW_BY_DAY[day] : undefined;

    // Biphasic BBT with noise: 36.25–36.55 before ovulation, 36.6–36.9 after.
    let bbt: number | undefined;
    if (seededNoise(offset * 5 + 1) < 0.85) {
      bbt =
        day < 15
          ? round2(36.25 + seededNoise(offset * 7 + 3) * 0.3)
          : round2(36.6 + seededNoise(offset * 7 + 3) * 0.3);
    }

    const includeMucus =
      (isCompleteCycle && day >= 13 && day <= 15) ||
      seededNoise(offset * 11 + 5) < 0.8;
    const cervicalMucus = includeMucus ? seedMucusForDay(day) : undefined;

    let ovulationTest: CycleEntry["ovulationTest"];
    if (isCompleteCycle && day === 14) ovulationTest = "positive";
    else if (isCompleteCycle && day === 13) ovulationTest = "negative";
    else if (isCompleteCycle && day === 12 && seededNoise(offset * 19 + 4) < 0.5)
      ovulationTest = "negative";

    const pregnancyTest: CycleEntry["pregnancyTest"] =
      isCompleteCycle && day === 28 ? "negative" : undefined;

    const symptoms: string[] = [];
    if (day <= 1) symptoms.push("cramps", "fatigue");
    else if (day === 2) symptoms.push("cramps");
    else if (day === 3 && seededNoise(offset * 23 + 6) < 0.5) symptoms.push("fatigue");
    if (day === 14 && seededNoise(offset * 29 + 8) < 0.4) symptoms.push("cramps");
    if (day >= 22 && day <= 27) {
      symptoms.push("breast tenderness");
      if (seededNoise(offset * 31 + 9) < 0.35) symptoms.push("mood swings");
      if (seededNoise(offset * 37 + 10) < 0.3) symptoms.push("bloating");
      if (seededNoise(offset * 41 + 11) < 0.25) symptoms.push("cravings");
    }
    if (seededNoise(offset * 43 + 12) < 0.08) symptoms.push("headache");
    if (seededNoise(offset * 47 + 13) < 0.06) symptoms.push("insomnia");

    let notes: string | undefined;
    if (day === 0) notes = "Period started today.";
    else if (isCompleteCycle && day === 14)
      notes = "Clear, stretchy mucus and a positive ovulation test.";

    entries.push({
      id: `cyc_${date}_seed`,
      date,
      flow,
      bbt,
      cervicalMucus,
      ovulationTest,
      pregnancyTest,
      symptoms,
      notes,
      createdAt: `${date}T07:30:00.000Z`,
    });
  }

  return sortByDateDesc(entries);
}

function buildSeedRecords(): MedicalRecord[] {
  const records: MedicalRecord[] = [
    {
      id: "rec_seed_postpartum_visit",
      type: "doctor_note",
      title: "6-week postpartum check-up",
      provider: "Dr. Rana Haddad",
      facility: "Amman Women's Health Clinic",
      date: "2025-09-17",
      content:
        "Six-week postpartum visit. Healing well; incision site closed with no signs of infection. Blood pressure 112/74. We talked about mood — Nagham reports tearful days and broken sleep, so we reviewed warning signs together and started sertraline 50 mg daily for postpartum mood support. Breastfeeding going well overall. Cleared for light exercise. Follow up in 6-8 weeks or sooner if mood dips.",
      tags: ["postpartum", "follow-up", "mood"],
      createdAt: "2025-09-17T10:00:00.000Z",
    },
    {
      id: "rec_seed_lactation",
      type: "doctor_note",
      title: "Lactation consultation",
      provider: "Lina Qasem, IBCLC",
      facility: "Amman Women's Health Clinic",
      date: "2025-08-27",
      content:
        "Lactation consult at 3 weeks. Laila latching shallow on the right side — adjusted positioning to cross-cradle with more chin contact; latch improved during the visit. Weight gain on track (28 g/day). Encouraged feeding on demand and offered strategies for the evening cluster feeds. Reassured mother that supply is adequate; plan to check in by phone in two weeks.",
      tags: ["breastfeeding", "lactation"],
      createdAt: "2025-08-27T10:00:00.000Z",
    },
    {
      id: "rec_seed_gp_followup",
      type: "doctor_note",
      title: "GP follow-up — energy and blood work review",
      provider: "Dr. Samir Khoury",
      facility: "Jabal Amman Family Practice",
      date: daysAgo(12),
      content:
        "Follow-up for ongoing fatigue. Reviewed recent complete blood count: hemoglobin 11.2 g/dL — mild anemia, likely iron deficiency after pregnancy and breastfeeding. Started dietary advice (iron-rich foods with vitamin C, spacing tea away from meals) and will recheck hemoglobin and ferritin in 8 weeks. Mood stable on sertraline; sleep still fragmented but improving. Continue current medications.",
      tags: ["anemia", "fatigue", "follow-up"],
      createdAt: `${daysAgo(12)}T10:00:00.000Z`,
    },
  ];
  return sortByDateDesc(records);
}

function seedMarker(
  name: string,
  value: number,
  unit: string,
  refLow?: number,
  refHigh?: number
): LabMarker {
  return { name, value, unit, refLow, refHigh, flag: computeMarkerFlag(value, refLow, refHigh) };
}

function buildSeedLabs(): LabResult[] {
  const labs: LabResult[] = [
    {
      id: "lab_seed_thyroid",
      testName: "Postpartum thyroid panel",
      category: "thyroid",
      date: daysAgo(35),
      provider: "Dr. Rana Haddad",
      markers: [
        seedMarker("TSH", 4.8, "mIU/L", 0.4, 4.0),
        seedMarker("Free T4", 1.1, "ng/dL", 0.8, 1.8),
      ],
      notes:
        "TSH slightly above range — can happen in the first year postpartum. Dr. Haddad suggests repeating the panel in 6-8 weeks. Not a diagnosis — review with your healthcare provider.",
      createdAt: `${daysAgo(35)}T09:00:00.000Z`,
    },
    {
      id: "lab_seed_cbc",
      testName: "Complete blood count",
      category: "blood",
      date: daysAgo(14),
      provider: "Dr. Samir Khoury",
      markers: [
        seedMarker("Hemoglobin", 11.2, "g/dL", 12, 15.5),
        seedMarker("White blood cells", 6.8, "10^9/L", 4, 11),
        seedMarker("Platelets", 262, "10^9/L", 150, 400),
      ],
      notes: "Mild anemia — iron-rich diet discussed; recheck with ferritin in 8 weeks.",
      createdAt: `${daysAgo(14)}T09:00:00.000Z`,
    },
  ];
  return sortByDateDesc(labs);
}

function buildSeedMedications(): Medication[] {
  const meds: Medication[] = [
    {
      id: "med_seed_prenatal",
      name: "Prenatal multivitamin",
      kind: "vitamin",
      dosage: "1 tablet",
      frequency: "Once daily, with breakfast",
      startDate: "2024-12-10",
      active: true,
      createdAt: "2024-12-10T08:00:00.000Z",
    },
    {
      id: "med_seed_vitd",
      name: "Vitamin D",
      kind: "supplement",
      dosage: "1000 IU",
      frequency: "Once daily",
      startDate: "2025-09-01",
      active: true,
      createdAt: "2025-09-01T08:00:00.000Z",
    },
    {
      id: "med_seed_sertraline",
      name: "Sertraline",
      kind: "medication",
      dosage: "50 mg",
      frequency: "Once daily, in the morning",
      startDate: "2025-09-17",
      prescribedBy: "Dr. Rana Haddad",
      providerNotes:
        "Started at the six-week visit for postpartum mood support. Safe to continue while breastfeeding at this dose. Review at the next follow-up; call the clinic if side effects or mood changes appear.",
      active: true,
      createdAt: "2025-09-17T10:30:00.000Z",
    },
  ];
  // Medications are kept newest-first by start date, matching other collections.
  return [...meds].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

interface SeedObservationSpec {
  offset: number;
  mood: number;
  energy: number;
  sleepQuality: number;
  overallWellbeing: number;
  stressFactors: string[];
  supportProvided: string[];
  concerns?: string;
  contextNotes?: string;
  sharedWithUser: boolean;
}

function buildSeedPartnerObservations(): PartnerObservation[] {
  // Loosely tracks the seeded check-in moods (4,3,4,3,4,5,3,4,3,4,2,...),
  // with a couple of days where Sam rated things lower than Nagham did.
  const specs: SeedObservationSpec[] = [
    {
      offset: 1,
      mood: 4,
      energy: 3,
      sleepQuality: 3,
      overallWellbeing: 4,
      stressFactors: [],
      supportProvided: ["cooked meals", "night feeds"],
      contextNotes: "Laila smiled at her — she was glowing all afternoon.",
      sharedWithUser: true,
    },
    {
      offset: 3,
      // Self-reported mood was 4 this day; Sam saw her as more worn down.
      mood: 3,
      energy: 2,
      sleepQuality: 3,
      overallWellbeing: 3,
      stressFactors: ["sleep deprivation"],
      supportProvided: ["night feeds", "household chores"],
      sharedWithUser: true,
    },
    {
      offset: 5,
      mood: 4,
      energy: 4,
      sleepQuality: 3,
      overallWellbeing: 4,
      stressFactors: [],
      supportProvided: ["quality time together"],
      contextNotes: "Short walk together in the evening — good conversation.",
      sharedWithUser: true,
    },
    {
      offset: 7,
      // Self-reported mood was 3; Sam noticed more withdrawal than usual.
      mood: 2,
      energy: 2,
      sleepQuality: 2,
      overallWellbeing: 2,
      stressFactors: ["sleep deprivation", "isolation"],
      supportProvided: ["listened / talked", "took over childcare"],
      concerns:
        "She seemed more withdrawn than usual and barely ate lunch. Keeping a closer eye this week and encouraging her to rest.",
      sharedWithUser: false,
    },
    {
      offset: 9,
      mood: 3,
      energy: 3,
      sleepQuality: 2,
      overallWellbeing: 3,
      stressFactors: ["childcare load"],
      supportProvided: ["household chores", "encouraged rest"],
      sharedWithUser: true,
    },
    {
      offset: 11,
      mood: 2,
      energy: 2,
      sleepQuality: 2,
      overallWellbeing: 2,
      stressFactors: ["sleep deprivation", "work pressure"],
      supportProvided: ["encouraged rest", "night feeds"],
      contextNotes: "Rough night — Laila woke four times. I took the early shift.",
      sharedWithUser: false,
    },
    {
      offset: 13,
      mood: 4,
      energy: 3,
      sleepQuality: 3,
      overallWellbeing: 4,
      stressFactors: [],
      supportProvided: ["cooked meals", "arranged help"],
      contextNotes: "Her mother visited and took Laila for a few hours.",
      sharedWithUser: true,
    },
  ];

  return sortByDateDesc(
    specs.map((s) => {
      const date = daysAgo(s.offset);
      return {
        id: `pobs_${date}_seed`,
        date,
        observerName: "Sam",
        mood: s.mood,
        energy: s.energy,
        sleepQuality: s.sleepQuality,
        overallWellbeing: s.overallWellbeing,
        stressFactors: s.stressFactors,
        supportProvided: s.supportProvided,
        concerns: s.concerns,
        contextNotes: s.contextNotes,
        sharedWithUser: s.sharedWithUser,
        createdAt: `${date}T20:30:00.000Z`,
      };
    })
  );
}

async function buildSeedPartnerSettings(): Promise<PartnerSettings> {
  const pinHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "1234"
  );
  return {
    enabled: true,
    partnerName: "Sam",
    pinHash,
    userCanViewObservations: true,
    partnerCanViewSummary: true,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function HealthProvider({ children }: { children: React.ReactNode }) {
  // HealthProvider must be nested inside AppProvider: buildSnapshot() pulls
  // the legacy profile and check-ins from useApp().
  const { profile, checkIns } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [cycleEntries, setCycleEntries] = useState<CycleEntry[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [partnerObservations, setPartnerObservations] = useState<PartnerObservation[]>(
    []
  );
  const [partnerSettings, setPartnerSettings] = useState<PartnerSettings>(
    DEFAULT_PARTNER_SETTINGS
  );
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(
    DEFAULT_PRIVACY_SETTINGS
  );
  const [careProfile, setCareProfile] = useState<CareProfile>(DEFAULT_CARE_PROFILE);

  // Refs mirror the latest state so async mutation callbacks never read stale
  // closures, and so persistence happens only inside mutations (never on render).
  const recordsRef = useRef<MedicalRecord[]>([]);
  const labsRef = useRef<LabResult[]>([]);
  const cycleRef = useRef<CycleEntry[]>([]);
  const medsRef = useRef<Medication[]>([]);
  const partnerObsRef = useRef<PartnerObservation[]>([]);
  const privacyRef = useRef<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);

  const commitRecords = useCallback((next: MedicalRecord[]) => {
    recordsRef.current = next;
    setRecords(next);
  }, []);
  const commitLabs = useCallback((next: LabResult[]) => {
    labsRef.current = next;
    setLabResults(next);
  }, []);
  const commitCycle = useCallback((next: CycleEntry[]) => {
    cycleRef.current = next;
    setCycleEntries(next);
  }, []);
  const commitMeds = useCallback((next: Medication[]) => {
    medsRef.current = next;
    setMedications(next);
  }, []);
  const commitPartnerObs = useCallback((next: PartnerObservation[]) => {
    partnerObsRef.current = next;
    setPartnerObservations(next);
  }, []);
  const commitPrivacy = useCallback((next: PrivacySettings) => {
    privacyRef.current = next;
    setPrivacySettings(next);
  }, []);

  /** Persist a sensitive collection, encrypted when the setting is on. */
  const persistSensitive = useCallback(
    async (storageKey: string, value: unknown, encrypt: boolean) => {
      const json = JSON.stringify(value);
      const payload = encrypt ? await encryptString(json) : json;
      await AsyncStorage.setItem(storageKey, payload);
    },
    []
  );

  const persistPlain = useCallback(async (storageKey: string, value: unknown) => {
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  }, []);

  // -------------------------------------------------------------------------
  // Load (with one-time seeding and retention cleanup)
  // -------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        const seedVersion = await AsyncStorage.getItem(SEED_VERSION_KEY);

        // The care profile is the user's own identity setting — load it in
        // both branches so it survives demo re-seeds.
        const rawCareProfile = await AsyncStorage.getItem(CARE_PROFILE_KEY);
        setCareProfile(safeParseSettings(rawCareProfile, DEFAULT_CARE_PROFILE));

        if (seedVersion !== SEED_VERSION) {
          // Fresh seed with relative dates (same pattern as AppContext).
          const seedCycle = buildSeedCycleEntries();
          const seedRecords = buildSeedRecords();
          const seedLabs = buildSeedLabs();
          const seedMeds = buildSeedMedications();
          const seedObs = buildSeedPartnerObservations();
          const seedPartner = await buildSeedPartnerSettings();
          const seedPrivacy = DEFAULT_PRIVACY_SETTINGS;

          await Promise.all([
            persistSensitive(RECORDS_KEY, seedRecords, seedPrivacy.encryptSensitiveAtRest),
            persistSensitive(LABS_KEY, seedLabs, seedPrivacy.encryptSensitiveAtRest),
            persistPlain(CYCLE_KEY, seedCycle),
            persistPlain(MEDICATIONS_KEY, seedMeds),
            persistPlain(PARTNER_OBS_KEY, seedObs),
            persistPlain(PARTNER_SETTINGS_KEY, seedPartner),
            persistPlain(PRIVACY_KEY, seedPrivacy),
          ]);
          await AsyncStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);

          commitRecords(seedRecords);
          commitLabs(seedLabs);
          commitCycle(seedCycle);
          commitMeds(seedMeds);
          commitPartnerObs(seedObs);
          setPartnerSettings(seedPartner);
          commitPrivacy(seedPrivacy);
          return;
        }

        const [
          rawRecords,
          rawLabs,
          rawCycle,
          rawMeds,
          rawObs,
          rawPartner,
          rawPrivacy,
        ] = await Promise.all([
          AsyncStorage.getItem(RECORDS_KEY),
          AsyncStorage.getItem(LABS_KEY),
          AsyncStorage.getItem(CYCLE_KEY),
          AsyncStorage.getItem(MEDICATIONS_KEY),
          AsyncStorage.getItem(PARTNER_OBS_KEY),
          AsyncStorage.getItem(PARTNER_SETTINGS_KEY),
          AsyncStorage.getItem(PRIVACY_KEY),
        ]);

        const loadedPrivacy: PrivacySettings = safeParseSettings(rawPrivacy, DEFAULT_PRIVACY_SETTINGS);
        const loadedPartner: PartnerSettings = safeParseSettings(rawPartner, DEFAULT_PARTNER_SETTINGS);

        // decryptString is plaintext-tolerant, so payloads written before
        // encryption was enabled still parse. Each collection is loaded in
        // isolation (safeLoadCollection swallows its own parse/decrypt
        // errors) so a single corrupted key can't blank every collection.
        let loadedRecords: MedicalRecord[] = await safeLoadCollection<MedicalRecord>(
          rawRecords,
          decryptString
        );
        let loadedLabs: LabResult[] = await safeLoadCollection<LabResult>(rawLabs, decryptString);
        let loadedCycle: CycleEntry[] = await safeLoadCollection<CycleEntry>(rawCycle);
        let loadedMeds: Medication[] = await safeLoadCollection<Medication>(rawMeds);
        let loadedObs: PartnerObservation[] = await safeLoadCollection<PartnerObservation>(rawObs);

        // Retention: drop anything older than the cutoff, then persist.
        if (loadedPrivacy.retentionMonths != null) {
          const cutoff = monthsAgo(loadedPrivacy.retentionMonths);
          const trimmedRecords = loadedRecords.filter((r) => r.date >= cutoff);
          const trimmedLabs = loadedLabs.filter((l) => l.date >= cutoff);
          const trimmedCycle = loadedCycle.filter((c) => c.date >= cutoff);
          const trimmedObs = loadedObs.filter((o) => o.date >= cutoff);
          // Active medications are kept regardless of start date — the user is
          // still taking them; only long-ended courses age out.
          const trimmedMeds = loadedMeds.filter(
            (m) => m.active || (m.endDate ?? m.startDate) >= cutoff
          );

          const persists: Promise<void>[] = [];
          if (trimmedRecords.length !== loadedRecords.length) {
            loadedRecords = trimmedRecords;
            persists.push(
              persistSensitive(
                RECORDS_KEY,
                trimmedRecords,
                loadedPrivacy.encryptSensitiveAtRest
              )
            );
          }
          if (trimmedLabs.length !== loadedLabs.length) {
            loadedLabs = trimmedLabs;
            persists.push(
              persistSensitive(
                LABS_KEY,
                trimmedLabs,
                loadedPrivacy.encryptSensitiveAtRest
              )
            );
          }
          if (trimmedCycle.length !== loadedCycle.length) {
            loadedCycle = trimmedCycle;
            persists.push(persistPlain(CYCLE_KEY, trimmedCycle));
          }
          if (trimmedMeds.length !== loadedMeds.length) {
            loadedMeds = trimmedMeds;
            persists.push(persistPlain(MEDICATIONS_KEY, trimmedMeds));
          }
          if (trimmedObs.length !== loadedObs.length) {
            loadedObs = trimmedObs;
            persists.push(persistPlain(PARTNER_OBS_KEY, trimmedObs));
          }
          if (persists.length > 0) await Promise.all(persists);
        }

        commitRecords(sortByDateDesc(loadedRecords));
        commitLabs(sortByDateDesc(loadedLabs));
        commitCycle(sortByDateDesc(loadedCycle));
        commitMeds(
          [...loadedMeds].sort((a, b) => b.startDate.localeCompare(a.startDate))
        );
        commitPartnerObs(sortByDateDesc(loadedObs));
        setPartnerSettings(loadedPartner);
        commitPrivacy(loadedPrivacy);
      } catch {
        // Corrupted storage: fall back to empty state rather than crashing.
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Medical records
  // -------------------------------------------------------------------------

  const addRecord = useCallback(
    async (input: MedicalRecordInput): Promise<MedicalRecord> => {
      const parsed = MedicalRecordInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const record: MedicalRecord = {
        ...parsed.data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const next = sortByDateDesc([record, ...recordsRef.current]);
      commitRecords(next);
      await persistSensitive(RECORDS_KEY, next, privacyRef.current.encryptSensitiveAtRest);
      return record;
    },
    [commitRecords, persistSensitive]
  );

  const updateRecord = useCallback(
    async (id: string, patch: Partial<MedicalRecordInput>): Promise<void> => {
      const existing = recordsRef.current.find((r) => r.id === id);
      if (!existing) throw new Error("Record not found");
      const merged: MedicalRecordInput = {
        type: existing.type,
        title: existing.title,
        provider: existing.provider,
        facility: existing.facility,
        date: existing.date,
        content: existing.content,
        attachmentUri: existing.attachmentUri,
        attachmentMime: existing.attachmentMime,
        tags: existing.tags,
        ...patch,
      };
      const parsed = MedicalRecordInputSchema.safeParse(merged);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const updated: MedicalRecord = {
        ...existing,
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      };
      const next = sortByDateDesc(
        recordsRef.current.map((r) => (r.id === id ? updated : r))
      );
      commitRecords(next);
      await persistSensitive(RECORDS_KEY, next, privacyRef.current.encryptSensitiveAtRest);
    },
    [commitRecords, persistSensitive]
  );

  const deleteRecord = useCallback(
    async (id: string): Promise<void> => {
      const next = recordsRef.current.filter((r) => r.id !== id);
      commitRecords(next);
      await persistSensitive(RECORDS_KEY, next, privacyRef.current.encryptSensitiveAtRest);
    },
    [commitRecords, persistSensitive]
  );

  // -------------------------------------------------------------------------
  // Lab results
  // -------------------------------------------------------------------------

  const addLabResult = useCallback(
    async (input: LabResultInput): Promise<LabResult> => {
      const parsed = LabResultInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const markers: LabMarker[] = parsed.data.markers.map((m) => ({
        ...m,
        flag: computeMarkerFlag(m.value, m.refLow, m.refHigh),
      }));
      const lab: LabResult = {
        ...parsed.data,
        markers,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const next = sortByDateDesc([lab, ...labsRef.current]);
      commitLabs(next);
      await persistSensitive(LABS_KEY, next, privacyRef.current.encryptSensitiveAtRest);
      return lab;
    },
    [commitLabs, persistSensitive]
  );

  const deleteLabResult = useCallback(
    async (id: string): Promise<void> => {
      const next = labsRef.current.filter((l) => l.id !== id);
      commitLabs(next);
      await persistSensitive(LABS_KEY, next, privacyRef.current.encryptSensitiveAtRest);
    },
    [commitLabs, persistSensitive]
  );

  // -------------------------------------------------------------------------
  // Cycle entries
  // -------------------------------------------------------------------------

  const upsertCycleEntry = useCallback(
    async (input: CycleEntryInput): Promise<CycleEntry> => {
      const parsed = CycleEntryInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const entry: CycleEntry = {
        ...parsed.data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      // One entry per calendar day: replace any existing entry for this date.
      const next = sortByDateDesc([
        entry,
        ...cycleRef.current.filter((e) => e.date !== parsed.data.date),
      ]);
      commitCycle(next);
      await persistPlain(CYCLE_KEY, next);
      return entry;
    },
    [commitCycle, persistPlain]
  );

  const deleteCycleEntry = useCallback(
    async (id: string): Promise<void> => {
      const next = cycleRef.current.filter((e) => e.id !== id);
      commitCycle(next);
      await persistPlain(CYCLE_KEY, next);
    },
    [commitCycle, persistPlain]
  );

  // -------------------------------------------------------------------------
  // Medications
  // -------------------------------------------------------------------------

  const addMedication = useCallback(
    async (input: MedicationInput): Promise<Medication> => {
      const parsed = MedicationInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const medication: Medication = {
        ...parsed.data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const next = [medication, ...medsRef.current].sort((a, b) =>
        b.startDate.localeCompare(a.startDate)
      );
      commitMeds(next);
      await persistPlain(MEDICATIONS_KEY, next);
      return medication;
    },
    [commitMeds, persistPlain]
  );

  const updateMedication = useCallback(
    async (id: string, patch: Partial<MedicationInput>): Promise<void> => {
      const existing = medsRef.current.find((m) => m.id === id);
      if (!existing) throw new Error("Medication not found");
      const merged: MedicationInput = {
        name: existing.name,
        kind: existing.kind,
        dosage: existing.dosage,
        frequency: existing.frequency,
        startDate: existing.startDate,
        endDate: existing.endDate,
        prescribedBy: existing.prescribedBy,
        providerNotes: existing.providerNotes,
        active: existing.active,
        ...patch,
      };
      const parsed = MedicationInputSchema.safeParse(merged);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const next = medsRef.current
        .map((m) => (m.id === id ? { ...existing, ...parsed.data } : m))
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      commitMeds(next);
      await persistPlain(MEDICATIONS_KEY, next);
    },
    [commitMeds, persistPlain]
  );

  const deleteMedication = useCallback(
    async (id: string): Promise<void> => {
      const next = medsRef.current.filter((m) => m.id !== id);
      commitMeds(next);
      await persistPlain(MEDICATIONS_KEY, next);
    },
    [commitMeds, persistPlain]
  );

  // -------------------------------------------------------------------------
  // Partner observations & settings
  // -------------------------------------------------------------------------

  const addPartnerObservation = useCallback(
    async (input: PartnerObservationInput): Promise<PartnerObservation> => {
      const parsed = PartnerObservationInputSchema.safeParse(input);
      if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));
      const observation: PartnerObservation = {
        ...parsed.data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const next = sortByDateDesc([observation, ...partnerObsRef.current]);
      commitPartnerObs(next);
      await persistPlain(PARTNER_OBS_KEY, next);
      return observation;
    },
    [commitPartnerObs, persistPlain]
  );

  const deletePartnerObservation = useCallback(
    async (id: string): Promise<void> => {
      const next = partnerObsRef.current.filter((o) => o.id !== id);
      commitPartnerObs(next);
      await persistPlain(PARTNER_OBS_KEY, next);
    },
    [commitPartnerObs, persistPlain]
  );

  const savePartnerSettings = useCallback(
    async (s: PartnerSettings): Promise<void> => {
      setPartnerSettings(s);
      await persistPlain(PARTNER_SETTINGS_KEY, s);
    },
    [persistPlain]
  );

  // -------------------------------------------------------------------------
  // Privacy
  // -------------------------------------------------------------------------

  const saveCareProfile = useCallback(
    async (p: CareProfile): Promise<void> => {
      setCareProfile(p);
      await persistPlain(CARE_PROFILE_KEY, p);
    },
    [persistPlain]
  );

  const savePrivacySettings = useCallback(
    async (s: PrivacySettings): Promise<void> => {
      const encryptionChanged =
        privacyRef.current.encryptSensitiveAtRest !== s.encryptSensitiveAtRest;
      commitPrivacy(s);
      await persistPlain(PRIVACY_KEY, s);
      if (encryptionChanged) {
        // Re-persist the two sensitive collections in the new mode so the
        // stored payloads match the setting immediately.
        await Promise.all([
          persistSensitive(RECORDS_KEY, recordsRef.current, s.encryptSensitiveAtRest),
          persistSensitive(LABS_KEY, labsRef.current, s.encryptSensitiveAtRest),
        ]);
      }
    },
    [commitPrivacy, persistPlain, persistSensitive]
  );

  const clearHealthDataType = useCallback(
    async (key: DataTypeKey): Promise<void> => {
      switch (key) {
        case "checkIns":
          // Legacy daily check-ins live in AppContext ("@bloom_checkins") and
          // that experience must keep working unchanged — intentionally a
          // no-op here.
          return;
        case "records": {
          commitRecords([]);
          await persistSensitive(RECORDS_KEY, [], privacyRef.current.encryptSensitiveAtRest);
          return;
        }
        case "labs": {
          commitLabs([]);
          await persistSensitive(LABS_KEY, [], privacyRef.current.encryptSensitiveAtRest);
          return;
        }
        case "cycle": {
          commitCycle([]);
          await persistPlain(CYCLE_KEY, []);
          return;
        }
        case "medications": {
          commitMeds([]);
          await persistPlain(MEDICATIONS_KEY, []);
          return;
        }
        case "partnerObservations": {
          commitPartnerObs([]);
          await persistPlain(PARTNER_OBS_KEY, []);
          return;
        }
      }
    },
    [commitRecords, commitLabs, commitCycle, commitMeds, commitPartnerObs, persistPlain, persistSensitive]
  );

  const clearAllHealthData = useCallback(async (): Promise<void> => {
    commitRecords([]);
    commitLabs([]);
    commitCycle([]);
    commitMeds([]);
    commitPartnerObs([]);
    await Promise.all([
      persistSensitive(RECORDS_KEY, [], privacyRef.current.encryptSensitiveAtRest),
      persistSensitive(LABS_KEY, [], privacyRef.current.encryptSensitiveAtRest),
      persistPlain(CYCLE_KEY, []),
      persistPlain(MEDICATIONS_KEY, []),
      persistPlain(PARTNER_OBS_KEY, []),
    ]);
  }, [commitRecords, commitLabs, commitCycle, commitMeds, commitPartnerObs, persistPlain, persistSensitive]);

  /**
   * Full factory reset for "Reset App Data": clears every health storage key
   * AND resets in-memory state to defaults. Also re-stamps SEED_VERSION_KEY
   * to the current version (instead of leaving it deleted) so the next cold
   * start sees "already seeded, nothing there" and loads empty state rather
   * than silently repopulating demo data over whatever the user sets up next.
   */
  const resetAll = useCallback(async (): Promise<void> => {
    commitRecords([]);
    commitLabs([]);
    commitCycle([]);
    commitMeds([]);
    commitPartnerObs([]);
    setPartnerSettings(DEFAULT_PARTNER_SETTINGS);
    commitPrivacy(DEFAULT_PRIVACY_SETTINGS);
    setCareProfile(DEFAULT_CARE_PROFILE);
    await AsyncStorage.multiRemove([
      RECORDS_KEY,
      LABS_KEY,
      CYCLE_KEY,
      MEDICATIONS_KEY,
      PARTNER_OBS_KEY,
      PARTNER_SETTINGS_KEY,
      PRIVACY_KEY,
      CARE_PROFILE_KEY,
    ]);
    await AsyncStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  }, [commitRecords, commitLabs, commitCycle, commitMeds, commitPartnerObs, commitPrivacy]);

  // -------------------------------------------------------------------------
  // Snapshot (full local export)
  // -------------------------------------------------------------------------

  const buildSnapshot = useCallback((): HealthSnapshot => {
    return {
      exportedAt: new Date().toISOString(),
      profile: profile
        ? {
            name: profile.name,
            babyName: profile.babyName,
            birthDate: profile.birthDate,
          }
        : null,
      checkIns,
      records,
      labResults,
      cycleEntries,
      medications,
      partnerObservations,
    };
  }, [profile, checkIns, records, labResults, cycleEntries, medications, partnerObservations]);

  const value = useMemo<HealthContextType>(
    () => ({
      isLoading,
      records,
      labResults,
      cycleEntries,
      medications,
      partnerObservations,
      partnerSettings,
      privacySettings,
      careProfile,
      addRecord,
      updateRecord,
      deleteRecord,
      addLabResult,
      deleteLabResult,
      upsertCycleEntry,
      deleteCycleEntry,
      addMedication,
      updateMedication,
      deleteMedication,
      addPartnerObservation,
      deletePartnerObservation,
      savePartnerSettings,
      savePrivacySettings,
      saveCareProfile,
      clearHealthDataType,
      clearAllHealthData,
      resetAll,
      buildSnapshot,
    }),
    [
      isLoading,
      records,
      labResults,
      cycleEntries,
      medications,
      partnerObservations,
      partnerSettings,
      privacySettings,
      careProfile,
      addRecord,
      updateRecord,
      deleteRecord,
      addLabResult,
      deleteLabResult,
      upsertCycleEntry,
      deleteCycleEntry,
      addMedication,
      updateMedication,
      deleteMedication,
      addPartnerObservation,
      deletePartnerObservation,
      savePartnerSettings,
      savePrivacySettings,
      saveCareProfile,
      clearHealthDataType,
      clearAllHealthData,
      resetAll,
      buildSnapshot,
    ]
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}

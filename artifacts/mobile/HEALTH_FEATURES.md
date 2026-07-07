# Health Features — Developer & Demo Guide

Luminara's original app is a postpartum depression (PPD) check-in and
support experience (`context/AppContext.tsx`, `app/(tabs)/checkin.tsx`,
etc.) — that experience is untouched and keeps working exactly as before.

This document covers the **reproductive health expansion** built on top of
it: medical records, lab results, cycle & biomarker tracking, medications,
an optional partner space, research participation, and privacy controls.
Everything here is local-first — no backend exists yet (see "Future backend
notes" below).

## 1. Feature map (route → purpose)

| Route | Purpose |
|---|---|
| `/records` | List of medical records (doctor notes, imaging, prescriptions, discharge summaries, lab reports, other). |
| `/records/add` | Add a medical record — type, provider, facility, date, free-text content, optional photo/document attachment, tags. |
| `/records/add-lab` | Add a lab result — test name, category, date, one or more markers (name/value/unit/reference range), notes. |
| `/records/[id]` | Detail view of a single medical record. |
| `/records/lab/[id]` (under `app/records/lab/`) | Detail view of a single lab result, with per-marker flag (low/normal/high). |
| `/cycle` | Cycle overview — current phase, next-period/ovulation prediction, recent entries. |
| `/cycle/log` | Log or edit today's (or any day's) cycle entry: flow, BBT, cervical mucus, ovulation/pregnancy test, symptoms, notes. |
| `/medications` | List of medications & supplements, active/inactive. |
| `/medications/add` | Add a medication or supplement — name, kind, dosage, frequency, dates, prescriber, notes. |
| `/partner` | Partner space entry point: enable/disable, PIN-gated partner view for logging observations. |
| `/partner/log` | Partner logs an observation about the user (mood/energy/sleep/wellbeing, stress factors, support given, concerns). |
| `/partner/dashboard` | Partner-facing summary view (gated by `partnerCanViewSummary`). |
| `/partner/settings` | User-facing partner settings: enable/disable, rename partner, change PIN, consent toggles. |
| `/research` | Research participation opt-in flow: choose which data types to contribute, view/revoke consent, export anonymized bundle. |
| `/privacy` | Privacy & data controls: encryption toggle, retention period, per-data-type clearing, full data export. |
| `/care-profile` | Optional inclusive personalization: self-described background(s) and a limited-sun-exposure flag, used only to tailor on-device recommendations (see §5). Never exported, never required. |

The home tab (`app/(tabs)/index.tsx`) surfaces all of this via a "Your
Health" 2×3 grid plus a phase strip; the profile tab
(`app/(tabs)/profile.tsx`) surfaces privacy/research/partner status via a
"Privacy & Data" settings section; the check-in flow
(`app/(tabs)/checkin.tsx`) nudges users toward `/cycle/log` right after a
check-in.

## 2. Data model overview

Single source of truth: **`types/health.ts`**. Read it before touching any
health feature — it defines every type, zod input schema, and default
value used across the feature set:

- **Reproductive phases** — `ReproductivePhase` (`menstrual | follicular |
  ovulation | luteal | pregnancy | postpartum | menopause | unknown`) and
  `REPRODUCTIVE_PHASE_LABELS`.
- **Medical records** — `MedicalRecord` / `MedicalRecordInput` (+ zod
  schema), typed by `MedicalRecordType`.
- **Lab results** — `LabResult` / `LabResultInput`, with `LabMarker` values
  auto-flagged `low | normal | high` via `computeMarkerFlag`.
- **Cycle entries** — `CycleEntry` / `CycleEntryInput`: one entry per
  calendar day (flow, BBT, cervical mucus, ovulation/pregnancy test,
  symptoms, notes). `CyclePrediction` is the derived output (next period,
  ovulation, fertile window, confidence).
- **Medications** — `Medication` / `MedicationInput` (medication, supplement,
  or vitamin; active flag; optional prescriber/notes).
- **Partner observations & settings** — `PartnerObservation` /
  `PartnerObservationInput` (partner-rated mood/energy/sleep/wellbeing,
  stress factors, support given, optional concerns/context,
  `sharedWithUser` flag) and `PartnerSettings` (enabled, partner name,
  **hashed** PIN, two independent consent flags).
- **Privacy & research** — `PrivacySettings` (encryption toggle, retention
  window) wrapping `ResearchConsent` (participating flag, per-`DataTypeKey`
  opt-in map, pseudonym).
- **Care profile** — `CareProfile` (`backgrounds: CareBackground[]` +
  `limitedSunExposure`), with `CARE_BACKGROUNDS` /
  `CARE_BACKGROUND_LABELS`. Optional, empty by default ("prefer not to
  say" is a first-class state). Deliberately excluded from
  `HealthSnapshot`, `AnonymizedBundle`, and provider reports — it exists
  only to tailor on-device guidance.
- **Snapshots** — `HealthSnapshot` (full local export, includes legacy
  check-ins + profile) vs. `AnonymizedBundle` (day-offset-relative, no
  names/notes/providers — the only shape ever considered for research
  sharing).
- **Wellness algorithm shared types** — `WellnessInput`, `WellnessResult`,
  `WellnessContribution`, `RiskWindow`, `Recommendation`,
  `PartnerCorrelation` (see §5).

All dates are `YYYY-MM-DD` strings; helpers `toDateString`, `daysBetween`,
`addDays`, `generateId` live at the bottom of `types/health.ts`.

## 3. Storage & encryption design

All health state is owned by **`context/HealthContext.tsx`** (`HealthProvider`
/ `useHealth()`), nested inside the existing `AppProvider` (it reads
`profile`/`checkIns` from `useApp()` for snapshot building, but never
mutates legacy state).

**AsyncStorage keys:**

| Key | Contents | Encrypted? |
|---|---|---|
| `@luminara_records` | `MedicalRecord[]` | Yes, when `privacySettings.encryptSensitiveAtRest` |
| `@luminara_labs` | `LabResult[]` | Yes, when `privacySettings.encryptSensitiveAtRest` |
| `@luminara_cycle` | `CycleEntry[]` | No (plaintext) |
| `@luminara_medications` | `Medication[]` | No (plaintext) |
| `@luminara_partner_obs` | `PartnerObservation[]` | No (plaintext) |
| `@luminara_partner_settings` | `PartnerSettings` (PIN stored as SHA-256 **hash**, never plaintext) | No (plaintext; the sensitive field is already hashed) |
| `@luminara_privacy` | `PrivacySettings` | No (plaintext) |
| `@luminara_care_profile` | `CareProfile` (optional inclusive personalization; survives demo re-seeds) | No (plaintext) |
| `@luminara_health_seed_version` | Seed version marker (bump `SEED_VERSION` in `HealthContext.tsx` to force a reseed) | No |

Medical records and lab results are the two collections judged sensitive
enough to warrant encryption-at-rest by default; cycle/medication/partner
data stays plaintext in this iteration to keep the demo fast and simple —
`privacySettings.encryptSensitiveAtRest` only affects the two "sensitive"
keys above.

**Encryption (`utils/encryption.ts`):**

- AES-256-**CTR** via `aes-js`, with a fresh random 16-byte IV per write.
- The 32-byte data key is generated once with `expo-crypto` and persisted in
  `expo-secure-store` (`SecureStore.setItemAsync` — OS Keychain on iOS,
  Keystore on Android). On web, where there's no OS keychain, it falls back
  to AsyncStorage — noted in code as obfuscation rather than true at-rest
  protection on that platform.
- Payload format: `"enc1:<hexIv>:<hexCipher>"`.
- `decryptString` is **plaintext-tolerant**: any string without the `enc1:`
  prefix is returned unchanged. This means turning encryption on/off, or
  loading data written before encryption existed, never crashes — it just
  reads as-is until the next write re-persists it in the current mode.
  `savePrivacySettings` proactively re-persists both sensitive collections
  immediately when the encryption toggle changes, so the on-disk format
  matches the setting right away rather than waiting for the next edit.

**Retention:** if `privacySettings.retentionMonths` is set, records/labs/
cycle entries/partner observations older than the cutoff are dropped on
load (medications are kept while `active`, regardless of age). This runs
once per app load in `HealthContext`'s load effect.

## 4. Consent model

- **Partner gates** (`PartnerSettings` + `/partner`, `/partner/settings`):
  - The partner space is off by default (`DEFAULT_PARTNER_SETTINGS.enabled
    = false`). The user must explicitly turn it on and set a PIN before a
    partner can do anything.
  - The PIN is never stored in plaintext — only its SHA-256 hash
    (`pinHash`), checked against a freshly hashed attempt on entry, with a
    3-attempt lockout + 30s cooldown with a live countdown that unlocks
    automatically (`app/partner/index.tsx`).
  - All PIN fields use the shared `components/PinInput.tsx`, which masks by
    default but offers a show/hide (eye) toggle so the PIN can be
    double-checked while typing — visibility is per-field, session-only,
    and never affects what is stored (always the hash).
  - Two independent, revocable consent flags, both defaulting toward the
    more private option:
    - `userCanViewObservations` — can the *user* see what the partner
      logged about them (default **on**, since it's the user's own
      wellness data).
    - `partnerCanViewSummary` — can the *partner* see the user's wellness
      summary (default **off** — the more sensitive direction, opt-in
      only).
  - Turning the partner space off, or revoking either flag, takes effect
    immediately from `/partner/settings` — no dark patterns, no
    "are you sure you want to keep your privacy" friction.
- **Research opt-in** (`ResearchConsent` + `/research`):
  - Off by default. The user picks which `DataTypeKey`s to contribute
    (`checkIns`, `cycle`, `labs`, `records`, `medications`,
    `partnerObservations`) — nothing is pre-checked.
  - On first consent, a random `pseudonym` is generated so repeated
    exports can be linked to "the same anonymous participant" without any
    name, email, or device identifier.
  - Only ever exports the `AnonymizedBundle` shape (`utils/anonymize.ts`):
    dates become day-offsets from the participant's earliest included
    entry, free-text notes/providers/names are stripped entirely, and only
    counts/flags/values remain.
  - Revoking sets `participating: false` and stamps `revokedDate` — no
    account deletion flow is needed because nothing left the device in the
    first place beyond whatever the user explicitly exported/shared.
- **Copy discipline:** no screen in this feature set claims HIPAA
  compliance or clinical validation. Anywhere a lab flag, phase, or
  wellness score is shown, copy pairs it with a "not a diagnosis — review
  with your healthcare provider" style disclaimer. (Note: the pre-existing
  legacy `app/(tabs)/profile.tsx` HIPAA badge and onboarding "Clinically
  Validated Research" badge predate this work and were left as-is per
  scope — they are legacy PPD-experience copy, not part of the health
  expansion described here.)

## 5. Wellness algorithm extension

`utils/wellnessAlgorithm.ts` is a pure, side-effect-free heuristic layer
(no React, deterministic, easy to unit test) that extends — but does not
replace — the legacy 6-factor PPD risk model in
`context/AppContext.tsx` (`calculateRiskScore`: mood .27, anxiety .25,
sleep .15, appetite .10, bonding .13, support .10):

- **`detectPhase({ birthDate, cycleEntries, today })`** — returns a
  `ReproductivePhase`. Checks pregnancy (positive test, no flow since),
  postpartum (recent birth date), then falls back to a calendar +
  fertility-sign model (period-start detection via flow runs; menstrual /
  follicular / ovulation / luteal windows) or `"unknown"` when there isn't
  enough data.
- **`predictCycle(cycleEntries, today)`** — returns a `CyclePrediction`
  (next period start, ovulation date, fertile window, average cycle/period
  length, current cycle day, and a `confidence` of `none | low | medium |
  high` based on sample count and cycle-length variance). This is what
  powers the home-screen phase strip's "Day N of ~M" / "next period in X
  days" text — hidden entirely at `confidence: "none"`.
- **`calculateWellnessScore(input: WellnessInput)`** — a superset of the
  legacy risk score. When only the six core check-in factors are supplied
  it reproduces `calculateRiskScore`'s output (±3 pts); when lab markers,
  active medications, partner observations, or recent cycle symptoms are
  also supplied, three additional weighted terms are blended in (labs .08,
  partner .10, symptoms .05, all weights renormalized to sum to 1), plus a
  small additive phase modifier (luteal +4, menstrual +3, postpartum +2).
  Same 0–100 scale and low/moderate/high thresholds (≤35 / ≤65 / >65) as
  the legacy score.
- **`predictRiskWindows(checkIns, cycleEntries, today)`** — flags upcoming
  date ranges worth extra self-awareness (e.g. recurring luteal-phase dips)
  as descriptive, non-diagnostic `RiskWindow`s.
- **`getRecommendations(input)`** — turns the score's contributions into a
  short list of prioritized, categorized `Recommendation`s (nutrition,
  exercise, mindfulness, medical, sleep, support).
- **Care-profile-aware recommendations** — when the user has filled in the
  optional `/care-profile`, `getRecommendations` may add population-level,
  non-diagnostic awareness items: a vitamin D check nudge (deeper skin
  tones / limited sun exposure, skipped when a recent vitamin D lab
  exists), a hemoglobinopathy-screening nudge (low hemoglobin flag +
  ancestry groups with higher thalassemia / sickle-cell-trait carrier
  rates, e.g. SWANA, African, South/Southeast Asian), a fibroid-awareness
  nudge (sustained heavy flow + Black/African background), and a
  gestational-diabetes screening nudge (pregnancy phase + higher-prevalence
  communities). All copy is framed as "ask your provider" awareness, never
  a diagnosis, and none of it fires unless the user opted in to sharing a
  background.
- **`correlateWithPartner(checkIns, partnerObservations)`** — simple
  matched-day averages/deltas between self-reported and partner-observed
  mood/sleep/energy/wellbeing, surfaced as descriptive statistics for the
  user's own reflection, not a clinical signal.

## 6. Seeded demo data walkthrough

On first load (or whenever `SEED_VERSION` in `HealthContext.tsx` is bumped),
`HealthProvider` seeds a realistic postpartum storyline for **Nagham**
(baby **Laila**, born 2025‑08‑06), all with relative (`daysAgo`/`monthsAgo`)
dates so the demo always looks current:

- **Cycle entries** — two complete ~29-day cycles plus the current partial
  one, with biphasic BBT (36.25–36.55 °C pre-ovulation, 36.6–36.9 °C
  post), cervical mucus progression, an ovulation-test-positive day 14,
  flow days, and clustered luteal-phase symptoms (breast tenderness, mood
  swings, bloating, cravings) — enough real signal for `detectPhase` /
  `predictCycle` to return a non-`"none"` confidence out of the box.
- **Medical records** — a 6-week postpartum visit (where sertraline is
  started for mood support), a 3-week lactation consult, and a recent GP
  follow-up for fatigue/anemia.
- **Lab results** — a postpartum thyroid panel (TSH slightly high, flagged)
  and a complete blood count (mild anemia, flagged low hemoglobin).
- **Medications** — an active prenatal multivitamin, vitamin D, and
  sertraline 50 mg (tied back to the postpartum-visit record above).
- **Partner observations** — seven observations from "Sam" over the last
  ~2 weeks, loosely tracking (and sometimes diverging from — intentionally,
  to make `correlateWithPartner` interesting) the seeded check-in moods;
  a couple are marked `sharedWithUser: false` to demonstrate that partner
  entries can stay private to the partner unless they choose to share.
- **Partner settings — demo PIN is `1234`.** `buildSeedPartnerSettings()`
  seeds `partnerSettings.enabled = true`, `partnerName: "Sam"`, both
  consent flags **on** (`userCanViewObservations: true`,
  `partnerCanViewSummary: true`), and `pinHash` set to the SHA-256 digest
  of the string `"1234"` — so from a fresh install you can go straight to
  `/partner`, enter PIN **1234**, and see the partner-facing flow without
  any setup. In a non-demo build a real partner would choose their own PIN
  from `/partner/index.tsx` or `/partner/settings.tsx`, and it is stored
  hashed, never in plaintext.
- **Privacy settings** — seeded to `DEFAULT_PRIVACY_SETTINGS`
  (`encryptSensitiveAtRest: true`, no retention limit, research
  participation off) so the demo starts from the most private/opt-out
  posture even though the rest of the data is pre-populated.

## 7. Future backend notes

`utils/syncAdapter.ts` defines a `SyncAdapter` interface and ships only a
`LocalOnlyAdapter` no-op implementation — **no network calls exist anywhere
in the health feature set today.** It exists purely so the rest of the app
can already be written against a stable interface; swapping
`activeSyncAdapter` for a real implementation later shouldn't require
touching call sites. The file documents, in detail, what a real backend
would need before it's safe to flip on:

1. **Transport security** — TLS 1.2+, certificate pinning on mobile, no
   plaintext fallback.
2. **End-to-end encryption of the snapshot** — the `HealthSnapshot` must be
   encrypted on-device (reusing/deriving from the `utils/encryption.ts`
   data key) before it ever leaves the phone; the server should ideally
   only ever see ciphertext. Multi-device sync would need proper key
   wrapping/exchange, never shipping the raw key to a server.
3. **BAA-covered hosting** — any vendor touching identifiable health data
   needs a signed Business Associate Agreement (HIPAA) or equivalent
   (e.g. GDPR Art. 28), with documented data residency.
4. **Audit logging** — every server-side read/write logged immutably
   (who/what/when), mirroring the on-device share audit trail in
   `utils/shareLog.ts` but for remote access.
5. **Token auth** — short-lived OAuth2/OIDC tokens scoped per-user/device,
   revocable and invalidated on logout, never long-lived static API keys.

Until all of the above exists and has passed a security review, the app
should keep `activeSyncAdapter = LocalOnlyAdapter`, and UI copy should keep
saying exactly what's true today: **"private by design — your data stays
on this device."**

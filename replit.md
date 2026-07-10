# Luminara Health — Reproductive & Postpartum Wellness

A local-first mobile app for tracking cycle, labs, medical records, medications, and postpartum mood, predicting PPD risk via a wellness score algorithm. No backend — everything lives encrypted on-device.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo app (via workflow)
- `pnpm --filter @workspace/mobile run test` — run unit tests (jest/ts-jest)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with expo-router
- State: AsyncStorage (local persistence, no backend)
- Encryption: AES-256-CTR (`aes-js`), device key in `expo-secure-store`
- Fonts: Inter (400/500/600/700) via `@expo-google-fonts/inter`
- Notifications: `expo-notifications` (local only)
- PDF export: `expo-print` + `expo-sharing`
- Animation/haptics: `react-native-reanimated`, `expo-haptics`
- i18n: hand-rolled English/Arabic context (`i18n/`), RTL via `I18nManager`
- Tests: `jest` + `ts-jest`

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/` — screens (onboarding, tabs, records, medications, cycle, partner, research, privacy, care-profile)
- `artifacts/mobile/app/(tabs)/` — Home, Check-In, History (Report), Resources, Insights, Profile tabs
- `artifacts/mobile/context/AppContext.tsx` — legacy check-in state, PPD risk algorithm inputs, AsyncStorage persistence
- `artifacts/mobile/context/HealthContext.tsx` — reproductive-health state (records, labs, cycle, medications, partner, privacy/research)
- `artifacts/mobile/i18n/` — `en.ts` / `ar.ts` dictionaries, `I18nProvider`, `useTranslation()`
- `artifacts/mobile/components/` — shared components, including `EmptyState.tsx`, `Skeleton.tsx`, `SyncStatusBadge.tsx`, `onboarding/illustrations/`
- `artifacts/mobile/utils/` — `wellnessAlgorithm.ts`, `pdfReport.ts`, `notifications.ts`, `correlations.ts`, `encryption.ts`, `syncAdapter.ts`, `backendClient.ts`
- `artifacts/mobile/constants/colors.ts` — Luminara teal/indigo/lavender palette (light + dormant dark)
- `artifacts/mobile/assets/luminara-logo.png` — official Luminara Health logo
- `artifacts/mobile/HEALTH_FEATURES.md` — developer/demo guide to the reproductive-health feature set (data model, storage/encryption design)

## Architecture decisions

- Frontend-only: all data stored locally via AsyncStorage (encrypted for records/labs), no backend needed
- `SyncStatusBadge` honestly reports "local only" — `syncAdapter.ts`/`backendClient.ts` are scaffolding for a future backend, not a live connection; no real network calls are made
- PPD risk score (0–100) computed from 6 daily factors: mood, sleep, anxiety, appetite, bonding, support
- Risk levels: Low (0–35), Moderate (36–65), High (66+) — based on EPDS principles; covered by unit tests in `utils/__tests__/`
- Onboarding redirect handled in root `_layout.tsx` via `profile.setupComplete` flag
- Simulation data auto-seeded on first launch: Nagham, baby Laila, born August 6, 2025
- i18n is a lightweight hand-rolled Context (not i18next) to keep dependencies minimal, matching the rest of the codebase
- Local notifications only — no push infrastructure, no server-side scheduling

## Product

- **Onboarding**: 6-step flow — Splash, Mood check ("How are you, radiant mama?"), Understand Your Rhythms (dark teal, custom SVG illustration), Early Risk Insights (dark purple, custom SVG illustration), Name, Baby info. Available in English and Arabic (RTL).
- **Home**: Dashboard with greeting, animated wellness % hero card, baby age badge, stats, check-in progress, 7-day bar chart, "Your Health" grid (cycle/labs/records/meds/partner), sync status badge, skeleton loading state.
- **Check-In**: Emoji mood picker (animated), sleep chip selector, dot-rating rows for anxiety/appetite/bonding/support, optional notes, haptic feedback on submit and on high-risk results.
- **History / Report**: Clinical Wellness Report — Mood Stability, Wellness Score circle (animated count-up), Sleep Quality, Cognitive Load & Stress, Emotional Resilience, 30-day risk summary, Timeline of Events with expandable entries, and a PDF export/share action (`utils/pdfReport.ts`).
- **Records**: `/records`, `/records/add`, `/records/add-lab`, `/records/[id]`, `/records/lab/[id]` — medical records and lab results, encrypted at rest, with empty/skeleton states.
- **Cycle**: `/cycle`, `/cycle/log` — phase overview, prediction, BBT/flow/symptom logging, empty/skeleton states.
- **Medications**: `/medications`, `/medications/add` — active/inactive tracking, optional local reminders.
- **Partner**: `/partner`, `/partner/log`, `/partner/dashboard`, `/partner/settings` — PIN-gated, consent-gated co-observation.
- **Research**: `/research` — opt-in anonymized research participation and consent management.
- **Privacy**: `/privacy` — encryption toggle, retention period, per-data-type clearing, full data export.
- **Insights**: Weekly Gentle Reflection — Wellness Signals bars, Mindful Minutes, Sleep Resonance timeline, Risk Trend chart, partner-vs-self correlation bars, a sleep/anxiety pattern card (`utils/correlations.ts`), PPD Assessment, daily tip.
- **Profile**: Avatar, stats, account settings, "Reminders & Notifications" section (check-in/medication/cycle toggles), "Data & Sync" section (sync status badge), language toggle (English/عربي), privacy/research/partner status, HIPAA badge, reset.

## User preferences

_Populate as needed._

## Gotchas

- Only restart the Expo workflow after dependency changes or Metro errors — HMR handles code changes
- Do not create a backend or database: the app is intentionally frontend-only
- Web preview may render text differently than native; Expo Go on device is the source of truth
- The app name is **Luminara Health** — not Bloom
- Dark theme exists in `colors.ts` but is dormant/not wired up — do not assume it's live
- RTL layout switch requires an app restart to fully apply (RN `I18nManager` limitation) — this is called out in-app, not silently broken
- `expo-notifications` has limited/no support on web — notification code is guarded with `Platform.OS !== 'web'`
- Home-screen widgets are out of scope under managed Expo (would require ejecting)

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- See the `expo` skill for mobile guidelines
- See `HEALTH_FEATURES.md` for the reproductive-health data model and encryption design

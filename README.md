# Luminara Health — Reproductive & Postpartum Wellness

A local-first mobile app that helps women track their whole reproductive-health picture — cycle, labs, medical records, medications, and postpartum mood — and predicts postpartum-depression (PPD) risk using a wellness score algorithm. All data stays encrypted on-device; there is no backend.

It placed **1st place** at the Najahna entrepreneurial-health competition — a reproductive-healthcare solution judged best in the country in Jordan.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with expo-router
- State: AsyncStorage (local persistence, no backend)
- Encryption: AES-256-CTR (`aes-js`) with a device key in `expo-secure-store` (OS Keychain/Keystore)
- Fonts: Inter (400/500/600/700) via `@expo-google-fonts/inter`
- Notifications: `expo-notifications` (local reminders only)
- PDF export: `expo-print` + `expo-sharing`
- Animation: `react-native-reanimated`, haptics via `expo-haptics`
- i18n: hand-rolled English/Arabic context with RTL switching (no external i18n library)
- Testing: `jest`/`ts-jest` for core health/wellness logic

## Getting started

```bash
pnpm install
pnpm --filter @workspace/mobile run dev        # run the Expo app
pnpm --filter @workspace/mobile run test        # run unit tests
pnpm run typecheck                              # typecheck across all packages
pnpm run build                                  # typecheck + build all packages
```

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/` — screens: onboarding, tabs, records, medications, cycle, partner, research, privacy
- `artifacts/mobile/app/(tabs)/` — Home, Check-In, History/Report, Resources, Insights, Profile tabs
- `artifacts/mobile/context/AppContext.tsx` — legacy PPD check-in state, wellness algorithm inputs, AsyncStorage persistence
- `artifacts/mobile/context/HealthContext.tsx` — reproductive-health state: records, labs, cycle, medications, partner, privacy/research settings
- `artifacts/mobile/i18n/` — English/Arabic translation dictionaries + `I18nProvider`/`useTranslation()`
- `artifacts/mobile/utils/` — wellness algorithm, PDF report generation, notifications, encryption, correlations, sync scaffolding
- `artifacts/mobile/components/` — shared UI (RiskGauge, MoodScale, PinInput, EmptyState, Skeleton, onboarding illustrations, charts)
- `artifacts/mobile/constants/colors.ts` — Luminara indigo/teal/amber palette, WCAG 2.2 AA verified, with a dormant dark theme
- `artifacts/mobile/HEALTH_FEATURES.md` — deep-dive developer guide to the reproductive-health feature set (data model, storage/encryption design, privacy controls)
- `web/luminara-brand-story.html` — brand & market story deck

## What's in the app

- **Onboarding** — 6-step flow (splash, mood check, "Understand Your Rhythms," "Early Risk Insights," name, baby info) with custom illustrations, now available in Arabic with RTL layout.
- **Home** — dashboard with wellness score (animated), baby age badge, check-in progress, 7-day chart, and a "Your Health" grid into cycle, labs, records, medications, and partner space.
- **Check-In** — daily PPD indicators: mood, sleep, anxiety, appetite, bonding, support — with haptic feedback and animated transitions.
- **History / Report** — Clinical Wellness Report (mood stability, wellness score, sleep quality, cognitive load, emotional resilience, 30-day risk summary, timeline) with one-tap PDF export/share for bringing to a provider.
- **Insights** — weekly reflection: wellness signal bars, mindful minutes, sleep timeline, risk trend, partner-vs-self correlation charts, and a sleep/anxiety pattern card computed from real check-in history.
- **Records & Labs** — medical records and lab results with per-marker flagging (low/normal/high), encrypted at rest.
- **Cycle** — daily flow/BBT/symptom logging with phase prediction (menstrual, follicular, ovulation, luteal, pregnancy, postpartum, menopause).
- **Medications** — active/inactive medication and supplement tracking with optional local reminders.
- **Partner space** — PIN-gated, consent-gated observation logging and dashboard for a partner to help notice changes.
- **Research & Privacy** — opt-in anonymized research participation, encryption toggle, retention controls, full local data export.
- **Notifications** — local reminders for check-ins, medications, and cycle predictions (on-device only, no push server).
- **Accessibility** — accessibility labels/roles on custom controls, color-independent risk labeling, empty/loading states across list screens.

## How the wellness score works

The PPD risk score (0–100) is computed from six daily factors: mood, sleep, anxiety, appetite, bonding, and support. Risk levels are Low (0–35), Moderate (36–65), and High (66+), based on EPDS principles. Core scoring logic has unit test coverage (`artifacts/mobile/utils/__tests__/`).

The app is frontend-only — there is no backend, and a "local only" sync indicator says so honestly rather than implying connectivity that doesn't exist.

## Known limitations

- Dark theme exists in `constants/colors.ts` but is intentionally not wired up yet.
- RTL layout requires a manual app restart to fully apply (a React Native / `I18nManager` constraint).
- Home-screen widgets aren't supported without ejecting from managed Expo, so they're out of scope for now.
- Arabic translation currently covers onboarding, home, and check-in; other screens remain English-only.

## License

MIT

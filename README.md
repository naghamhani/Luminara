# Luminara Health — Postpartum Wellness

A mobile app that helps new mothers track postpartum depression indicators daily and predicts their PPD risk level using a wellness score algorithm.

it is a reproductive-healthcare-solution that placed 1st place at the Najahna entrepreneurial-health competition — a reproductive-healthcare solution judged best in the country in Jordan.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with expo-router
- State: AsyncStorage (local persistence, no backend)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter

## Getting started

```bash
pnpm install
pnpm --filter @workspace/mobile run dev   # run the Expo app
pnpm run typecheck                        # typecheck across all packages
pnpm run build                            # typecheck + build all packages
```

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/` — screens (onboarding, tabs)
- `artifacts/mobile/app/(tabs)/` — Home, Check-In, Report, Support, Insights, Me tabs
- `artifacts/mobile/context/AppContext.tsx` — app state, PPD risk algorithm, AsyncStorage persistence
- `artifacts/mobile/components/` — shared components
- `artifacts/mobile/constants/colors.ts` — Luminara teal/indigo/lavender palette

## How it works

The PPD risk score (0–100) is computed from six daily factors: mood, sleep, anxiety, appetite, bonding, and support. Risk levels are Low (0–35), Moderate (36–65), and High (66+), based on EPDS principles. The app is frontend-only — all data is stored locally via AsyncStorage, with no backend required.

## License

MIT

# Bloom — Postpartum Wellness

A mobile app that helps new mothers track postpartum depression indicators daily and predicts their PPD risk level using a wellness score algorithm.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo app (via workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) with expo-router
- State: AsyncStorage (local persistence, no backend)
- Fonts: Inter (400/500/600/700) via @expo-google-fonts/inter

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/` — screens (onboarding, tabs)
- `artifacts/mobile/context/AppContext.tsx` — all app state, PPD risk algorithm, AsyncStorage persistence
- `artifacts/mobile/components/` — MoodScale, RiskGauge components
- `artifacts/mobile/constants/colors.ts` — warm cream/lavender/blush palette

## Architecture decisions

- Frontend-only: all data stored locally via AsyncStorage, no backend needed
- PPD risk score (0–100) is computed from 6 daily factors: mood, sleep, anxiety, appetite, bonding, support
- Risk levels: Low (0–35), Moderate (36–65), High (66+) — based on EPDS principles
- Onboarding redirect handled in root `_layout.tsx` via `profile.setupComplete` flag

## Product

- **Onboarding**: Collects user name, baby name, and birth date (3-step flow)
- **Home**: Dashboard with greeting, risk score, 7-day bar chart, streak counter
- **Check-In**: Step-by-step daily survey (6 factors + optional notes)
- **History**: Expandable list of past entries with per-metric dot indicators
- **Insights**: PPD prediction trend, 7-day averages, 30-day summary, coping tips, crisis resources

## User preferences

_Populate as needed._

## Gotchas

- Only restart the Expo workflow after dependency changes or Metro errors — HMR handles code changes
- Do not create a backend or database: the app is intentionally frontend-only
- Web preview may render text differently than native; Expo Go on device is the source of truth

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- See the `expo` skill for mobile guidelines

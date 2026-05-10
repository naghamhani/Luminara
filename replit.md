# Luminara Health — Postpartum Wellness

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
- `artifacts/mobile/app/(tabs)/` — Home, Check-In, Report, Support, Insights, Me tabs
- `artifacts/mobile/context/AppContext.tsx` — all app state, PPD risk algorithm, AsyncStorage persistence
- `artifacts/mobile/components/` — shared components
- `artifacts/mobile/constants/colors.ts` — Luminara teal/indigo/lavender palette
- `artifacts/mobile/assets/luminara-logo.png` — official Luminara Health logo

## Architecture decisions

- Frontend-only: all data stored locally via AsyncStorage, no backend needed
- PPD risk score (0–100) is computed from 6 daily factors: mood, sleep, anxiety, appetite, bonding, support
- Risk levels: Low (0–35), Moderate (36–65), High (66+) — based on EPDS principles
- Onboarding redirect handled in root `_layout.tsx` via `profile.setupComplete` flag
- Simulation data auto-seeded on first launch: Nagham, baby Laila, born August 6, 2025

## Product

- **Onboarding**: 6-step flow — Splash, Mood check ("How are you, radiant mama?"), Understand Your Rhythms (dark teal), Early Risk Insights (dark purple), Name, Baby info
- **Home**: Dashboard with greeting, wellness % hero card, baby age badge, stats, check-in progress, 7-day bar chart, guided content
- **Check-In**: Emoji mood picker, sleep chip selector, dot-rating rows for anxiety/appetite/bonding/support, optional notes
- **Report**: Clinical Wellness Report — Mood Stability, Wellness Score circle, Sleep Quality, Cognitive Load & Stress, Emotional Resilience, 30-day risk summary, Timeline of Events with expandable entries
- **Support**: Resources & Support — 988 crisis line, text counselor, Find a Specialist directory, Knowledge Library articles, Explore Topics grid, Join Weekly Circle
- **Insights**: Weekly Gentle Reflection — Wellness Signals bars, Mindful Minutes, Sleep Resonance timeline, Risk Trend chart, PPD Assessment, daily tip
- **Me**: Profile & Settings — avatar, stats, account settings, notification toggles, privacy, HIPAA badge, reset

## User preferences

_Populate as needed._

## Gotchas

- Only restart the Expo workflow after dependency changes or Metro errors — HMR handles code changes
- Do not create a backend or database: the app is intentionally frontend-only
- Web preview may render text differently than native; Expo Go on device is the source of truth
- The app name is **Luminara Health** — not Bloom

## Pointers

- See the `pnpm-workspace` skill for workspace structure
- See the `expo` skill for mobile guidelines

/**
 * Luminara colour system — v2 (research-grounded, WCAG-2.2-AA verified)
 *
 * Every text/background pairing below was measured with a contrast script
 * and clears WCAG 2.2 AA (>=4.5:1 body text, >=3:1 large/UI). See
 * assets/brand/DESIGN-SYSTEM.md for the ratios and the reasoning.
 *
 * Design decisions, and why:
 *  - Indigo is the base (~60% of surface). Blue-family hues are the most
 *    consistently associated with trust, calm and competence — the right
 *    frame for a private health app, and a deliberate break from the
 *    pink/red femtech cliché (which skews arousal/anxiety upward and reads
 *    as gendered/juvenile).
 *  - Amber is the ONE warm accent, and it is rationed (~10%, the "60-30-10"
 *    rule). Because it is the only warm note, the eye goes straight to it
 *    (von Restorff / isolation effect) — so it means "act here / warmth".
 *  - Risk is never signalled with pure alarm-red. Moderate uses accessible
 *    amber, high uses a softened red — enough to flag, not enough to spike
 *    anxiety in a mental-health context.
 *  - A full dark palette ships for 3am / night use (lower luminance is
 *    gentler on dark-adapted eyes and on sleep). It is dormant until
 *    app.json's userInterfaceStyle is set to "automatic" — see the doc.
 *
 * Shape is unchanged (default export with `light`, `dark`, `radius`) so this
 * is a drop-in replacement; `hooks/useColors` already switches on `dark`.
 */

const light = {
  // base surfaces & text
  background: "#F5F7FD", // app canvas (cool, calm)
  foreground: "#171A2B",
  text: "#171A2B",
  card: "#FFFFFF",
  cardForeground: "#171A2B",
  muted: "#EEF1FA", // subtle surface
  mutedForeground: "#565D85", // 5.9:1 on canvas, 6.4:1 on card
  border: "#E2E6F3",
  input: "#E2E6F3",

  // primary — indigo (trust)
  primary: "#4A5DAE", // 6.1:1 as text on white; white label 6.1:1 on it
  primaryForeground: "#FFFFFF",
  tint: "#4A5DAE",
  secondary: "#E7EAF8", // indigo chip
  secondaryForeground: "#3A4A9E", // 6.6:1 on secondary

  // accent — teal-green (safe, positive)
  accent: "#2FA37E",
  accentForeground: "#FFFFFF",

  // signature warm — amber (rationed)
  warm: "#F6A94C",

  // semantic risk (calm, not alarmist)
  destructive: "#C13B37",
  destructiveForeground: "#FFFFFF",
  riskLow: "#1F7A5E", // 5.3:1
  riskModerate: "#A0610F", // 5.0:1 (accessible amber text)
  riskHigh: "#C0413C", // 5.2:1

  // cycle-phase + decorative hues (used as fills, labelled in ink)
  teal: "#2FA37E",
  purple: "#8C7BD0",
  navy: "#171A2B",
  lavender: "#DDE3F8",
  blush: "#F1ECFB",
  softGreen: "#E4F5EE",
  softOrange: "#FDF0DF",
  softRed: "#FBE9E7",
};

const dark: typeof light = {
  background: "#14172A",
  foreground: "#EDEFF9",
  text: "#EDEFF9",
  card: "#1E2238",
  cardForeground: "#EDEFF9",
  muted: "#262B45",
  mutedForeground: "#A7ACC7", // 7.9:1 on bg, 7.0:1 on card
  border: "#303650",
  input: "#303650",

  primary: "#8EA0E8", // reads as accent text on dark (7:1) and as a button (dark label)
  primaryForeground: "#14172A", // 7.0:1 on primary
  tint: "#8EA0E8",
  secondary: "#262B45",
  secondaryForeground: "#C7CEF2",

  accent: "#46C79E",
  accentForeground: "#14172A",

  warm: "#F6A94C",

  destructive: "#F0736D",
  destructiveForeground: "#14172A",
  riskLow: "#46C79E",
  riskModerate: "#E0A34A",
  riskHigh: "#F0736D",

  teal: "#46C79E",
  purple: "#A99AE6",
  navy: "#EDEFF9",
  lavender: "#2A3050",
  blush: "#26234A",
  softGreen: "#163329",
  softOrange: "#33291A",
  softRed: "#331F1D",
};

const colors = {
  light,
  dark,
  radius: 16,
};

export default colors;

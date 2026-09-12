import type { FontSource } from "expo-font";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import type { Locale } from "./types";

/**
 * Locale-aware font registration.
 *
 * Inter carries no Arabic glyphs. Rendering Arabic with it silently falls back
 * to whatever the OS picks, which differs per device and per weight — the text
 * is legible but the typography is not ours, and weights land wherever the
 * fallback chain happens to go.
 *
 * The fix exploits something `useFonts` allows: the KEY is the family name the
 * app asks for, and the VALUE is any font file. So in Arabic we register IBM
 * Plex Sans Arabic *under the Inter family names*. All 431 existing
 * `fontFamily: "Inter_600SemiBold"` call sites keep working untouched, and
 * nobody has to remember to use a locale-aware font helper in new code.
 *
 * IBM Plex Sans Arabic was chosen over the warmer Tajawal for one practical
 * reason: it ships Regular/Medium/SemiBold/Bold, an exact 400/500/600/700
 * match for the four Inter weights in use. Tajawal has no 600, so every
 * SemiBold in the app — 145 of them — would have had to collapse into another
 * weight and the hierarchy would flatten in Arabic only.
 *
 * This swap is safe precisely because changing language already requires a full
 * restart for RTL (see i18n/index.tsx), so fonts are only ever chosen once per
 * process, at boot, from the persisted locale.
 *
 * Licence: IBM Plex Sans Arabic is SIL OFL 1.1 — see assets/fonts/OFL.txt.
 */
export function fontMapForLocale(locale: Locale): Record<string, FontSource> {
  if (locale === "ar") {
    return {
      Inter_400Regular: require("@/assets/fonts/IBMPlexSansArabic-Regular.ttf"),
      Inter_500Medium: require("@/assets/fonts/IBMPlexSansArabic-Medium.ttf"),
      Inter_600SemiBold: require("@/assets/fonts/IBMPlexSansArabic-SemiBold.ttf"),
      Inter_700Bold: require("@/assets/fonts/IBMPlexSansArabic-Bold.ttf"),
    };
  }

  return {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  };
}

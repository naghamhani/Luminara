import { NativeModules, Platform } from "react-native";

import { type Locale } from "./types";

/**
 * Device language detection, with no new dependency.
 *
 * `expo-localization` is the usual answer, but this workspace installs through
 * pnpm with the `catalog:` protocol and adding a native module here would mean
 * a lockfile change plus a rebuild. Everything below is already in the runtime:
 * Hermes ships Intl on React Native 0.81, and the platform locale is readable
 * from NativeModules on both OSes as a fallback.
 *
 * If you later add `expo-localization` for other reasons (region, calendar,
 * measurement system), replace the body of `detectDeviceLocale` with
 * `Localization.getLocales()[0]?.languageCode` and delete the rest.
 */
function rawDeviceLocale(): string | undefined {
  // Preferred: Intl, which Hermes enables by default on RN 0.81.
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved) return resolved;
  } catch {
    // Intl missing or throwing — fall through to the native modules.
  }

  try {
    if (Platform.OS === "ios") {
      const settings = NativeModules["SettingsManager"]?.settings;
      // AppleLanguages is the user's ordered preference list and is the more
      // accurate signal; AppleLocale reflects region formatting.
      const preferred = settings?.AppleLanguages?.[0];
      return preferred ?? settings?.AppleLocale;
    }
    if (Platform.OS === "android") {
      return NativeModules["I18nManager"]?.localeIdentifier;
    }
  } catch {
    // Native module shape differs across versions — never let this throw.
  }

  return undefined;
}

/**
 * Best-guess app locale for a first launch, before the user has chosen one.
 * Anything that isn't recognisably Arabic falls back to English.
 */
export function detectDeviceLocale(): Locale {
  const raw = rawDeviceLocale();
  if (!raw) return "en";

  // Matches "ar", "ar-JO", "ar_JO", "ar-Arab-JO" — the language subtag is all
  // that matters, and the separator differs by platform.
  const language = raw.replace("_", "-").split("-")[0]?.toLowerCase();
  return language === "ar" ? "ar" : "en";
}

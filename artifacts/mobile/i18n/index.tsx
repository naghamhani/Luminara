import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { I18nManager } from "react-native";

import { showAlert } from "@/utils/dialog";

import { ar } from "./ar";
import { detectDeviceLocale } from "./device";
import { en, TranslationKeys } from "./en";
import { isRTLLocale, type Locale } from "./types";

export type { Locale } from "./types";
export { LOCALES, LOCALE_LABELS, isRTLLocale } from "./types";
export { fontMapForLocale } from "./fonts";

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}.${NestedKeyOf<T[K]>}`
    : K;
}[keyof T & string];

export type TranslationKey = NestedKeyOf<TranslationKeys>;

/** Values interpolated into a translation via {placeholder} tokens. */
export type TranslationVars = Record<string, string | number>;

interface I18nContextType {
  t: (key: TranslationKey | string, vars?: TranslationVars) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  /** True when the ACTIVE LAYOUT is right-to-left. */
  isRTL: boolean;
  /**
   * True when the chosen locale's direction differs from the direction the app
   * actually booted with — i.e. a restart is still pending. Screens can use it
   * to keep showing the "restart to finish" notice.
   */
  needsRestart: boolean;
}

export const LOCALE_KEY = "@luminara_locale";

const TRANSLATIONS: Record<Locale, TranslationKeys> = { en, ar };

function lookup(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Replaces {name} tokens. Unknown tokens are left intact rather than blanked,
 *  so a typo is visible in QA instead of silently deleting copy. */
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

/**
 * Reads the persisted locale, falling back to the device language on a first
 * launch. Call this BEFORE rendering: fonts are chosen from the result, and a
 * wrong first guess would show a frame of Latin-font Arabic.
 */
export async function loadInitialLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(LOCALE_KEY);
    if (stored === "en" || stored === "ar") return stored;
  } catch {
    // Storage unavailable — fall through to device detection.
  }
  return detectDeviceLocale();
}

/**
 * Aligns the native RTL flag with a locale. Must run before the first render,
 * because React Native reads these flags when it builds the view hierarchy.
 *
 * `allowRTL` is a capability switch, not a direction: it must stay true so the
 * platform is permitted to lay out RTL at all. Passing `allowRTL(false)` while
 * asking for `forceRTL(true)` is contradictory and leaves Arabic laid out
 * left-to-right.
 *
 * Returns true when the flag had to change, which means the running process is
 * still laid out the old way and a restart is required.
 */
export function applyLayoutDirection(locale: Locale): boolean {
  const shouldBeRTL = isRTLLocale(locale);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    return true;
  }
  return false;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  /** Resolved by loadInitialLocale() before fonts load. */
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? "en");
  const [needsRestart, setNeedsRestart] = useState(false);

  // Only used when no initialLocale was supplied (e.g. a test harness or a
  // screen rendering the provider directly). The normal app path resolves the
  // locale in the root layout before this mounts.
  useEffect(() => {
    if (initialLocale !== undefined) return;
    let cancelled = false;
    (async () => {
      const resolved = await loadInitialLocale();
      if (!cancelled) setLocaleState(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  const t = useCallback(
    (key: TranslationKey | string, vars?: TranslationVars): string => {
      const value = lookup(TRANSLATIONS[locale], key);
      if (value !== undefined) return interpolate(value, vars);
      // Fall back to English if the key is missing in the active locale, then
      // to the raw key so the UI never crashes on a missing translation.
      const fallback = lookup(en, key);
      return fallback !== undefined ? interpolate(fallback, vars) : key;
    },
    [locale]
  );

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      await AsyncStorage.setItem(LOCALE_KEY, next);
    } catch {
      // A failed write only costs the user their choice next launch.
    }

    const directionChanged = applyLayoutDirection(next);
    if (!directionChanged) return;

    // React Native does not re-lay-out a running app when the RTL flag flips —
    // the native flag is persisted and read at startup. expo-updates is not
    // installed here, and even with it Expo Go and dev clients rarely reload
    // cleanly through a native-level direction change, so the honest move is to
    // ask for a restart rather than pretend it took effect.
    setNeedsRestart(true);
    showAlert(
      TRANSLATIONS[next].profile.languageChangeRestartTitle,
      TRANSLATIONS[next].profile.languageChangeRestartBody
    );
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({ t, locale, setLocale, isRTL: I18nManager.isRTL, needsRestart }),
    [t, locale, setLocale, needsRestart]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}

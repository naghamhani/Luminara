import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nManager } from "react-native";

import { showAlert } from "@/utils/dialog";

import { en, TranslationKeys } from "./en";
import { ar } from "./ar";

export type Locale = "en" | "ar";

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}.${NestedKeyOf<T[K]>}`
    : K;
}[keyof T & string];

export type TranslationKey = NestedKeyOf<TranslationKeys>;

interface I18nContextType {
  t: (key: TranslationKey | string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

const LOCALE_KEY = "@luminara_locale";

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

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LOCALE_KEY);
        if (stored === "en" || stored === "ar") {
          setLocaleState(stored);
        }
      } catch {
      }
    })();
  }, []);

  const t = useCallback(
    (key: TranslationKey | string): string => {
      const table = TRANSLATIONS[locale];
      const value = lookup(table, key);
      if (value !== undefined) return value;
      // Fall back to English if the key is missing in the active locale,
      // then finally fall back to the raw key so the UI never crashes on
      // a missing translation.
      const fallback = lookup(en, key);
      return fallback !== undefined ? fallback : key;
    },
    [locale]
  );

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      await AsyncStorage.setItem(LOCALE_KEY, next);
    } catch {
    }

    const shouldBeRTL = next === "ar";
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.allowRTL(shouldBeRTL);

    // React Native does not apply a forceRTL() flip to the running app —
    // it only takes effect after a full native reload. We don't have
    // expo-updates installed in this project, so there's no reliable
    // Updates.reloadAsync() to call here (and even with it, Expo Go /
    // dev builds often can't reload cleanly for a native-level RTL
    // change). Best we can honestly do is tell the user to restart.
    showAlert(
      TRANSLATIONS[next].profile.languageChangeRestartTitle,
      TRANSLATIONS[next].profile.languageChangeRestartBody
    );
  }, []);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}

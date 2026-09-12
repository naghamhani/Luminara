export type Locale = "en" | "ar";

export const LOCALES: Locale[] = ["en", "ar"];

/** Locales that lay out right-to-left. */
export const RTL_LOCALES: Locale[] = ["ar"];

export function isRTLLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Native language names — a language picker should never be in English only. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

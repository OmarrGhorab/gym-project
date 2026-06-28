export const locales = ["en", "ar"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "atp-gym-locale";

export function isAppLocale(value: string | undefined): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function getLocaleDirection(locale: AppLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}

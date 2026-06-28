import { type AppLocale, defaultLocale } from "./config";

const messages = {
  en: () => import("../../messages/en.json").then((module) => module.default),
  ar: () => import("../../messages/ar.json").then((module) => module.default),
} satisfies Record<AppLocale, () => Promise<Record<string, unknown>>>;

export async function getMessages(locale: AppLocale = defaultLocale) {
  return messages[locale]();
}

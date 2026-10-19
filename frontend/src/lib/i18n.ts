import { i18n } from "@lingui/core";
import { fetchJson } from "./api";

export const LOCALES = {
  en: { label: "EN", name: "English" },
  es: { label: "ES", name: "Español" },
} as const;
export type Locale = keyof typeof LOCALES;

const isLocale = (value: string): value is Locale => value in LOCALES;

async function activate(locale: Locale): Promise<void> {
  const { messages } = await import(`../locales/${locale}.po`);
  i18n.loadAndActivate({ locale, messages });
  document.documentElement.lang = locale;
}

/** The backend resolves cookie > Accept-Language, so the first paint is already right. */
export async function initI18n(): Promise<void> {
  const { locale } = await fetchJson<{ locale: string }>("/api/v1/locale").catch(() => ({
    locale: navigator.language.slice(0, 2),
  }));
  await activate(isLocale(locale) ? locale : "en");
}

export async function changeLocale(locale: Locale): Promise<void> {
  await fetchJson("/api/v1/locale", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  await activate(locale);
}

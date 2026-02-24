import { en } from "./locales/en";

export type TranslationKey = keyof typeof en;

const translations = {
  en,
};

type Language = keyof typeof translations;

let currentLanguage: Language = "en";

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: TranslationKey): string {
  return translations[currentLanguage][key] || key;
}

export function getAvailableLanguages(): Language[] {
  return Object.keys(translations) as Language[];
}

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";

export const STORAGE_KEY = "xchat.locale";

export interface SupportedLanguage {
  code: string;
  flag: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
];

export const DATE_LOCALES: Record<string, string> = {
  en: "en-GB",
  de: "de-CH",
  fr: "fr-FR",
};

function readStoredLanguage(): string {
  if (typeof window === "undefined") {
    return "en";
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && SUPPORTED_LANGUAGES.some((language) => language.code === stored)
    ? stored
    : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: readStoredLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function changeLanguage(code: string): void {
  void i18n.changeLanguage(code);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, code);
  }
}

export default i18n;

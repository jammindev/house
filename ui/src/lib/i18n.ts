import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../locales/en/translation.json';
import frTranslation from '../locales/fr/translation.json';
import deTranslation from '../locales/de/translation.json';
import esTranslation from '../locales/es/translation.json';

const supportedLanguages = ['en', 'fr', 'de', 'es'];

function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  // 1. User preference (set after login or settings change)
  const stored = localStorage.getItem('lang');
  if (stored && supportedLanguages.includes(stored)) return stored;
  // 2. Browser language
  const browserLang = navigator.language.split('-')[0];
  return supportedLanguages.includes(browserLang) ? browserLang : 'en';
}

const detectedLang = detectLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    fr: { translation: frTranslation },
    de: { translation: deTranslation },
    es: { translation: esTranslation },
  },
  lng: detectedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;

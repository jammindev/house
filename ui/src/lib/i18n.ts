import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../locales/en/translation.json';
import frTranslation from '../locales/fr/translation.json';
import deTranslation from '../locales/de/translation.json';
import esTranslation from '../locales/es/translation.json';

// Detect language from Django's <html lang="..."> attribute set via {% get_current_language %}
const htmlLang =
  typeof document !== 'undefined' ? document.documentElement.lang : 'en';

const supportedLanguages = ['en', 'fr', 'de', 'es'];
const detectedLang = supportedLanguages.includes(htmlLang) ? htmlLang : 'en';

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

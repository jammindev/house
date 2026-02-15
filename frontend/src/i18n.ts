import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

// Get locale from localStorage or browser
const savedLocale = localStorage.getItem('locale');
const browserLocale = navigator.language.split('-')[0];
const initialLocale = savedLocale || (browserLocale === 'fr' ? 'fr' : 'en');

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLocale,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// Save locale changes to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('locale', lng);
  document.documentElement.lang = lng;
});

export default i18n;

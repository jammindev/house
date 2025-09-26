"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";

type Locale = "en" | "fr";
type Dict = Record<string, string>;

type I18nContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

const DICTS: Record<Locale, Dict> = { en, fr } as any;

function translate(dict: Dict, key: string, params?: Record<string, string | number>) {
  let template = dict[key] ?? DICTS.en[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      template = template.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return template;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, _setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const fromStorage = localStorage.getItem("locale");
      if (fromStorage === "fr" || fromStorage === "en") {
        _setLocale(fromStorage);
        return;
      }
    } catch {}
    // fallback browser language
    if (typeof navigator !== "undefined") {
      const lang = navigator.language?.toLowerCase() || "en";
      if (lang.startsWith("fr")) _setLocale("fr");
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    _setLocale(l);
    try { localStorage.setItem("locale", l); } catch {}
    try { document.documentElement.lang = l; } catch {}
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const dict = DICTS[locale] || DICTS.en;
    return translate(dict, key, params);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}


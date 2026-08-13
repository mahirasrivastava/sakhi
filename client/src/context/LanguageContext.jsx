import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "../i18n/en.json";
import {
  LANGUAGES, LANGUAGE_CODES, DEFAULT_LANGUAGE, getLanguage, detectBrowserLanguage,
} from "../i18n/languages.js";

// 23 dictionaries eagerly imported would ship every script's strings to every
// phone on a 2G connection. Vite turns this glob into 23 separate lazy chunks;
// only the selected language is ever fetched. English is the one exception —
// it is the fallback for any key a translation has not caught up with, so it
// must always be resident.
const LOADERS = import.meta.glob("../i18n/*.json");

const DICTS = { en };
const LanguageContext = createContext(null);

const STORAGE_KEY = "sakhi_lang";

function initialLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LANGUAGE_CODES.includes(saved)) return saved;
  // No stored choice: follow the phone's own language rather than assuming
  // English. For most of the people this app is for, English is the second or
  // third language at best.
  return detectBrowserLanguage();
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLanguage);
  const [dict, setDict] = useState(() => DICTS[initialLanguage()] || en);
  const [loading, setLoading] = useState(false);

  const loadDict = useCallback(async (code) => {
    if (DICTS[code]) return DICTS[code];
    const loader = LOADERS[`../i18n/${code}.json`];
    if (!loader) return en;
    const mod = await loader();
    DICTS[code] = mod.default || mod;
    return DICTS[code];
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (DICTS[lang]) {
      setDict(DICTS[lang]);
      return undefined;
    }
    setLoading(true);
    loadDict(lang)
      .then((d) => { if (!cancelled) setDict(d); })
      // A failed chunk fetch must not blank the interface — English is still
      // readable, and a health app that renders nothing is worse than one that
      // renders the wrong language.
      .catch(() => { if (!cancelled) setDict(en); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lang, loadDict]);

  // Direction and lang on <html> drive text alignment, punctuation placement and
  // screen-reader pronunciation. Urdu, Kashmiri and Sindhi render wrong without it.
  useEffect(() => {
    const meta = getLanguage(lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", meta.dir);
  }, [lang]);

  const changeLang = useCallback((next) => {
    if (!LANGUAGE_CODES.includes(next)) return;
    setLang(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useMemo(() => (key) => dict[key] ?? en[key] ?? key, [dict]);

  const value = useMemo(() => ({
    lang,
    changeLang,
    t,
    loading,
    languages: LANGUAGES,
    meta: getLanguage(lang),
    dir: getLanguage(lang).dir,
    defaultLanguage: DEFAULT_LANGUAGE,
  }), [lang, changeLang, t, loading]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

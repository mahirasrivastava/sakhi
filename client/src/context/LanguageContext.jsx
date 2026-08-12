import React, { createContext, useContext, useState, useMemo } from "react";
import en from "../i18n/en.json";
import hi from "../i18n/hi.json";
import kn from "../i18n/kn.json";

const DICTS = { en, hi, kn };
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem("sakhi_lang") || "en");

  function changeLang(next) {
    setLang(next);
    localStorage.setItem("sakhi_lang", next);
  }

  const t = useMemo(() => {
    const dict = DICTS[lang] || DICTS.en;
    return (key) => dict[key] || DICTS.en[key] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

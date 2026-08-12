import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हि" },
  { code: "kn", label: "ಕನ್ನಡ" },
];

const LINKS = [
  { to: "/", key: "nav_home" },
  { to: "/triage", key: "nav_triage" },
  { to: "/general", key: "nav_general" },
  { to: "/nearby", key: "nav_nearby" },
  { to: "/demo", key: "nav_demo" },
  { to: "/anaemia", key: "nav_anaemia" },
  { to: "/cycle", key: "nav_cycle" },
  { to: "/dashboard", key: "nav_dashboard" },
  { to: "/impact", key: "nav_impact" },
];

export default function Navbar() {
  const { lang, changeLang, t } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <header style={styles.header}>
      <div className="container" style={styles.inner}>
        <NavLink to="/" style={styles.brand} onClick={() => setOpen(false)}>
          <span style={styles.brandMark}>स</span>
          <span className="display" style={styles.brandName}>Sakhi</span>
        </NavLink>

        <button
          className="sakhi-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={styles.burger}
        >
          {open ? "✕" : "☰"}
        </button>

        <nav className={`sakhi-nav${open ? " open" : ""}`} style={styles.nav}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.linkActive : {}),
              })}
            >
              {t(l.key)}
            </NavLink>
          ))}

          <div className="lang-group" style={styles.langGroup} role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                aria-pressed={lang === l.code}
                style={{
                  ...styles.langBtn,
                  ...(lang === l.code ? styles.langBtnActive : {}),
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 40,
    background: "rgba(253, 248, 246, 0.92)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #F0DFE2",
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    gap: 12,
  },
  brand: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#2B1E22" },
  brandMark: {
    width: 32, height: 32, borderRadius: "50%",
    background: "#B04A63", color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "Fraunces, serif", fontSize: 17,
  },
  brandName: { fontSize: 20 },
  burger: {
    display: "none",
    background: "none", border: "none", fontSize: 22, color: "#7E2F44",
  },
  nav: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  navOpen: {},
  link: {
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 14.5,
    fontWeight: 500,
    textDecoration: "none",
    color: "#6B5A5F",
  },
  linkActive: { background: "#F2D9DF", color: "#7E2F44", fontWeight: 600 },
  langGroup: { display: "flex", gap: 4, marginLeft: 8, borderLeft: "1px solid #F0DFE2", paddingLeft: 10 },
  langBtn: {
    padding: "6px 9px", fontSize: 12.5, borderRadius: 999,
    border: "1px solid #F0DFE2", background: "white", color: "#6B5A5F", fontWeight: 600,
  },
  langBtnActive: { background: "#B04A63", color: "white", borderColor: "#B04A63" },
};

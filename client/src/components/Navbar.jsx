import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import LanguagePicker from "./LanguagePicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

// Icons carry real weight here, not decoration. A lot of the people this is
// built for read slowly or not at all in the language on screen, and a
// recognisable pictogram next to a label is often what makes a nav usable at
// all. They are paired with text, never used alone.
const LINKS = [
  { to: "/", key: "nav_home", icon: "🏠" },
  { to: "/triage", key: "nav_triage", icon: "⚡" },
  { to: "/sakhi", key: "nav_sakhi", icon: "🧭" },
  { to: "/general", key: "nav_general", icon: "🩺" },
  { to: "/nearby", key: "nav_nearby", icon: "📍" },
  { to: "/anaemia", key: "nav_anaemia", icon: "👁️" },
  { to: "/cycle", key: "nav_cycle", icon: "🗓️" },
  { to: "/prescription", key: "nav_prescription", icon: "📄" },
  { to: "/impact", key: "nav_impact", icon: "📊" },
  { to: "/demo", key: "nav_demo", icon: "▶️" },
];

export default function Navbar() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Navigating with the menu open on a phone should close it — otherwise the
  // new page loads behind a full-height overlay.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const staffLink = isAuthenticated
    ? { to: "/dashboard", label: t("nav_dashboard") }
    : { to: "/asha/login", label: "Staff sign-in" };

  return (
    <header className="site-header">
      {/* Utility strip: the two things someone in trouble needs before anything
          else, and the settings that change how the whole site reads. */}
      <div className="utility-bar">
        <div className="container utility-inner">
          <div className="utility-left">
            <a href="tel:108" className="helpline">🚑 Ambulance 108</a>
            <a href="tel:112" className="helpline">☎️ Emergency 112</a>
            <a href="tel:1091" className="helpline">👩 Women's helpline 1091</a>
            <span className="utility-note">Free · No account needed · Nothing is tied to your name</span>
          </div>
          <div className="utility-right">
            <LanguagePicker />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container header-main">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">स</span>
          <span>
            <span className="brand-name">Sakhi</span>
            <span className="brand-tag">Health help in your language</span>
          </span>
        </NavLink>

        <button
          className="sakhi-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>

        <nav className={`sakhi-nav${open ? " open" : ""}`} aria-label="Main">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <span className="nav-icon" aria-hidden="true">{l.icon}</span>
              <span>{t(l.key)}</span>
            </NavLink>
          ))}

          {/* Visually separated from the patient-facing links — this is a
              restricted area, and it should not look like another service. */}
          <NavLink to={staffLink.to} className="staff-link">
            {isAuthenticated ? "" : "🔒 "}{staffLink.label}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

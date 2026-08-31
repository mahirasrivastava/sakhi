import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { NAV } from "../navConfig.js";
import LanguagePicker from "./LanguagePicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
//
// This was eleven links in a flat row, plus four phone numbers, a language
// picker, a theme toggle and a staff link — eighteen targets competing on one
// line. Everything was top-level, so nothing read as important, and the row
// wrapped onto two lines on a laptop and scrolled horizontally on a phone.
//
// Now it is five top-level items (see navConfig.js — BottomNav renders from
// the same list, so the phone tab bar and this drawer can never disagree
// about what the five core destinations are).
//
// Impact moved to the footer: it is an "about this project" page, not a task,
// and it was taking a slot from things people actually need. The three emergency
// numbers stay pinned in the utility strip above, because someone in trouble
// must not have to open a menu — but "All helplines" moves into Find help,
// since that one is browsing, not dialling.
//
// Icons carry real weight here, not decoration. A lot of the people this is
// built for read slowly or not at all in the language on screen, and a
// recognisable pictogram next to a label is often what makes a nav usable at
// all. They are paired with text, never used alone — and they are drawn (see
// Icon.jsx) rather than typed as emoji, so they inherit the active colour and
// render identically on a five-year-old handset.

export default function Navbar() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { user, isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const location = useLocation();
  const navRef = useRef(null);

  // Navigating with the menu open on a phone should close it — otherwise the
  // new page loads behind a full-height overlay.
  useEffect(() => { setOpen(false); setMenu(null); }, [location.pathname]);

  // A dropdown left open when the user clicks elsewhere is a stuck overlay, and
  // Escape is what people reach for.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => { if (!navRef.current?.contains(e.target)) setMenu(null); };
    const onKey = (e) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const staffLink = isAuthenticated
    ? { to: "/dashboard", label: t("nav_dashboard") }
    : { to: "/asha/login", label: "Staff sign-in" };

  // A group is "current" when the open page is one of its children, so the user
  // can see where they are without opening anything.
  const groupActive = (group) => group.children.some((c) => c.to === location.pathname);

  const label = (item) => {
    const translated = t(item.key);
    // Group labels are new keys; fall back to English rather than rendering the
    // raw key if a language file has not caught up yet.
    return translated === item.key ? (item.fallback || item.key) : translated;
  };

  return (
    <header className="site-header">
      {/* Civic tricolour rule. Decorative only — see the note in index.css on
          why no emblem or government wording appears anywhere in this shell. */}
      <div className="tricolour-rule" aria-hidden="true">
        <span /><span /><span />
      </div>

      {/* Utility strip: the numbers someone in trouble needs before anything
          else, and the settings that change how the whole site reads. Trimmed
          to three — a row of numbers nobody can scan is not an emergency
          affordance, it is decoration. */}
      <div className="utility-bar">
        <div className="container utility-inner">
          <div className="utility-left">
            <a href="tel:108" className="helpline">
              <Icon name="ambulance" size={14} /> Ambulance 108
            </a>
            <a href="tel:112" className="helpline">
              <Icon name="alert" size={14} /> Emergency 112
            </a>
            <a href="tel:181" className="helpline">
              <Icon name="woman" size={14} /> Women 181
            </a>
            <span className="utility-note">Free · No account needed · Nothing is tied to your name</span>
          </div>
          <div className="utility-right">
            <LanguagePicker />
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="container header-main">
        <NavLink to="/" className="masthead" onClick={() => setOpen(false)}>
          <Logo size={42} />
          <span className="masthead-text">
            <span className="logo-wordmark-dv">सखी</span>
            <span className="logo-wordmark-en">SAKHI</span>
            <span className="masthead-tag">Health triage &amp; screening</span>
          </span>
        </NavLink>

        <button
          className="sakhi-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? "close" : "menu"} size={22} />
        </button>

        <nav className={`sakhi-nav${open ? " open" : ""}`} aria-label="Main" ref={navRef}>
          {NAV.map((item) => (
            item.children ? (
              <div
                key={item.id}
                className={`nav-group${menu === item.id ? " open" : ""}${groupActive(item) ? " active" : ""}`}
              >
                <button
                  type="button"
                  className={`nav-link nav-group-trigger${groupActive(item) ? " active" : ""}`}
                  aria-expanded={menu === item.id}
                  onClick={() => setMenu((m) => (m === item.id ? null : item.id))}
                >
                  <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                  <span>{label(item)}</span>
                  <Icon name="chevronDown" size={14} className="nav-caret" />
                </button>

                <div className="nav-menu" role="menu">
                  {item.children.map((c) => (
                    <NavLink
                      key={c.to}
                      to={c.to}
                      role="menuitem"
                      className={({ isActive }) => `nav-menu-item${isActive ? " active" : ""}`}
                      onClick={() => setMenu(null)}
                    >
                      <span className="nav-menu-icon"><Icon name={c.icon} size={17} /></span>
                      <span>
                        <span className="nav-menu-label">{t(c.key)}</span>
                        <span className="nav-menu-blurb">{c.blurb}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                <span>{label(item)}</span>
              </NavLink>
            )
          ))}

          <NavLink to="/account" className="nav-link">
            <Icon name="user" size={16} />
            <span>{isSignedIn ? user.handle : t("nav_account")}</span>
          </NavLink>

          {/* Visually separated from the patient-facing links — this is a
              restricted area, and it should not look like another service. */}
          <NavLink to={staffLink.to} className="staff-link">
            {!isAuthenticated && <Icon name="lock" size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 5 }} />}
            {staffLink.label}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

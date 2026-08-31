import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { NAV } from "../navConfig.js";
import Icon from "./Icon.jsx";

// ---------------------------------------------------------------------------
// Phone tab bar.
// ---------------------------------------------------------------------------
//
// The top nav (Navbar.jsx) only ever offers a hamburger drawer below 1180px —
// correct for a tablet, but on a phone it means every one of the five things
// this app does is one extra tap behind a menu icon that itself needs
// explaining. Aarogya Setu, CoWIN and UMANG all settle on the same answer:
// a fixed row of icon-and-label destinations, always on screen, always in
// the same place, thumb-reachable with the phone held one-handed. That
// pattern is borrowed here for the same reason the rest of the
// government-service shell is (see the CSS note by that name) — it is
// legible on sight to someone who has used one of those apps, and it is
// good accessibility practice regardless.
//
// It renders from the same NAV list Navbar.jsx uses, so the two can never
// disagree about what the five core destinations are. A group (e.g.
// "Screening") becomes a single tab that opens its first, most common child
// route directly — a bottom bar that opened a menu of its own would just be
// the hamburger problem again, one level down. Anyone who wants a different
// child of that group still has the full drawer at the top.
const TABS = NAV.map((item) =>
  item.children
    ? {
        to: item.children[0].to,
        match: item.children.map((c) => c.to),
        key: item.key,
        fallback: item.fallback,
        icon: item.icon,
      }
    : { to: item.to, match: [item.to], key: item.key, icon: item.icon, end: item.to === "/" }
);

export default function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();

  const label = (tab) => {
    const translated = t(tab.key);
    return translated === tab.key ? (tab.fallback || tab.key) : translated;
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.end
          ? location.pathname === tab.to
          : tab.match.includes(location.pathname);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`bottom-nav-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={23} />
            <span>{label(tab)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

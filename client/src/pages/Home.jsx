import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./../components/Icon.jsx";
import JourneyChecklist from "../components/JourneyChecklist.jsx";
import { callsFor } from "../helplines.js";

// The full service list, as a grid of large tiles. This is the pattern the
// public service apps settle on for good reason: every service is visible at
// once, each one is a big target with a pictogram and a plain-language
// description, and nobody has to guess what lives behind a menu.
const SERVICES = [
  { to: "/triage", icon: "triage", key: "nav_triage", descKey: "home_desc_triage" },
  { to: "/nearby", icon: "pin", key: "nav_nearby", descKey: "home_desc_nearby", urgent: true },
  { to: "/helplines", icon: "phone", key: "nav_helplines", descKey: "home_desc_helplines", urgent: true },
  { to: "/anaemia", icon: "eye", key: "nav_anaemia", descKey: "home_desc_anaemia" },
  { to: "/prescription", icon: "report", key: "nav_prescription", descKey: "home_desc_prescription" },
  { to: "/sakhi", icon: "compass", key: "nav_sakhi", descKey: "home_desc_sakhi" },
  { to: "/general", icon: "stethoscope", key: "nav_general", descKey: "home_desc_general" },
  { to: "/cycle", icon: "calendar", key: "nav_cycle", descKey: "home_desc_cycle" },
  { to: "/pregnancy", icon: "pregnancy", key: "nav_pregnancy", descKey: "home_desc_pregnancy" },
  { to: "/report", icon: "report", key: "nav_report", descKey: "home_desc_report" },
  { to: "/impact", icon: "chart", key: "nav_impact", descKey: "home_desc_impact" },
];

const PROMISES = [
  { icon: "handshake", titleKey: "home_promise_do_title", textKey: "home_promise_do_text" },
  { icon: "ban", titleKey: "home_promise_never_title", textKey: "home_promise_never_text" },
  { icon: "lock", titleKey: "home_promise_keep_title", textKey: "home_promise_keep_text" },
];

export default function Home() {
  const { t } = useLanguage();
  const emergencyLines = callsFor({ limit: 3 });

  return (
    <>
      {/* Hero band. The tinted full-bleed background is what stops the top of
          the page reading as an empty white sheet with a paragraph on it. */}
      <section style={styles.heroBand}>
        <div className="container" style={styles.heroInner}>
          <div style={{ maxWidth: 640 }}>
            <span style={styles.kicker}>{t("home_kicker")}</span>
            <h1 className="display" style={styles.heroTitle}>{t("home_title")}</h1>
            <p style={styles.heroSub}>{t("home_subtitle")}</p>

            <div style={styles.heroActions}>
              <Link to="/triage" className="btn btn-primary btn-lg">
                {t("home_cta")} <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/sakhi" className="btn btn-ghost btn-lg">
                <Icon name="compass" size={18} /> {t("home_browse_topics")}
              </Link>
            </div>

            <div style={styles.badges}>
              {["home_pill_1", "home_pill_2", "home_pill_3"].map((k) => (
                <span key={k} style={styles.badge}>
                  <Icon name="check" size={14} style={{ color: "var(--rose)" }} />
                  {t(k)}
                </span>
              ))}
            </div>
          </div>

          {/* Emergency panel, deliberately at the top right rather than buried
              in a footer. Someone who needs 108 needs it before anything else
              on this page. */}
          <aside style={styles.emergencyPanel}>
            <div style={styles.emergencyTitle}>
              <Icon name="alert" size={19} />
              {t("home_emergency_title")}
            </div>
            <p style={styles.emergencyText}>{t("home_emergency_text")}</p>
            {emergencyLines.map((h, i) => (
              <a
                key={h.number}
                href={`tel:${h.dial}`}
                className={`btn ${i === 0 ? "btn-emergency" : "btn-ghost"}`}
                style={styles.emergencyBtn}
              >
                <Icon name={h.icon} size={17} />
                <span>{h.label}</span>
                <strong style={styles.emergencyNum}>{h.number}</strong>
              </a>
            ))}
            <Link to="/helplines" className="btn-text" style={{ marginTop: 12 }}>
              {t("home_emergency_more")} <Icon name="arrowRight" size={13} />
            </Link>
          </aside>
        </div>
      </section>

      <section style={styles.servicesBand}>
        <div className="container" style={{ paddingTop: 44, paddingBottom: 20 }}>
          <div className="section-head">
            <span className="section-eyebrow">
              <Icon name="home" size={13} /> {t("home_services_eyebrow")}
            </span>
            <h2 className="display section-title">{t("home_services_title")}</h2>
            <p className="section-sub">{t("home_services_sub")}</p>
            <div className="section-rule" />
          </div>

          <div className="tile-grid">
            {SERVICES.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className={`tile${s.primary ? " tile-primary" : ""}${s.urgent ? " tile-urgent" : ""}`}
              >
                <span className="tile-mark">
                  <Icon name={s.icon} size={24} />
                </span>
                <span className="tile-title">{t(s.key)}</span>
                <span className="tile-desc">{t(s.descKey)}</span>
                <span className="tile-go">
                  {t("home_tile_open")} <Icon name="arrowRight" size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <JourneyChecklist />

      {/* Plain-language statement of what this is and is not. On a health tool
          used by people who may not have seen one before, saying this outright
          matters more than any feature on the page. */}
      <section className="container" style={{ paddingBottom: 50 }}>
        <div style={styles.promiseBand}>
          {PROMISES.map((p) => (
            <div key={p.titleKey}>
              <span style={styles.promiseIcon}>
                <Icon name={p.icon} size={22} />
              </span>
              <h3 style={styles.promiseTitle}>{t(p.titleKey)}</h3>
              <p style={styles.promiseText}>{t(p.textKey)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const styles = {
  servicesBand: {
    background: "linear-gradient(180deg, var(--cream) 0%, var(--rose-soft) 55%, var(--cream) 100%)",
  },
  heroBand: {
    background: "linear-gradient(180deg, var(--rose-soft) 0%, var(--cream) 100%)",
    borderBottom: "1px solid var(--border)",
    paddingTop: 46,
    paddingBottom: 46,
  },
  heroInner: {
    display: "flex", gap: 34, alignItems: "flex-start",
    justifyContent: "space-between", flexWrap: "wrap",
  },
  kicker: {
    display: "inline-block", padding: "6px 15px", borderRadius: 999,
    background: "var(--rose)", color: "var(--on-brand)",
    fontSize: 12.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(32px, 4.6vw, 54px)", lineHeight: 1.1, marginTop: 18, color: "var(--ink)",
  },
  heroSub: { fontSize: 18.5, color: "var(--ink-soft)", marginTop: 18, lineHeight: 1.6 },
  heroActions: { display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" },
  badges: { display: "flex", gap: 9, marginTop: 26, flexWrap: "wrap" },
  badge: {
    display: "inline-flex", alignItems: "center", gap: 7,
    fontSize: 13.5, color: "var(--rose-deep)", background: "var(--surface)",
    border: "1px solid var(--border-strong)", padding: "8px 14px",
    borderRadius: 999, fontWeight: 600,
  },

  emergencyPanel: {
    flex: "1 1 290px", maxWidth: 350,
    background: "var(--surface)", border: "2px solid var(--emergency)",
    borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow)",
  },
  emergencyTitle: {
    display: "flex", alignItems: "center", gap: 9,
    fontSize: 17, fontWeight: 700, color: "var(--emergency)",
  },
  emergencyText: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "8px 0 14px" },
  emergencyBtn: {
    width: "100%", justifyContent: "flex-start", textDecoration: "none",
    marginBottom: 8, fontSize: 15, padding: "12px 16px",
  },
  emergencyNum: {
    marginInlineStart: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },

  promiseBand: {
    display: "grid", gap: 26, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    background: "var(--cream-dim)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 30,
  },
  promiseIcon: {
    width: 42, height: 42, borderRadius: 12, background: "var(--surface)",
    border: "1px solid var(--border-strong)", color: "var(--rose-deep)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  promiseTitle: { fontSize: 17, fontWeight: 700, color: "var(--ink)", marginTop: 12 },
  promiseText: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 7 },
};

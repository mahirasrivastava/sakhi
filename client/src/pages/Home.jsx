import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./../components/Icon.jsx";
import JourneyChecklist from "../components/JourneyChecklist.jsx";
import { callsFor } from "../helplines.js";
import en from "../i18n/en.json";

// ---------------------------------------------------------------------------
// "Say It" — voice-first
// ---------------------------------------------------------------------------
//
// The home page used to open with a gradient hero band, a headline, two pill
// buttons and a row of badge chips — the templated shape most landing pages
// settle on regardless of what the product actually does. This instead
// leads with the product's real differentiator: you can speak instead of
// typing. The orb and its sound-rings are drawn from the app's own mic
// icon (see Icon.jsx), not a stock illustration, and the primary action is
// a tactile "press to speak" button rather than a generic pill CTA.
//
// The headline pairs the current UI language with English underneath it —
// the same bilingual convention the masthead already uses, just at hero
// scale — instead of a small "kicker" badge above generic hero copy.
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

// A numbered walkthrough before the tile grid, not after. Someone who has
// never used Sakhi and does not yet trust it should see the shape of the
// whole interaction — three short steps, nothing hidden — before being asked
// to pick from eleven destinations.
const STEPS = [
  { icon: "mic", titleKey: "home_step1_title", textKey: "home_step1_text" },
  { icon: "shield", titleKey: "home_step2_title", textKey: "home_step2_text" },
  { icon: "handshake", titleKey: "home_step3_title", textKey: "home_step3_text" },
];

export default function Home() {
  const { t, lang } = useLanguage();
  const emergencyLines = callsFor({ limit: 3 });

  return (
    <>
      {/* The hero. No gradient band, no floating alert card — the mic orb
          and its rings are the visual centre, and the primary action is the
          orb button itself rather than a pill-shaped "Start" button. */}
      <section className="voice-hero">
        <div className="container voice-hero-inner">
          <div className="voice-copy">
            <p className="voice-lang-title">{t("home_title")}</p>
            {/* The masthead already pairs Hindi with English regardless of
                the active language; this does the same at hero scale —
                current language on top, English underneath, skipped only
                when they're the same string. */}
            {lang !== "en" && <p className="voice-lang-sub">{en.home_title}</p>}
            <p className="voice-sub">{t("home_subtitle")}</p>

            <div className="voice-actions">
              <Link to="/triage" className="voice-btn" aria-label={t("home_cta")}>
                <Icon name="mic" size={26} />
              </Link>
              <div className="voice-label">
                <Link to="/triage" className="voice-label-main">{t("home_cta")}</Link>
                <Link to="/sakhi" className="voice-label-alt">
                  <Icon name="compass" size={12} /> {t("home_browse_topics")}
                </Link>
              </div>
            </div>

            <p className="voice-trust">{t("home_kicker")}</p>
          </div>

          <div className="voice-orb-wrap" aria-hidden="true">
            <span className="orb-ring r2" />
            <span className="orb-ring r1" />
            <span className="orb">
              <Icon name="mic" size={42} />
            </span>
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

      <section className="container" style={{ paddingTop: 46, paddingBottom: 10 }}>
        <div className="section-head">
          <span className="section-eyebrow">
            <Icon name="compass" size={13} /> {t("home_steps_eyebrow")}
          </span>
          <h2 className="display section-title">{t("home_steps_title")}</h2>
          <p className="section-sub">{t("home_steps_sub")}</p>
          <div className="section-rule" />
        </div>

        <div style={styles.stepsRow}>
          {STEPS.map((s, i) => (
            <div key={s.titleKey} style={styles.stepCard}>
              <span style={styles.stepNum}>{i + 1}</span>
              <span style={styles.stepIcon}>
                <Icon name={s.icon} size={24} />
              </span>
              <h3 style={styles.stepTitle}>{t(s.titleKey)}</h3>
              <p style={styles.stepText}>{t(s.textKey)}</p>
            </div>
          ))}
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

  stepsRow: {
    display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    marginTop: 10,
  },
  stepCard: {
    position: "relative",
    background: "var(--surface)", border: "1px solid var(--border-strong)",
    borderRadius: "var(--radius)", padding: "26px 20px 20px",
  },
  stepNum: {
    position: "absolute", top: -15, insetInlineStart: 18,
    width: 30, height: 30, borderRadius: "50%",
    background: "var(--rose)", color: "var(--on-brand)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15,
    border: "2px solid var(--cream)",
  },
  stepIcon: {
    width: 44, height: 44, borderRadius: 12, background: "var(--rose-soft)",
    color: "var(--rose-deep)", display: "flex", alignItems: "center", justifyContent: "center",
  },
  stepTitle: { fontSize: 16.5, fontWeight: 700, color: "var(--ink)", marginTop: 14 },
  stepText: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 6 },

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

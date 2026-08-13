import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

// The full service list, as a grid of large cards. This is the pattern public
// service portals settle on for good reason: every service is visible at once,
// each one is a big target with an icon and a plain-language description, and
// nobody has to guess what lives behind a menu.
const SERVICES = [
  { to: "/triage", icon: "⚡", key: "nav_triage",
    desc: "Answer a few questions and find out how urgent it is. Takes two minutes.", primary: true },
  { to: "/sakhi", icon: "🧭", key: "nav_sakhi",
    desc: "Read trusted health information by topic. Every card cites WHO or NHM." },
  { to: "/general", icon: "🩺", key: "nav_general",
    desc: "The same urgency check, for anyone — any age, any symptom." },
  { to: "/nearby", icon: "📍", key: "nav_nearby",
    desc: "Call an ambulance and get a location code you can read out on the phone.", urgent: true },
  { to: "/anaemia", icon: "👁️", key: "nav_anaemia",
    desc: "Point the camera at your lower eyelid to check for signs of low blood." },
  { to: "/cycle", icon: "🗓️", key: "nav_cycle",
    desc: "Track your period or pregnancy week by week. Danger signs checked automatically." },
  { to: "/prescription", icon: "📄", key: "nav_prescription",
    desc: "Photograph a prescription to understand what each medicine is for." },
  { to: "/impact", icon: "📊", key: "nav_impact",
    desc: "How many people this has helped, and what it found." },
];

export default function Home() {
  const { t } = useLanguage();

  return (
    <>
      {/* Hero band. The tinted full-bleed background is what stops the top of
          the page reading as an empty white sheet with a paragraph on it. */}
      <section style={styles.heroBand}>
        <div className="container" style={styles.heroInner}>
          <div style={{ maxWidth: 640 }}>
            <span style={styles.kicker}>Free · Private · No account</span>
            <h1 className="display" style={styles.heroTitle}>{t("home_title")}</h1>
            <p style={styles.heroSub}>{t("home_subtitle")}</p>

            <div style={styles.heroActions}>
              <Link to="/triage" className="btn btn-primary btn-lg">{t("home_cta")} →</Link>
              <Link to="/sakhi" className="btn btn-ghost btn-lg">🧭 Browse health topics</Link>
            </div>

            <div style={styles.badges}>
              {["home_pill_1", "home_pill_2", "home_pill_3"].map((k) => (
                <span key={k} style={styles.badge}>✓ {t(k)}</span>
              ))}
            </div>
          </div>

          {/* Emergency panel, deliberately at the top right rather than buried
              in a footer. Someone who needs 108 needs it before anything else
              on this page. */}
          <aside style={styles.emergencyPanel}>
            <div style={styles.emergencyTitle}>🚨 Need help right now?</div>
            <p style={styles.emergencyText}>
              Do not use the symptom check. Call straight away — all three are free.
            </p>
            <a href="tel:108" className="btn btn-primary" style={styles.emergencyBtn}>🚑 Ambulance — 108</a>
            <a href="tel:102" className="btn btn-ghost" style={styles.emergencyBtn}>🤰 Pregnancy — 102</a>
            <a href="tel:1091" className="btn btn-ghost" style={styles.emergencyBtn}>👩 Women's helpline — 1091</a>
          </aside>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 44, paddingBottom: 20 }}>
        <h2 className="display" style={styles.sectionTitle}>What would you like to do?</h2>
        <p style={styles.sectionSub}>Tap any box below. Nothing asks for your name.</p>

        <div style={styles.grid}>
          {SERVICES.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="card"
              style={{
                ...styles.serviceCard,
                ...(s.primary ? styles.servicePrimary : {}),
                ...(s.urgent ? styles.serviceUrgent : {}),
              }}
            >
              <span style={styles.serviceIcon} aria-hidden="true">{s.icon}</span>
              <span style={styles.serviceTitle}>{t(s.key)}</span>
              <span style={styles.serviceDesc}>{s.desc}</span>
              <span style={styles.serviceGo}>Open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Plain-language statement of what this is and is not. On a health tool
          used by people who may not have seen one before, saying this outright
          matters more than any feature on the page. */}
      <section className="container" style={{ paddingBottom: 50 }}>
        <div style={styles.promiseBand}>
          <div>
            <div style={styles.promiseIcon}>🤝</div>
            <h3 style={styles.promiseTitle}>What Sakhi does</h3>
            <p style={styles.promiseText}>
              Tells you how urgent something is and where to go. If it is serious, an
              ASHA worker is alerted so a real person follows up.
            </p>
          </div>
          <div>
            <div style={styles.promiseIcon}>🚫</div>
            <h3 style={styles.promiseTitle}>What Sakhi never does</h3>
            <p style={styles.promiseText}>
              It never tells you what illness you have and never prescribes medicine.
              Only a doctor can do that.
            </p>
          </div>
          <div>
            <div style={styles.promiseIcon}>🔒</div>
            <h3 style={styles.promiseTitle}>What we keep</h3>
            <p style={styles.promiseText}>
              No name, no phone number, no account. A health worker sees only how
              urgent your case is, never who you are.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

const styles = {
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
    fontSize: 13.5, color: "var(--rose-deep)", background: "var(--surface)",
    border: "1px solid var(--border-strong)", padding: "8px 14px",
    borderRadius: 999, fontWeight: 600,
  },

  emergencyPanel: {
    flex: "1 1 290px", maxWidth: 350,
    background: "var(--surface)", border: "2px solid var(--emergency)",
    borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow)",
  },
  emergencyTitle: { fontSize: 17, fontWeight: 700, color: "var(--emergency)" },
  emergencyText: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: "8px 0 14px" },
  emergencyBtn: {
    width: "100%", justifyContent: "center", textDecoration: "none",
    marginBottom: 8, fontSize: 15, padding: "12px 16px",
  },

  sectionTitle: { fontSize: "clamp(24px, 3vw, 32px)" },
  sectionSub: { fontSize: 16, color: "var(--ink-soft)", marginTop: 8 },
  grid: {
    marginTop: 26, display: "grid", gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(262px, 1fr))",
  },
  serviceCard: {
    display: "flex", flexDirection: "column", gap: 7,
    textDecoration: "none", color: "inherit", padding: 22, minHeight: 190,
  },
  servicePrimary: { borderColor: "var(--rose)", borderWidth: 2, background: "var(--surface-alt)" },
  serviceUrgent: { borderColor: "var(--emergency-border)", borderWidth: 2 },
  serviceIcon: { fontSize: 32, lineHeight: 1 },
  serviceTitle: {
    fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--rose-deep)",
  },
  serviceDesc: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.55, flex: 1 },
  serviceGo: { fontSize: 13.5, fontWeight: 700, color: "var(--rose)", marginTop: 4 },

  promiseBand: {
    display: "grid", gap: 26, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    background: "var(--cream-dim)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", padding: 30,
  },
  promiseIcon: { fontSize: 26 },
  promiseTitle: { fontSize: 17, fontWeight: 700, color: "var(--ink)", marginTop: 9 },
  promiseText: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 7 },
};

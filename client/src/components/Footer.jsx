import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

// Column footer in the public-service style: helplines first, then the services
// again as text links, then the honest statement of what this is. Repeating the
// nav at the bottom is not redundancy on a site like this — it is the second
// chance for someone who scrolled looking for something and did not find it.
export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer style={styles.footer}>
      <div className="container">
        <div style={styles.columns}>
          <div>
            <div style={styles.brandRow}>
              <span style={styles.mark} aria-hidden="true">स</span>
              <span style={styles.brandName}>Sakhi</span>
            </div>
            <p style={styles.about}>
              A private, voice-first health companion for women and girls. Free to use,
              in your own language, with no account and no name.
            </p>
          </div>

          <div>
            <h3 style={styles.colTitle}>Emergency numbers</h3>
            <ul style={styles.list}>
              <li><a href="tel:108" style={styles.link}>🚑 Ambulance — 108</a></li>
              <li><a href="tel:102" style={styles.link}>🤰 Pregnancy transport — 102</a></li>
              <li><a href="tel:112" style={styles.link}>☎️ Any emergency — 112</a></li>
              <li><a href="tel:1091" style={styles.link}>👩 Women's helpline — 1091</a></li>
              <li><a href="tel:1098" style={styles.link}>🧒 Child helpline — 1098</a></li>
            </ul>
          </div>

          <div>
            <h3 style={styles.colTitle}>Services</h3>
            <ul style={styles.list}>
              <li><Link to="/triage" style={styles.link}>{t("nav_triage")}</Link></li>
              <li><Link to="/sakhi" style={styles.link}>{t("nav_sakhi")}</Link></li>
              <li><Link to="/nearby" style={styles.link}>{t("nav_nearby")}</Link></li>
              <li><Link to="/anaemia" style={styles.link}>{t("nav_anaemia")}</Link></li>
              <li><Link to="/cycle" style={styles.link}>{t("nav_cycle")}</Link></li>
              <li><Link to="/prescription" style={styles.link}>{t("nav_prescription")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 style={styles.colTitle}>About</h3>
            <ul style={styles.list}>
              <li><Link to="/impact" style={styles.link}>{t("nav_impact")}</Link></li>
              <li><Link to="/demo" style={styles.link}>{t("nav_demo")}</Link></li>
              <li><Link to="/asha/login" style={styles.link}>🔒 Staff sign-in</Link></li>
            </ul>
            <p style={styles.sources}>
              Health information is drawn from WHO and National Health Mission guidance.
            </p>
          </div>
        </div>

        <div style={styles.bottom}>
          <p style={styles.disclaimer}>{t("footer_disclaimer")}</p>
          <p style={styles.small}>
            Sakhi · Built for the SkillUp Hackathon with IBM SkillsBuild. This is a
            student project, not an official government service.
          </p>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    borderTop: "3px solid var(--rose)",
    marginTop: 60,
    padding: "38px 0 26px",
    background: "var(--cream-dim)",
  },
  columns: {
    display: "grid", gap: 30,
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  mark: {
    width: 34, height: 34, borderRadius: 9, background: "var(--rose)",
    color: "var(--on-brand)", display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
  },
  brandName: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--ink)" },
  about: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.65, marginTop: 12, maxWidth: 300 },
  colTitle: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
    color: "var(--rose-deep)", marginBottom: 12,
  },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 9 },
  link: { fontSize: 13.5, color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 },
  sources: { fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 14 },
  bottom: {
    borderTop: "1px solid var(--border)", marginTop: 30, paddingTop: 20, textAlign: "center",
  },
  disclaimer: { color: "var(--ink-soft)", fontSize: 13.5, maxWidth: 680, margin: "0 auto 10px", lineHeight: 1.6 },
  small: { color: "var(--ink-muted)", fontSize: 12, lineHeight: 1.6 },
};

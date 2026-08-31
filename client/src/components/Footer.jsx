import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";
import Logo from "./Logo.jsx";
import { HELPLINES } from "../helplines.js";

// The helplines that belong in a footer: the ones someone scrolled to the
// bottom of a health site looking for. The full nineteen live on /helplines —
// a footer column with nineteen numbers in it is a wall, not a directory.
const FOOTER_HELPLINES = ["108", "102", "112", "181", "1098", "14416"];

// Column footer in the public-service style: helplines first, then the services
// again as text links, then the honest statement of what this is. Repeating the
// nav at the bottom is not redundancy on a site like this — it is the second
// chance for someone who scrolled looking for something and did not find it.
export default function Footer() {
  const { t } = useLanguage();
  const lines = FOOTER_HELPLINES
    .map((n) => HELPLINES.find((h) => h.number === n))
    .filter(Boolean);

  return (
    <footer style={styles.footer}>
      <div className="container">
        <div style={styles.columns}>
          <div>
            <div style={styles.brandRow}>
              <Logo size={30} animated={false} />
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
              {lines.map((h) => (
                <li key={h.number}>
                  <a href={`tel:${h.dial}`} style={styles.link}>
                    <Icon name={h.icon} size={15} style={{ color: "var(--rose)" }} />
                    <span>{h.label}</span>
                    <span style={styles.num}>{h.number}</span>
                  </a>
                </li>
              ))}
              <li>
                <Link to="/helplines" style={{ ...styles.link, color: "var(--rose-deep)", fontWeight: 700 }}>
                  <Icon name="arrowRight" size={15} />
                  <span>All {HELPLINES.length} national helplines</span>
                </Link>
              </li>
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
              <li><Link to="/report" style={styles.link}>{t("nav_report")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 style={styles.colTitle}>About</h3>
            <ul style={styles.list}>
              <li><Link to="/impact" style={styles.link}>{t("nav_impact")}</Link></li>
              <li><Link to="/demo" style={styles.link}>{t("nav_demo")}</Link></li>
              <li>
                <Link to="/asha/login" style={styles.link}>
                  <Icon name="lock" size={14} />
                  <span>Staff sign-in</span>
                </Link>
              </li>
            </ul>
            <p style={styles.sources}>
              Health information is drawn from WHO guidance and the National Health
              Mission's operational guidelines. Every scheme named in a report cites the
              ministry that runs it.
            </p>
          </div>
        </div>

        <div style={styles.bottom}>
          <p style={styles.small}>© Sakhi</p>
          <Link to="/terms" style={styles.termsLink}>{t("terms_footer_link")}</Link>
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
  brandName: { fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "var(--ink)" },
  about: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.65, marginTop: 12, maxWidth: 300 },
  colTitle: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
    color: "var(--rose-deep)", marginBottom: 12,
  },
  list: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 9 },
  link: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 13.5, color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500,
  },
  num: {
    marginInlineStart: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12.5, fontWeight: 700, color: "var(--rose-deep)",
  },
  sources: { fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 14 },
  bottom: {
    borderTop: "1px solid var(--border)", marginTop: 30, paddingTop: 20,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap",
  },
  small: { color: "var(--ink-muted)", fontSize: 12, lineHeight: 1.6, margin: 0 },
  termsLink: {
    color: "var(--rose-deep)", fontSize: 12.5, fontWeight: 700, textDecoration: "underline",
  },
};

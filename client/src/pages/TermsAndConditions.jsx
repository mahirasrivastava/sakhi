import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { TERMS_SECTIONS } from "../terms.js";

// The same content ConsentGate requires a scroll through on first visit,
// available here to reread any time — linked from the bottom of every page.
// See terms.js for why both render from one list rather than two copies.
export default function TermsAndConditions() {
  const { t } = useLanguage();

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 720 }}>
      <h1 className="display section-title">{t("terms_page_title")}</h1>
      <p className="section-sub">{t("terms_page_intro")}</p>
      <div className="section-rule" />

      <div style={{ marginTop: 30, display: "grid", gap: 26 }}>
        {TERMS_SECTIONS.map((s, i) => (
          <section key={s.titleKey}>
            <h2 style={styles.title}>
              <span style={styles.num}>{String(i + 1).padStart(2, "0")}</span>
              {t(s.titleKey)}
            </h2>
            <p style={styles.body}>{t(s.bodyKey)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

const styles = {
  title: {
    display: "flex", alignItems: "baseline", gap: 11,
    fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink)",
  },
  num: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12, fontWeight: 700, color: "var(--on-brand)",
    background: "var(--rose)", borderRadius: 5, padding: "3px 7px", flexShrink: 0,
  },
  body: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 8, maxWidth: "68ch" },
};

import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="container" style={{ paddingTop: 64, paddingBottom: 40 }}>
      <div style={{ maxWidth: 620 }}>
        <span style={pillStyle}>Sakhi</span>
        <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.12, marginTop: 18 }}>
          {t("home_title")}
        </h1>
        <p style={{ fontSize: 18, color: "#6B5A5F", marginTop: 18, lineHeight: 1.6 }}>
          {t("home_subtitle")}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 30, flexWrap: "wrap" }}>
          <Link to="/triage" className="btn btn-primary">{t("home_cta")} →</Link>
          <Link to="/general" className="btn btn-ghost">{t("nav_general")} →</Link>
        </div>
        <p style={{ fontSize: 13, color: "#9C8A8F", marginTop: 12 }}>
          Sakhi is the private path for women and girls. MediMind General Triage is the same
          engine, open to anyone.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 34, flexWrap: "wrap" }}>
          {["home_pill_1", "home_pill_2", "home_pill_3"].map((k) => (
            <span key={k} style={badgeStyle}>{t(k)}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 70, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <FeatureCard to="/triage" title={t("nav_triage")} desc="A voice-first conversation that triages urgency — never a diagnosis." />
        <FeatureCard to="/general" title={t("nav_general")} desc="The same rules-first triage engine, open to anyone — any symptom, any patient." />
        <FeatureCard to="/anaemia" title={t("nav_anaemia")} desc="Point your camera at your lower eyelid for a private pallor screen." />
        <FeatureCard to="/cycle" title={t("nav_cycle")} desc="Week-by-week tracking that checks for danger signs automatically." />
      </div>
    </div>
  );
}

function FeatureCard({ to, title, desc }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <h3 className="display" style={{ fontSize: 19, color: "#7E2F44" }}>{title}</h3>
      <p style={{ color: "#6B5A5F", fontSize: 14.5, marginTop: 8, lineHeight: 1.5 }}>{desc}</p>
    </Link>
  );
}

const pillStyle = {
  display: "inline-block", padding: "5px 14px", borderRadius: 999,
  background: "#F2D9DF", color: "#7E2F44", fontSize: 13, fontWeight: 700, letterSpacing: "0.03em",
};
const badgeStyle = {
  fontSize: 13, color: "#6B5A5F", background: "white", border: "1px solid #F0DFE2",
  padding: "7px 13px", borderRadius: 999,
};

import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";

export default function Impact() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.impact().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 720 }}>
      <h1 className="display" style={{ fontSize: 30 }}>{t("impact_title")}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 26 }}>
        <StatCard big="~80%" label="of India's doctors are concentrated in urban areas" />
        <StatCard big="20.6" label="health workers per 10,000 people in India, vs. WHO's benchmark of 44.5" />
        <StatCard big="4×" label="higher doctor density in urban vs. rural India" />
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <h3 className="display" style={{ fontSize: 18, color: "var(--rose-deep)" }}>Live session counter</h3>
        {stats ? (
          <>
            <p style={{ fontSize: 36, fontFamily: "Fraunces, serif", marginTop: 8 }}>{stats.totalSessions}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              {Object.entries(stats.byLevel).map(([lvl, count]) => (
                <span key={lvl} className={`pill pill-${lvl === "self-care" ? "selfcare" : lvl}`}>{lvl}: {count}</span>
              ))}
            </div>
          </>
        ) : (
          <p style={{ color: "var(--ink-muted)", marginTop: 10 }}>No sessions logged yet.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="display" style={{ fontSize: 18, color: "var(--rose-deep)" }}>Why privacy, not just proximity</h3>
        <p style={{ fontSize: 14.5, color: "var(--ink)", marginTop: 10, lineHeight: 1.7 }}>
          The doctor-shortage numbers above explain why care is hard to reach. They don't explain why a
          teenage girl with a period problem or a pregnancy scare often won't say it out loud — not to a
          male clinician, not in front of family. That's a shame-and-privacy problem, and it needs a
          private, no-name, voice-first entry point as much as it needs more clinics.
        </p>
      </div>
    </div>
  );
}

function StatCard({ big, label }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <p style={{ fontSize: 32, fontFamily: "Fraunces, serif", color: "var(--rose)", margin: 0 }}>{big}</p>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5 }}>{label}</p>
    </div>
  );
}

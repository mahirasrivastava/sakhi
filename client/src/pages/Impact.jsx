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
        <StatCard big="~80%" label={t("impact_stat1_label")} />
        <StatCard big="20.6" label={t("impact_stat2_label")} />
        <StatCard big="4×" label={t("impact_stat3_label")} />
      </div>

      <div className="card" style={{ marginTop: 30 }}>
        <h3 className="display" style={{ fontSize: 18, color: "var(--rose-deep)" }}>{t("impact_live_counter_title")}</h3>
        {stats ? (
          <>
            <p style={{ fontSize: 36, fontFamily: "Fraunces, serif", marginTop: 8 }}>{stats.totalSessions}</p>
            {/* The urgency split is returned only to a signed-in worker. In a
                single-sub-centre village the counts are small enough to be
                matched to a person, so the public view stops at the total. */}
            {stats.byLevel ? (
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                {Object.entries(stats.byLevel).map(([lvl, count]) => (
                  <span key={lvl} className={`pill pill-${lvl === "self-care" ? "selfcare" : lvl}`}>{lvl}: {count}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 10, lineHeight: 1.6 }}>
                {t("impact_breakdown_restricted")}
              </p>
            )}
          </>
        ) : (
          <p style={{ color: "var(--ink-muted)", marginTop: 10 }}>{t("impact_no_sessions")}</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="display" style={{ fontSize: 18, color: "var(--rose-deep)" }}>{t("impact_privacy_title")}</h3>
        <p style={{ fontSize: 14.5, color: "var(--ink)", marginTop: 10, lineHeight: 1.7 }}>
          {t("impact_privacy_text")}
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

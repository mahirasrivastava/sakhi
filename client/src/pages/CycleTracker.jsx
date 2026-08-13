import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const DANGER_SIGNS = [
  { id: "heavy_bleeding_hourly", en: "Heavy bleeding (soaking a pad every hour)" },
  { id: "severe_headache", en: "Severe headache with blurred vision" },
  { id: "convulsions", en: "Convulsions or fits" },
  { id: "reduced_fetal_movement", en: "Reduced baby movement" },
  { id: "severe_swelling", en: "Sudden swelling of face or hands" },
  { id: "severe_abdominal_pain", en: "Severe abdominal pain" },
];

export default function CycleTracker() {
  const { t } = useLanguage();
  const [week, setWeek] = useState(1);
  const [checked, setChecked] = useState([]);
  const [entries, setEntries] = useState([]);

  const anyDanger = checked.length > 0;

  function toggle(id) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function logWeek() {
    setEntries((prev) => [{ week, dangerSigns: [...checked], date: new Date().toLocaleDateString() }, ...prev]);
    setChecked([]);
  }

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: 28 }}>{t("cycle_title")}</h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>{t("cycle_subtitle")}</p>

      <div className="card" style={{ marginTop: 22 }}>
        <label style={{ fontSize: 13.5, fontWeight: 600, color: "var(--rose-deep)" }}>Week</label>
        <input type="number" min="1" max="42" value={week} onChange={(e) => setWeek(e.target.value)}
          style={{ display: "block", marginTop: 8, width: 100, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)" }} />

        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--rose-deep)", marginTop: 20 }}>Any of these this week?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {DANGER_SIGNS.map((sign) => (
            <label key={sign.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={checked.includes(sign.id)} onChange={() => toggle(sign.id)} />
              {sign.en}
            </label>
          ))}
        </div>

        {anyDanger && (
          <div style={{ marginTop: 16, padding: 14, background: "var(--emergency-bg)", borderRadius: 12, color: "var(--emergency-ink)", fontSize: 14 }}>
            One or more danger signs checked. Please go to the Talk to Sakhi page now for an urgent triage check.
          </div>
        )}

        <button className="btn btn-primary" onClick={logWeek} style={{ marginTop: 16 }}>Log this week</button>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="display" style={{ fontSize: 18, marginBottom: 12 }}>Your log</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e, i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <strong style={{ fontSize: 14 }}>Week {e.week}</strong>
                <span style={{ color: "var(--ink-muted)", fontSize: 12.5, marginLeft: 10 }}>{e.date}</span>
                {e.dangerSigns.length > 0 ? (
                  <p style={{ fontSize: 13, color: "var(--emergency)", marginTop: 6 }}>
                    Flagged: {e.dangerSigns.join(", ")}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--routine)", marginTop: 6 }}>No danger signs reported.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

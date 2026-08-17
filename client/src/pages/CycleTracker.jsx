import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useReport } from "../context/ReportContext.jsx";
import Icon from "../components/Icon.jsx";
import ScriptField from "../components/ScriptField.jsx";

// The obstetric danger signs from the Ministry of Health and Family Welfare's
// antenatal care guidance. Any one of them is a same-day referral, which is why
// checking a single box is enough to raise the banner below.
const DANGER_SIGNS = [
  { id: "heavy_bleeding_hourly", icon: "drop", en: "Heavy bleeding (soaking a pad every hour)" },
  { id: "severe_headache", icon: "brain", en: "Severe headache with blurred vision" },
  { id: "convulsions", icon: "triage", en: "Convulsions or fits" },
  { id: "reduced_fetal_movement", icon: "pregnancy", en: "Reduced baby movement" },
  { id: "severe_swelling", icon: "water", en: "Sudden swelling of face or hands" },
  { id: "severe_abdominal_pain", icon: "stomach", en: "Severe abdominal pain" },
];

export default function CycleTracker() {
  const { t } = useLanguage();
  const { recordCycle } = useReport();
  const [week, setWeek] = useState("1");
  const [checked, setChecked] = useState([]);
  const [entries, setEntries] = useState([]);

  const anyDanger = checked.length > 0;

  function toggle(id) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function logWeek() {
    const labels = checked
      .map((id) => DANGER_SIGNS.find((s) => s.id === id)?.en)
      .filter(Boolean);
    setEntries((prev) => [
      { week, dangerSigns: [...checked], dangerSignLabels: labels, date: new Date().toLocaleDateString() },
      ...prev,
    ]);
    recordCycle({ week, dangerSigns: [...checked], dangerSignLabels: labels });
    setChecked([]);
  }

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 680 }}>
      <span className="section-eyebrow">
        <Icon name="calendar" size={13} /> {t("nav_cycle")}
      </span>
      <h1 className="display section-title">{t("cycle_title")}</h1>
      <p className="section-sub">{t("cycle_subtitle")}</p>
      <div className="section-rule" />

      <div className="card" style={{ marginTop: 22 }}>
        <label style={styles.label} htmlFor="cycle-week">Week</label>
        <ScriptField
          id="cycle-week"
          type="number"
          inputMode="numeric"
          min="1"
          max="42"
          value={week}
          onValueChange={setWeek}
          keyboard="numeric"
          className="field-input"
          style={{ width: 140 }}
          wrapperStyle={{ width: 140, marginTop: 8 }}
        />

        <p style={{ ...styles.label, marginTop: 22 }}>Any of these this week?</p>
        <div className="choice-grid" style={{ marginTop: 10 }}>
          {DANGER_SIGNS.map((sign) => (
            <button
              key={sign.id}
              type="button"
              className="choice"
              aria-pressed={checked.includes(sign.id)}
              onClick={() => toggle(sign.id)}
            >
              <span className="choice-icon">
                <Icon name={sign.icon} size={18} />
              </span>
              <span>{sign.en}</span>
            </button>
          ))}
        </div>

        {anyDanger && (
          <div style={styles.danger}>
            <Icon name="alert" size={19} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>These are danger signs.</strong> Any one of them needs to be seen the
              same day. Call <a href="tel:102" style={styles.dangerLink}>102</a> for free
              pregnancy transport or <a href="tel:108" style={styles.dangerLink}>108</a> for
              an ambulance, and run an urgent triage check.
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <a href="tel:102" className="btn btn-emergency btn-sm">
                  <Icon name="pregnancy" size={15} /> Pregnancy transport 102
                </a>
                <Link to="/triage" className="btn btn-ghost btn-sm">
                  <Icon name="triage" size={15} /> Urgent triage check
                </Link>
              </div>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={logWeek} style={{ marginTop: 18 }}>
          <Icon name="check" size={17} /> Log this week
        </button>
        <p style={styles.hint}>
          Logging a week adds it to your health report, so an ANM can see the pattern
          rather than one day of it.
        </p>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="display" style={{ fontSize: 18, marginBottom: 12 }}>Your log</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e, i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <strong style={{ fontSize: 14 }}>Week {e.week}</strong>
                <span style={{ color: "var(--ink-muted)", fontSize: 12.5, marginInlineStart: 10 }}>{e.date}</span>
                {e.dangerSignLabels.length > 0 ? (
                  <p style={{ fontSize: 13, color: "var(--emergency)", marginTop: 6, lineHeight: 1.6 }}>
                    Flagged: {e.dangerSignLabels.join("; ")}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--routine)", marginTop: 6 }}>No danger signs reported.</p>
                )}
              </div>
            ))}
          </div>
          <Link to="/report" className="btn-text" style={{ marginTop: 14 }}>
            <Icon name="report" size={13} /> See this in your health report
          </Link>
        </div>
      )}
    </div>
  );
}

const styles = {
  label: { display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--rose-deep)" },
  danger: {
    display: "flex", gap: 11, marginTop: 18, padding: 15,
    background: "var(--emergency-bg)", border: "1px solid var(--emergency-border)",
    borderRadius: 12, color: "var(--emergency-ink)", fontSize: 14, lineHeight: 1.65,
  },
  dangerLink: { fontWeight: 700, color: "inherit" },
  hint: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 12, lineHeight: 1.6 },
};

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import TrustStrip from "../components/TrustStrip.jsx";
import { useReport } from "../context/ReportContext.jsx";

/**
 * Pregnancy tracker — separate from the cycle tracker (rebuilt).
 *
 * Date-based: you enter the first day of your last period (LMP); the week,
 * trimester and estimated due date are worked out from today's date — no more
 * "week 1…" guessing. Anonymous + on-device (localStorage), so nothing is tied
 * to a name. Danger signs come from MoHFW antenatal guidance; any one is a
 * same-day referral. English copy for now — translations come in the i18n pass.
 */
const STORE = "sakhi_pregnancy_v1";
const GEST_DAYS = 280; // 40 weeks

const DANGER_SIGNS = [
  { id: "heavy_bleeding", icon: "drop", label: "Bleeding from the vagina" },
  { id: "severe_headache", icon: "brain", label: "Severe headache or blurred vision" },
  { id: "convulsions", icon: "triage", label: "Convulsions or fits" },
  { id: "reduced_movement", icon: "pregnancy", label: "Baby moving less than usual" },
  { id: "severe_swelling", icon: "water", label: "Sudden swelling of face or hands" },
  { id: "severe_abdominal_pain", icon: "stomach", label: "Severe stomach pain" },
  { id: "high_fever", icon: "thermometer", label: "High fever" },
  { id: "water_breaking", icon: "water", label: "Water breaking early / fluid leaking" },
];

function load() { try { return JSON.parse(localStorage.getItem(STORE)) || { lmp: "", logs: [] }; } catch { return { lmp: "", logs: [] }; } }
function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } }
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => { const t = new Date(iso + "T00:00:00"); t.setDate(t.getDate() + d); return t; };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function PregnancyTracker() {
  const { recordCycle } = useReport();
  const [state, setState] = useState(load);
  const [lmpInput, setLmpInput] = useState(state.lmp || "");
  const [checked, setChecked] = useState([]);

  const derived = useMemo(() => {
    if (!state.lmp) return null;
    const days = daysBetween(state.lmp, todayISO());
    const week = Math.floor(days / 7);
    const due = addDays(state.lmp, GEST_DAYS);
    const trimester = week < 13 ? 1 : week < 27 ? 2 : 3;
    const pct = Math.max(0, Math.min(100, (days / GEST_DAYS) * 100));
    return { days, week: Math.max(0, week), due, trimester, pct, overdue: days > GEST_DAYS };
  }, [state.lmp]);

  function setLmp() {
    if (!lmpInput) return;
    const v = { ...state, lmp: lmpInput }; setState(v); save(v);
    recordCycle({ kind: "pregnancy", lmp: lmpInput });
  }
  function logCheckin() {
    const labels = checked.map((id) => DANGER_SIGNS.find((s) => s.id === id)?.label).filter(Boolean);
    const v = { ...state, logs: [{ date: todayISO(), dangerSigns: [...checked], labels }, ...state.logs].slice(0, 60) };
    setState(v); save(v); setChecked([]);
    recordCycle({ kind: "pregnancy", lmp: state.lmp, week: derived?.week, dangerSignLabels: labels });
  }
  function reset() { const v = { lmp: "", logs: [] }; setState(v); save(v); setLmpInput(""); }
  const toggle = (id) => setChecked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const anyDanger = checked.length > 0;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 760 }}>
      <h1 className="display section-title">Track your pregnancy</h1>
      <p className="section-sub">
        Enter the first day of your last period and Sakhi works out your week, trimester and due date.
      </p>
      <div className="section-rule" />

      <TrustStrip />

      {/* LMP input */}
      <div className="card" style={{ marginTop: 20 }}>
        <p style={styles.h}>First day of your last period</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <input type="date" className="field-input" style={{ maxWidth: 200 }} value={lmpInput} max={todayISO()} onChange={(e) => setLmpInput(e.target.value)} />
          <button className="btn btn-primary" onClick={setLmp}>{state.lmp ? "Update" : "Start tracking"}</button>
          {state.lmp && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={reset}>Reset</button>}
        </div>
        {!state.lmp && <p style={styles.hint}>Don't know the exact day? Your best estimate is fine — you can update it later.</p>}
      </div>

      {/* progress + weeks */}
      {derived && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--rose)" }}>
              Week {derived.week} <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)" }}>· Trimester {derived.trimester}</span>
            </p>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
              {derived.overdue ? "Past your due date — see a health worker." : `Due ~ ${fmt(derived.due)}`}
            </p>
          </div>
          {/* trimester progress bar */}
          <div style={styles.track}>
            <div style={{ ...styles.seg, background: "var(--pill-selfcare-bg)" }} />
            <div style={{ ...styles.seg, background: "var(--warn-bg)" }} />
            <div style={{ ...styles.seg, background: "var(--pill-urgent-bg)" }} />
            <div style={{ ...styles.marker, left: `${derived.pct}%` }} title={`Week ${derived.week}`} />
          </div>
          <div style={styles.trackLabels}><span>T1 · 0–12w</span><span>T2 · 13–26w</span><span>T3 · 27–40w</span></div>
          <p style={{ ...styles.hint, marginTop: 10 }}>
            Aim for at least 4 antenatal checkups. <Link to="/nearby" className="link-inline">Find the nearest clinic</Link>{" "}
            or an <Link to="/nearby" className="link-inline">ambulance + location code</Link>.
          </p>
        </div>
      )}

      {/* danger signs */}
      {state.lmp && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={styles.h}>Any of these right now?</p>
          <div style={styles.grid}>
            {DANGER_SIGNS.map((s) => {
              const on = checked.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  style={{ ...styles.dsBtn, ...(on ? styles.dsOn : {}) }}>
                  <Icon name={s.icon} size={18} /> <span>{s.label}</span>
                </button>
              );
            })}
          </div>
          {anyDanger && (
            <div style={styles.alert}>
              <strong>Do not wait.</strong> These can be serious in pregnancy. Call <strong>102</strong> (pregnancy ambulance)
              or <strong>108</strong>, or go to the nearest facility now.
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn btn-primary" href="tel:102"><Icon name="ambulance" size={16} /> Call 102</a>
                <Link className="btn" to="/nearby">Location code</Link>
              </div>
            </div>
          )}
          <button className="btn" style={{ marginTop: 12 }} onClick={logCheckin}>Save today's check-in</button>
        </div>
      )}

      {/* log history */}
      {state.logs.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={styles.h}>Your check-ins</p>
          <ul style={styles.list}>
            {state.logs.map((l, i) => (
              <li key={i} style={styles.item}>
                <span><strong>{fmt(l.date)}</strong>
                  {l.labels?.length
                    ? <span style={{ color: "var(--emergency)", fontSize: 13 }}> · {l.labels.join(", ")}</span>
                    : <span style={{ color: "var(--routine)", fontSize: 13 }}> · no danger signs</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* caveats */}
      <div className="card" style={{ marginTop: 16, background: "var(--surface-alt)" }}>
        <p style={styles.h}>Good to know</p>
        <ul style={styles.caveats}>
          <li>Take iron-folic acid tablets daily, and your TT/Td injections on time.</li>
          <li>Any bleeding, severe headache, or reduced baby movement — get seen the same day.</li>
          <li>Register your pregnancy at the Anganwadi/PHC for free care and benefits (JSY, PMMVY).</li>
        </ul>
        <p style={{ ...styles.hint, marginTop: 8 }}>
          Tracking a period instead? <Link to="/cycle" className="link-inline">Use the cycle tracker</Link>.
        </p>
      </div>

      <p style={styles.disc}>Dates here are estimates. Only a clinician can confirm your due date and your baby's health.</p>
    </div>
  );
}

const styles = {
  h: { fontWeight: 700, fontSize: 15, margin: "0 0 10px" },
  hint: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0" },
  track: { position: "relative", display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginTop: 14, border: "1px solid var(--border)" },
  seg: { flex: 1 },
  marker: { position: "absolute", top: -3, width: 4, height: 20, borderRadius: 2, background: "var(--rose)", transform: "translateX(-50%)" },
  trackLabels: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-muted)", marginTop: 6 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  dsBtn: { display: "flex", alignItems: "center", gap: 8, textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-alt)", fontSize: 13.5, cursor: "pointer", color: "inherit" },
  dsOn: { borderColor: "var(--emergency)", background: "var(--pill-emergency-bg)", color: "var(--emergency)", fontWeight: 600 },
  alert: { marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--pill-emergency-bg)", border: "1px solid var(--emergency)", color: "var(--emergency)", fontSize: 13.5, lineHeight: 1.6 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 },
  item: { borderBottom: "1px solid var(--border)", paddingBottom: 8, fontSize: 14 },
  caveats: { margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.8 },
  disc: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.7, marginTop: 16 },
};

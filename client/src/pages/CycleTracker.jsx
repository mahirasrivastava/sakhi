import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useReport } from "../context/ReportContext.jsx";

/**
 * Cycle tracker — period logging by DATE (rebuilt).
 *
 * Anonymous + on-device: entries live in localStorage only, tied to no account
 * and never sent anywhere. That keeps the "nothing tied to your name" promise
 * while still letting someone watch their own pattern over months.
 *
 * It logs the FIRST DAY of each period. The gap between consecutive first-days
 * is the "cycle length". A typical cycle is 21–35 days (most often 25–32); the
 * graph shades that band so anything drifting outside it is obvious. English
 * copy for now — translations come in the i18n pass.
 */
const STORE = "sakhi_cycle_v1";
const NORMAL_LOW = 21;
const NORMAL_HIGH = 35;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
}
function save(rows) {
  try { localStorage.setItem(STORE, JSON.stringify(rows)); } catch { /* private mode */ }
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function CycleTracker() {
  const { recordCycle } = useReport();
  const [rows, setRows] = useState(load);         // [{date, flow, pain}]
  const [date, setDate] = useState(todayISO());
  const [flow, setFlow] = useState("normal");
  const [pain, setPain] = useState("mild");

  const sorted = useMemo(() => [...rows].sort((a, b) => a.date.localeCompare(b.date)), [rows]);

  // cycle lengths between consecutive first-days
  const lengths = useMemo(() => {
    const out = [];
    for (let i = 1; i < sorted.length; i++) {
      out.push({ date: sorted[i].date, length: daysBetween(sorted[i - 1].date, sorted[i].date), row: sorted[i] });
    }
    return out;
  }, [sorted]);

  const analysis = useMemo(() => analyse(sorted, lengths), [sorted, lengths]);

  function addPeriod() {
    if (!date) return;
    const next = [...rows.filter((r) => r.date !== date), { date, flow, pain }];
    setRows(next); save(next);
    recordCycle({ kind: "cycle", lastPeriod: date, cyclesLogged: next.length, status: analyseStatus(next) });
  }
  function remove(d) { const next = rows.filter((r) => r.date !== d); setRows(next); save(next); }
  function clearAll() { setRows([]); save([]); }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 760 }}>
      <span className="section-eyebrow" style={{ color: "var(--rose)" }}>
        <Icon name="calendar" size={13} /> Cycle tracker
      </span>
      <h1 className="display section-title">Track your period</h1>
      <p className="section-sub">
        Log the <strong>first day</strong> of each period. Over a few months this shows whether your
        cycle is regular. Everything stays on this device — no name, no account.
      </p>
      <div className="section-rule" />

      {/* status banner */}
      <div className="card" style={{ ...styles.banner, ...bannerTone(analysis.tone), marginTop: 20 }}>
        <span style={{ ...styles.bannerDot, background: toneColor(analysis.tone) }} />
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{analysis.headline}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>{analysis.detail}</p>
        </div>
      </div>

      {/* log form */}
      <div className="card" style={{ marginTop: 16 }}>
        <p style={styles.h}>Log a period</p>
        <div style={styles.formRow}>
          <label style={styles.field}>
            First day
            <input type="date" className="field-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label style={styles.field}>
            Flow
            <select className="field-input" value={flow} onChange={(e) => setFlow(e.target.value)}>
              <option value="light">Light</option>
              <option value="normal">Normal</option>
              <option value="heavy">Heavy (soaking a pad every 1–2h)</option>
            </select>
          </label>
          <label style={styles.field}>
            Pain
            <select className="field-input" value={pain} onChange={(e) => setPain(e.target.value)}>
              <option value="none">None</option>
              <option value="mild">Mild</option>
              <option value="severe">Severe (stops daily activity)</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={addPeriod}>
          <Icon name="calendar" size={16} /> Save this period
        </button>
      </div>

      {/* graph */}
      {lengths.length >= 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={styles.h}>Your cycle length over time</p>
          <p style={styles.hint}>The green band is the usual 21–35 days. Tap or hover a dot for the date and details.</p>
          <CycleChart points={lengths} />
        </div>
      )}

      {/* history */}
      {sorted.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={styles.h}>Logged periods</p>
          <ul style={styles.list}>
            {[...sorted].reverse().map((r, i, arr) => {
              const idxInSorted = sorted.indexOf(r);
              const len = idxInSorted > 0 ? daysBetween(sorted[idxInSorted - 1].date, r.date) : null;
              const bad = len != null && (len < NORMAL_LOW || len > NORMAL_HIGH);
              return (
                <li key={r.date} style={styles.item}>
                  <span>
                    <strong>{fmt(r.date)}</strong>
                    {len != null && (
                      <span style={{ ...styles.lenPill, ...(bad ? styles.lenBad : styles.lenOk) }}>{len} days</span>
                    )}
                    <span style={styles.meta}>
                      {r.flow === "heavy" ? " · heavy flow" : ""}{r.pain === "severe" ? " · severe pain" : ""}
                    </span>
                  </span>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => remove(r.date)}>Remove</button>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: 12.5 }} onClick={clearAll}>Clear all</button>
        </div>
      )}

      {/* caveats */}
      <div className="card" style={{ marginTop: 16, background: "var(--surface-alt)" }}>
        <p style={styles.h}>When to get checked</p>
        <ul style={styles.caveats}>
          <li>Cycles regularly shorter than 21 days or longer than 35 days.</li>
          <li>Very heavy bleeding — soaking a pad every hour, or large clots.</li>
          <li>Bleeding between periods, or after sex.</li>
          <li>Severe pain that stops your daily activities.</li>
          <li>Periods stopping for 3+ months when not pregnant.</li>
          <li>Any bleeding after menopause.</li>
        </ul>
        <p style={{ ...styles.hint, marginTop: 8 }}>
          Not sure how urgent something is? <Link to="/triage" className="link-inline">Check your symptoms</Link>{" "}
          or <Link to="/helplines" className="link-inline">see helplines</Link>. Are you pregnant?{" "}
          <Link to="/pregnancy" className="link-inline">Use the pregnancy tracker</Link>.
        </p>
      </div>

      <p style={styles.disc}>This is a self-tracking aid, not a diagnosis. A cycle can vary for many harmless reasons.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
function analyseStatus(rows) {
  const s = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const lens = [];
  for (let i = 1; i < s.length; i++) lens.push(daysBetween(s[i - 1].date, s[i].date));
  if (lens.length === 0) return "insufficient";
  const outOfRange = lens.some((l) => l < NORMAL_LOW || l > NORMAL_HIGH);
  return outOfRange ? "irregular" : "normal";
}
function analyse(sorted, lengths) {
  if (sorted.length === 0)
    return { tone: "neutral", headline: "No periods logged yet", detail: "Save the first day of your last period to begin." };

  // days since last period
  const last = sorted[sorted.length - 1].date;
  const sinceLast = daysBetween(last, todayISO());

  if (lengths.length === 0) {
    let detail = "Log one more period and the graph will show your cycle length.";
    if (sinceLast > NORMAL_HIGH) detail = `It has been ${sinceLast} days since your last period. If you are not expecting a pregnancy and it has been over 35 days, consider a check.`;
    return { tone: sinceLast > NORMAL_HIGH ? "amber" : "neutral", headline: "One period logged", detail };
  }

  const lens = lengths.map((x) => x.length);
  const avg = Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
  const outOfRange = lens.filter((l) => l < NORMAL_LOW || l > NORMAL_HIGH).length;
  const heavy = sorted.filter((r) => r.flow === "heavy").length;
  const severePain = sorted.filter((r) => r.pain === "severe").length;

  if (outOfRange === 0 && heavy === 0 && severePain === 0)
    return { tone: "green", headline: `Looks regular — about every ${avg} days`, detail: `Your ${lens.length} recorded cycle${lens.length > 1 ? "s are" : " is"} within the usual 21–35 days. Keep logging to stay sure.` };

  const bits = [];
  if (outOfRange) bits.push(`${outOfRange} cycle${outOfRange > 1 ? "s" : ""} outside 21–35 days`);
  if (heavy) bits.push(`${heavy} heavy period${heavy > 1 ? "s" : ""}`);
  if (severePain) bits.push(`${severePain} with severe pain`);
  return {
    tone: outOfRange || heavy ? "red" : "amber",
    headline: `Average about ${avg} days — worth mentioning`,
    detail: `You logged ${bits.join(", ")}. This is often harmless, but it's worth showing a health worker or ASHA.`,
  };
}

const toneColor = (t) => ({ green: "var(--selfcare)", amber: "var(--gold)", red: "var(--emergency)", neutral: "var(--ink-muted)" }[t] || "var(--ink-muted)");
const bannerTone = (t) => ({
  green: { background: "var(--pill-selfcare-bg)" }, amber: { background: "var(--warn-bg)" },
  red: { background: "var(--pill-emergency-bg)" }, neutral: { background: "var(--surface-alt)" },
}[t] || {});

// ---------------------------------------------------------------------------
// Inline SVG line chart (no dependency)
// ---------------------------------------------------------------------------
function CycleChart({ points }) {
  const [hover, setHover] = useState(null);
  const W = 620, H = 220, padL = 36, padR = 16, padT = 18, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const yMin = 15, yMax = 45;
  const n = points.length;
  const X = (i) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = (v) => padT + ih - ((clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * ih;
  const bandTop = Y(NORMAL_HIGH), bandBottom = Y(NORMAL_LOW);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${X(i)} ${Y(p.length)}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }} role="img" aria-label="Cycle length over time">
        {/* normal band */}
        <rect x={padL} y={bandTop} width={iw} height={bandBottom - bandTop} fill="var(--selfcare)" opacity="0.12" />
        <text x={padL + 4} y={bandTop - 4} fontSize="10" fill="var(--routine)">usual 21–35 days</text>
        {/* y ticks */}
        {[20, 30, 40].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeDasharray="3 3" />
            <text x={padL - 6} y={Y(v) + 3} fontSize="10" textAnchor="end" fill="var(--ink-muted)">{v}</text>
          </g>
        ))}
        {/* line */}
        <path d={path} fill="none" stroke="var(--rose)" strokeWidth="2.5" strokeLinejoin="round" />
        {/* nodes */}
        {points.map((p, i) => {
          const bad = p.length < NORMAL_LOW || p.length > NORMAL_HIGH || p.row?.flow === "heavy" || p.row?.pain === "severe";
          return (
            <circle key={i} cx={X(i)} cy={Y(p.length)} r={hover === i ? 7 : 5}
              fill={bad ? "var(--emergency)" : "var(--rose)"} stroke="#fff" strokeWidth="2"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} />
          );
        })}
        {/* tooltip */}
        {hover != null && points[hover] && (() => {
          const p = points[hover]; const tx = clamp(X(hover), padL + 60, W - padR - 60); const ty = Y(p.length) - 14;
          const notes = [p.row?.flow === "heavy" ? "heavy" : "", p.row?.pain === "severe" ? "severe pain" : ""].filter(Boolean).join(", ");
          return (
            <g pointerEvents="none">
              <rect x={tx - 60} y={ty - 34} width="120" height="34" rx="6" fill="var(--ink)" opacity="0.92" />
              <text x={tx} y={ty - 20} fontSize="10.5" fill="#fff" textAnchor="middle">{fmt(p.date)}</text>
              <text x={tx} y={ty - 7} fontSize="10.5" fill="#fff" textAnchor="middle">{p.length} days{notes ? " · " + notes : ""}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

const styles = {
  banner: { display: "flex", gap: 12, alignItems: "flex-start" },
  bannerDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 5 },
  h: { fontWeight: 700, fontSize: 15, margin: "0 0 10px" },
  hint: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "0 0 10px" },
  formRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, flex: "1 1 180px" },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 },
  item: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 8, fontSize: 14 },
  lenPill: { marginLeft: 10, fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "1px 8px" },
  lenOk: { color: "var(--routine)", background: "var(--pill-selfcare-bg)" },
  lenBad: { color: "var(--emergency)", background: "var(--pill-emergency-bg)" },
  meta: { color: "var(--ink-muted)", fontSize: 12.5 },
  caveats: { margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.8 },
  disc: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.7, marginTop: 16 },
};

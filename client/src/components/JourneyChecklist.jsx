import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useReport } from "../context/ReportContext.jsx";

/**
 * Visible progress checklist (points 5 & 9).
 *
 * A calm, tickable list of the self-check steps, so someone can see what they've
 * done and what's left — and pick up where they stopped. It reads the same
 * session report the printable record is built from, so it's always in step with
 * reality and needs no separate state. Nothing here is required; it's a guide,
 * not a gate. English literals for now, like the other new pieces.
 */
export default function JourneyChecklist() {
  const { report } = useReport();

  const steps = [
    { to: "/triage", label: "Check how urgent your symptoms are", done: Boolean(report?.triage) },
    { to: "/anaemia", label: "Do the anaemia (eyelid) screen", done: Boolean(report?.anaemia) },
    { to: "/cycle", label: "Log your cycle or pregnancy", done: Boolean(report?.cycle) },
    { to: "/prescription", label: "Read a prescription (optional)", done: false, optional: true },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const anyContent = doneCount > 0;

  return (
    <section className="section" aria-label="Your progress">
      <div className="section-head">
        <span className="section-eyebrow">
          <Icon name="report" size={13} /> Your progress
        </span>
        <h2 className="display section-title">Your health check</h2>
        <p className="section-sub">
          {anyContent
            ? `${doneCount} of ${steps.length - 1} steps done. Pick up wherever you left off.`
            : "A short journey — do as much or as little as you like. Nothing asks for your name."}
        </p>
        <div className="section-rule" />
      </div>

      <ul style={styles.list}>
        {steps.map((s) => (
          <li key={s.to} style={styles.item}>
            <Link to={s.to} style={styles.row}>
              <span style={{ ...styles.check, ...(s.done ? styles.checkDone : {}) }} aria-hidden="true">
                {s.done ? <Icon name="shield" size={15} /> : ""}
              </span>
              <span style={{ ...styles.label, ...(s.done ? styles.labelDone : {}) }}>
                {s.label}
                {s.optional && <span style={styles.opt}> · optional</span>}
              </span>
              <span style={styles.go}>{s.done ? "Review" : "Start"} <Icon name="arrowRight" size={13} /></span>
            </Link>
          </li>
        ))}
      </ul>

      {anyContent && (
        <div style={{ marginTop: 14 }}>
          <Link to="/report" className="btn btn-primary">
            <Icon name="report" size={16} /> See my printable report
          </Link>
        </div>
      )}
    </section>
  );
}

const styles = {
  list: { listStyle: "none", padding: 0, margin: "4px 0 0", display: "flex", flexDirection: "column", gap: 8 },
  item: {},
  row: {
    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
    borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-alt)",
    textDecoration: "none", color: "inherit",
  },
  check: {
    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
    border: "2px solid var(--border)", display: "grid", placeItems: "center", color: "#fff",
  },
  checkDone: { background: "var(--selfcare)", borderColor: "var(--selfcare)" },
  label: { flex: 1, fontSize: 14.5, fontWeight: 600 },
  labelDone: { color: "var(--ink-soft)" },
  opt: { fontWeight: 400, color: "var(--ink-muted)", fontSize: 13 },
  go: { fontSize: 13, color: "var(--rose)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" },
};

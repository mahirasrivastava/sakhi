import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";

const LEVEL_ORDER = ["emergency", "urgent", "routine", "self-care"];

export default function Dashboard() {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.sessions();
      const sorted = [...data].sort((a, b) => LEVEL_ORDER.indexOf(a.triage.level) - LEVEL_ORDER.indexOf(b.triage.level));
      setSessions(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const visible = filter === "all" ? sessions : sessions.filter((s) => s.triage.level === filter);

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60 }}>
      <h1 className="display" style={{ fontSize: 28 }}>{t("dashboard_title")}</h1>
      <p style={{ color: "#6B5A5F", marginTop: 8 }}>{t("dashboard_subtitle")}</p>

      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        {["all", "emergency", "urgent", "routine", "self-care"].map((lvl) => (
          <button key={lvl} onClick={() => setFilter(lvl)} style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: filter === lvl ? "1.5px solid #B04A63" : "1px solid #F0DFE2",
            background: filter === lvl ? "#F2D9DF" : "white", color: filter === lvl ? "#7E2F44" : "#6B5A5F",
          }}>
            {lvl === "all" ? "All" : lvl}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: "auto", fontSize: 13, color: "#7E2F44", background: "none", border: "none", fontWeight: 600 }}>
          Refresh
        </button>
      </div>

      {loading && <p style={{ marginTop: 30, color: "#9C8A8F" }}>Loading sessions...</p>}
      {error && <p style={{ marginTop: 30, color: "#B0342C" }}>{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p style={{ marginTop: 30, color: "#9C8A8F" }}>No sessions yet — run a triage check-in to see it appear here.</p>
      )}

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((s) => (
          <button key={s.id} onClick={() => setSelected(s)} className="card" style={{
            textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, border: "1px solid #F0DFE2", flexWrap: "wrap",
          }}>
            <div>
              <span className={`pill pill-${s.triage.level === "self-care" ? "selfcare" : s.triage.level}`}>{s.triage.level}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: "#6B5A5F" }}>{new Date(s.createdAt).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#9C8A8F" }}>
              {s.triage.firedRules.length} rule(s) fired · {Math.round(s.triage.confidence * 100)}% confidence
            </div>
          </button>
        ))}
      </div>

      {selected && <TraceDrawer session={selected} onClose={() => setSelected(null)} onDeleted={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function TraceDrawer({ session, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteSession(session.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ float: "right", border: "none", background: "none", fontSize: 18 }}>✕</button>
        <span className={`pill pill-${session.triage.level === "self-care" ? "selfcare" : session.triage.level}`}>{session.triage.level}</span>
        <h3 className="display" style={{ marginTop: 14, fontSize: 20 }}>Session {session.id}</h3>
        <p style={{ fontSize: 12.5, color: "#9C8A8F" }}>{new Date(session.createdAt).toLocaleString()} · language: {session.language}</p>

        <Section title="Intake">
          <pre style={preStyle}>{JSON.stringify(session.intake, null, 2)}</pre>
        </Section>
        <Section title="Rules fired">
          <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {session.triage.firedRules.map((r) => <li key={r.id}><code>{r.id}</code> — {r.description}</li>)}
            {session.triage.firedRules.length === 0 && <li>None</li>}
          </ul>
        </Section>
        <Section title="Model layer">
          <p style={{ fontSize: 13 }}>
            rule level → <strong>{session.triage.ruleLevel}</strong>, model level → <strong>{session.triage.modelLevel}</strong> ({session.triage.modelSource})
          </p>
          <p style={{ fontSize: 13, color: "#6B5A5F" }}>{session.triage.modelReason}</p>
        </Section>
        <Section title="Routing action">
          <p style={{ fontSize: 13 }}>{session.routing.action} — ASHA alert: {String(session.routing.ashaAlert)}</p>
        </Section>

        <button className="btn btn-ghost" onClick={handleDelete} disabled={deleting} style={{ marginTop: 18, color: "#B0342C", borderColor: "#F3C9C4" }}>
          {deleting ? "Deleting..." : "Delete this patient's data"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#7E2F44" }}>{title}</p>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(43,30,34,0.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" };
const drawerStyle = { width: "min(440px, 92vw)", height: "100%", background: "white", padding: 24, overflowY: "auto" };
const preStyle = { fontSize: 11.5, background: "#F5ECE8", padding: 10, borderRadius: 8, overflowX: "auto" };

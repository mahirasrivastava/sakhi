import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";

const LEVEL_ORDER = ["emergency", "urgent", "routine", "self-care"];

export default function Dashboard() {
  const { t } = useLanguage();
  const { worker, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.sessions();
      const sorted = [...data].sort(
        (a, b) => LEVEL_ORDER.indexOf(a.triage.level) - LEVEL_ORDER.indexOf(b.triage.level)
      );
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
      <div style={styles.staffBar}>
        <div>
          <span style={styles.staffBadge}>Staff area</span>
          <span style={{ marginLeft: 10, fontSize: 13.5, color: "var(--ink-soft)" }}>
            Signed in as <strong>{worker?.displayName}</strong> ({worker?.workerId})
            {worker?.phc ? ` · ${worker.phc}` : ""}
          </span>
        </div>
        <button onClick={logout} style={styles.signOut}>Sign out</button>
      </div>

      <h1 className="display" style={{ fontSize: 28, marginTop: 20 }}>{t("dashboard_title")}</h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>{t("dashboard_subtitle")}</p>

      <p style={styles.auditNotice}>
        This queue shows urgency only. Opening a record reveals what the patient
        wrote in her own words and is recorded in the audit log against your worker ID.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        {["all", "emergency", "urgent", "routine", "self-care"].map((lvl) => (
          <button key={lvl} onClick={() => setFilter(lvl)} style={{
            padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: filter === lvl ? "1.5px solid var(--rose)" : "1px solid var(--border)",
            background: filter === lvl ? "var(--rose-soft)" : "var(--surface)", color: filter === lvl ? "var(--rose-deep)" : "var(--ink-soft)",
          }}>
            {lvl === "all" ? "All" : lvl}
          </button>
        ))}
        <button onClick={load} className="btn-text" style={{ marginInlineStart: "auto" }}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>

      {loading && <p style={{ marginTop: 30, color: "var(--ink-muted)" }}>Loading sessions...</p>}
      {error && <p style={{ marginTop: 30, color: "var(--emergency)" }}>{error}</p>}
      {!loading && !error && visible.length === 0 && (
        <p style={{ marginTop: 30, color: "var(--ink-muted)" }}>No sessions yet — run a triage check-in to see it appear here.</p>
      )}

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((s) => (
          <button key={s.id} onClick={() => setSelectedId(s.id)} className="card" style={{
            textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, border: "1px solid var(--border)", flexWrap: "wrap",
          }}>
            <div>
              <span className={`pill pill-${s.triage.level === "self-care" ? "selfcare" : s.triage.level}`}>{s.triage.level}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: "var(--ink-soft)" }}>{new Date(s.createdAt).toLocaleString()}</span>
              {s.safetyFlag && <span style={styles.safetyChip}>needs a person</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              {s.triage.firedRules.length} rule(s) fired · {Math.round(s.triage.confidence * 100)}% confidence
            </div>
          </button>
        ))}
      </div>

      {selectedId && (
        <TraceDrawer
          sessionId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => { setSelectedId(null); load(); }}
        />
      )}
    </div>
  );
}

function TraceDrawer({ sessionId, onClose, onDeleted }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The full record is fetched on demand rather than shipped with the list, so
  // the sensitive fields only ever leave the server for a record a worker
  // actually opened — and that fetch is what the audit log records.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.session(sessionId)
      .then((data) => { if (!cancelled) { setSession(data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={drawerStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="btn-icon" style={{ float: "right", border: "none", background: "none" }} aria-label="Close"><Icon name="close" size={18} /></button>

        {loading && <p style={{ color: "var(--ink-muted)", marginTop: 40 }}>Opening record…</p>}
        {error && <p style={{ color: "var(--emergency)", marginTop: 40 }}>{error}</p>}

        {session && (
          <>
            <span className={`pill pill-${session.triage.level === "self-care" ? "selfcare" : session.triage.level}`}>
              {session.triage.level}
            </span>
            <h3 className="display" style={{ marginTop: 14, fontSize: 20 }}>Session {session.id}</h3>
            <p style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              {new Date(session.createdAt).toLocaleString()} · language: {session.language}
            </p>

            {session.intake?.safetyFlag && (
              <div style={styles.safetyBanner}>
                This check-in mentioned harm or abuse. It was never sent to the AI model.
                Handle it as a person-to-person conversation.
              </div>
            )}

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
                rule level <strong>{session.triage.ruleLevel}</strong>, model level <strong>{session.triage.modelLevel}</strong> ({session.triage.modelSource})
              </p>
              <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{session.triage.modelReason}</p>
            </Section>
            <Section title="Routing action">
              <p style={{ fontSize: 13 }}>{session.routing.action} — ASHA alert: {String(session.routing.ashaAlert)}</p>
            </Section>

            <DeleteRecord sessionId={session.id} onDeleted={onDeleted} />
          </>
        )}
      </div>
    </div>
  );
}

// Deletion is permanent and the server demands the worker's password again, so
// the UI collects it rather than firing a request that is guaranteed to fail.
function DeleteRecord({ sessionId, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete(e) {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      await api.deleteSession(sessionId, password);
      onDeleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setPassword("");
    }
  }

  if (!confirming) {
    return (
      <button
        className="btn btn-ghost"
        onClick={() => setConfirming(true)}
        style={{ marginTop: 18, color: "var(--emergency)", borderColor: "var(--emergency-border)" }}
      >
        Delete this patient's data
      </button>
    );
  }

  return (
    <form onSubmit={handleDelete} style={styles.deleteBox}>
      <p style={{ fontSize: 13, color: "var(--emergency-ink)", fontWeight: 600 }}>
        This permanently erases the record. Confirm with your password.
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Your password"
        autoComplete="current-password"
        required
        style={styles.deleteInput}
      />
      {error && <p style={{ color: "var(--emergency)", fontSize: 12.5 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-ghost" disabled={deleting}
          style={{ color: "var(--emergency)", borderColor: "var(--emergency-border)" }}>
          {deleting ? "Deleting…" : "Confirm delete"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { setConfirming(false); setError(null); setPassword(""); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--rose-deep)" }}>{title}</p>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 50, display: "flex", justifyContent: "flex-end" };
const drawerStyle = { width: "min(440px, 92vw)", height: "100%", background: "var(--surface)", padding: 24, overflowY: "auto" };
const preStyle = { fontSize: 11.5, background: "var(--cream-dim)", padding: 10, borderRadius: 8, overflowX: "auto" };

const styles = {
  staffBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    flexWrap: "wrap", padding: "10px 14px", borderRadius: 10,
    background: "var(--surface-alt)", border: "1px solid var(--border)",
  },
  staffBadge: {
    fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
    color: "var(--rose-deep)", background: "var(--rose-soft)", padding: "4px 9px", borderRadius: 999,
  },
  signOut: {
    fontSize: 13, fontWeight: 600, color: "var(--rose-deep)", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 999, padding: "7px 14px",
  },
  auditNotice: {
    marginTop: 16, fontSize: 12.5, color: "var(--warn-ink)", background: "var(--warn-bg)",
    border: "1px solid var(--warn-border)", borderRadius: 10, padding: "10px 13px", lineHeight: 1.6,
  },
  safetyChip: {
    marginLeft: 10, fontSize: 11.5, fontWeight: 700, color: "var(--emergency-ink)",
    background: "var(--emergency-bg)", padding: "3px 8px", borderRadius: 999,
  },
  safetyBanner: {
    marginTop: 14, fontSize: 12.5, color: "var(--emergency-ink)", background: "var(--emergency-bg)",
    border: "1px solid var(--emergency-border)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.6,
  },
  deleteBox: {
    marginTop: 18, padding: 14, borderRadius: 10,
    background: "var(--surface-alt)", border: "1px solid var(--emergency-border)",
    display: "flex", flexDirection: "column", gap: 10,
  },
  deleteInput: {
    width: "100%", padding: "9px 11px", borderRadius: 8,
    border: "1px solid var(--emergency-border)", fontSize: 14, background: "var(--surface)",
  },
};

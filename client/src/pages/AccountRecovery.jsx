import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

/**
 * Landing page for the links Sakhi emails (Point 2).
 *
 *   /account/verify?token=…  — confirm an email address (auto-submits)
 *   /account/reset?token=…   — set a new password
 *
 * Kept as one small component because the two flows share the same "here is a
 * token from your inbox" shape. English literals for now — see UserAccount.jsx.
 */
export default function AccountRecovery({ mode }) {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  if (mode === "verify") return <VerifyView token={token} />;
  return <ResetView token={token} />;
}

function Shell({ title, children }) {
  return (
    <div className="container container-narrow" style={{ paddingTop: 44, paddingBottom: 64 }}>
      <h1 className="display" style={{ fontSize: 24, marginBottom: 14 }}>{title}</h1>
      <div className="card">{children}</div>
    </div>
  );
}

function VerifyView({ token }) {
  const [state, setState] = useState(token ? "working" : "notoken");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.user.verifyEmail({ token })
      .then(() => { if (!cancelled) { setState("ok"); setMessage("Your email is confirmed. You can sign in now."); } })
      .catch((err) => { if (!cancelled) { setState("error"); setMessage(err.message || "This link is invalid or has expired."); } });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <Shell title="Confirm your email">
      {state === "working" && <p style={{ color: "var(--ink-muted)" }}>Confirming…</p>}
      {state === "notoken" && <p style={{ color: "var(--emergency)" }}>This link is missing its token. Open the link from your email again.</p>}
      {state === "ok" && (
        <>
          <p style={{ color: "var(--success-ink)", margin: 0 }}>{message}</p>
          <Link to="/account" className="btn btn-primary" style={{ marginTop: 16 }}>Go to sign in</Link>
        </>
      )}
      {state === "error" && (
        <>
          <p style={{ color: "var(--emergency)", margin: 0 }}>{message}</p>
          <Link to="/account" className="btn" style={{ marginTop: 16 }}>Back to account</Link>
        </>
      )}
    </Shell>
  );
}

function ResetView({ token }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      await api.user.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Shell title="Reset your password">
        <p style={{ color: "var(--emergency)" }}>This link is missing its token. Open the link from your email again.</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell title="Password changed">
        <p style={{ color: "var(--success-ink)", margin: 0 }}>Your password has been changed. You can sign in now.</p>
        <Link to="/account" className="btn btn-primary" style={{ marginTop: 16 }}>Go to sign in</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Reset your password">
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600 }}>
          New password
          <input className="field-input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600 }}>
          Confirm new password
          <input className="field-input" type="password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p style={{ color: "var(--emergency)", fontSize: 13.5, margin: 0 }} role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    </Shell>
  );
}

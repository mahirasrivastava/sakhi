import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import ScriptField from "../components/ScriptField.jsx";

// Two modes on one screen:
//   "signin"   — returning worker: ID + password
//   "activate" — first time: ID + one-time code issued by the PHC -> choose password
//
// A note on the fields. Worker IDs and activation codes go through ScriptField
// with keyboard="latin": they are ASCII on the card in the worker's hand, so
// transliterating them into her app language would produce a string the server
// has never seen. The three PASSWORD fields are deliberately plain <input>s —
// an on-screen keyboard renders every tapped key at 19px in a panel anyone
// standing nearby can read, which is the wrong trade for a credential that
// unlocks other people's health records.
export default function AshaLogin() {
  const { login, activate, isAuthenticated, notice, setNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signin");
  const [policy, setPolicy] = useState(null);

  // Only ever redirect to a path inside this app. "//evil.com" and "/\evil.com"
  // are both read as protocol-relative URLs by browsers, so a poisoned `from`
  // could otherwise bounce a signed-in worker onto an attacker's page.
  const requested = location.state?.from;
  const from =
    typeof requested === "string" && /^\/(?![/\\])/.test(requested) ? requested : "/dashboard";

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    api.auth.policy().then(setPolicy).catch(() => {});
  }, []);

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 520 }}>
      <div style={{ textAlign: "center" }}>
        <div style={styles.lockMark} aria-hidden="true"><Icon name="lock" size={24} /></div>
        <h1 className="display" style={{ fontSize: 26, marginTop: 12 }}>ASHA & clinician sign-in</h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 8, fontSize: 14.5, lineHeight: 1.65 }}>
          This area holds real patients' health records, many of them minors.
          Access is restricted to health workers registered with the district,
          and every record opened here is logged against your worker ID.
        </p>
      </div>

      {notice && (
        <div style={styles.notice} role="status">
          {notice}
          <button onClick={() => setNotice(null)} style={styles.noticeClose} aria-label="Dismiss"><Icon name="close" size={14} /></button>
        </div>
      )}

      {policy?.demoMode && <DemoBanner demo={policy.demo} />}

      {/* Two clearly separate jobs, not two spellings of "log in". The subtitle
          under each tab is what stops a returning worker burning a code and a
          new worker typing a password that was never set. */}
      <div style={styles.tabs} role="tablist">
        <TabButton
          active={mode === "signin"}
          onClick={() => setMode("signin")}
          title="Sign in"
          subtitle="Account already set up"
        />
        <TabButton
          active={mode === "activate"}
          onClick={() => setMode("activate")}
          title="First-time setup"
          subtitle="Never signed in before"
        />
      </div>

      {mode === "signin"
        ? <SignInForm onLogin={login} onNeedActivation={() => setMode("activate")} />
        : <ActivateForm
            onActivate={activate}
            policy={policy}
            onDone={() => setMode("signin")}
            onSwitchToSignIn={() => setMode("signin")}
          />}

      <p style={styles.footNote}>
        Not a health worker? You don't need an account — the{" "}
        <a href="/triage" style={{ color: "var(--rose-deep)" }}>symptom check</a> is anonymous and always will be.
      </p>
    </div>
  );
}

// Dev-only. The server omits `demoMode` from /auth/policy entirely when
// NODE_ENV=production, so this cannot render in a production build.
function DemoBanner({ demo }) {
  return (
    <div style={styles.demoBanner}>
      <strong style={{ display: "block", marginBottom: 6 }}>Development build</strong>
      Demo worker ID <code style={styles.code}>{demo?.workerId || "ASHA-KA-0001"}</code> is
      seeded for local testing. If sign-in fails, run{" "}
      <code style={styles.code}>{demo?.seedCommand || "npm run seed:demo"}</code> in{" "}
      <code style={styles.code}>server/</code> to reset its password and clear any lockout.
      This banner never appears in production.
    </div>
  );
}

function SignInForm({ onLogin, onNeedActivation }) {
  const [workerId, setWorkerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [lockedFor, setLockedFor] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLockedFor(null);
    try {
      await onLogin(workerId, password);
      // On success AuthContext flips isAuthenticated, and the effect in
      // AshaLogin redirects to /dashboard (or the page that bounced us here).
    } catch (err) {
      setError(err.message);
      // 423 = account lockout. Showing the wait explicitly beats a worker
      // retrying a correct password four more times and extending the lockout.
      if (err.status === 423 && err.body?.retryAfterSeconds) {
        setLockedFor(err.body.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <form onSubmit={submit} className="card" style={styles.card}>
      <p style={styles.explain}>
        For workers whose account is <strong>already set up</strong>. If you have never
        signed in on any device, your password does not exist yet — use{" "}
        <button type="button" onClick={onNeedActivation} style={styles.linkBtn}>
          First-time setup
        </button>{" "}
        instead.
      </p>

      <Field label="Worker ID" hint="Printed on your ASHA / ANM identity card">
        <ScriptField
          value={workerId}
          onValueChange={setWorkerId}
          keyboard="latin"
          placeholder="ASHA-KA-0001"
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          required
          style={styles.input}
        />
      </Field>

      <Field label="Password">
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ ...styles.input, paddingRight: 62 }}
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} style={styles.reveal}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      {error && <p style={styles.error} role="alert">{error}</p>}
      {lockedFor !== null && (
        <p style={styles.lockNote} role="alert">
          The account is locked for about {Math.ceil(lockedFor / 60)} more minute
          {Math.ceil(lockedFor / 60) === 1 ? "" : "s"}. Further attempts — even with the
          correct password — will be rejected until then, and will extend the lock.
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy || lockedFor !== null} style={{ marginTop: 4 }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>

      {/* Shown to everyone, always — the server deliberately will not say whether
          an ID exists or is unactivated, so this hint cannot be used to probe. */}
      <p style={styles.hint}>
        First time signing in?{" "}
        <button type="button" onClick={onNeedActivation} style={styles.linkBtn}>
          Set up your password
        </button>{" "}
        using the one-time code from your PHC supervisor.
      </p>
    </form>
  );
}

function ActivateForm({ onActivate, policy, onDone, onSwitchToSignIn }) {
  const [workerId, setWorkerId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);
  const [devHint, setDevHint] = useState(null);
  const [alreadyActive, setAlreadyActive] = useState(false);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setDetails([]);
    setDevHint(null);
    setAlreadyActive(false);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await onActivate(workerId, code, password);
      setSuccess(res.message || "Password created. Please sign in.");
      setPassword("");
      setConfirm("");
      setCode("");
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
      // Dev builds get the precise cause; production sends only the uniform
      // message, so this stays null there.
      if (err.body?.devMessage) setDevHint(err.body.devMessage);
      if (err.body?.devReason === "already_active") setAlreadyActive(true);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="card" style={styles.card}>
        <p style={styles.successLine}><Icon name="check" size={17} /> {success}</p>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 10, lineHeight: 1.65 }}>
          Your one-time activation code has now been used and will not work again.
          If anyone else asks you for it, report it to your supervisor.
        </p>
        <button className="btn btn-primary" onClick={onDone} style={{ marginTop: 16 }}>
          Go to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={styles.card}>
      <p style={styles.explain}>
        <strong>Only for accounts that have never been signed into.</strong> This sets your
        password for the first time. If you already have a password, go back to{" "}
        <button type="button" onClick={onSwitchToSignIn} style={styles.linkBtn}>Sign in</button> —
        your activation code has already been used and will not work twice.
      </p>

      <p style={styles.explain}>
        Your worker ID alone is not enough to create an account — it is printed on your
        ID card and others can see it. You also need the one-time activation code your
        PHC supervisor gives you in person or by SMS.
      </p>

      <Field label="Worker ID">
        <ScriptField
          value={workerId}
          onValueChange={setWorkerId}
          keyboard="latin"
          placeholder="ASHA-KA-0001"
          autoCapitalize="characters"
          spellCheck={false}
          required
          style={styles.input}
        />
      </Field>

      <Field label="One-time activation code" hint="Given to you by your PHC supervisor. Works once.">
        <ScriptField
          value={code}
          onValueChange={setCode}
          keyboard="latin"
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          spellCheck={false}
          required
          style={{ ...styles.input, letterSpacing: "0.08em", fontFamily: "ui-monospace, monospace" }}
        />
      </Field>

      <Field label="Create a password">
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            style={{ ...styles.input, paddingRight: 62 }}
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} style={styles.reveal}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      <Field label="Confirm password">
        <input
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
          style={{ ...styles.input, ...(mismatch ? { borderColor: "var(--danger-border)" } : {}) }}
        />
        {mismatch && <p style={styles.error}>Passwords do not match.</p>}
      </Field>

      <ul style={styles.rules}>
        <li>At least {policy?.password?.minLength ?? 12} characters</li>
        <li>Mix at least 3 of: lowercase, uppercase, numbers, symbols</li>
        <li>Must not contain your worker ID</li>
        <li>Never reuse the password from any other service</li>
      </ul>

      {error && <p style={styles.error} role="alert">{error}</p>}
      {details.length > 0 && (
        <ul style={{ ...styles.error, paddingLeft: 18 }}>
          {details.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}

      {devHint && (
        <div style={styles.devHint} role="status">
          <strong>Development detail:</strong> {devHint}
          {alreadyActive && (
            <button type="button" onClick={onSwitchToSignIn} className="btn btn-ghost" style={{ marginTop: 12, fontSize: 13.5, padding: "8px 16px" }}>
              Go to Sign in
            </button>
          )}
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy || mismatch} style={{ marginTop: 4 }}>
        {busy ? "Creating…" : "Create password"}
      </button>
    </form>
  );
}

function TabButton({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
    >
      <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{title}</span>
      <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>
        {subtitle}
      </span>
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      {hint && <p style={styles.hintSmall}>{hint}</p>}
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

const styles = {
  lockMark: {
    width: 52, height: 52, borderRadius: "50%", background: "var(--rose-soft)",
    display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22,
  },
  tabs: { display: "flex", gap: 8, marginTop: 26, marginBottom: 16, justifyContent: "center" },
  tab: {
    flex: 1, maxWidth: 240, padding: "10px 14px", borderRadius: 14, textAlign: "center",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-soft)",
  },
  // Full `border` rather than `borderColor` — mixing the shorthand with a
  // longhand across a rerender makes React warn and can drop the border.
  tabActive: { background: "var(--rose-soft)", border: "1px solid var(--rose)", color: "var(--rose-deep)" },
  card: { padding: 24 },
  label: { display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--rose-deep)" },
  hintSmall: { fontSize: 12, color: "var(--ink-muted)", marginTop: 3 },
  input: {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    border: "1px solid var(--border)", fontSize: 15, background: "var(--surface)", color: "var(--ink)",
  },
  reveal: {
    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
    border: "none", background: "none", fontSize: 12.5, fontWeight: 600, color: "var(--rose-deep)",
  },
  explain: {
    fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, background: "var(--surface-alt)",
    padding: 12, borderRadius: 10, marginBottom: 18,
  },
  rules: { fontSize: 12.5, color: "var(--ink-soft)", paddingLeft: 18, lineHeight: 1.8, marginBottom: 14 },
  error: { color: "var(--emergency)", fontSize: 13, marginTop: 8 },
  hint: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 16, lineHeight: 1.6 },
  linkBtn: {
    background: "none", border: "none", padding: 0, color: "var(--rose-deep)",
    fontWeight: 600, fontSize: 12.5, textDecoration: "underline",
  },
  notice: {
    marginTop: 20, padding: "11px 14px", borderRadius: 10, background: "var(--warn-bg)",
    border: "1px solid var(--warn-border)", color: "var(--warn-ink)", fontSize: 13.5,
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
  },
  noticeClose: { border: "none", background: "none", color: "var(--warn-ink)", fontSize: 14 },
  lockNote: {
    marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--emergency-bg)",
    border: "1px solid var(--emergency-border)", color: "var(--emergency-ink)", fontSize: 12.5, lineHeight: 1.6,
  },
  demoBanner: {
    marginTop: 22, padding: "12px 14px", borderRadius: 12, background: "var(--info-bg)",
    border: "1px dashed var(--info-border)", color: "var(--info-ink)", fontSize: 12.5, lineHeight: 1.75,
  },
  devHint: {
    marginTop: 12, padding: "11px 13px", borderRadius: 10, background: "var(--info-bg)",
    border: "1px dashed var(--info-border)", color: "var(--info-ink)", fontSize: 12.5, lineHeight: 1.7,
  },
  code: {
    fontFamily: "ui-monospace, monospace", fontSize: 12, background: "var(--info-chip)",
    padding: "1px 5px", borderRadius: 5,
  },
  successLine: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 15, color: "var(--success-ink)", fontWeight: 600,
  },
  footNote: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 22, textAlign: "center", lineHeight: 1.6 },
};

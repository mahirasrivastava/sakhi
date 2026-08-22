import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "../components/Icon.jsx";

/**
 * Optional account screen.
 *
 * The most important thing on this page is the line telling people they do not
 * need it. Everything the app does works signed out, and a sign-in wall — even a
 * soft one — is exactly the friction that stops someone asking about a symptom
 * she is embarrassed by.
 */
export default function UserAccount() {
  const { t, lang } = useLanguage();
  const { user, isSignedIn, login, register, logout, checking } = useUser();

  const [tab, setTab] = useState("signin");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  function reset() {
    setHandle(""); setPassword(""); setConfirm(""); setError(null);
  }

  async function submitSignIn(e) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      await login(handle.trim().toLowerCase(), password);
      reset();
    } catch (err) {
      setError(err.status === 429 ? t("account_rate_limited") : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    if (password !== confirm) { setError(t("account_mismatch")); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      await register(handle.trim().toLowerCase(), password, lang);
      reset();
      setTab("signin");
      setNotice(t("account_created"));
    } catch (err) {
      setError(err.status === 429 ? t("account_rate_limited") : err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="container container-narrow" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <p style={{ color: "var(--ink-muted)" }}>{t("account_checking")}</p>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="container container-narrow" style={{ paddingTop: 40, paddingBottom: 64 }}>
        <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>{t("account_title")}</h1>
        <div className="card" style={{ marginTop: 18 }}>
          <p style={{ margin: 0, fontSize: 15 }}>
            {t("account_signed_in_as")} <strong>{user.handle}</strong>
          </p>
          <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            {t("account_stores")}
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={logout}>{t("account_sign_out")}</button>
            <Link to="/" className="btn btn-primary">{t("account_continue")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const isRegister = tab === "register";

  return (
    <div className="container container-narrow" style={{ paddingTop: 40, paddingBottom: 64 }}>
      <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>{t("account_title")}</h1>

      {/* The reassurance comes before the form, not after it. */}
      <div className="card" style={styles.optional}>
        <span style={styles.optionalIcon}><Icon name="shield" size={18} /></span>
        <div>
          <p style={styles.optionalTitle}>{t("account_optional_title")}</p>
          <p style={styles.optionalBody}>{t("account_optional_body")}</p>
          <Link to="/" className="link-inline" style={{ fontSize: 13.5 }}>
            {t("account_skip")}
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={!isRegister}
            className={`btn ${!isRegister ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setTab("signin"); setError(null); }}
          >
            {t("account_tab_signin")}
          </button>
          <button
            role="tab"
            aria-selected={isRegister}
            className={`btn ${isRegister ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setTab("register"); setError(null); setNotice(null); }}
          >
            {t("account_tab_register")}
          </button>
        </div>

        {notice && <p style={styles.notice}>{notice}</p>}

        <form onSubmit={isRegister ? submitRegister : submitSignIn} style={styles.form}>
          <label style={styles.label}>
            {t("account_username")}
            <input
              className="field-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          {isRegister && <p style={styles.hint}>{t("account_username_hint")}</p>}

          <label style={styles.label}>
            {t("account_password")}
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>

          {isRegister && (
            <>
              <p style={styles.hint}>{t("account_password_hint")}</p>
              <label style={styles.label}>
                {t("account_confirm")}
                <input
                  className="field-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          )}

          {error && <p style={styles.error} role="alert">{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy
              ? t("account_working")
              : isRegister ? t("account_tab_register") : t("account_tab_signin")}
          </button>
        </form>
      </div>

      <p style={styles.staff}>
        {t("account_staff_note")} <Link to="/asha/login" className="link-inline">{t("account_staff_link")}</Link>
      </p>
    </div>
  );
}

const styles = {
  optional: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "var(--surface-alt)",
  },
  optionalIcon: { color: "var(--rose)", flexShrink: 0, marginTop: 2 },
  optionalTitle: { margin: 0, fontWeight: 700, fontSize: 14.5 },
  optionalBody: { margin: "6px 0 10px", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 },

  tabs: { display: "flex", gap: 8, marginBottom: 18 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 600 },
  hint: { margin: "-6px 0 0", fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 },
  notice: {
    fontSize: 13.5,
    color: "var(--success-ink)",
    background: "var(--pill-selfcare-bg)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 14,
  },
  error: { fontSize: 13.5, color: "var(--emergency)", margin: 0, lineHeight: 1.6 },
  staff: { marginTop: 22, fontSize: 12.5, color: "var(--ink-muted)" },
};

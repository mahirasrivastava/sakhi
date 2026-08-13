import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import ResultCard from "./ResultCard.jsx";
import { speechRecognitionSupported, startListening } from "../speech.js";

const SEVERITY_LABELS = [
  "", "Mild — annoying", "Noticeable", "Bad", "Very bad", "Unbearable",
];

export default function TriageForm({ symptomOptions, title, intro, showPregnant = true }) {
  const { t, lang } = useLanguage();
  const [symptoms, setSymptoms] = useState([]);
  const [durationDays, setDurationDays] = useState(1);
  const [severity, setSeverity] = useState(2);
  const [freeText, setFreeText] = useState("");
  const [isPregnantOrPossible, setPregnant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [listening, setListening] = useState(false);
  const stopListeningRef = useRef(null);

  function toggleMic() {
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      return;
    }
    setListening(true);
    stopListeningRef.current = startListening(lang, {
      onResult: (transcript) => setFreeText(transcript),
      onEnd: () => setListening(false),
      onError: (err) => {
        setError(err.message);
        setListening(false);
      },
    });
  }

  function toggleSymptom(id) {
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSession(null);
    try {
      const result = await api.triage({
        symptoms, durationDays: Number(durationDays), severity: Number(severity),
        freeText, isPregnantOrPossible: showPregnant ? isPregnantOrPossible : false, language: lang,
      });
      setSession(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSession(null);
    setSymptoms([]);
    setFreeText("");
    setDurationDays(1);
    setSeverity(2);
    setPregnant(false);
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <PageHeading title={title} intro={intro} />

      {session ? (
        <div className="split" style={{ marginTop: 24 }}>
          <div>
            <ResultCard session={session} />
            <button className="btn btn-ghost btn-lg" style={{ marginTop: 18 }} onClick={reset}>
              ↻ Start a new check-in
            </button>
          </div>
          <div>
            <HelpAside />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="split" style={{ marginTop: 24 }}>
          <div className="card" style={{ padding: 26 }}>
            <Step
              n={1}
              label={t("triage_symptoms")}
              hint="Tap everything that applies. You can pick more than one, or none."
            >
              <div className="choice-grid">
                {symptomOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt.id}
                    className="choice"
                    onClick={() => toggleSymptom(opt.id)}
                    aria-pressed={symptoms.includes(opt.id)}
                  >
                    <span className="choice-icon" aria-hidden="true">{opt.icon || "•"}</span>
                    <span>{opt[lang] || opt.en}</span>
                  </button>
                ))}
              </div>
              <p style={styles.count}>
                {symptoms.length === 0
                  ? "Nothing selected yet"
                  : `${symptoms.length} selected`}
              </p>
            </Step>

            <Step n={2} label={t("triage_duration")} hint="Roughly is fine. Put 0 if it started today.">
              <input
                type="number" min="0" max="60" value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="field-input" style={{ maxWidth: 200 }}
              />
            </Step>

            <Step n={3} label={t("triage_severity")}>
              <input
                type="range" min="1" max="5" value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{ width: "100%", maxWidth: 460, accentColor: "var(--rose)" }}
              />
              {/* The number alone means little. The word next to it is what
                  someone actually calibrates against. */}
              <div style={styles.severityRow}>
                <span style={styles.severityNum}>{severity}</span>
                <span style={styles.severityWord}>{SEVERITY_LABELS[severity]}</span>
              </div>
            </Step>

            {showPregnant && (
              <Step n={4} label={t("triage_pregnant")} hint="This changes which danger signs Sakhi checks for.">
                <div style={{ display: "flex", gap: 10 }}>
                  {[true, false].map((v) => (
                    <button
                      type="button"
                      key={String(v)}
                      className="choice"
                      style={{ flex: "0 1 160px", justifyContent: "center" }}
                      aria-pressed={isPregnantOrPossible === v}
                      onClick={() => setPregnant(v)}
                    >
                      <span className="choice-icon" aria-hidden="true">{v ? "🤰" : "🚫"}</span>
                      <span>{v ? "Yes, or maybe" : "No"}</span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            <Step
              n={showPregnant ? 5 : 4}
              label={t("triage_freetext")}
              hint="Optional. Type, or tap the microphone and just speak."
            >
              <div style={{ position: "relative" }}>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  rows={4}
                  className="field-input"
                  style={{ resize: "vertical", paddingRight: 58 }}
                />
                {speechRecognitionSupported() && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={listening ? "Stop voice input" : "Start voice input"}
                    aria-pressed={listening}
                    style={{
                      ...styles.mic,
                      background: listening ? "var(--rose)" : "var(--rose-soft)",
                      color: listening ? "var(--on-brand)" : "var(--rose-deep)",
                    }}
                  >
                    {listening ? "●" : "🎤"}
                  </button>
                )}
              </div>
              {listening && <span style={styles.listening}>● Listening — speak now</span>}
            </Step>

            {error && <p style={styles.error} role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? t("triage_loading") : `${t("triage_submit")} →`}
            </button>
            <p style={styles.privacy}>
              🔒 Nothing here is linked to your name. No account, no phone number.
            </p>
          </div>

          <div>
            <HelpAside />
          </div>
        </form>
      )}
    </div>
  );
}

/** Shared page heading. Wide screens keep the intro readable rather than letting
 *  it run the full 1280px, which is unreadable as a paragraph. */
function PageHeading({ title, intro }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15 }}>
        {title}
      </h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
        {intro}
      </p>
    </div>
  );
}

function Step({ n, label, hint, children }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <div className="step">
        <span className="step-num" aria-hidden="true">{n}</span>
        <div>
          <div className="step-label">{label}</div>
          {hint && <div className="step-hint">{hint}</div>}
        </div>
      </div>
      <div style={{ paddingInlineStart: 43 }}>{children}</div>
    </section>
  );
}

/** The right-hand column. It fills the width with something genuinely useful
 *  rather than padding — emergency numbers, and what happens next. */
function HelpAside() {
  return (
    <div className="aside-sticky" style={{ display: "grid", gap: 16 }}>
      <div className="aside-card" style={{ borderInlineStart: "4px solid var(--emergency)" }}>
        <div className="aside-title" style={{ color: "var(--emergency)" }}>If it is an emergency</div>
        <p style={styles.asideText}>
          Do not wait for a result. Call now — these are free.
        </p>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <a href="tel:108" className="btn btn-primary" style={styles.asideBtn}>🚑 Ambulance — 108</a>
          <a href="tel:102" className="btn btn-ghost" style={styles.asideBtn}>🤰 Pregnancy — 102</a>
          <a href="tel:112" className="btn btn-ghost" style={styles.asideBtn}>☎️ Any emergency — 112</a>
        </div>
        <Link to="/nearby" style={styles.asideLink}>📍 Find your location code & nearest hospital →</Link>
      </div>

      <div className="aside-card">
        <div className="aside-title">What happens next</div>
        <ol style={styles.steps}>
          <li>Sakhi decides how urgent it is — <strong>never</strong> what illness you have.</li>
          <li>You get a clear next step: home care, a clinic visit, or go now.</li>
          <li>If it is serious, an ASHA worker is alerted so a real person follows up.</li>
        </ol>
      </div>

      <div className="aside-card">
        <div className="aside-title">Your privacy</div>
        <ul style={styles.steps}>
          <li>No name, no phone number, no account.</li>
          <li>Free, in {""}your own language.</li>
          <li>A health worker only ever sees the urgency, not your identity.</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  count: { fontSize: 13, color: "var(--ink-muted)", marginTop: 10, fontWeight: 600 },
  severityRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 },
  severityNum: {
    fontSize: 15, fontWeight: 700, color: "var(--rose-deep)",
    background: "var(--rose-soft)", borderRadius: 8, padding: "3px 11px",
  },
  severityWord: { fontSize: 14.5, color: "var(--ink-soft)" },
  mic: {
    position: "absolute", top: 10, insetInlineEnd: 10, width: 38, height: 38,
    borderRadius: "50%", border: "none", fontSize: 17,
  },
  listening: { fontSize: 13, color: "var(--rose)", marginTop: 6, display: "block", fontWeight: 600 },
  error: { color: "var(--emergency)", fontSize: 14, marginBottom: 10 },
  privacy: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 14, lineHeight: 1.6 },
  asideText: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 },
  asideBtn: { justifyContent: "center", textDecoration: "none", fontSize: 14.5, padding: "11px 16px" },
  asideLink: {
    display: "block", marginTop: 14, fontSize: 13,
    color: "var(--rose-deep)", fontWeight: 600, textDecoration: "underline",
  },
  steps: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
};

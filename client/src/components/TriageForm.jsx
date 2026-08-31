import React, { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useReport } from "../context/ReportContext.jsx";
import { api } from "../api.js";
import ResultCard from "./ResultCard.jsx";
import ScriptField from "./ScriptField.jsx";
import Icon from "./Icon.jsx";
import { callsFor } from "../helplines.js";
import { speechRecognitionSupported, startListening } from "../speech.js";

const SEVERITY_LABELS = [
  "", "Mild — annoying", "Noticeable", "Bad", "Very bad", "Unbearable",
];

export default function TriageForm({ symptomOptions, title, intro, showPregnant = true }) {
  const { t, lang } = useLanguage();
  const { recordTriage } = useReport();
  const [symptoms, setSymptoms] = useState([]);
  const [durationDays, setDurationDays] = useState("1");
  const [severity, setSeverity] = useState(2);
  const [freeText, setFreeText] = useState("");
  const [isPregnantOrPossible, setPregnant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [listening, setListening] = useState(false);
  const stopListeningRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  function startVoiceInput() {
    setListening(true);
    setError(null);
    stopListeningRef.current = startListening(lang, {
      onResult: (transcript) => setFreeText(transcript),
      onEnd: () => setListening(false),
      onError: (err) => {
        setError(err.message);
        setListening(false);
      },
    });
  }

  function toggleMic() {
    if (listening) {
      stopListeningRef.current?.();
      setListening(false);
      return;
    }
    startVoiceInput();
  }

  // Home's "tap to speak" hero button lands here with autoListen in the
  // navigation state — the point of a push-to-talk button is that pushing
  // it starts the talking, not that it opens a form you then have to tap
  // the mic on again. Falls back to just scrolling to the field (so typing
  // is still one motion, not a hunt) when the browser has no speech API.
  useEffect(() => {
    if (!location.state?.autoListen) return;
    const el = document.getElementById("triage-own-words");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (speechRecognitionSupported()) startVoiceInput();
    // Consume the state so a later back/forward through history doesn't
    // silently restart the mic.
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        symptoms, durationDays: Number(durationDays) || 0, severity: Number(severity),
        freeText, isPregnantOrPossible: showPregnant ? isPregnantOrPossible : false, language: lang,
      });
      setSession(result);
      // Filed into the health report so it can be printed alongside the anaemia
      // screen, rather than being one more result
      // that vanishes when the tab closes.
      recordTriage({
        session: result,
        symptomLabels: symptoms
          .map((id) => symptomOptions.find((o) => o.id === id))
          .filter(Boolean)
          .map((o) => o.en),
        durationDays: Number(durationDays) || 0,
        severity: Number(severity),
        isPregnantOrPossible: showPregnant ? isPregnantOrPossible : false,
      });
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
    setDurationDays("1");
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
              <Icon name="refresh" size={17} /> Start a new check-in
            </button>
          </div>
          <div>
            <HelpAside maternal={isPregnantOrPossible} />
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
                    <span className="choice-icon">
                      <Icon name={opt.icon || "info"} size={19} />
                    </span>
                    <span>{opt[lang] || opt.en}</span>
                  </button>
                ))}
              </div>
              <p style={styles.count}>
                {symptoms.length === 0
                  ? "Nothing selected yet"
                  : `${symptoms.length} selected`}
              </p>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("triage-own-words");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    const ta = el.querySelector("textarea");
                    if (ta) setTimeout(() => ta.focus(), 350);
                  }
                }}
                style={styles.otherBtn}
              >
                <Icon name="info" size={16} /> Something else, or not listed? Describe it in your own words →
              </button>
            </Step>

            <Step n={2} label={t("triage_duration")} hint="Roughly is fine. Put 0 if it started today.">
              <ScriptField
                type="number"
                inputMode="numeric"
                min="0"
                max="60"
                value={durationDays}
                onValueChange={setDurationDays}
                keyboard="numeric"
                className="field-input"
                style={{ maxWidth: 200 }}
                wrapperStyle={{ maxWidth: 200 }}
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
                      style={{ flex: "0 1 160px" }}
                      aria-pressed={isPregnantOrPossible === v}
                      onClick={() => setPregnant(v)}
                    >
                      <span className="choice-icon">
                        <Icon name={v ? "pregnancy" : "ban"} size={19} />
                      </span>
                      <span>{v ? "Yes, or maybe" : "No"}</span>
                    </button>
                  ))}
                </div>
              </Step>
            )}

            <Step
              n={showPregnant ? 5 : 4}
              label={t("triage_freetext")}
              hint="Not listed above, or anything else you want to add? Describe it here in your own words — type in your own script, tap the microphone and speak, or use the keyboard button in the corner of the box."
            >
              <div id="triage-own-words" style={{ position: "relative" }}>
                <ScriptField
                  as="textarea"
                  value={freeText}
                  onValueChange={setFreeText}
                  rows={4}
                  className="field-input"
                  style={{ resize: "vertical", paddingInlineEnd: 92 }}
                  adornmentInset={54}
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
                    <Icon name="mic" size={17} />
                  </button>
                )}
              </div>
              {listening && <span style={styles.listening}>Listening — speak now</span>}
            </Step>

            {error && <p style={styles.error} role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? t("triage_loading") : t("triage_submit")}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
            <p style={styles.privacy}>
              <Icon name="lock" size={14} style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 5 }} />
              Nothing here is linked to your name. No account, no phone number.
            </p>
          </div>

          <div>
            <HelpAside maternal={showPregnant && isPregnantOrPossible} />
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
function HelpAside({ maternal = false }) {
  const lines = callsFor({ maternal, limit: 3 });

  return (
    <div className="aside-sticky" style={{ display: "grid", gap: 16 }}>
      <div className="aside-card" style={{ borderInlineStart: "4px solid var(--emergency)" }}>
        <div className="aside-title" style={{ color: "var(--emergency)" }}>If it is an emergency</div>
        <p style={styles.asideText}>
          Do not wait for a result. Call now — these are free.
        </p>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {lines.map((h, i) => (
            <a
              key={h.number}
              href={`tel:${h.dial}`}
              className={`btn ${i === 0 ? "btn-emergency" : "btn-ghost"}`}
              style={styles.asideBtn}
            >
              <Icon name={h.icon} size={16} />
              <span>{h.label}</span>
              <strong style={styles.asideNum}>{h.number}</strong>
            </a>
          ))}
        </div>
        <Link to="/helplines" style={styles.asideLink}>
          <Icon name="phone" size={13} /> Women, children and mental health lines
        </Link>
        <Link to="/nearby" style={styles.asideLink}>
          <Icon name="pin" size={13} /> Location code &amp; nearest hospital
        </Link>
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
          <li>Free, in your own language.</li>
          <li>A health worker only ever sees the urgency, not your identity.</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  otherBtn: { marginTop: 12, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
    padding: "12px 14px", borderRadius: 12, border: "1px dashed var(--rose)", background: "var(--rose-soft)",
    color: "var(--rose-deep)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", lineHeight: 1.4 },
  count: { fontSize: 13, color: "var(--ink-muted)", marginTop: 10, fontWeight: 600 },
  severityRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 },
  severityNum: {
    fontSize: 15, fontWeight: 700, color: "var(--rose-deep)",
    background: "var(--rose-soft)", borderRadius: 8, padding: "3px 11px",
  },
  severityWord: { fontSize: 14.5, color: "var(--ink-soft)" },
  mic: {
    position: "absolute", top: 10, insetInlineEnd: 10, width: 38, height: 38,
    borderRadius: "50%", border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  listening: { fontSize: 13, color: "var(--rose)", marginTop: 6, display: "block", fontWeight: 600 },
  error: { color: "var(--emergency)", fontSize: 14, marginBottom: 10 },
  privacy: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 14, lineHeight: 1.6 },
  asideText: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 },
  asideBtn: { justifyContent: "flex-start", textDecoration: "none", fontSize: 14, padding: "11px 14px" },
  asideNum: {
    marginInlineStart: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  asideLink: {
    display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13,
    color: "var(--rose-deep)", fontWeight: 600, textDecoration: "none",
  },
  steps: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
};

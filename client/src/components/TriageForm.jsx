import React, { useState, useRef } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../api.js";
import ResultCard from "./ResultCard.jsx";
import { speechRecognitionSupported, startListening } from "../speech.js";

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
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 680 }}>
      <h1 className="display" style={{ fontSize: 30 }}>{title}</h1>
      <p style={{ color: "#6B5A5F", marginTop: 8 }}>{intro}</p>

      {!session && (
        <form onSubmit={handleSubmit} className="card" style={{ marginTop: 24 }}>
          <Field label={t("triage_symptoms")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {symptomOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => toggleSymptom(opt.id)}
                  aria-pressed={symptoms.includes(opt.id)}
                  style={{
                    padding: "8px 13px", borderRadius: 999, fontSize: 13.5,
                    border: symptoms.includes(opt.id) ? "1.5px solid #B04A63" : "1px solid #F0DFE2",
                    background: symptoms.includes(opt.id) ? "#F2D9DF" : "white",
                    color: symptoms.includes(opt.id) ? "#7E2F44" : "#6B5A5F",
                    fontWeight: symptoms.includes(opt.id) ? 600 : 400,
                  }}
                >
                  {opt[lang] || opt.en}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t("triage_duration")}>
            <input type="number" min="0" max="60" value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)} style={inputStyle} />
          </Field>

          <Field label={t("triage_severity")}>
            <input type="range" min="1" max="5" value={severity}
              onChange={(e) => setSeverity(e.target.value)} style={{ width: "100%" }} />
            <span style={{ fontSize: 13, color: "#7E2F44", fontWeight: 600 }}>{severity} / 5</span>
          </Field>

          {showPregnant && (
            <Field label={t("triage_pregnant")}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={isPregnantOrPossible} onChange={(e) => setPregnant(e.target.checked)} />
                {isPregnantOrPossible ? "Yes" : "No"}
              </label>
            </Field>
          )}

          <Field label={t("triage_freetext")}>
            <div style={{ position: "relative" }}>
              <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)}
                rows={3} style={{ ...inputStyle, resize: "vertical", paddingRight: 46 }} />
              {speechRecognitionSupported() && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={listening}
                  style={{
                    position: "absolute", top: 8, right: 8, width: 32, height: 32,
                    borderRadius: "50%", border: "none", fontSize: 15,
                    background: listening ? "#B04A63" : "#F2D9DF",
                    color: listening ? "white" : "#7E2F44",
                  }}
                >
                  {listening ? "●" : "🎤"}
                </button>
              )}
            </div>
            {listening && <span style={{ fontSize: 12, color: "#B04A63", marginTop: 4, display: "block" }}>Listening...</span>}
          </Field>

          {error && <p style={{ color: "#B0342C", fontSize: 13.5 }}>{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? t("triage_loading") : t("triage_submit")}
          </button>
        </form>
      )}

      {session && (
        <>
          <ResultCard session={session} />
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={reset}>
            Start a new check-in
          </button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#7E2F44", marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid #F0DFE2", fontSize: 14.5, fontFamily: "Inter, sans-serif",
};

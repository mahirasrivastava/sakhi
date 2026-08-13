import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import ResultCard from "../components/ResultCard.jsx";

const SCENARIOS = [
  {
    id: "chest-pain-hi",
    label: "Chest pain — Hindi",
    expect: "Emergency",
    payload: { symptoms: ["chest_pain"], durationDays: 0, severity: 5, freeText: "सीने में तेज़ दर्द हो रहा है", language: "hi" },
  },
  {
    id: "fever-kn",
    label: "3-day fever — Kannada",
    expect: "Urgent",
    payload: { symptoms: ["fever"], durationDays: 3, severity: 3, freeText: "ಜ್ವರ ಮೂರು ದಿನಗಳಿಂದ ಇದೆ", language: "kn" },
  },
  {
    id: "mild-cold-en",
    label: "Mild cold — English",
    expect: "Self-care",
    payload: { symptoms: ["cough"], durationDays: 1, severity: 2, freeText: "just a mild cold, feeling okay", language: "en" },
  },
  {
    id: "compound-anaemia",
    label: "Compound pattern — dizziness + anaemia flag",
    expect: "Urgent (combined weak signals)",
    payload: {
      symptoms: ["dizziness", "fatigue"], durationDays: 4, severity: 2,
      freeText: "feeling dizzy and tired for a few days", language: "en",
      anaemiaScreen: { flagged: true, pallorScore: 0.58 },
    },
  },
];

export default function Demo() {
  const [step, setStep] = useState(0);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const runScenario = useCallback(async (idx) => {
    setLoading(true);
    setSession(null);
    try {
      const result = await api.triage(SCENARIOS[idx].payload);
      setSession(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { runScenario(step); }, [step, runScenario]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => {
      setStep((s) => (s + 1) % SCENARIOS.length);
    }, 7000);
    return () => clearTimeout(timer);
  }, [autoPlay, step, session]);

  const current = SCENARIOS[step];

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 680 }}>
      <h1 className="display" style={{ fontSize: 28 }}>Demo scenarios</h1>
      <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>
        Four preset cases run through the real backend — same rules engine, same explainability,
        no live typing required. Deterministic regardless of whether watsonx.ai keys are configured.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
        {SCENARIOS.map((s, i) => (
          <button key={s.id} onClick={() => setStep(i)} style={{
            padding: "8px 14px", borderRadius: 999, fontSize: 13,
            border: i === step ? "1.5px solid var(--rose)" : "1px solid var(--border)",
            background: i === step ? "var(--rose-soft)" : "var(--surface)", color: i === step ? "var(--rose-deep)" : "var(--ink-soft)",
            fontWeight: i === step ? 600 : 400,
          }}>
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={() => setStep((s) => (s - 1 + SCENARIOS.length) % SCENARIOS.length)}>← Prev</button>
        <button className="btn btn-ghost" onClick={() => setStep((s) => (s + 1) % SCENARIOS.length)}>Next →</button>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", marginLeft: "auto" }}>
          <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
          Auto-play
        </label>
      </div>

      <p style={{ marginTop: 16, fontSize: 13, color: "var(--ink-muted)" }}>
        Expected outcome: <strong style={{ color: "var(--rose-deep)" }}>{current.expect}</strong>
      </p>

      {loading && <p style={{ marginTop: 20, color: "var(--ink-muted)" }}>Running triage...</p>}
      {session && <ResultCard session={session} />}
    </div>
  );
}

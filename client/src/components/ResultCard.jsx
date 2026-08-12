import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import NearbyFacilities from "./NearbyFacilities.jsx";
import { speak, stopSpeaking, speechSynthesisSupported } from "../speech.js";

const LEVEL_META = {
  emergency: { pill: "pill-emergency", label: { en: "Emergency", hi: "आपातकाल", kn: "ತುರ್ತು" } },
  urgent: { pill: "pill-urgent", label: { en: "Urgent", hi: "अत्यावश्यक", kn: "ತುರ್ತುಸ್ಥಿತಿ" } },
  routine: { pill: "pill-routine", label: { en: "Routine", hi: "सामान्य", kn: "ಸಾಮಾನ್ಯ" } },
  "self-care": { pill: "pill-selfcare", label: { en: "Self-care", hi: "स्वयं देखभाल", kn: "ಸ್ವಯಂ ಆರೈಕೆ" } },
};

export default function ResultCard({ session }) {
  const { t, lang } = useLanguage();
  const { triage, routing, selfCare } = session;
  const meta = LEVEL_META[triage.level] || LEVEL_META.routine;
  const [speaking, setSpeaking] = useState(false);

  function toggleListen() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const parts = [triage.modelReason, ...(routing.instructions || []), selfCare?.text].filter(Boolean);
    speak(parts.join(". "), lang);
    setSpeaking(true);
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span className={`pill ${meta.pill}`}>{meta.label[lang] || meta.label.en}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {speechSynthesisSupported() && (
            <button
              type="button"
              onClick={toggleListen}
              className="btn btn-ghost"
              style={{ padding: "6px 12px", fontSize: 12.5 }}
            >
              {speaking ? "⏸ Stop" : "🔊 Listen"}
            </button>
          )}
          <ConfidenceBar value={triage.confidence} label={t("result_confidence")} />
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 15, color: "#2B1E22", lineHeight: 1.6 }}>
        {triage.modelReason}
      </p>

      {routing.instructions?.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 20, color: "#3C2A2F", fontSize: 14.5, lineHeight: 1.7 }}>
          {routing.instructions.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}

      {(triage.level === "emergency" || triage.level === "urgent") && (
        <NearbyFacilities compact />
      )}

      {selfCare && (
        <div style={{ marginTop: 14, padding: 14, background: "#F5ECE8", borderRadius: 12, fontSize: 14.5, color: "#3C2A2F" }}>
          {selfCare.text}
        </div>
      )}

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "#7E2F44" }}>
          {t("result_rules_fired")} ({triage.firedRules.length})
        </summary>
        <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 13, color: "#6B5A5F", lineHeight: 1.7 }}>
          {triage.firedRules.length === 0 && <li>No red-flag rules fired.</li>}
          {triage.firedRules.map((r) => (
            <li key={r.id}><code>{r.id}</code> — {r.description}</li>
          ))}
          <li style={{ marginTop: 6 }}>
            <strong>{t("result_model_note")}:</strong> rule level "{triage.ruleLevel}" → model level "{triage.modelLevel}" ({triage.modelSource})
          </li>
        </ul>
      </details>

      {routing.needsHumanReview && (
        <p style={{ marginTop: 12, fontSize: 12.5, color: "#B0342C" }}>
          Confidence was below threshold — this case was automatically escalated for human review.
        </p>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#9C8A8F" }}>{t("result_not_diagnosis")}</p>

      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-ghost no-print"
        style={{ marginTop: 14, padding: "8px 16px", fontSize: 13 }}
      >
        🖨 Print / save as PDF for a doctor
      </button>

      {/* Print-only clean summary — hidden on screen, shown via @media print */}
      <div className="print-only">
        <h2>Sakhi triage summary</h2>
        <p>Generated {new Date(session.createdAt).toLocaleString()} — not a diagnosis.</p>
        <p><strong>Urgency level:</strong> {meta.label[lang] || meta.label.en}</p>
        <p><strong>Reason:</strong> {triage.modelReason}</p>
        <p><strong>Rules fired:</strong> {triage.firedRules.map((r) => `${r.id} (${r.description})`).join("; ") || "None"}</p>
        <p><strong>Recommended action:</strong> {routing.instructions?.join(" ")}</p>
        {selfCare && <p><strong>Self-care guidance:</strong> {selfCare.text}</p>}
        <p><strong>Confidence:</strong> {Math.round(triage.confidence * 100)}%</p>
      </div>
    </div>
  );
}

function ConfidenceBar({ value, label }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#6B5A5F" }}>{label}</span>
      <div style={{ width: 90, height: 6, borderRadius: 999, background: "#F0DFE2", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#B04A63" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#7E2F44" }}>{pct}%</span>
    </div>
  );
}

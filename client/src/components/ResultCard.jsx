import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import NearbyFacilities from "./NearbyFacilities.jsx";
import EmergencyLocator from "./EmergencyLocator.jsx";
import { speak, stopSpeaking, speechSynthesisSupported } from "../speech.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { Link } from "react-router-dom";

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
  const [relatedKnowledge, setRelatedKnowledge] = useState([]);

  useEffect(() => {
    const symptoms = session.intake?.symptoms?.join(" ") || "";
    if (symptoms) {
      api.knowledgeSearch(symptoms, lang).then(setRelatedKnowledge).catch(() => {});
    }
  }, [session, lang]);

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
              <Icon name={speaking ? "pause" : "speaker"} size={15} />
              {speaking ? "Stop" : "Listen"}
            </button>
          )}
          <ConfidenceBar value={triage.confidence} label={t("result_confidence")} />
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 15, color: "var(--ink)", lineHeight: 1.6 }}>
        {triage.modelReason}
      </p>

      {routing.instructions?.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 20, color: "var(--ink)", fontSize: 14.5, lineHeight: 1.7 }}>
          {routing.instructions.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}

      {/* On an emergency result the ambulance line and a sayable location code
          matter more than a list of facilities to travel to — so the locator
          comes first, and auto-starts, because at this point the person has
          already told us something urgent is happening. */}
      {triage.level === "emergency" && (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 14,
          background: "var(--emergency-bg)", border: "1px solid var(--emergency-border)",
        }}>
          <EmergencyLocator
            autoStart
            compact
            maternal={Boolean(session.intake?.isPregnantOrPossible)}
            // A disclosure of abuse or self-harm reorders the call buttons to
            // 181, 1098 and Tele-MANAS. An ambulance is not what that person is
            // asking for, and offering it first is a way of not listening.
            safety={Boolean(session.intake?.safetyFlag)}
          />
        </div>
      )}

      {(triage.level === "emergency" || triage.level === "urgent") && (
        <NearbyFacilities compact />
      )}

      {selfCare && (
        <div style={{ marginTop: 14, padding: 14, background: "var(--cream-dim)", borderRadius: 12, fontSize: 14.5, color: "var(--ink)" }}>
          {selfCare.text}
        </div>
      )}

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--rose-deep)" }}>
          {t("result_rules_fired")} ({triage.firedRules.length})
        </summary>
        <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          {triage.firedRules.length === 0 && <li>No red-flag rules fired.</li>}
          {triage.firedRules.map((r) => (
            <li key={r.id}><code>{r.id}</code> — {r.description}</li>
          ))}
          <li style={{ marginTop: 6 }}>
            <strong>{t("result_model_note")}:</strong> rule level "{triage.ruleLevel}" to model level "{triage.modelLevel}" ({triage.modelSource})
          </li>
        </ul>
      </details>

      {routing.needsHumanReview && (
        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--emergency)" }}>
          Confidence was below threshold — this case was automatically escalated for human review.
        </p>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "var(--ink-muted)" }}>{t("result_not_diagnosis")}</p>

      {relatedKnowledge.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--rose-deep)" }}>
            Learn more from trusted sources
          </p>
          {relatedKnowledge.map((k) => (
            <details key={k.id} style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {k.title}
              </summary>
              <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7, marginTop: 6 }}>{k.content}</p>
              <p style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 4 }}>Source: {k.source}</p>
            </details>
          ))}
        </div>
      )}

      <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {/* The report is the better artefact to hand a clinician — it carries
            this result plus everything else, and the entitlements that cover
            whatever it recommends. The bare print stays for anyone who only
            wants this one card. */}
        <Link to="/report" className="btn btn-primary btn-sm">
          <Icon name="report" size={15} /> Add to my health report
        </Link>
        <button type="button" onClick={() => window.print()} className="btn btn-ghost btn-sm">
          <Icon name="printer" size={15} /> Print this result
        </button>
      </div>

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
      <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{label}</span>
      <div style={{ width: 90, height: 6, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--rose)" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--rose-deep)" }}>{pct}%</span>
    </div>
  );
}

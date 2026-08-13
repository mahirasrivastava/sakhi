import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { speak, speechSynthesisSupported } from "../speech.js";

export default function EducationCard({ card }) {
  const { lang } = useLanguage();
  const [expanded, setExpanded] = useState(true);
  const content = card[lang] || card.en;

  return (
    <div className="card" style={{ marginTop: 14, borderLeft: "4px solid var(--rose)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <h3 className="display" style={{ fontSize: 17, color: "var(--rose-deep)", flex: 1 }}>{content.title}</h3>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {speechSynthesisSupported() && (
            <button
              onClick={() => {
                const text = [content.body, ...content.whatToDo].join(". ");
                speak(text, lang);
              }}
              className="btn btn-ghost"
              style={{ padding: "4px 10px", fontSize: 12 }}
              aria-label="Listen to this card"
            >🔊</button>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="btn btn-ghost"
            style={{ padding: "4px 10px", fontSize: 12 }}
          >{expanded ? "Collapse" : "Expand"}</button>
        </div>
      </div>

      {expanded && (
        <>
          <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--ink)", lineHeight: 1.7 }}>{content.body}</p>

          <div style={{ marginTop: 14 }}>
            <p style={sectionHead}>✓ What to do</p>
            <ul style={listStyle}>
              {content.whatToDo.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          {content.doNot?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ ...sectionHead, color: "var(--emergency)" }}>✕ Do not</p>
              <ul style={{ ...listStyle, color: "var(--emergency-ink)" }}>
                {content.doNot.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 14, padding: "8px 12px", background: "var(--cream-dim)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
              Source: {card.source}
            </span>
            {card.sourceUrl && (
              <a href={card.sourceUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11.5, color: "var(--rose-deep)", fontWeight: 600 }}>
                Read original →
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const sectionHead = { fontSize: 13, fontWeight: 700, color: "var(--routine)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.03em" };
const listStyle = { paddingLeft: 20, fontSize: 14, color: "var(--ink)", lineHeight: 1.7, margin: 0 };

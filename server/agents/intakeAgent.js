// intakeAgent.js
// Agent 1. Takes raw form/voice-transcribed input and produces a structured
// intake object. Also runs a keyword-level safety pre-screen: if the free text
// suggests self-harm or abuse, it sets safetyFlag=true so the content is NEVER
// passed to the model layer and is routed to a human path instead.

const SAFETY_KEYWORDS = [
  "suicide", "kill myself", "end my life", "hurt myself", "self harm",
  "being hit", "being abused", "forced", "he hits me", "not safe at home",
];

export function runIntake(raw) {
  const freeText = (raw.freeText || "").toLowerCase();
  const safetyFlag = SAFETY_KEYWORDS.some((kw) => freeText.includes(kw));

  return {
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
    durationDays: Number(raw.durationDays) || 0,
    durationHours: Number(raw.durationHours) || 0,
    severity: Math.min(5, Math.max(1, Number(raw.severity) || 1)),
    freeText: raw.freeText || "",
    isPregnantOrPossible: Boolean(raw.isPregnantOrPossible),
    gestationWeeks: raw.gestationWeeks ?? null,
    anaemiaScreen: raw.anaemiaScreen || null, // { pallorScore, flagged }
    age: raw.age ?? null,
    language: raw.language || "en",
    safetyFlag,
  };
}

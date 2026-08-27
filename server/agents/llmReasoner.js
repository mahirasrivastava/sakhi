// llmReasoner.js
// Compound-pattern reasoning on top of the deterministic rules engine.
//
// The model can only ever RAISE the urgency the rules engine produced — it is
// structurally incapable of lowering it (see enforceEscalateOnly). It never
// diagnoses and never names a drug.
//
// The actual LLM call now goes through ../agents/llmProvider.js, which picks a
// FREE provider (Groq or Gemini) from whatever key is present — no watsonx bill.
// With NO key configured the system runs in rules-only mode and this function is
// a deterministic pass-through. That is a real degraded mode, not a placeholder:
// Sakhi must work with zero keys and ₹0 cost for the demo.

import { higherLevel } from "../rulesEngine.js";
import { chatJSON, isLlmConfigured, activeTextProvider, activeModelIsGranite } from "./llmProvider.js";

export function isConfigured() {
  return isLlmConfigured();
}

const SYSTEM = `You are a triage-support reasoning layer for a rural women's health app.
You NEVER diagnose a disease and you NEVER suggest a drug or treatment.
You only judge whether the COMBINATION of reported symptoms suggests a higher urgency than the rules already found.
You may only answer with one of: self-care, routine, urgent, emergency — and it MUST be EQUAL TO OR HIGHER than the rule-based level given.
Respond with strict JSON only: {"level":"...","reason":"one short plain-language sentence"}`;

function buildUser(intake, ruleResult) {
  return `Rule-based level: ${ruleResult.level}
Rules fired: ${ruleResult.firedRules.map((r) => r.id).join(", ") || "none"}
Reported symptoms: ${intake.symptoms.join(", ")}
Duration (days): ${intake.durationDays}
Severity (1-5): ${intake.severity}
Free text (patient's own words): ${intake.freeText || "(none)"}`;
}

/**
 * Calls the configured free LLM if available; otherwise returns a rules-only
 * pass-through. The result level is ALWAYS clamped to be >= the rule level.
 */
export async function reasonAboutCompoundPatterns(intake, ruleResult) {
  if (intake.safetyFlag) {
    // Never let the model see self-harm / abuse content. Human path only.
    return { level: ruleResult.level, reason: "Routed directly to a human — not passed to the model.", source: "safety-bypass" };
  }

  if (!isLlmConfigured()) {
    return {
      level: ruleResult.level,
      reason: "Rules-only mode (no AI key configured) — decision based entirely on deterministic red-flag rules.",
      source: "rules-only-fallback",
    };
  }

  try {
    const parsed = await chatJSON({ system: SYSTEM, user: buildUser(intake, ruleResult), maxTokens: 160 });
    return {
      level: enforceEscalateOnly(ruleResult.level, String(parsed.level || "").trim()),
      reason: parsed.reason || "Model flagged a compound pattern across reported symptoms.",
      source: `${activeTextProvider() || "llm"}${activeModelIsGranite() ? " (IBM Granite)" : ""}`,
    };
  } catch (err) {
    // Fail safe: any model error falls back to rules-only, never blocks the flow.
    return {
      level: ruleResult.level,
      reason: "AI call failed — fell back to rules-only decision.",
      source: "llm-error-fallback",
    };
  }
}

/** Structural guarantee: the model can only ever raise the level, never lower it. */
export function enforceEscalateOnly(ruleLevel, modelLevel) {
  if (!modelLevel) return ruleLevel;
  return higherLevel(ruleLevel, modelLevel);
}

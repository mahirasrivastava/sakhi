// llmReasoner.js
// Wraps IBM watsonx.ai Granite for compound-pattern reasoning on top of the
// rules engine. This layer can only RAISE the level the rules engine produced —
// it is structurally incapable of lowering it (see enforceEscalateOnly below).
//
// If WATSONX_API_KEY / WATSONX_PROJECT_ID are not set in the environment, the
// system runs in rules-only mode and this function is a deterministic pass-through.
// That's a real degraded mode, not a placeholder — Sakhi must work with zero keys
// for the demo.

import { higherLevel } from "../rulesEngine.js";

const WATSONX_URL = process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com";
const WATSONX_API_KEY = process.env.WATSONX_API_KEY || "";
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || "";

export function isConfigured() {
  return Boolean(WATSONX_API_KEY && WATSONX_PROJECT_ID);
}

function buildPrompt(intake, ruleResult) {
  return `You are a triage-support reasoning layer. You NEVER diagnose a disease and you NEVER suggest a drug.
You only assess whether the combination of reported symptoms suggests a higher urgency than the rules below already found.
You may only respond with one of: self-care, routine, urgent, emergency — and it must be EQUAL TO OR HIGHER than the rule-based level.

Rule-based level: ${ruleResult.level}
Rules fired: ${ruleResult.firedRules.map((r) => r.id).join(", ") || "none"}
Reported symptoms: ${intake.symptoms.join(", ")}
Duration (days): ${intake.durationDays}
Severity (1-5): ${intake.severity}
Free text (patient's own words): ${intake.freeText || "(none)"}

Respond with strict JSON only: {"level": "...", "reason": "one short plain-language sentence"}`;
}

/**
 * Calls watsonx.ai Granite if configured; otherwise returns a rules-only
 * pass-through result. Result is ALWAYS clamped to be >= the rule level.
 */
export async function reasonAboutCompoundPatterns(intake, ruleResult) {
  if (intake.safetyFlag) {
    // Never let the model see self-harm/abuse content. Human path only.
    return { level: ruleResult.level, reason: "Routed directly to a human — not passed to the model.", source: "safety-bypass" };
  }

  if (!isConfigured()) {
    return {
      level: ruleResult.level,
      reason: "Rules-only mode (no model keys configured) — decision based entirely on deterministic red-flag rules.",
      source: "rules-only-fallback",
    };
  }

  try {
    const tokenRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
    });
    const { access_token } = await tokenRes.json();

    const res = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2024-05-01`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        model_id: "ibm/granite-13b-instruct-v2",
        project_id: WATSONX_PROJECT_ID,
        input: buildPrompt(intake, ruleResult),
        parameters: { max_new_tokens: 120, temperature: 0.2 },
      }),
    });
    const data = await res.json();
    const text = data?.results?.[0]?.generated_text || "";
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

    return {
      level: enforceEscalateOnly(ruleResult.level, parsed.level),
      reason: parsed.reason || "Model flagged a compound pattern across reported symptoms.",
      source: "watsonx-granite",
    };
  } catch (err) {
    // Fail safe: any model error falls back to rules-only, never blocks the flow.
    return {
      level: ruleResult.level,
      reason: "Model call failed — fell back to rules-only decision.",
      source: "watsonx-error-fallback",
    };
  }
}

/** Structural guarantee: the model can only ever raise the level, never lower it. */
export function enforceEscalateOnly(ruleLevel, modelLevel) {
  if (!modelLevel) return ruleLevel;
  return higherLevel(ruleLevel, modelLevel);
}

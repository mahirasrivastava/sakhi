// triageAgent.js
// Agent 2. Runs deterministic rules first, then (if configured) asks the model
// layer to reason about compound patterns. The model can only raise the level
// the rules already produced — see llmReasoner.enforceEscalateOnly.

import { runRules } from "../rulesEngine.js";
import { reasonAboutCompoundPatterns } from "./llmReasoner.js";

export async function runTriage(intake) {
  const ruleResult = runRules(intake);
  const modelResult = await reasonAboutCompoundPatterns(intake, ruleResult);

  const finalLevel = modelResult.level; // already clamped >= ruleResult.level

  return {
    level: finalLevel,
    ruleLevel: ruleResult.level,
    modelLevel: modelResult.level,
    modelSource: modelResult.source,
    modelReason: modelResult.reason,
    firedRules: ruleResult.firedRules,
    ruleVersion: ruleResult.ruleVersion,
    confidence: computeConfidence(ruleResult, modelResult),
  };
}

// Simple, explainable confidence heuristic: more rules firing in agreement,
// and rules-only decisions (no model uncertainty layered on top), score higher.
function computeConfidence(ruleResult, modelResult) {
  let score = 0.6;
  score += Math.min(ruleResult.firedRules.length * 0.1, 0.3);
  if (modelResult.source === "rules-only-fallback") score += 0.1;
  if (modelResult.source === "watsonx-error-fallback") score -= 0.15;
  return Math.max(0.3, Math.min(0.98, Number(score.toFixed(2))));
}

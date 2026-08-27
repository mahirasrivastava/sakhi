// scripts/test-llm.js
// Smoke-test whichever FREE AI provider you configured (Groq / Gemini / watsonx).
// Run:  npm run test:llm      (from server/)
//
// It tells you which provider is active, does one real text call, and — if a
// vision provider is set — one tiny image call. Any failure prints the provider
// error verbatim so you know exactly what to fix (bad key vs wrong model id).

import {
  activeTextProvider, activeVisionProvider, isLlmConfigured, isVisionConfigured,
  activeModelIsGranite, chatJSON, visionText,
} from "../agents/llmProvider.js";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);

console.log("\nSakhi — free AI provider check\n");

if (!isLlmConfigured()) {
  bad("No AI provider configured.");
  console.log(`
  The app still runs fine in rules-only mode. To enable AI, set ONE of these in server/.env:

    GROQ_API_KEY=...      (get it free at https://console.groq.com/keys — no card)
    GEMINI_API_KEY=...    (get it free at https://aistudio.google.com/apikey)

  Then run this again.\n`);
  process.exit(1);
}

console.log(`  Active text provider:   ${activeTextProvider()}${activeModelIsGranite() ? "  🧠 running IBM Granite" : ""}`);
console.log(`  Active vision provider: ${activeVisionProvider() || "(none — OCR disabled)"}\n`);

let failed = false;

try {
  const r = await chatJSON({
    system: 'Reply with strict JSON only.',
    user: 'Return {"ok": true, "word": "namaste"} and nothing else.',
    maxTokens: 50,
  });
  if (r && (r.ok === true || r.word)) ok(`Text call works (got: ${JSON.stringify(r)})`);
  else { bad(`Text call returned unexpected JSON: ${JSON.stringify(r)}`); failed = true; }
} catch (err) {
  bad(`Text call failed: ${err.message}`);
  console.log("     → usually a bad API key or a decommissioned model id (update GROQ_MODEL / GEMINI_MODEL).");
  failed = true;
}

if (isVisionConfigured()) {
  // A 1x1 red PNG — just proves the vision path is wired and the model id is valid.
  const RED_DOT_PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  try {
    const t = await visionText({
      prompt: "What colour is this image? One word.",
      imageBase64: RED_DOT_PNG, mimeType: "image/png", maxTokens: 20,
    });
    ok(`Vision call works (got: ${JSON.stringify((t || "").trim().slice(0, 40))})`);
  } catch (err) {
    bad(`Vision call failed: ${err.message}`);
    console.log("     → update GEMINI_VISION_MODEL / GROQ_VISION_MODEL if the model was decommissioned.");
    failed = true;
  }
} else {
  console.log("  (No vision provider — prescription OCR will be disabled. Add GEMINI_API_KEY to enable it.)");
}

console.log(failed ? "\nSome checks failed — see above.\n" : "\nAll good. AI is live and free.\n");
process.exit(failed ? 1 : 0);

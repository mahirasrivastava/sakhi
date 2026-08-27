// scripts/test-watson.js
// A one-shot connectivity check for IBM watsonx.ai Granite.
//
//   npm run test:watson        (from server/)
//   node --env-file-if-exists=.env scripts/test-watson.js
//
// It answers exactly one question — "are my watsonx keys wired correctly?" —
// and prints, in order: whether the env vars are present, whether the IAM token
// exchange works, and whether a tiny generation call comes back. Each step
// fails loudly with the reason, so you find out which half is wrong (key vs
// project id vs region) instead of staring at a silent fallback.

const API_KEY = process.env.WATSONX_API_KEY || "";
const PROJECT_ID = process.env.WATSONX_PROJECT_ID || "";
const URL = process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com";
const MODEL_ID = process.env.WATSONX_MODEL_ID || "ibm/granite-3-8b-instruct";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`\x1b[36m${m}\x1b[0m`);

async function main() {
  info("\n1. Environment variables");
  if (!API_KEY) { bad("WATSONX_API_KEY is not set"); return fail("Set WATSONX_API_KEY in server/.env — see WATSON-SETUP.md"); }
  ok(`WATSONX_API_KEY present (${API_KEY.slice(0, 4)}…${API_KEY.slice(-2)})`);
  if (!PROJECT_ID) { bad("WATSONX_PROJECT_ID is not set"); return fail("Set WATSONX_PROJECT_ID in server/.env — see WATSON-SETUP.md"); }
  ok(`WATSONX_PROJECT_ID present (${PROJECT_ID})`);
  ok(`Region/URL: ${URL}`);
  ok(`Model: ${MODEL_ID}`);

  info("\n2. IAM token exchange (iam.cloud.ibm.com)");
  let token;
  try {
    const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(API_KEY)}`,
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      bad(`IAM rejected the key (HTTP ${res.status})`);
      return fail(data.errorMessage || "The API key is wrong or has been revoked. Create a fresh one in IBM Cloud → Manage → Access (IAM) → API keys.");
    }
    token = data.access_token;
    ok("Got an access token");
  } catch (err) {
    bad("Could not reach IBM IAM");
    return fail(err.message);
  }

  info("\n3. Generation call (watsonx.ai)");
  try {
    const res = await fetch(`${URL}/ml/v1/text/generation?version=2024-05-01`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model_id: MODEL_ID,
        project_id: PROJECT_ID,
        input: "Reply with the single word: OK",
        parameters: { max_new_tokens: 5, temperature: 0 },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      bad(`watsonx rejected the request (HTTP ${res.status})`);
      const msg = data?.errors?.[0]?.message || JSON.stringify(data);
      if (/project/i.test(msg)) return fail(`${msg}\n  → Check WATSONX_PROJECT_ID and that the project has watsonx.ai (not just a plain IBM Cloud project).`);
      if (/model/i.test(msg))   return fail(`${msg}\n  → The model id may be unavailable in this region. Try a different WATSONX_MODEL_ID or region.`);
      if (/region|url/i.test(msg)) return fail(`${msg}\n  → WATSONX_URL region may not match where the project lives.`);
      return fail(msg);
    }
    const text = data?.results?.[0]?.generated_text ?? "(empty)";
    ok(`Model responded: "${text.trim()}"`);
    info("\n\x1b[32mAll good — watsonx.ai is connected. Sakhi will use Granite for triage reasoning.\x1b[0m\n");
  } catch (err) {
    bad("Generation call failed");
    return fail(err.message);
  }
}

function fail(reason) {
  console.log(`\n\x1b[31mFAILED:\x1b[0m ${reason}\n`);
  process.exitCode = 1;
}

main();

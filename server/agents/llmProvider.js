// llmProvider.js
// One small, provider-agnostic wrapper over a chat/vision LLM.
//
// Sakhi must cost ₹0 to run, so the AI layer is pluggable and every supported
// provider has a genuinely FREE path. You pick one by dropping in a key (or, for
// Ollama, by running it locally). With no provider at all, the app runs in
// rules-only mode and every caller falls back cleanly.
//
// IBM Granite is a first-class option here and it is FREE two ways:
//   * huggingface — IBM Granite on Hugging Face's free inference tier (a key,
//     no card). This is the easy "IBM Granite in the cloud" path.
//   * ollama      — IBM Granite running locally via Ollama: no key, no limits,
//     fully offline. OPTIONAL and installed SEPARATELY (`ollama pull granite3.3`);
//     never required to run the app, and only used when LLM_PROVIDER=ollama.
// watsonx is still supported for anyone with IBM credits, but it BILLS per call
// so it is never the default.
//
// Other free options: groq (fastest), gemini (best OCR vision).
//
// MODEL NAMES CHANGE on free tiers. Every model id is an env var with a current
// default; on a "model not found / decommissioned" error, update the matching
// *_MODEL env var — nothing else changes.

// ---------------------------------------------------------------------------
// Provider configuration (all read from the environment)
// ---------------------------------------------------------------------------
const PROVIDER = (process.env.LLM_PROVIDER || "auto").toLowerCase();

// -- Groq (OpenAI-compatible) --
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

// -- Hugging Face (OpenAI-compatible) — free IBM Granite in the cloud --
const HF_API_KEY = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || "";
const HF_BASE_URL = process.env.HF_BASE_URL || "https://router.huggingface.co/v1";
const HF_MODEL = process.env.HF_MODEL || "ibm-granite/granite-3.3-8b-instruct";

// -- Ollama (OpenAI-compatible) — free IBM Granite running locally --
// STRICTLY OPT-IN so a fresh clone never depends on Ollama. It is used ONLY when
// you explicitly ask for it: LLM_PROVIDER=ollama (or USE_OLLAMA=true). Setting
// OLLAMA_MODEL / OLLAMA_BASE_URL merely customizes it and does NOT switch it on,
// so an unset/absent Ollama can never block anyone who cloned the repo.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "granite3.3";
const OLLAMA_ENABLED = PROVIDER === "ollama" || process.env.USE_OLLAMA === "true";

// -- Gemini (its own REST shape; also our preferred OCR vision) --
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || "gemini-2.0-flash-lite";

// -- IBM watsonx (its own REST shape; OPTIONAL, bills per call) --
const WATSONX_URL = process.env.WATSONX_URL || "https://us-south.ml.cloud.ibm.com";
const WATSONX_API_KEY = process.env.WATSONX_API_KEY || "";
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID || "";
const WATSONX_MODEL_ID = process.env.WATSONX_MODEL_ID || "ibm/granite-3-8b-instruct";

// OpenAI-compatible providers share one code path; only the config differs.
const OPENAI_COMPAT = {
  groq: { baseUrl: GROQ_BASE_URL, apiKey: GROQ_API_KEY, model: GROQ_MODEL, visionModel: GROQ_VISION_MODEL, ready: () => Boolean(GROQ_API_KEY) },
  huggingface: { baseUrl: HF_BASE_URL, apiKey: HF_API_KEY, model: HF_MODEL, visionModel: null, ready: () => Boolean(HF_API_KEY) },
  ollama: { baseUrl: OLLAMA_BASE_URL, apiKey: "ollama", model: OLLAMA_MODEL, visionModel: null, ready: () => OLLAMA_ENABLED },
};

// ---------------------------------------------------------------------------
// Which provider answers?  "auto" prefers whatever free option is available.
// ---------------------------------------------------------------------------
export function activeTextProvider() {
  const explicit = ["groq", "huggingface", "ollama", "gemini", "watsonx"];
  if (explicit.includes(PROVIDER)) {
    if (PROVIDER === "gemini") return GEMINI_API_KEY ? "gemini" : null;
    if (PROVIDER === "watsonx") return (WATSONX_API_KEY && WATSONX_PROJECT_ID) ? "watsonx" : null;
    return OPENAI_COMPAT[PROVIDER]?.ready() ? PROVIDER : null;
  }
  // auto — selection PRIORITY (uses the first one that is configured; on a call
  // error every caller already falls back to rules-only):
  //   1) Ollama + IBM Granite   — local, only when explicitly opted in
  //   2) Hugging Face + Granite — the cloud IBM alternative
  //   3) watsonx                — IBM, paid, only if keys are set
  //   4) Groq, then Gemini      — free fallbacks
  //   5) (none configured)      -> null -> rules-only triage
  // TEXT only; OCR vision is chosen separately in activeVisionProvider() (Gemini).
  if (OPENAI_COMPAT.ollama.ready()) return "ollama";             // IBM Granite (local, opt-in)
  if (OPENAI_COMPAT.huggingface.ready()) return "huggingface";   // IBM Granite (cloud)
  if (WATSONX_API_KEY && WATSONX_PROJECT_ID) return "watsonx";   // IBM watsonx (paid)
  if (OPENAI_COMPAT.groq.ready()) return "groq";                 // fallback
  if (GEMINI_API_KEY) return "gemini";                           // fallback
  return null;
}

// Vision (prescription OCR): Gemini preferred (best free handwriting), Groq next.
// IBM Granite text models don't do vision on the free tiers, so OCR stays here.
export function activeVisionProvider() {
  if (GEMINI_API_KEY) return "gemini";
  if (GROQ_API_KEY) return "groq";
  return null;
}

export function isLlmConfigured() { return activeTextProvider() !== null; }
export function isVisionConfigured() { return activeVisionProvider() !== null; }

// True when the active text provider is serving an IBM Granite model — used only
// for honest labelling in logs / the report ("powered by IBM Granite").
export function activeModelIsGranite() {
  const p = activeTextProvider();
  if (p === "watsonx") return WATSONX_MODEL_ID.includes("granite");
  if (p === "huggingface") return HF_MODEL.toLowerCase().includes("granite");
  if (p === "ollama") return OLLAMA_MODEL.toLowerCase().includes("granite");
  return false;
}

function extractJson(text) {
  const s = String(text || "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON in model output");
  return JSON.parse(s.slice(start, end + 1));
}

// ---------------------------------------------------------------------------
// OpenAI-compatible chat (groq / huggingface / ollama)
// ---------------------------------------------------------------------------
async function openaiChat(cfg, { system, user, maxTokens, json }) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: maxTokens || 400,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${cfg.model} ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function geminiChat({ system, user, maxTokens, json }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: (system ? system + "\n\n" : "") + user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens || 400, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

async function watsonxChat({ system, user, maxTokens }) {
  const tokenRes = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_API_KEY}`,
  });
  const { access_token } = await tokenRes.json();
  const res = await fetch(`${WATSONX_URL}/ml/v1/text/generation?version=2024-05-01`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({
      model_id: WATSONX_MODEL_ID,
      project_id: WATSONX_PROJECT_ID,
      input: (system ? system + "\n\n" : "") + user,
      parameters: { max_new_tokens: maxTokens || 400, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`watsonx ${res.status}`);
  const data = await res.json();
  return data?.results?.[0]?.generated_text || "";
}

async function dispatchChat(p, opts) {
  if (OPENAI_COMPAT[p]) return openaiChat(OPENAI_COMPAT[p], opts);
  if (p === "gemini") return geminiChat(opts);
  return watsonxChat(opts);
}

/** Plain text completion. Throws on any provider error (callers fall back). */
export async function chatText({ system, user, maxTokens }) {
  const p = activeTextProvider();
  if (!p) throw new Error("no LLM provider configured");
  return dispatchChat(p, { system, user, maxTokens, json: false });
}

/** JSON completion — returns a parsed object. Throws on error/parse failure. */
export async function chatJSON({ system, user, maxTokens }) {
  const p = activeTextProvider();
  if (!p) throw new Error("no LLM provider configured");
  const text = await dispatchChat(p, { system, user, maxTokens, json: true });
  return extractJson(text);
}

// ---------------------------------------------------------------------------
// Vision (prescription OCR)
// ---------------------------------------------------------------------------
async function groqVision({ prompt, imageBase64, mimeType, maxTokens }) {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      temperature: 0.1,
      max_tokens: maxTokens || 700,
    }),
  });
  if (!res.ok) throw new Error(`groq-vision ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function geminiVision({ prompt, imageBase64, mimeType, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens || 700 },
    }),
  });
  if (!res.ok) throw new Error(`gemini-vision ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

/** Vision → text. Prefers Gemini. Throws if no vision provider configured. */
export async function visionText({ prompt, imageBase64, mimeType, maxTokens }) {
  const p = activeVisionProvider();
  if (!p) throw new Error("no vision provider configured");
  if (p === "gemini") return geminiVision({ prompt, imageBase64, mimeType, maxTokens });
  return groqVision({ prompt, imageBase64, mimeType, maxTokens });
}

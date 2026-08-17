// visionOcr.js
// Cloud OCR for prescriptions — Gemini Vision (default) or Google Cloud Vision.
//
// ---------------------------------------------------------------------------
// WHY THIS REPLACED TESSERACT
// ---------------------------------------------------------------------------
// Tesseract's LSTM recogniser is trained on *rendered text* — books, forms,
// scanned documents. An Indian prescription is close to the worst possible input
// for it, for reasons no amount of preprocessing fixes:
//
//   - It is handwritten, in a hurried clinical hand, often cursive.
//   - Drug names are out-of-vocabulary proper nouns. Tesseract's language model
//     actively hurts here: it nudges an unfamiliar string toward a familiar
//     English word, so "Ranitidine" comes back "Rantidine" or "Rank tide".
//   - Dosage notation is symbolic, not lexical — "1-0-1", "T.D.S.", "OD", "HS",
//     "q.i.d.", "×5d". Tesseract has no concept of these and mangles them.
//   - Layout is two-column with a letterhead, a Rx glyph, and a signature.
//
// So the previous work — downscaling, Otsu binarisation, contrast stretching —
// made Tesseract *faster* but could not make it *accurate*, because the ceiling
// was the model, not the pixels. A vision-language model reads a prescription
// the way a pharmacist does: it uses the fact that it is a prescription. It
// knows "Tab. Ferrous Ascorbate 100mg" is a plausible line and "Tab Ferrons
// Ascorbcte lOOrng" is not, and it can return structure rather than a flat
// string that then has to be regex-parsed.
//
// ---------------------------------------------------------------------------
// PRIVACY — THIS IS A REAL CHANGE, AND IT IS NOT HIDDEN FROM THE USER
// ---------------------------------------------------------------------------
// Tesseract ran in the browser and the photograph never left the phone. These
// providers are network services: the image is transmitted to Google and
// processed there. A prescription carries a name, a doctor, a facility and a
// diagnosis, and for the women this app is built for, a diagnosis can be
// dangerous information in the wrong hands.
//
// That trade is the operator's to make, not something to bury. So:
//   - The client states plainly, BEFORE the file picker, where the image goes.
//   - The image is never written to disk here and never logged.
//   - It is forwarded once and held only in memory for that request.
//   - Tesseract remains available as an explicit on-device fallback, and is
//     used automatically whenever no key is configured.
//
// If you are deploying this for real, read your provider's data-retention terms
// and set the client's disclosure text to match them.

const PROVIDER = (process.env.OCR_PROVIDER || "gemini").toLowerCase();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
// Flash rather than Pro: prescription reading is a short, highly constrained
// extraction, and the accuracy difference on this task does not justify the
// latency for someone on a rural connection. Override if you disagree.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GCV_API_KEY = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY || "";

const TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 25000);

export const PROVIDERS = {
  gemini: {
    id: "gemini",
    engine: "Google Gemini Vision",
    model: GEMINI_MODEL,
    mode: "Multimodal VLM · structured JSON extraction",
    where: "Image is sent to Google's Gemini API and processed there.",
    strength: "Reads handwriting and understands dosage notation; returns structure, not a flat string.",
  },
  gcv: {
    id: "gcv",
    engine: "Google Cloud Vision",
    model: "DOCUMENT_TEXT_DETECTION",
    mode: "Dense document OCR",
    where: "Image is sent to the Google Cloud Vision API and processed there.",
    strength: "Very strong on printed and typed prescriptions; weaker on cursive handwriting.",
  },
  tesseract: {
    id: "tesseract",
    engine: "Tesseract 5 (WebAssembly)",
    model: "eng.traineddata — LSTM, fast build",
    mode: "OEM 1 / PSM 6, on-device",
    where: "Runs in the browser. The image never leaves the phone.",
    strength: "Private and offline. Struggles badly with handwriting.",
  },
};

/** Which provider is actually usable right now. */
export function activeProvider() {
  if (PROVIDER === "gemini" && GEMINI_API_KEY) return "gemini";
  if (PROVIDER === "gcv" && GCV_API_KEY) return "gcv";
  // Configured provider has no key — try the other before giving up, so a
  // deployment that set only one key still gets cloud OCR.
  if (GEMINI_API_KEY) return "gemini";
  if (GCV_API_KEY) return "gcv";
  return null;
}

export function isConfigured() {
  return activeProvider() !== null;
}

/** What the client needs to decide which path to take and what to tell the user. */
export function ocrStatus() {
  const active = activeProvider();
  return {
    configured: active !== null,
    provider: active || "tesseract",
    ...(PROVIDERS[active || "tesseract"]),
    fallback: PROVIDERS.tesseract,
  };
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

// Written to fight the two failure modes that matter clinically.
//
// The first is INVENTION. A language model asked to read a blurred drug name
// will happily produce a plausible one, and a plausible wrong drug name is far
// more dangerous than a blank — it looks right, so nobody checks it. Hence the
// explicit instruction to leave a field null and to mark the line uncertain
// rather than guess, and the per-medicine `legible` flag the client surfaces.
//
// The second is HELPFULNESS. A vision model asked about a prescription tends to
// volunteer advice: what the drug is for, whether the dose looks right, what to
// do about side effects. That is unlicensed medical advice generated from a
// photograph of unknown provenance, and this app must not carry it. The model's
// job stops at transcription; interpretation stays in the deterministic code in
// routes/prescriptions.js, which is auditable.
const GEMINI_PROMPT = `You are a careful transcription assistant reading a photograph of a medical prescription from India. You transcribe only. You do not interpret, diagnose, or advise.

Return STRICT JSON matching this shape and nothing else:
{
  "rawText": "every line of text you can read, in reading order, newline separated",
  "medicines": [
    {
      "name": "drug name exactly as written, expanded from abbreviation only if unambiguous",
      "strength": "e.g. 500mg, 10ml, or null if not written",
      "form": "tablet | capsule | syrup | injection | drops | cream | inhaler | other | null",
      "frequency": "as written, e.g. 1-0-1, TDS, OD, BD, HS, or null",
      "duration": "e.g. 5 days, 1 month, or null",
      "legible": true
    }
  ],
  "handwritten": true,
  "quality": "good | fair | poor",
  "notes": "only observations about legibility, never medical advice"
}

Rules you must follow:
- Transcribe what is written. Never infer a drug that is not on the page.
- If a name is partly illegible, give your best reading, set "legible" to false, and do not silently correct it.
- If a field is not written on the prescription, use null. Do not fill gaps with typical values.
- Indian brand names are common (Dolo, Shelcal, Zincovit, Livogen, Orofer). Prefer the exact brand as written over a generic substitution.
- Preserve dosage notation exactly: 1-0-1, 0-0-1, TDS, BD, OD, SOS, HS, STAT, q.i.d.
- Do not include the doctor's name, registration number, patient name, or address in "medicines".
- If the image is not a prescription, return empty "medicines" and say so in "notes".
- Output JSON only. No markdown fences, no commentary.`;

async function readWithGemini(base64, mimeType) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header rather than a query parameter: a key in a URL ends up in proxy
      // logs and error reports.
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: GEMINI_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        // Transcription is not a creative task. Any temperature above zero is
        // literally asking the model to sometimes pick the less likely reading
        // of a drug name.
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
      // The image is a medical document; the default safety filters can trip on
      // clinical content and return an empty candidate with no useful error.
      safetySettings: [
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
      ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
    }),
  });

  if (!res.ok) {
    const detail = await safeErrorBody(res);
    throw new OcrError(`Gemini returned ${res.status}`, res.status, detail);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];

  if (!candidate || candidate.finishReason === "SAFETY") {
    throw new OcrError("The image was blocked by the provider's content filter.", 422);
  }

  const text = candidate.content?.parts?.map((p) => p.text).join("") || "";
  const parsed = parseJsonLoosely(text);
  if (!parsed) throw new OcrError("The provider returned a response that could not be parsed.", 502);

  const medicines = Array.isArray(parsed.medicines) ? parsed.medicines : [];

  return {
    // rawText is what the downstream analyser matches on, so the structured
    // names are appended to it. If the model read a name into `medicines` but
    // the flat transcription garbled it, the good reading still reaches the
    // matcher.
    text: [parsed.rawText || "", ...medicines.map(formatMedicineLine)]
      .filter(Boolean)
      .join("\n"),
    medicines: medicines.map(normaliseMedicine),
    handwritten: Boolean(parsed.handwritten),
    quality: ["good", "fair", "poor"].includes(parsed.quality) ? parsed.quality : null,
    notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 400) : null,
    provider: "gemini",
    model: GEMINI_MODEL,
  };
}

function formatMedicineLine(m) {
  return [m?.name, m?.strength, m?.form, m?.frequency, m?.duration]
    .filter((v) => typeof v === "string" && v.trim())
    .join(" ");
}

function normaliseMedicine(m) {
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : null);
  return {
    name: str(m?.name),
    strength: str(m?.strength),
    form: str(m?.form),
    frequency: str(m?.frequency),
    duration: str(m?.duration),
    // Absent flag means legible — but an explicit false must survive.
    legible: m?.legible !== false,
  };
}

// ---------------------------------------------------------------------------
// Google Cloud Vision
// ---------------------------------------------------------------------------

async function readWithCloudVision(base64) {
  const res = await fetchWithTimeout(
    "https://vision.googleapis.com/v1/images:annotate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GCV_API_KEY },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          // DOCUMENT_TEXT_DETECTION, not TEXT_DETECTION: the former runs dense
          // document analysis with block/paragraph structure, which is what a
          // prescription is. TEXT_DETECTION is tuned for signage and photos of
          // scenes and scatters a form into unordered fragments.
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["en", "hi"] },
        }],
      }),
    }
  );

  if (!res.ok) {
    const detail = await safeErrorBody(res);
    throw new OcrError(`Cloud Vision returned ${res.status}`, res.status, detail);
  }

  const data = await res.json();
  const result = data.responses?.[0];
  if (result?.error) throw new OcrError(result.error.message || "Cloud Vision error", 502);

  const annotation = result?.fullTextAnnotation;

  return {
    text: annotation?.text || "",
    // Cloud Vision returns text, not structure. Leaving this empty is honest —
    // the downstream matcher in routes/prescriptions.js handles flat text, and
    // fabricating structure here would misrepresent where it came from.
    medicines: [],
    handwritten: null,
    quality: null,
    notes: null,
    provider: "gcv",
    model: "DOCUMENT_TEXT_DETECTION",
    confidence: averageConfidence(annotation),
  };
}

function averageConfidence(annotation) {
  const pages = annotation?.pages || [];
  const values = pages.map((p) => p.confidence).filter((c) => typeof c === "number");
  if (!values.length) return null;
  return Number((values.reduce((a, v) => a + v, 0) / values.length).toFixed(3));
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export class OcrError extends Error {
  constructor(message, status = 502, detail = null) {
    super(message);
    this.name = "OcrError";
    this.status = status;
    this.detail = detail;
  }
}

async function fetchOnce(url, options) {
  // A rural connection that stalls must fail in seconds, not hang the request
  // until the platform's own timeout kills it with no message for the user.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new OcrError("The reading service did not respond in time.", 504);
    }
    throw new OcrError("Could not reach the reading service.", 502);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retries transient failures.
 *
 * Only 429 and 5xx, and only twice. A 400 (bad key, bad request) will fail
 * identically forever, and retrying it just makes the user wait three times as
 * long for the same error — while a rate-limit or a cold upstream usually clears
 * within a second. Backoff is exponential with jitter so that a burst of users
 * hitting a rate limit does not retry in lockstep and re-trip it.
 */
async function fetchWithTimeout(url, options, attempt = 0) {
  const MAX_ATTEMPTS = 3;
  try {
    const res = await fetchOnce(url, options);
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS - 1) {
      const wait = 400 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
      return fetchWithTimeout(url, options, attempt + 1);
    }
    return res;
  } catch (err) {
    // A timeout or a dropped socket is worth one more try; a hard failure on the
    // last attempt propagates so the client can fall back to on-device.
    if (err instanceof OcrError && err.status >= 502 && attempt < MAX_ATTEMPTS - 1) {
      const wait = 400 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
      return fetchWithTimeout(url, options, attempt + 1);
    }
    throw err;
  }
}

/** Reads an error body without ever letting it throw over the real failure. */
async function safeErrorBody(res) {
  try {
    const body = await res.json();
    return body?.error?.message?.slice(0, 300) || null;
  } catch {
    return null;
  }
}

/**
 * Tolerant JSON parse.
 *
 * responseMimeType: "application/json" makes bare JSON the norm, but models
 * still occasionally wrap output in ```json fences. Failing the whole read over
 * three backticks would be a poor trade.
 */
function parseJsonLoosely(text) {
  const trimmed = String(text || "").trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  ];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") return parsed;
    } catch { /* try the next shape */ }
  }
  return null;
}

/**
 * Reads a prescription image.
 *
 * @param {string} base64    image bytes, base64, no data: prefix
 * @param {string} mimeType  image/jpeg | image/png | image/webp | image/heic
 */
export async function readPrescriptionImage(base64, mimeType = "image/jpeg") {
  const provider = activeProvider();
  if (!provider) {
    throw new OcrError(
      "No cloud OCR key is configured on the server. The app will read the image on your device instead.",
      503
    );
  }

  const startedAt = Date.now();
  const result = provider === "gcv"
    ? await readWithCloudVision(base64)
    : await readWithGemini(base64, mimeType);

  return { ...result, ms: Date.now() - startedAt };
}

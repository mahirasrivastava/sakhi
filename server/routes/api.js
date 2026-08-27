import { Router } from "express";
import { runSession } from "../orchestrator.js";
import {
  getSessions, getSessionById, deleteSession, getImpactStats, redactForList,
} from "../store.js";
import {
  analyzePallor, SYMPTOM_OPTIONS as ANAEMIA_SYMPTOMS, RISK_OPTIONS as ANAEMIA_RISKS,
} from "./anaemia.js";
import { retrieveEducation, getCorpusSize } from "../vectorStore.js";
import { visionText, isVisionConfigured, activeVisionProvider, chatJSON, isLlmConfigured, activeTextProvider } from "../agents/llmProvider.js";
import {
  requireAuth, requireCsrf, noStore, optionalAuth, inputSanitizer,
} from "../security/middleware.js";
import { verifyAccountPassword } from "../security/accounts.js";
import { audit, AUDIT } from "../security/audit.js";

const router = Router();

// ---------------------------------------------------------------------------
// PUBLIC — the patient-facing flow. Anonymous by design: a girl checking a
// symptom must never need an account, because needing one is the thing that
// stops her asking.
// ---------------------------------------------------------------------------

// POST /api/triage — run a full intake -> triage -> routing session
router.post("/triage", inputSanitizer, async (req, res) => {
  try {
    const session = await runSession(req.body || {});
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Triage failed. Please try again." });
  }
});

// POST /api/navigate — Sakhi Navigator: triage + education cards from trusted sources
router.post("/navigate", inputSanitizer, async (req, res) => {
  try {
    const session = await runSession(req.body || {});
    const educationCards = retrieveEducation(
      req.body.symptoms || [],
      req.body.freeText || "",
      3
    );
    res.json({ ...session, educationCards, corpusSize: getCorpusSize() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Navigation failed. Please try again." });
  }
});

// POST /api/anaemia-screen — conjunctival pallor screen.
//
// Takes a flat array of sampled {r,g,b} pixels. No image is stored, and none is
// ever received: the client crops and samples on the device, so what arrives is
// aggregate colour data that cannot be reassembled into a photograph of anyone.
const MIN_SAMPLE_PIXELS = 30;
const MAX_SAMPLE_PIXELS = 5000;

// Pixels arrive from a canvas, so they are trusted only after being checked
// into range. A crafted payload must not reach the arithmetic as NaN, as a
// negative, or as a value that would skew a mean past what a sensor can emit.
function validatePixels(raw) {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Expected `pixels` to be an array of {r, g, b} samples." };
  }
  if (raw.length < MIN_SAMPLE_PIXELS) {
    return {
      ok: false,
      error: `Not enough pixel data — got ${raw.length}, need at least ${MIN_SAMPLE_PIXELS}. Move closer and try again.`,
    };
  }
  if (raw.length > MAX_SAMPLE_PIXELS) {
    return {
      ok: false,
      error: `Too much pixel data — got ${raw.length}, the maximum is ${MAX_SAMPLE_PIXELS}.`,
    };
  }

  const pixels = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!p || typeof p !== "object") {
      return { ok: false, error: `Pixel ${i} is not an object with r, g and b.` };
    }
    const { r, g, b } = p;
    if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
      return { ok: false, error: `Pixel ${i} must have numeric r, g and b values.` };
    }
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
      return { ok: false, error: `Pixel ${i} has a non-finite channel value.` };
    }
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      return { ok: false, error: `Pixel ${i} has a channel outside 0-255.` };
    }
    pixels[i] = { r, g, b };
  }

  return { ok: true, pixels };
}

router.post("/anaemia-screen", (req, res) => {
  try {
    const validation = validatePixels(req.body?.pixels);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const result = analyzePallor(validation.pixels);

    // A capture that failed the quality gate is a client-correctable problem,
    // not a server error — 422 so the UI can tell them what to fix.
    if (result.rejected) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("[anaemia]", err?.message);
    res.status(500).json({ error: "Anaemia screen failed." });
  }
});

// GET /api/anaemia-screen/questions — drives the checklist, so the labels and
// the scoring weights can never drift apart.
router.get("/anaemia-screen/questions", (req, res) => {
  res.json({ symptoms: ANAEMIA_SYMPTOMS, risks: ANAEMIA_RISKS });
});

// GET /api/impact — aggregate counts only, no per-person data. Stays public so
// the Impact page works for anyone, but what it shows depends on who is asking.
//
// The total is a reach number and is safe to publish. The per-level breakdown
// is not: in a village served by one sub-centre, "3 emergencies this week" is a
// small enough number to be matched against who was seen going to the clinic.
// Aggregates stop protecting anyone once the denominator is a hamlet, so the
// breakdown is shown only to a signed-in worker, who can see the underlying
// records anyway.
router.get("/impact", optionalAuth, async (req, res) => {
  try {
    const stats = await getImpactStats();
    if (!req.auth) return res.json({ totalSessions: stats.totalSessions });
    res.json(stats);
  } catch (err) {
    console.error("[impact]", err?.message);
    res.status(500).json({ error: "Could not load impact statistics." });
  }
});

// ---------------------------------------------------------------------------
// RESTRICTED — everything below reads or destroys identifiable health records
// belonging to (often underage) patients. Authenticated ASHA workers only, and
// every access is written to the audit trail.
// ---------------------------------------------------------------------------


// POST /api/prescription/read — read a photographed prescription with a FREE
// vision model (Gemini/Groq). Deliberately NOT plain OCR: doctor handwriting
// defeats Tesseract, and a wrong drug name is dangerous. A vision LLM reads it,
// marks its own confidence, and the RESULT IS NEVER AUTO-TRUSTED — the client
// forces the patient to confirm every line against the doctor/pharmacist.
//
// Privacy: the photo is analysed in-request and never stored. It does leave the
// device (unlike the anaemia pixels), so the client says so before uploading.
router.post("/prescription/read", inputSanitizer, async (req, res) => {
  if (!isVisionConfigured()) {
    return res.status(503).json({
      error: "Prescription reading is not enabled. Set GEMINI_API_KEY (free) in the server .env to turn it on.",
      reason: "no_vision_provider",
    });
  }

  const imageBase64 = String(req.body?.imageBase64 || "").replace(/^data:[^,]+,/, "");
  const mimeType = String(req.body?.mimeType || "image/jpeg");
  if (!imageBase64 || imageBase64.length < 100) {
    return res.status(400).json({ error: "No image received. Please take or choose a clearer photo." });
  }
  if (imageBase64.length > 2_400_000) {
    return res.status(413).json({ error: "That photo is too large. The app should shrink it first — try again." });
  }

  const prompt = [
    "You are transcribing a photographed medical prescription for a patient in rural India.",
    "Transcribe ONLY what is actually written. Do NOT guess or complete a medicine name you cannot read.",
    "Return STRICT JSON only, no prose, in exactly this shape:",
    '{"legibleText":"<best transcription of all visible text>",',
    ' "items":[{"medicine":"<name as written>","strength":"<e.g. 500mg, or empty>","frequency":"<e.g. 1-0-1, or empty>","duration":"<e.g. 5 days, or empty>","confidence":"high|medium|low"}],',
    ' "unreadable": <true if large parts are illegible>,',
    ' "notes":"<anything the patient should double-check>"}',
    "Mark any item you are unsure about as \"low\". Leave a field \"\" if you cannot read it. NEVER invent a dosage.",
  ].join("\n");

  try {
    const raw = await visionText({ prompt, imageBase64, mimeType, maxTokens: 800 });
    let parsed;
    try {
      const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
      parsed = JSON.parse(raw.slice(a, b + 1));
    } catch {
      // Model didn't return clean JSON — hand back the raw text so nothing is lost.
      parsed = { legibleText: raw, items: [], unreadable: true, notes: "" };
    }
    res.json({
      ok: true,
      source: activeVisionProvider(),
      legibleText: parsed.legibleText || "",
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [],
      unreadable: Boolean(parsed.unreadable),
      notes: parsed.notes || "",
      // The client must show this. The reading is an aid, never an instruction.
      disclaimer: "This is a best-effort AI reading and can be wrong. Confirm every medicine, strength and dose with your doctor or pharmacist before taking anything.",
    });
  } catch (err) {
    console.error("[prescription]", err?.message);
    res.status(502).json({ error: "Could not read the prescription right now. Please try again, or ask your pharmacist." });
  }
});


// POST /api/report/summarize — turn the collected self-check into a short,
// plain-language summary + next steps, written by the FREE LLM. It NEVER
// diagnoses and NEVER names a medicine; it is guidance to take to a health
// worker, printed alongside the raw findings. Free, optional, rules still stand.
router.post("/report/summarize", inputSanitizer, async (req, res) => {
  if (!isLlmConfigured()) {
    return res.status(503).json({
      error: "AI summary isn't enabled. Set GROQ_API_KEY or GEMINI_API_KEY (free) in the server .env.",
      reason: "no_llm_provider",
    });
  }
  const context = String(req.body?.context || "").slice(0, 4000);
  if (!context.trim()) return res.status(400).json({ error: "Nothing to summarize yet." });

  const system = [
    "You write a SHORT, plain-language summary of a health self-check for a woman in rural India to hand to an ASHA worker or doctor.",
    "Use very simple words a non-native English reader understands. Be warm and calm.",
    "You must NOT diagnose a disease. You must NOT name or suggest any medicine or treatment.",
    "If anything looks urgent, gently say to see a health worker soon.",
    'Respond with STRICT JSON only: {"summary":"2 to 3 short sentences","nextSteps":["short step","short step","short step"]}',
  ].join(" ");

  try {
    const parsed = await chatJSON({ system, user: `Self-check findings:\n${context}`, maxTokens: 320 });
    res.json({
      ok: true,
      source: activeTextProvider(),
      summary: String(parsed.summary || "").slice(0, 700),
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 6).map((x) => String(x).slice(0, 160)) : [],
      disclaimer: "This summary is written by AI to help you talk to a health worker. It is not a diagnosis.",
    });
  } catch (err) {
    console.error("[report-summary]", err?.message);
    res.status(502).json({ error: "Could not write the summary right now. Please try again." });
  }
});

router.use("/sessions", noStore, requireAuth, requireCsrf);

// GET /api/sessions — the ASHA/clinician triage queue, redacted.
router.get("/sessions", async (req, res) => {
  const { level, ashaAlert } = req.query;
  try {
    const rows = (await getSessions({ level, ashaAlert })).map(redactForList);
    audit(AUDIT.LIST_SESSIONS, {
      req,
      actor: req.auth.workerId,
      outcome: "ok",
      meta: { count: rows.length, filters: { level: level || null, ashaAlert: ashaAlert ?? null } },
    });
    res.json(rows);
  } catch (err) {
    // Audited as an error rather than swallowed: a worker who cannot see the
    // queue needs to know the queue is broken, not assume it is empty.
    audit(AUDIT.LIST_SESSIONS, {
      req, actor: req.auth.workerId, outcome: "error", reason: "store_unavailable",
    });
    console.error("[sessions]", err?.message);
    res.status(503).json({ error: "The queue is unavailable right now. Please retry." });
  }
});

// GET /api/sessions/:id — the full record, including the patient's own words.
// This is the narrow, audited door to sensitive content.
router.get("/sessions/:id", async (req, res) => {
  let session;
  try {
    session = await getSessionById(req.params.id);
  } catch (err) {
    audit(AUDIT.READ_SESSION, {
      req, actor: req.auth.workerId, targetId: req.params.id, outcome: "error", reason: "store_unavailable",
    });
    console.error("[session]", err?.message);
    return res.status(503).json({ error: "That record is unavailable right now. Please retry." });
  }
  if (!session) {
    audit(AUDIT.READ_SESSION, {
      req, actor: req.auth.workerId, targetId: req.params.id, outcome: "denied", reason: "not_found",
    });
    return res.status(404).json({ error: "Session not found." });
  }
  audit(AUDIT.READ_SESSION, { req, actor: req.auth.workerId, targetId: session.id, outcome: "ok" });
  res.json(session);
});

// DELETE /api/sessions/:id — the patient's right to erasure, exercised by staff.
// Irreversible, so it requires the worker's password again (step-up): a walked-away
// tablet with a live session cannot be used to wipe the queue.
router.delete("/sessions/:id", async (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    return res.status(400).json({ error: "Confirm your password to delete this record.", reason: "reauth_required" });
  }

  const ok = await verifyAccountPassword(req.auth.workerId, password);
  if (!ok) {
    audit(AUDIT.DELETE_DENIED, {
      req, actor: req.auth.workerId, targetId: req.params.id, outcome: "denied", reason: "reauth_failed",
    });
    return res.status(401).json({ error: "Password confirmation failed.", reason: "reauth_failed" });
  }

  let deleted;
  try {
    deleted = await deleteSession(req.params.id);
  } catch (err) {
    audit(AUDIT.DELETE_SESSION, {
      req, actor: req.auth.workerId, targetId: req.params.id, outcome: "error", reason: "store_unavailable",
    });
    console.error("[delete]", err?.message);
    return res.status(503).json({ error: "Could not delete that record right now. Please retry." });
  }
  if (!deleted) {
    audit(AUDIT.DELETE_SESSION, {
      req, actor: req.auth.workerId, targetId: req.params.id, outcome: "denied", reason: "not_found",
    });
    return res.status(404).json({ error: "Session not found." });
  }

  audit(AUDIT.DELETE_SESSION, { req, actor: req.auth.workerId, targetId: req.params.id, outcome: "ok" });
  res.json({ deleted: true });
});

export default router;

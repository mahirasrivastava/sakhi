import { Router } from "express";
import { runSession } from "../orchestrator.js";
import {
  getSessions, getSessionById, deleteSession, getImpactStats, redactForList,
} from "../store.js";
import {
  analyzePallor, SYMPTOM_OPTIONS as ANAEMIA_SYMPTOMS, RISK_OPTIONS as ANAEMIA_RISKS,
} from "./anaemia.js";
import { retrieveEducation, getCorpusSize } from "../vectorStore.js";
import { requireAuth, requireCsrf, noStore } from "../security/middleware.js";
import { verifyAccountPassword } from "../security/accounts.js";
import { audit, AUDIT } from "../security/audit.js";

const router = Router();

// ---------------------------------------------------------------------------
// PUBLIC — the patient-facing flow. Anonymous by design: a girl checking a
// symptom must never need an account, because needing one is the thing that
// stops her asking.
// ---------------------------------------------------------------------------

// POST /api/triage — run a full intake -> triage -> routing session
router.post("/triage", async (req, res) => {
  try {
    const session = await runSession(req.body || {});
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Triage failed. Please try again." });
  }
});

// POST /api/navigate — Sakhi Navigator: triage + education cards from trusted sources
router.post("/navigate", async (req, res) => {
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
// Accepts a burst of frames plus a wide reference sample used for white
// balance. The single-array `pixels` form from the older client still works.
// No image is stored: pixels are scored in-process and discarded.
const MAX_FRAMES = 8;
const MAX_PIXELS_PER_FRAME = 12000;
const MAX_REFERENCE_PIXELS = 4000;

// Pixel arrays arrive from a canvas, so entries are trusted only after being
// coerced into finite 0-255 numbers — a crafted payload must not reach the
// maths as NaN or a huge value.
function sanitizePixels(raw, limit) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw.slice(0, limit)) {
    if (!p || typeof p !== "object") continue;
    const r = Number(p.r), g = Number(p.g), b = Number(p.b);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    out.push({
      r: Math.max(0, Math.min(255, r)),
      g: Math.max(0, Math.min(255, g)),
      b: Math.max(0, Math.min(255, b)),
    });
  }
  return out;
}

router.post("/anaemia-screen", (req, res) => {
  try {
    const body = req.body || {};

    const rawFrames = Array.isArray(body.frames) && body.frames.length
      ? body.frames.slice(0, MAX_FRAMES)
      : [body.pixels];

    const frames = rawFrames
      .map((f) => sanitizePixels(f, MAX_PIXELS_PER_FRAME))
      .filter((f) => f.length > 0);

    if (frames.length === 0) {
      return res.status(400).json({ error: "No pixel data received." });
    }

    const focusScore = Number.isFinite(Number(body.focusScore))
      ? Number(body.focusScore)
      : undefined;

    // The checklist answers. Filtered against the server's own option lists so
    // an arbitrary string in the payload cannot reach the scoring tables.
    const validSymptoms = new Set(ANAEMIA_SYMPTOMS.map((o) => o.id));
    const validRisks = new Set(ANAEMIA_RISKS.map((o) => o.id));
    const symptoms = Array.isArray(body.symptoms)
      ? body.symptoms.filter((s) => validSymptoms.has(s))
      : [];
    const risks = Array.isArray(body.risks)
      ? body.risks.filter((r) => validRisks.has(r))
      : [];

    const result = analyzePallor({
      frames,
      reference: sanitizePixels(body.reference, MAX_REFERENCE_PIXELS),
      focusScore,
      symptoms,
      risks,
    });

    // A capture that failed the quality gate is a client-correctable problem,
    // not a server error — 422 so the UI can tell them what to fix.
    if (!result.ok) return res.status(422).json(result);
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
// the Impact page works for anyone.
router.get("/impact", (req, res) => {
  res.json(getImpactStats());
});

// ---------------------------------------------------------------------------
// RESTRICTED — everything below reads or destroys identifiable health records
// belonging to (often underage) patients. Authenticated ASHA workers only, and
// every access is written to the audit trail.
// ---------------------------------------------------------------------------

router.use("/sessions", noStore, requireAuth, requireCsrf);

// GET /api/sessions — the ASHA/clinician triage queue, redacted.
router.get("/sessions", (req, res) => {
  const { level, ashaAlert } = req.query;
  const rows = getSessions({ level, ashaAlert }).map(redactForList);
  audit(AUDIT.LIST_SESSIONS, {
    req,
    actor: req.auth.workerId,
    outcome: "ok",
    meta: { count: rows.length, filters: { level: level || null, ashaAlert: ashaAlert ?? null } },
  });
  res.json(rows);
});

// GET /api/sessions/:id — the full record, including the patient's own words.
// This is the narrow, audited door to sensitive content.
router.get("/sessions/:id", (req, res) => {
  const session = getSessionById(req.params.id);
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

  const deleted = deleteSession(req.params.id);
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

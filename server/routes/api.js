import { Router } from "express";
import { runSession } from "../orchestrator.js";
import { getSessions, getSessionById, deleteSession, getImpactStats } from "../store.js";
import { analyzePallor } from "./anaemia.js";

const router = Router();

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

// POST /api/anaemia-screen — pallor score from an eyelid photo (base64 canvas data)
router.post("/anaemia-screen", (req, res) => {
  try {
    const { pixels } = req.body; // array of {r,g,b} sampled from the client canvas
    if (!Array.isArray(pixels) || pixels.length === 0) {
      return res.status(400).json({ error: "No pixel data received." });
    }
    const result = analyzePallor(pixels);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Anaemia screen failed." });
  }
});

// GET /api/sessions — for the ASHA/clinician dashboard
router.get("/sessions", (req, res) => {
  const { level, ashaAlert } = req.query;
  res.json(getSessions({ level, ashaAlert }));
});

router.get("/sessions/:id", (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found." });
  res.json(session);
});

// DELETE /api/sessions/:id — patient's right to delete their data
router.delete("/sessions/:id", (req, res) => {
  const ok = deleteSession(req.params.id);
  if (!ok) return res.status(404).json({ error: "Session not found." });
  res.json({ deleted: true });
});

// GET /api/impact — live counter + stats for the Impact page
router.get("/impact", (req, res) => {
  res.json(getImpactStats());
});

export default router;

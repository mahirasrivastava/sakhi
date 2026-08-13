// routes/prescriptions.js
// Reads OCR'd prescription text and reports what it implies.
//
// PRIVACY
// The image never reaches this server. OCR runs in the browser (tesseract.js),
// and only the extracted text is posted here. Nothing is written to disk: the
// text is analysed in-process and discarded when the response is sent. That is
// the point — a prescription is among the most identifying health documents a
// person has, and this app's whole premise is that a girl can use it without
// creating a record of herself anywhere.
//
// SAFETY
// The analysis never tells anyone to start, stop or change a medicine. It says
// what a medicine is usually for, what conditions are worth asking about
// alongside it, and what to raise with a clinician.

import { Router } from "express";
import {
  MEDICINES, CONDITIONS, FAMILY_RISK, FAMILY_HISTORY_OPTIONS,
} from "../knowledge/medicines.js";

const router = Router();

const MAX_TEXT = 20000;

// OCR of a handwritten or faxed prescription is noisy. Normalising aggressively
// before matching recovers a lot of otherwise-missed names.
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    // Common OCR confusions in drug names printed in small type.
    .replace(/[0O]/g, "o")
    .replace(/[1l|]/g, "l")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerm(term) {
  return normalize(term);
}

/**
 * Finds medicine names in the text.
 *
 * Matching is on word boundaries over the normalised string, so "pan" matches
 * the brand Pan but not "panic", and a brand hit records which term matched so
 * the UI can show the user why something was detected.
 */
function detectMedicines(rawText) {
  const haystack = ` ${normalize(rawText)} `;
  const found = [];

  for (const med of MEDICINES) {
    const matched = [];
    for (const term of [...med.generics, ...med.brands]) {
      const needle = normalizeTerm(term);
      if (needle.length < 3) continue;
      if (haystack.includes(` ${needle} `) || haystack.includes(` ${needle}`)) {
        // Require a word boundary on the left to avoid substring accidents.
        const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
        if (re.test(haystack)) matched.push(term);
      }
    }
    if (matched.length > 0) {
      found.push({
        id: med.id,
        label: med.label,
        matchedOn: [...new Set(matched)],
        conditions: med.conditions,
        note: med.note || null,
        pregnancyWarning: med.pregnancyWarning || null,
      });
    }
  }
  return found;
}

/** Conditions implied by the detected medicines, with what pointed at each. */
function impliedConditions(medicines, { isPregnantOrPossible = false } = {}) {
  const map = new Map();
  for (const med of medicines) {
    for (const cid of med.conditions) {
      if (!CONDITIONS[cid]) continue;
      if (!map.has(cid)) {
        map.set(cid, { id: cid, label: CONDITIONS[cid].label, from: [] });
      }
      map.get(cid).from.push(med.label);
    }
  }

  // A stated pregnancy is a known context, not something to "check for". Adding
  // it here keeps it out of the discoveries list and, more usefully, pulls in
  // everything pregnancy links to — which is the whole point of asking.
  if (isPregnantOrPossible && !map.has("pregnancy_care")) {
    map.set("pregnancy_care", {
      id: "pregnancy_care",
      label: CONDITIONS.pregnancy_care.label,
      from: ["you told us you are pregnant or might be"],
    });
  }

  return [...map.values()];
}

/**
 * The interlinked issues — conditions connected to what was found, that are not
 * themselves already being treated.
 *
 * Something already on the prescription is not a discovery, so it is filtered
 * out: the value here is in surfacing the link nobody has checked yet.
 */
function interlinkedIssues(conditionIds) {
  const present = new Set(conditionIds);
  const byTarget = new Map();

  for (const cid of conditionIds) {
    for (const link of CONDITIONS[cid]?.links || []) {
      if (present.has(link.to)) continue;
      if (!CONDITIONS[link.to]) continue;
      if (!byTarget.has(link.to)) {
        byTarget.set(link.to, {
          id: link.to,
          label: CONDITIONS[link.to].label,
          reasons: [],
        });
      }
      byTarget.get(link.to).reasons.push({
        from: CONDITIONS[cid].label,
        why: link.why,
      });
    }
  }

  // More independent routes to the same suggestion means it deserves more of
  // the reader's attention, so those sort first.
  return [...byTarget.values()].sort((a, b) => b.reasons.length - a.reasons.length);
}

/** Where family history and the prescription point at the same thing. */
function familyRiskAnalysis(familyHistory, conditionIds) {
  const present = new Set(conditionIds);
  const out = [];

  for (const fid of familyHistory) {
    const entry = FAMILY_RISK[fid];
    if (!entry) continue;
    const label = FAMILY_HISTORY_OPTIONS.find((o) => o.id === fid)?.label || fid;

    const overlapping = entry.raises
      .filter((r) => present.has(r))
      .map((r) => CONDITIONS[r]?.label)
      .filter(Boolean);

    out.push({
      id: fid,
      label,
      advice: entry.advice,
      // The strongest signal in the whole feature: a family history of the same
      // condition the person is already being treated for.
      reinforces: overlapping,
      priority: overlapping.length > 0 ? "high" : "standard",
    });
  }

  return out.sort((a, b) => (a.priority === "high" ? -1 : 1) - (b.priority === "high" ? -1 : 1));
}

function pregnancyNotes(medicines, isPregnantOrPossible) {
  if (!isPregnantOrPossible) return [];
  return medicines
    .filter((m) => m.pregnancyWarning)
    .map((m) => ({ medicine: m.label, warning: m.pregnancyWarning }));
}

// Several conditions read badly in a "should I be checked for X?" frame —
// "checked for pregnancy care" is not a sentence anyone would say. These get
// their own phrasing.
const QUESTION_PHRASING = {
  pregnancy_care: "Given everything I am taking, what extra checks do I need for pregnancy?",
  infertility: "If I have trouble conceiving, could any of this be the reason?",
  mental_health: "I have been feeling low or anxious — could this be connected to my treatment?",
  contraception: "Which contraception is safe alongside my current medicines?",
};

function askFor(label, id) {
  if (id && QUESTION_PHRASING[id]) return QUESTION_PHRASING[id];
  return `Should I be checked for ${label.toLowerCase()}?`;
}

// Labels carry acronyms and parentheses ("PCOS (polycystic ovary syndrome)"),
// so they are joined as written rather than lowercased wholesale.
function joinLabels(labels) {
  if (labels.length <= 1) return labels[0] || "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Concrete things to ask, which is what actually gets acted on in a 4-minute consult. */
function buildQuestions({ conditions, interlinked, familyRisks, pregnancy }) {
  const questions = [];

  for (const item of interlinked.slice(0, 4)) {
    questions.push(`${askFor(item.label, item.id)} (${item.reasons[0].why})`);
  }
  for (const fr of familyRisks.filter((f) => f.priority === "high").slice(0, 2)) {
    questions.push(`${fr.label} runs in my family and I am already being treated for ${joinLabels(fr.reinforces)} — should I be screened earlier or more often?`);
  }
  if (pregnancy.length > 0) {
    questions.push("I am pregnant or might be — are all of my current medicines safe to continue, and does any dose need changing?");
  }
  if (conditions.some((c) => c.id === "anaemia")) {
    questions.push("Can I have a haemoglobin test to see whether the iron tablets are working?");
  }
  if (questions.length === 0) {
    questions.push("What is each of these medicines for, and how long should I keep taking it?");
  }
  return questions;
}

// POST /api/prescription/analyze
// Body: { text, familyHistory?: string[], isPregnantOrPossible?: boolean }
router.post("/analyze", (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.slice(0, MAX_TEXT) : "";
    if (!text.trim()) {
      return res.status(400).json({ error: "No prescription text was received." });
    }

    const validIds = new Set(FAMILY_HISTORY_OPTIONS.map((o) => o.id));
    const familyHistory = Array.isArray(req.body?.familyHistory)
      ? req.body.familyHistory.filter((f) => validIds.has(f))
      : [];
    const isPregnantOrPossible = Boolean(req.body?.isPregnantOrPossible);

    const medicines = detectMedicines(text);
    const conditions = impliedConditions(medicines, { isPregnantOrPossible });
    const conditionIds = conditions.map((c) => c.id);
    const interlinked = interlinkedIssues(conditionIds);
    const familyRisks = familyRiskAnalysis(familyHistory, conditionIds);
    const pregnancy = pregnancyNotes(medicines, isPregnantOrPossible);

    res.json({
      ok: true,
      medicines,
      conditions,
      interlinked,
      familyRisks,
      pregnancyNotes: pregnancy,
      questionsForDoctor: buildQuestions({ conditions, interlinked, familyRisks, pregnancy }),
      unrecognised: medicines.length === 0,
      disclaimer:
        "This reads names off a prescription and lists what those medicines are usually for. " +
        "It is not a diagnosis, not a check of your doses, and not a complete interaction check. " +
        "Never start, stop or change a medicine based on this — take the questions to a doctor or ASHA worker instead.",
    });
  } catch (err) {
    console.error("[prescription]", err?.message);
    res.status(500).json({ error: "Could not analyse the prescription." });
  }
});

// GET /api/prescription/family-history-options — drives the checkbox list
router.get("/family-history-options", (req, res) => {
  res.json(FAMILY_HISTORY_OPTIONS);
});

export default router;

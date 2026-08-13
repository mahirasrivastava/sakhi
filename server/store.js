// store.js
// In-memory + JSON-file-backed session store. No DB setup needed for the demo;
// swap for Google Sheets or Postgres later without changing the route contract.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "sessions.json");

let sessions = [];

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      sessions = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch {
    sessions = [];
  }
}

function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
  } catch {
    // Non-fatal for the demo — in-memory state still works.
  }
}

load();

export function addSession(session) {
  sessions.unshift(session);
  persist();
  return session;
}

export function getSessions({ level, ashaAlert } = {}) {
  return sessions.filter((s) => {
    if (level && s.triage.level !== level) return false;
    if (ashaAlert !== undefined && s.routing.ashaAlert !== (ashaAlert === "true")) return false;
    return true;
  });
}

// Data minimization for the dashboard list.
//
// The queue view needs to answer one question — "who do I call first?" — and
// that needs urgency, time, and which rules fired. It does not need the girl's
// own words, her age, or how many weeks pregnant she is. Those fields are
// returned only by the single-session endpoint, which is audited, so opening
// one person's record is a deliberate, attributable act rather than a
// side effect of loading a page.
export function redactForList(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    language: session.language,
    triage: {
      level: session.triage.level,
      ruleLevel: session.triage.ruleLevel,
      confidence: session.triage.confidence,
      // Rule IDs are clinical metadata, not patient disclosures.
      firedRules: session.triage.firedRules,
    },
    routing: {
      level: session.routing.level,
      action: session.routing.action,
      ashaAlert: session.routing.ashaAlert,
      needsHumanReview: session.routing.needsHumanReview,
      bloodDonorStandby: session.routing.bloodDonorStandby ?? false,
    },
    // A flag, not the text that raised it.
    safetyFlag: Boolean(session.intake?.safetyFlag),
    redacted: true,
  };
}

export function getSessionById(id) {
  return sessions.find((s) => s.id === id) || null;
}

export function deleteSession(id) {
  const before = sessions.length;
  sessions = sessions.filter((s) => s.id !== id);
  persist();
  return sessions.length < before;
}

export function getImpactStats() {
  const total = sessions.length;
  const byLevel = { emergency: 0, urgent: 0, routine: 0, "self-care": 0 };
  for (const s of sessions) byLevel[s.triage.level] = (byLevel[s.triage.level] || 0) + 1;
  return { totalSessions: total, byLevel };
}

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

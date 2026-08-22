// store.js
// Session storage. Backed by Supabase Postgres when it is configured, and by a
// JSON file on disk when it is not.
//
// The JSON path is not dead code kept for nostalgia — it is what makes the app
// clonable and demoable with zero configuration, which is the difference
// between someone trying this and someone giving up at a credentials screen.
// It is not, however, safe for real deployment: Render's disk is ephemeral, so
// a restart loses the queue. Set SUPABASE_URL in production.
//
// Every exported accessor is async regardless of backend, so the route contract
// does not change when the backend does.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase, isSupabaseConfigured, SESSIONS_TABLE } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "sessions.json");

export const backend = isSupabaseConfigured ? "supabase" : "json-file";

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
// Postgres columns are snake_case, the session object the agents build is
// camelCase. Converting in exactly these two functions keeps the rest of the
// app from having to know which backend it is talking to.

function toRow(session) {
  return {
    id: session.id,
    created_at: session.createdAt,
    language: session.language,
    intake: session.intake,
    triage: session.triage,
    routing: session.routing,
    self_care: session.selfCare ?? null,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    language: row.language,
    intake: row.intake,
    triage: row.triage,
    routing: row.routing,
    selfCare: row.self_care,
  };
}

// ---------------------------------------------------------------------------
// JSON file backend
// ---------------------------------------------------------------------------

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
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(sessions, null, 2));
  } catch {
    // Non-fatal for the demo — in-memory state still works.
  }
}

if (!isSupabaseConfigured) load();

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export async function addSession(session) {
  if (!isSupabaseConfigured) {
    sessions.unshift(session);
    persist();
    return session;
  }

  const { error } = await supabase.from(SESSIONS_TABLE).insert(toRow(session));

  // Deliberately fatal. If the write fails, the record never reaches the ASHA
  // queue — and an emergency case that no worker can see is the worst outcome
  // this system has. Failing the request tells the patient to try again, which
  // is recoverable; returning advice while silently dropping the alert is not.
  if (error) {
    console.error("[store] session insert failed:", error.message);
    throw new Error("Could not save this session.");
  }
  return session;
}

export async function getSessions({ level, ashaAlert } = {}) {
  if (!isSupabaseConfigured) {
    return sessions.filter((s) => {
      if (level && s.triage.level !== level) return false;
      if (ashaAlert !== undefined && s.routing.ashaAlert !== (ashaAlert === "true")) return false;
      return true;
    });
  }

  let query = supabase
    .from(SESSIONS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  // Filtering inside JSONB. `->>` yields text, so the boolean is compared as
  // 'true'/'false' — matching the expression indexes in 001_schema.sql.
  if (level) query = query.filter("triage->>level", "eq", level);
  if (ashaAlert !== undefined) {
    query = query.filter("routing->>ashaAlert", "eq", String(ashaAlert === "true"));
  }

  const { data, error } = await query;

  // Never degrade to an empty list here. An empty queue and a broken queue look
  // identical on screen, and one of them tells a worker that nobody is waiting.
  if (error) {
    console.error("[store] session list failed:", error.message);
    throw new Error("Could not load the queue.");
  }
  return data.map(fromRow);
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

export async function getSessionById(id) {
  if (!isSupabaseConfigured) {
    return sessions.find((s) => s.id === id) || null;
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[store] session read failed:", error.message);
    throw new Error("Could not load that record.");
  }
  return data ? fromRow(data) : null;
}

export async function deleteSession(id) {
  if (!isSupabaseConfigured) {
    const before = sessions.length;
    sessions = sessions.filter((s) => s.id !== id);
    persist();
    return sessions.length < before;
  }

  // `select()` makes the delete return the rows it removed, which is how we
  // tell "erased" from "never existed" — the route reports 404 for the latter,
  // and the audit entry records which of the two actually happened.
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[store] session delete failed:", error.message);
    throw new Error("Could not delete that record.");
  }
  return data.length > 0;
}

const LEVELS = ["emergency", "urgent", "routine", "self-care"];

export async function getImpactStats() {
  if (!isSupabaseConfigured) {
    const byLevel = { emergency: 0, urgent: 0, routine: 0, "self-care": 0 };
    for (const s of sessions) byLevel[s.triage.level] = (byLevel[s.triage.level] || 0) + 1;
    return { totalSessions: sessions.length, byLevel };
  }

  // Counted in Postgres rather than by pulling rows back and tallying them in
  // JS. `head: true` fetches no row bodies at all, so this stays cheap as the
  // table grows and no patient data crosses the wire to produce a number.
  const counts = await Promise.all([
    supabase.from(SESSIONS_TABLE).select("*", { count: "exact", head: true }),
    ...LEVELS.map((level) =>
      supabase
        .from(SESSIONS_TABLE)
        .select("*", { count: "exact", head: true })
        .filter("triage->>level", "eq", level)
    ),
  ]);

  const failed = counts.find((c) => c.error);
  if (failed) {
    console.error("[store] impact stats failed:", failed.error.message);
    throw new Error("Could not load impact statistics.");
  }

  const [total, ...levelCounts] = counts;
  const byLevel = {};
  LEVELS.forEach((level, i) => { byLevel[level] = levelCounts[i].count ?? 0; });

  return { totalSessions: total.count ?? 0, byLevel };
}

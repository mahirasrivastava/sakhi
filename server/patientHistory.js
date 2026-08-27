// patientHistory.js
// Opt-in, login-gated store for a patient's own health history.  (Point 2)
//
// Mirrors store.js exactly: Supabase Postgres when configured, a JSON file when
// not, every accessor async so the route contract does not change with the
// backend. See migrations/002_patient_history.sql for the privacy rationale and
// the mitigations this depends on (opt-in, user-deletable, no PII).
//
// The authorization rule is simple and enforced in every function here: a
// caller may only ever read or delete rows whose account_id is their own. The
// route passes req.patient.account.id; nothing here trusts an account id from
// the request body.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "patient-history.json");
const TABLE = "patient_history";
const MAX_ENTRIES_PER_ACCOUNT = 500; // a hard cap so one account cannot grow without bound

export const historyBackend = isSupabaseConfigured ? "supabase" : "json-file";

const VALID_KINDS = new Set(["triage", "anaemia", "cycle", "location", "report"]);

// ---------------------------------------------------------------------------
// JSON file backend
// ---------------------------------------------------------------------------
let rows = [];
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(DATA_FILE)) rows = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!Array.isArray(rows)) rows = [];
  } catch { rows = []; }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), { mode: 0o600 });
  } catch (err) { console.error("[history] persist failed:", err?.message); }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export async function addHistoryEntry(accountId, { kind, data }) {
  if (!accountId) throw new Error("accountId required");
  if (!VALID_KINDS.has(kind)) throw new Error(`unknown history kind: ${kind}`);

  const entry = {
    id: nanoid(12),
    account_id: accountId,
    kind,
    data: data ?? {},
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    load();
    rows.unshift(entry);
    // Trim oldest beyond the cap for this account.
    const mine = rows.filter((r) => r.account_id === accountId);
    if (mine.length > MAX_ENTRIES_PER_ACCOUNT) {
      const drop = new Set(mine.slice(MAX_ENTRIES_PER_ACCOUNT).map((r) => r.id));
      rows = rows.filter((r) => !drop.has(r.id));
    }
    persist();
    return toPublic(entry);
  }

  const { error } = await supabase.from(TABLE).insert(entry);
  if (error) { console.error("[history] insert failed:", error.message); throw new Error("Could not save to your history."); }
  return toPublic(entry);
}

export async function listHistory(accountId) {
  if (!accountId) throw new Error("accountId required");
  if (!isSupabaseConfigured) {
    load();
    return rows.filter((r) => r.account_id === accountId).map(toPublic);
  }
  const { data, error } = await supabase
    .from(TABLE).select("*").eq("account_id", accountId).order("created_at", { ascending: false });
  if (error) { console.error("[history] list failed:", error.message); throw new Error("Could not load your history."); }
  return data.map(toPublic);
}

export async function deleteHistoryEntry(accountId, id) {
  if (!accountId || !id) return false;
  if (!isSupabaseConfigured) {
    load();
    const before = rows.length;
    // account_id in the filter is the authorization check — you cannot delete
    // someone else's row even if you guess its id.
    rows = rows.filter((r) => !(r.id === id && r.account_id === accountId));
    persist();
    return rows.length < before;
  }
  const { data, error } = await supabase
    .from(TABLE).delete().eq("id", id).eq("account_id", accountId).select("id");
  if (error) { console.error("[history] delete failed:", error.message); throw new Error("Could not delete that entry."); }
  return data.length > 0;
}

export async function deleteAllHistory(accountId) {
  if (!accountId) return 0;
  if (!isSupabaseConfigured) {
    load();
    const before = rows.length;
    rows = rows.filter((r) => r.account_id !== accountId);
    persist();
    return before - rows.length;
  }
  const { data, error } = await supabase.from(TABLE).delete().eq("account_id", accountId).select("id");
  if (error) { console.error("[history] wipe failed:", error.message); throw new Error("Could not clear your history."); }
  return data.length;
}

// Never leak the internal account_id back to the client.
function toPublic(row) {
  return { id: row.id, kind: row.kind, data: row.data, recordedAt: row.created_at };
}

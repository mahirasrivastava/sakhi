// security/audit.js
// Append-only audit trail for every touch of patient data.
//
// This is a safety control, not bookkeeping. The records here belong to
// adolescent girls; if an account is ever misused, the only way to tell whose
// data was read — and to notify them — is a log that says who opened what.
//
// The log stores WHO looked at WHICH record. It never stores the record's
// contents: no free text, no symptoms, no passwords, no tokens. An audit log
// that copies the sensitive payload just doubles the size of the breach.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit-log.jsonl");

export const AUDIT = {
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILURE: "auth.login.failure",
  LOGIN_LOCKED: "auth.login.locked_out",
  ACTIVATION_SUCCESS: "auth.activation.success",
  ACTIVATION_FAILURE: "auth.activation.failure",
  LOGOUT: "auth.logout",
  PASSWORD_CHANGED: "auth.password.changed",
  SESSION_REJECTED: "auth.session.rejected",
  SESSION_IP_CHANGED: "auth.session.ip_changed",
  CSRF_REJECTED: "auth.csrf.rejected",
  RATE_LIMITED: "auth.rate_limited",
  UNAUTHORIZED_ACCESS: "access.unauthorized",
  LIST_SESSIONS: "data.sessions.list",
  READ_SESSION: "data.session.read",
  DELETE_SESSION: "data.session.delete",
  DELETE_DENIED: "data.session.delete_denied",
};

let stream = null;

function ensureStream() {
  if (stream) return stream;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    stream = fs.createWriteStream(AUDIT_FILE, { flags: "a", mode: 0o600 });
    stream.on("error", (err) => {
      console.error("[audit] write stream error:", err.message);
      stream = null;
    });
  } catch (err) {
    console.error("[audit] could not open audit log:", err.message);
    stream = null;
  }
  return stream;
}

// Client IPs are personal data too. Hashing with a per-boot salt keeps the log
// useful for correlation ("same source hit 40 accounts") without storing a
// plain address indefinitely.
const IP_SALT = crypto.randomBytes(16).toString("hex");

function pseudonymizeIp(ip) {
  if (!ip) return null;
  return "ip_" + crypto.createHash("sha256").update(IP_SALT + ip).digest("hex").slice(0, 16);
}

/**
 * Record one auditable event.
 * @param {string} action     one of AUDIT.*
 * @param {object} details    { req, actor, targetId, outcome, reason, meta }
 */
export function audit(action, { req, actor = null, targetId = null, outcome = "ok", reason = null, meta = null } = {}) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    actor,                       // worker ID, or null for anonymous/failed auth
    targetId,                    // patient session ID, when applicable
    outcome,                     // "ok" | "denied" | "error"
    reason,
    ip: pseudonymizeIp(req?.clientIp),
    ua: req?.get?.("user-agent")?.slice(0, 160) || null,
    meta,
  };

  const s = ensureStream();
  if (s) {
    s.write(JSON.stringify(entry) + "\n");
  } else {
    // If the log cannot be written, surface it loudly rather than silently
    // losing the trail.
    console.warn("[audit:fallback]", JSON.stringify(entry));
  }
  return entry;
}

export function auditFilePath() {
  return AUDIT_FILE;
}

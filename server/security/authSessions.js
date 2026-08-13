// security/authSessions.js
// Server-side login sessions for the ASHA dashboard.
//
// Design notes:
//  - Sessions live in memory only. They are deliberately NOT persisted: a stolen
//    copy of the data directory must not yield usable dashboard sessions, and a
//    server restart logging every worker out is the safe failure direction.
//  - Only a SHA-256 hash of the token is retained. A heap dump or log leak
//    therefore cannot be replayed as a valid cookie.
//  - Two independent clocks: an idle timeout (a walked-away-from tablet at a PHC)
//    and an absolute lifetime (a stolen cookie cannot live forever).

import crypto from "crypto";

const IDLE_TIMEOUT_MS = 15 * 60e3;     // 15 minutes of inactivity
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60e3; // one shift
const SWEEP_INTERVAL_MS = 60e3;

const TOKEN_BYTES = 32; // 256 bits
const MAX_SESSIONS_PER_WORKER = 5;

/** @type {Map<string, object>} keyed by token hash */
const sessions = new Map();

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function fingerprintUA(userAgent) {
  return crypto.createHash("sha256").update(String(userAgent ?? "")).digest("hex").slice(0, 32);
}

export function createSession({ workerId, ip, userAgent }) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const csrfSecret = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();

  const record = {
    tokenHash: hashToken(token),
    workerId,
    csrfSecret,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + ABSOLUTE_TIMEOUT_MS,
    uaFingerprint: fingerprintUA(userAgent),
    createdIp: ip,
    lastIp: ip,
  };

  sessions.set(record.tokenHash, record);
  enforceSessionCap(workerId);

  return { token, csrfSecret, record };
}

// Caps concurrent sessions per worker, dropping the oldest. Limits how many
// places one credential can be live at once if it is shared or phished.
function enforceSessionCap(workerId) {
  const mine = [...sessions.values()]
    .filter((s) => s.workerId === workerId)
    .sort((a, b) => a.createdAt - b.createdAt);
  while (mine.length > MAX_SESSIONS_PER_WORKER) {
    const oldest = mine.shift();
    sessions.delete(oldest.tokenHash);
  }
}

/**
 * Resolve a token to a live session, sliding the idle window forward.
 * Returns { ok, session, reason }.
 */
export function touchSession(token, { ip, userAgent } = {}) {
  if (!token) return { ok: false, reason: "no_token" };

  const record = sessions.get(hashToken(token));
  if (!record) return { ok: false, reason: "unknown_session" };

  const now = Date.now();
  if (now > record.absoluteExpiresAt) {
    sessions.delete(record.tokenHash);
    return { ok: false, reason: "expired_absolute" };
  }
  if (now - record.lastSeenAt > IDLE_TIMEOUT_MS) {
    sessions.delete(record.tokenHash);
    return { ok: false, reason: "expired_idle" };
  }

  // A cookie replayed from a different browser is treated as theft. The IP is
  // deliberately not pinned — ASHA workers move between mobile towers mid-shift
  // and pinning it would lock them out during exactly the emergencies that matter.
  if (record.uaFingerprint !== fingerprintUA(userAgent)) {
    sessions.delete(record.tokenHash);
    return { ok: false, reason: "fingerprint_mismatch" };
  }

  const ipChanged = record.lastIp !== ip;
  record.lastSeenAt = now;
  record.lastIp = ip;

  return { ok: true, session: record, ipChanged };
}

export function destroySession(token) {
  if (!token) return false;
  return sessions.delete(hashToken(token));
}

// Used when a password changes: every other live session for that worker dies.
export function destroyAllForWorker(workerId, { exceptToken } = {}) {
  const keep = exceptToken ? hashToken(exceptToken) : null;
  let removed = 0;
  for (const [key, record] of sessions) {
    if (record.workerId === workerId && key !== keep) {
      sessions.delete(key);
      removed++;
    }
  }
  return removed;
}

export function verifyCsrf(session, presentedToken) {
  if (!session?.csrfSecret || !presentedToken) return false;
  const expected = Buffer.from(session.csrfSecret);
  const actual = Buffer.from(String(presentedToken));
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function sessionStats() {
  return { active: sessions.size };
}

// Periodic sweep so abandoned sessions don't accumulate in memory between requests.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of sessions) {
    if (now > record.absoluteExpiresAt || now - record.lastSeenAt > IDLE_TIMEOUT_MS) {
      sessions.delete(key);
    }
  }
}, SWEEP_INTERVAL_MS);
sweep.unref?.();

export const SESSION_POLICY = {
  idleTimeoutMs: IDLE_TIMEOUT_MS,
  absoluteTimeoutMs: ABSOLUTE_TIMEOUT_MS,
};

// routes/auth.js
// ASHA worker authentication: first-time activation, login, logout, password change.
//
// Two deliberate properties throughout:
//  1. Failure responses are uniform. The API never confirms whether a worker ID
//     exists, so it cannot be used to enumerate the district's ASHA roster.
//  2. Every attempt is audited, successful or not.

import { Router } from "express";
import {
  activateAccount, authenticate, changePassword,
  publicAccount, normalizeWorkerId, findAccount, isLockedOut, lockoutRemainingMs,
} from "../security/accounts.js";
import { validatePasswordPolicy, PASSWORD_RULES } from "../security/passwords.js";
import { createSession, destroySession, destroyAllForWorker, SESSION_POLICY } from "../security/authSessions.js";
import {
  setAuthCookies, clearAuthCookies, requireAuth, requireCsrf, noStore, SESSION_COOKIE,
} from "../security/middleware.js";
import { authIpLimiter, authIdLimiter, activationIpLimiter } from "../security/rateLimit.js";
import { audit, AUDIT } from "../security/audit.js";

const router = Router();

router.use(noStore);

// ---------------------------------------------------------------------------
// DEVELOPMENT-ONLY diagnostics
//
// In production every auth failure is deliberately uniform, so the endpoint
// cannot be used to enumerate the district's ASHA roster. That same uniformity
// makes local debugging miserable — "not valid" covers unknown ID, wrong code,
// and already-activated alike.
//
// DEMO_MODE unlocks a precise reason string on activation failures ONLY. It is
// off whenever NODE_ENV=production, and can additionally be forced off in dev
// with SAKHI_DEMO=0. It never affects login, lockout, CSRF or session handling.
// ---------------------------------------------------------------------------
const DEMO_MODE =
  process.env.NODE_ENV !== "production" && process.env.SAKHI_DEMO !== "0";

// Shown on the sign-in screen when DEMO_MODE is on, so nobody has to guess the
// seeded credentials. The password itself is NOT sent — only the worker ID and
// the command that sets it.
const DEMO_HINT = {
  workerId: "ASHA-KA-0001",
  seedCommand: "npm run seed:demo",
  note: "Development build. Run the seed command in server/ to (re)create this account.",
};

// Precise, human-readable causes for the dev demo hint. Keys match the `detail`
// values produced by activateAccount().
const ACTIVATION_DETAIL_MESSAGES = {
  already_active:
    "This account is already activated, so First-time setup no longer applies to it. Use the “Sign in” tab instead — or run `npm run seed:demo` in server/ to reset the demo password.",
  bad_activation_code:
    "That activation code is not correct for this worker ID. Codes are one-time: if this account was already set up, the code has been burned and cannot be reused.",
  unknown_worker_id:
    "No account exists for that worker ID. Enrollment is closed — the district roster has to provision the ID first.",
  revoked: "This account has been revoked. Contact your PHC supervisor.",
};

// Bound every credential field before it reaches the KDF — an unbounded password
// field is a free CPU-exhaustion primitive against a memory-hard hash.
const MAX_FIELD = 256;
const str = (v) => (typeof v === "string" ? v.slice(0, MAX_FIELD) : "");

function tooLong(...values) {
  return values.some((v) => typeof v === "string" && v.length > MAX_FIELD);
}

function limited(req, res, limiter, key, action) {
  const { allowed, retryAfterMs } = limiter.check(key);
  if (!allowed) {
    audit(AUDIT.RATE_LIMITED, { req, outcome: "denied", reason: limiter.name, meta: { action } });
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    res.status(429).json({
      error: "Too many attempts. Please wait and try again.",
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// GET /api/auth/policy — password rules, so the UI states them before submission
// ---------------------------------------------------------------------------
router.get("/policy", (req, res) => {
  res.json({
    password: PASSWORD_RULES,
    idleTimeoutMinutes: Math.round(SESSION_POLICY.idleTimeoutMs / 60e3),
    sessionHours: Math.round(SESSION_POLICY.absoluteTimeoutMs / 3600e3),
    // Dev-only. Absent entirely in production, so the UI's demo banner cannot
    // render there even if someone ships the client build by mistake.
    ...(DEMO_MODE ? { demoMode: true, demo: DEMO_HINT } : {}),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/activate — first-time setup: worker ID + one-time code -> password
// ---------------------------------------------------------------------------
router.post("/activate", async (req, res) => {
  const workerId = normalizeWorkerId(str(req.body?.workerId));
  const activationCode = str(req.body?.activationCode).trim().toUpperCase();
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (limited(req, res, activationIpLimiter, req.clientIp, "activate")) return;
  if (limited(req, res, authIdLimiter, workerId || "unknown", "activate")) return;

  if (tooLong(newPassword) || !workerId || !activationCode) {
    audit(AUDIT.ACTIVATION_FAILURE, { req, actor: workerId || null, outcome: "denied", reason: "missing_fields" });
    return res.status(400).json({ error: "Worker ID, activation code and a new password are all required." });
  }

  // Policy is checked before the code is verified, so a worker who mistypes a
  // weak password does not burn their one-time code.
  const policy = validatePasswordPolicy(newPassword, { workerId });
  if (!policy.ok) {
    return res.status(400).json({ error: "Password does not meet the security requirements.", details: policy.errors });
  }

  const result = await activateAccount({ workerId, activationCode, newPassword });

  if (!result.ok) {
    // The true cause always reaches the audit log, in every environment.
    audit(AUDIT.ACTIVATION_FAILURE, {
      req, actor: workerId, outcome: "denied", reason: result.detail || result.reason,
    });
    if (result.reason === "locked") {
      return res.status(423).json({ error: "This account is temporarily locked. Contact your PHC supervisor." });
    }
    // Uniform message: does not distinguish "no such ID" from "wrong code" from
    // "already activated". In dev only, a precise explanation rides alongside it
    // so first-time setup on an already-active account is clearly handled
    // instead of looking like a mystery rejection.
    return res.status(400).json({
      error: "That worker ID and activation code combination is not valid.",
      reason: "invalid_activation",
      ...(DEMO_MODE && ACTIVATION_DETAIL_MESSAGES[result.detail]
        ? { devReason: result.detail, devMessage: ACTIVATION_DETAIL_MESSAGES[result.detail] }
        : {}),
    });
  }

  audit(AUDIT.ACTIVATION_SUCCESS, { req, actor: workerId, outcome: "ok" });
  authIdLimiter.reset(workerId);

  // No auto-login: the worker signs in with the password they just chose, which
  // confirms they can reproduce it before they depend on it.
  res.json({ ok: true, message: "Password created. Please sign in with your new password." });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const workerId = normalizeWorkerId(str(req.body?.workerId));
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (limited(req, res, authIpLimiter, req.clientIp, "login")) return;
  if (limited(req, res, authIdLimiter, workerId || "unknown", "login")) return;

  if (tooLong(password) || !workerId || !password) {
    audit(AUDIT.LOGIN_FAILURE, { req, actor: workerId || null, outcome: "denied", reason: "missing_fields" });
    return res.status(400).json({ error: "Worker ID and password are required." });
  }

  const result = await authenticate({ workerId, password });

  if (!result.ok) {
    if (result.reason === "locked") {
      audit(AUDIT.LOGIN_LOCKED, { req, actor: workerId, outcome: "denied" });
      res.setHeader("Retry-After", Math.ceil((result.retryAfterMs || 0) / 1000));
      return res.status(423).json({
        error: "Too many failed attempts. This account is temporarily locked.",
        retryAfterSeconds: Math.ceil((result.retryAfterMs || 0) / 1000),
      });
    }
    audit(AUDIT.LOGIN_FAILURE, { req, actor: workerId, outcome: "denied", reason: result.reason });
    // "not_activated" is folded into the same message on purpose — the login
    // response must not reveal which IDs exist but have no password yet.
    return res.status(401).json({ error: "Incorrect worker ID or password." });
  }

  const { token, csrfSecret } = createSession({
    workerId: result.account.workerId,
    ip: req.clientIp,
    userAgent: req.get("user-agent"),
  });

  setAuthCookies(res, { token, csrfSecret, maxAge: SESSION_POLICY.absoluteTimeoutMs });
  authIdLimiter.reset(workerId);
  audit(AUDIT.LOGIN_SUCCESS, { req, actor: result.account.workerId, outcome: "ok" });

  res.json({
    ok: true,
    worker: publicAccount(result.account),
    session: {
      idleTimeoutMinutes: Math.round(SESSION_POLICY.idleTimeoutMs / 60e3),
      expiresInHours: Math.round(SESSION_POLICY.absoluteTimeoutMs / 3600e3),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — session probe used by the client route guard
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, worker: publicAccount(req.auth.account) });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post("/logout", (req, res) => {
  // Deliberately not behind requireAuth: logging out must succeed even when the
  // session has already expired, so the cookies always get cleared.
  const token = req.cookies?.[SESSION_COOKIE];
  const existed = destroySession(token);
  clearAuthCookies(res);
  if (existed) audit(AUDIT.LOGOUT, { req, outcome: "ok" });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------
router.post("/change-password", requireAuth, requireCsrf, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const workerId = req.auth.workerId;

  if (tooLong(currentPassword, newPassword) || !currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are both required." });
  }

  const policy = validatePasswordPolicy(newPassword, { workerId });
  if (!policy.ok) {
    return res.status(400).json({ error: "Password does not meet the security requirements.", details: policy.errors });
  }

  const result = await changePassword({ workerId, currentPassword, newPassword });
  if (!result.ok) {
    audit(AUDIT.LOGIN_FAILURE, { req, actor: workerId, outcome: "denied", reason: `change_password:${result.reason}` });
    if (result.reason === "password_reused") {
      return res.status(400).json({ error: "Choose a password you have not used here before." });
    }
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  // A password change is the standard response to "I think someone has my
  // login" — so every other live session for this worker is terminated.
  const revoked = destroyAllForWorker(workerId, { exceptToken: req.auth.token });
  audit(AUDIT.PASSWORD_CHANGED, { req, actor: workerId, outcome: "ok", meta: { otherSessionsRevoked: revoked } });

  res.json({ ok: true, otherSessionsSignedOut: revoked });
});

export default router;

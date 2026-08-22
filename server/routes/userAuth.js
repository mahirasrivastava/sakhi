// routes/userAuth.js
// Optional accounts for patients. Mounted at /api/user.
//
// Nothing in the patient-facing app depends on these routes. Triage, the
// anaemia screen, the cycle log, helplines and the health report all work
// signed out, and that is a requirement rather than a happy accident — see the
// note at the top of security/patientAuth.js.

import { Router } from "express";
import { noStore } from "../security/middleware.js";
import { createLimiter } from "../security/rateLimit.js";
import {
  validateHandle, validatePatientPassword,
  registerPatient, verifyPatient, updatePreferences, publicProfile,
  createPatientSession, destroyPatientSession,
  setPatientCookies, clearPatientCookies,
  requirePatientAuth, requirePatientCsrf,
} from "../security/patientAuth.js";

const router = Router();

// Never cache an auth response — a shared phone must not serve the previous
// user's profile out of the back-forward cache.
router.use(noStore);

// Signup is the expensive one (scrypt), so it is the tighter limit.
const registerLimiter = createLimiter({ name: "user-register", windowMs: 60 * 60e3, max: 5 });
const loginLimiter = createLimiter({ name: "user-login", windowMs: 15 * 60e3, max: 10 });

function limited(limiter) {
  return (req, res, next) => {
    const verdict = limiter.check(req.clientIp);
    if (!verdict.allowed) {
      const seconds = Math.ceil(verdict.retryAfterMs / 1000);
      res.setHeader("Retry-After", String(seconds));
      return res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
        retryAfterSeconds: seconds,
      });
    }
    next();
  };
}

// POST /api/user/register
router.post("/register", limited(registerLimiter), async (req, res) => {
  const handleCheck = validateHandle(req.body?.handle);
  if (!handleCheck.ok) return res.status(400).json({ error: handleCheck.error });

  const passwordCheck = validatePatientPassword(req.body?.password);
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.errors[0], details: passwordCheck.errors });
  }

  try {
    const result = await registerPatient({
      handle: handleCheck.handle,
      password: req.body.password,
      language: req.body?.language,
    });
    if (!result.ok) return res.status(409).json({ error: result.error });

    // No session is issued here. Signing in as a separate, deliberate step
    // means a signup on a borrowed phone does not silently leave that phone
    // logged in afterwards.
    res.json({ ok: true, message: "Account created. You can sign in now." });
  } catch (err) {
    console.error("[user/register]", err?.message);
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

// POST /api/user/login
router.post("/login", limited(loginLimiter), async (req, res) => {
  const handleCheck = validateHandle(req.body?.handle);
  // A malformed handle is still run through the same generic failure below, so
  // the response cannot be used to probe which usernames exist.
  const account = handleCheck.ok
    ? await verifyPatient({ handle: handleCheck.handle, password: req.body?.password })
    : null;

  if (!account) {
    return res.status(401).json({ error: "Username or password is incorrect." });
  }

  const { token, csrfSecret, maxAge } = createPatientSession(account.id);
  setPatientCookies(res, { token, csrfSecret, maxAge });
  res.json({ ok: true, user: publicProfile(account) });
});

// POST /api/user/logout
router.post("/logout", (req, res) => {
  // Deliberately not behind requirePatientAuth: signing out must succeed even
  // when the session has already expired, or the cookie is never cleared.
  destroyPatientSession(req.cookies?.sakhi_user_session);
  clearPatientCookies(res);
  res.json({ ok: true });
});

// GET /api/user/me — how the client rehydrates on load.
router.get("/me", requirePatientAuth, (req, res) => {
  res.json({ user: publicProfile(req.patient.account) });
});

// PATCH /api/user/preferences — display settings only.
router.patch("/preferences", requirePatientAuth, requirePatientCsrf, (req, res) => {
  const account = updatePreferences(req.patient.account.id, { language: req.body?.language });
  if (!account) return res.status(404).json({ error: "Account not found." });
  res.json({ user: publicProfile(account) });
});

export default router;

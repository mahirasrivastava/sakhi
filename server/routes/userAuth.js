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
  validateHandle, validateEmail, validatePatientPassword,
  registerPatient, verifyPatient, updatePreferences, publicProfile,
  createPatientSession, destroyPatientSession,
  setPatientCookies, clearPatientCookies,
  requirePatientAuth, requirePatientCsrf,
  createVerificationToken, verifyEmailToken,
  createResetToken, resetPasswordWithToken, findAccountForVerification,
} from "../security/patientAuth.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../security/email.js";
import { addHistoryEntry, listHistory, deleteHistoryEntry, deleteAllHistory } from "../patientHistory.js";

// Links in emails point at the CLIENT, not this API.
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const verifyUrl = (token) => `${APP_BASE_URL}/account/verify?token=${encodeURIComponent(token)}`;
const resetUrl = (token) => `${APP_BASE_URL}/account/reset?token=${encodeURIComponent(token)}`;

const router = Router();

// Never cache an auth response — a shared phone must not serve the previous
// user's profile out of the back-forward cache.
router.use(noStore);

// Signup is the expensive one (scrypt), so it is the tighter limit.
const registerLimiter = createLimiter({ name: "user-register", windowMs: 60 * 60e3, max: 5 });
const loginLimiter = createLimiter({ name: "user-login", windowMs: 15 * 60e3, max: 10 });
const recoverLimiter = createLimiter({ name: "user-recover", windowMs: 60 * 60e3, max: 8 });

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

  // Email is required so the account is recoverable ("gmail entered on first
  // login"). It is verified by the link we send, not trusted from the form.
  const emailCheck = validateEmail(req.body?.email, { required: true });
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });

  const passwordCheck = validatePatientPassword(req.body?.password);
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.errors[0], details: passwordCheck.errors });
  }

  try {
    const result = await registerPatient({
      handle: handleCheck.handle,
      password: req.body.password,
      language: req.body?.language,
      email: emailCheck.email,
    });
    if (!result.ok) return res.status(409).json({ error: result.error });

    // Send the verification email (console fallback in dev). Never block the
    // signup on the mail succeeding.
    const { token, code } = createVerificationToken(result.account.id);
    sendVerificationEmail(emailCheck.email, { handle: handleCheck.handle, url: verifyUrl(token), code }).catch(() => {});

    // No session is issued here. Signing in as a separate, deliberate step
    // means a signup on a borrowed phone does not silently leave that phone
    // logged in afterwards.
    res.json({ ok: true, message: "Account created. Check your email to confirm the address, then sign in." });
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
router.patch("/preferences", requirePatientAuth, requirePatientCsrf, async (req, res) => {
  const account = await updatePreferences(req.patient.account.id, { language: req.body?.language });
  if (!account) return res.status(404).json({ error: "Account not found." });
  res.json({ user: publicProfile(account) });
});


// POST /api/user/verify-email — confirm the address from the emailed link/code.
router.post("/verify-email", async (req, res) => {
  const result = await verifyEmailToken({
    token: req.body?.token,
    accountId: req.body?.accountId,
    code: req.body?.code,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, message: "Email confirmed." });
});

// POST /api/user/resend-verification — re-issue the confirmation email.
router.post("/resend-verification", limited(recoverLimiter), (req, res) => {
  const account = findAccountForVerification({ handle: req.body?.handle, email: req.body?.email });
  // Always the same response, so this cannot enumerate accounts.
  if (account && account.email && !account.emailVerified) {
    const { token, code } = createVerificationToken(account.id);
    sendVerificationEmail(account.email, { handle: account.handle, url: verifyUrl(token), code }).catch(() => {});
  }
  res.json({ ok: true, message: "If that account exists and is unverified, a new email is on its way." });
});

// POST /api/user/forgot-password — email a reset link to the address on file.
router.post("/forgot-password", limited(recoverLimiter), (req, res) => {
  const emailCheck = validateEmail(req.body?.email, { required: true });
  // Even a malformed email returns the same generic success below.
  if (emailCheck.ok) {
    const issued = createResetToken(emailCheck.email);
    if (issued) {
      sendPasswordResetEmail(issued.account.email, {
        handle: issued.account.handle, url: resetUrl(issued.token), code: issued.code,
      }).catch(() => {});
    }
  }
  res.json({ ok: true, message: "If that email is registered, a reset link is on its way." });
});

// POST /api/user/reset-password — set a new password from the reset token/code.
router.post("/reset-password", limited(recoverLimiter), async (req, res) => {
  const result = await resetPasswordWithToken({
    token: req.body?.token,
    accountId: req.body?.accountId,
    code: req.body?.code,
    newPassword: req.body?.password,
  });
  if (!result.ok) return res.status(400).json({ error: result.error, details: result.details });
  res.json({ ok: true, message: "Password changed. You can sign in now." });
});


// ---------------------------------------------------------------------------
// Health history — opt-in, login-gated, user-deletable.  (Point 2)
// Every handler is scoped to req.patient.account.id; a caller can only ever
// touch their own rows. See patientHistory.js + migration 002 for the privacy
// rationale this depends on.
// ---------------------------------------------------------------------------

// POST /api/user/history  { kind, data }
router.post("/history", requirePatientAuth, requirePatientCsrf, async (req, res) => {
  try {
    const kind = String(req.body?.kind || "");
    const entry = await addHistoryEntry(req.patient.account.id, { kind, data: req.body?.data });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ error: err.message || "Could not save to your history." });
  }
});

// GET /api/user/history  -> the signed-in user's own history, newest first.
router.get("/history", requirePatientAuth, async (req, res) => {
  try {
    res.json({ history: await listHistory(req.patient.account.id) });
  } catch (err) {
    res.status(503).json({ error: err.message || "Could not load your history." });
  }
});

// DELETE /api/user/history/:id  -> remove one entry (right to erasure).
router.delete("/history/:id", requirePatientAuth, requirePatientCsrf, async (req, res) => {
  try {
    const deleted = await deleteHistoryEntry(req.patient.account.id, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Entry not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message || "Could not delete that entry." });
  }
});

// DELETE /api/user/history  -> wipe all of this account's history.
router.delete("/history", requirePatientAuth, requirePatientCsrf, async (req, res) => {
  try {
    const count = await deleteAllHistory(req.patient.account.id);
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(503).json({ error: err.message || "Could not clear your history." });
  }
});

export default router;

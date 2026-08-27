// security/patientAuth.js
// Optional accounts for the people the app is *for*, as opposed to the ASHA
// workers who staff it. Deliberately a separate subsystem from accounts.js /
// authSessions.js, for two reasons:
//
//   1. A patient token must never be able to satisfy requireAuth and reach the
//      dashboard. Separate cookies, separate stores, no shared code path where
//      a mistake could confuse the two.
//   2. The two have opposite threat models. A worker account unlocks other
//      people's health records, so it is gated behind issued activation codes,
//      a 12-character policy and lockout. A patient account unlocks nothing but
//      a language preference, so the same ceremony would be pure friction on
//      someone who may be typing on a borrowed phone.
//
// -------------------------------------------------------------------------
// WHAT AN ACCOUNT IS ALLOWED TO HOLD
// -------------------------------------------------------------------------
// A handle, a password hash, and display preferences. That is the whole schema,
// and it is the point. No triage result, no anaemia score, no cycle log, no
// name, no phone number, no village.
//
// Health history stays in the browser (see ReportContext on the client). That
// is a real cost — clear the browser and it is gone, and it does not follow the
// user to another phone — and it is accepted deliberately. The alternative is a
// server-side row linking reproductive-health findings to a login belonging to
// someone who may be fifteen years old, and a database that can be subpoenaed,
// leaked or shoulder-read is a worse outcome than a lost history.
//
// If you are about to add a health field to an account here: don't. Put it in
// ReportContext instead. If it genuinely must be on the server, that is a
// product decision with a threat model attached, not a schema tweak.

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword, verifyPassword } from "./passwords.js";
import { serializeCookie } from "./middleware.js";
import { supabase, isSupabaseConfigured } from "../supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCOUNTS_FILE = path.join(__dirname, "..", "data", "patient-accounts.json");

export const USER_SESSION_COOKIE = "sakhi_user_session";
export const USER_CSRF_COOKIE = "sakhi_user_csrf";
export const USER_CSRF_HEADER = "x-user-csrf-token";

// Shorter than a worker's eight-hour shift: a phone in a household is shared,
// and a session left open is the realistic risk here rather than an attacker.
const IDLE_TIMEOUT_MS = 30 * 60e3;
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60e3;
const TOKEN_BYTES = 32;

// ---------------------------------------------------------------------------
// Handle and password policy
// ---------------------------------------------------------------------------

const HANDLE_RE = /^[a-z0-9_][a-z0-9_.-]{2,31}$/;
// A deliberately permissive email check: reject the obviously-broken, accept
// the rest. A stricter regex mostly rejects valid addresses. Real proof the
// address exists comes from the verification email, not from this pattern.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200; // bounded so a huge input cannot be a CPU-burn DoS

const COMMON = new Set([
  "password", "password1", "12345678", "123456789", "qwertyuiop",
  "iloveyou", "sakhi123", "abcd1234", "00000000", "11111111",
]);

export function validateHandle(raw) {
  const handle = String(raw || "").trim().toLowerCase();
  if (!handle) return { ok: false, error: "Choose a username." };
  if (!HANDLE_RE.test(handle)) {
    return {
      ok: false,
      error: "Username must be 3-32 characters: letters, numbers, dot, dash or underscore.",
    };
  }
  return { ok: true, handle };
}

export function validateEmail(raw, { required = true } = {}) {
  const email = String(raw || "").trim().toLowerCase();
  if (!email) {
    return required ? { ok: false, error: "Enter an email so you can recover your account." } : { ok: true, email: null };
  }
  if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: "That does not look like a valid email address." };
  }
  return { ok: true, email };
}

/**
 * Eight characters, not a well-known string, not one repeated character, not a
 * straight sequence. No character-class requirement: forcing a symbol onto
 * someone using a transliterated keyboard buys very little against an account
 * that holds no health data, and costs a lot in abandoned signups.
 */
export function validatePatientPassword(raw) {
  const pw = String(raw || "");
  const errors = [];
  if (pw.length < MIN_PASSWORD) errors.push(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (pw.length > MAX_PASSWORD) errors.push(`Password must be at most ${MAX_PASSWORD} characters.`);
  if (COMMON.has(pw.toLowerCase())) errors.push("That password is too common. Choose something less guessable.");
  if (pw.length >= 4 && /^(.)\1+$/.test(pw)) errors.push("Password must not be one repeated character.");
  if (isSequential(pw)) errors.push("Password must not be a simple sequence.");
  return { ok: errors.length === 0, errors };
}

function isSequential(pw) {
  if (pw.length < 4) return false;
  let up = true, down = true;
  for (let i = 1; i < pw.length; i++) {
    const d = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

// ---------------------------------------------------------------------------
// Account store
// ---------------------------------------------------------------------------

let accounts = [];      // in-memory read cache; Supabase is the source of truth when configured
let loaded = false;

const ACCOUNTS_TABLE = "patient_accounts";
export const accountsBackend = isSupabaseConfigured ? "supabase" : "json-file";

// Postgres columns are snake_case; the account object is camelCase. Convert in
// exactly these two functions so nothing else needs to know the backend.
function toRow(a) {
  return {
    id: a.id, handle: a.handle, email: a.email,
    email_verified: Boolean(a.emailVerified), password_hash: a.passwordHash,
    language: a.language, created_at: a.createdAt, last_login_at: a.lastLoginAt,
  };
}
function fromRow(r) {
  return {
    id: r.id, handle: r.handle, email: r.email,
    emailVerified: Boolean(r.email_verified), passwordHash: r.password_hash,
    language: r.language, createdAt: r.created_at, lastLoginAt: r.last_login_at,
  };
}

function writeSecure(contents) {
  const tmp = `${ACCOUNTS_FILE}.tmp`;
  fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
  // Write then rename: a crash mid-write must not truncate the file and lock
  // every user out of their own account.
  fs.writeFileSync(tmp, contents, { mode: 0o600 });
  fs.renameSync(tmp, ACCOUNTS_FILE);
  try { fs.chmodSync(ACCOUNTS_FILE, 0o600); } catch { /* non-POSIX filesystem */ }
}

function loadFromFile() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      accounts = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    accounts = [];
  }
}

function persistFile() {
  try {
    writeSecure(JSON.stringify(accounts, null, 2));
  } catch (err) {
    console.error("[patientAuth] could not persist accounts:", err?.message);
  }
}

/**
 * Load all patient accounts into memory once, at server boot. With Supabase
 * configured, the table is the source of truth and this fills the read cache;
 * every write below is write-through (Supabase + cache). Without Supabase,
 * accounts live in the local JSON file exactly as before.
 *
 * The cache is what keeps the auth middleware synchronous — getPatientById runs
 * on every request — while durability lives in Postgres. The cache is
 * per-instance and refreshed at boot, which is correct for the current
 * single-instance deployment; a multi-instance setup would read hot rows from
 * Supabase directly (a future change, not needed yet).
 */
export async function initPatientAccounts() {
  if (loaded) return;
  loaded = true;
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from(ACCOUNTS_TABLE).select("*");
    if (error) {
      console.error("[patientAuth] could not load accounts from Supabase:", error.message);
      accounts = [];
    } else {
      accounts = (data || []).map(fromRow);
    }
  } else {
    loadFromFile();
  }
}

// JSON mode lazy-loads on first touch, so a unit test needs no boot step. In
// Supabase mode the boot init has already filled the cache.
function ensureLoaded() {
  if (loaded) return;
  if (!isSupabaseConfigured) { loaded = true; loadFromFile(); }
}

// Write one account through to the durable store and update the read cache.
async function saveAccount(account) {
  const i = accounts.findIndex((a) => a.id === account.id);
  if (i >= 0) accounts[i] = account; else accounts.push(account);
  if (isSupabaseConfigured) {
    const { error } = await supabase.from(ACCOUNTS_TABLE).upsert(toRow(account), { onConflict: "id" });
    if (error) {
      console.error("[patientAuth] save failed:", error.message);
      throw new Error("Could not save your account. Please try again.");
    }
  } else {
    persistFile();
  }
}

const findByHandle = (handle) => accounts.find((a) => a.handle === handle) || null;
const findByEmail = (email) => (email ? accounts.find((a) => a.email === email) || null : null);
const findById = (id) => accounts.find((a) => a.id === id) || null;

/** The shape sent to the client. Never includes the hash. */
export function publicProfile(account) {
  return {
    handle: account.handle,
    email: account.email || null,
    emailVerified: Boolean(account.emailVerified),
    language: account.language || null,
    createdAt: account.createdAt,
  };
}

export async function registerPatient({ handle, password, language, email = null }) {
  ensureLoaded();
  if (findByHandle(handle)) {
    return { ok: false, error: "That username is taken. Try another." };
  }
  if (email && findByEmail(email)) {
    return { ok: false, error: "That email is already registered." };
  }

  const account = {
    id: crypto.randomUUID(),
    handle,
    email: email || null,
    emailVerified: false,
    passwordHash: await hashPassword(password),
    language: typeof language === "string" ? language.slice(0, 12) : null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  await saveAccount(account);
  return { ok: true, account };
}

export async function verifyPatient({ handle, password }) {
  ensureLoaded();
  const account = findByHandle(handle);

  // Hash even when the handle is unknown, so a missing account and a wrong
  // password take the same time and cannot be told apart by a stopwatch.
  if (!account) {
    await hashPassword(String(password || ""));
    return null;
  }

  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) return null;

  account.lastLoginAt = new Date().toISOString();
  await saveAccount(account);
  return account;
}

export async function updatePreferences(id, { language }) {
  ensureLoaded();
  const account = findById(id);
  if (!account) return null;
  if (typeof language === "string") account.language = language.slice(0, 12);
  await saveAccount(account);
  return account;
}

export function getPatientById(id) {
  ensureLoaded();
  return findById(id);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

const sessions = new Map();
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function createPatientSession(accountId) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const csrfSecret = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();

  sessions.set(hash(token), {
    accountId,
    csrfSecret,
    createdAt: now,
    lastSeenAt: now,
    absoluteExpiresAt: now + ABSOLUTE_TIMEOUT_MS,
  });

  return { token, csrfSecret, maxAge: ABSOLUTE_TIMEOUT_MS };
}

export function touchPatientSession(token) {
  if (!token) return null;
  const key = hash(token);
  const record = sessions.get(key);
  if (!record) return null;

  const now = Date.now();
  if (now > record.absoluteExpiresAt || now - record.lastSeenAt > IDLE_TIMEOUT_MS) {
    sessions.delete(key);
    return null;
  }

  record.lastSeenAt = now;
  return record;
}

export function destroyPatientSession(token) {
  if (token) sessions.delete(hash(token));
}

// Expired records are dropped on read, but a session nobody returns to would
// sit in memory forever without this.
setInterval(() => {
  const now = Date.now();
  for (const [key, r] of sessions) {
    if (now > r.absoluteExpiresAt || now - r.lastSeenAt > IDLE_TIMEOUT_MS) sessions.delete(key);
  }
}, 60e3).unref();

// ---------------------------------------------------------------------------
// Cookies and guards
// ---------------------------------------------------------------------------

export function setPatientCookies(res, { token, csrfSecret, maxAge }) {
  res.append("Set-Cookie", serializeCookie(USER_SESSION_COOKIE, token, {
    httpOnly: true, maxAge, path: "/",
  }));
  // Readable by JS on purpose: the client echoes it back in a header, which is
  // the step a cross-site page cannot perform.
  res.append("Set-Cookie", serializeCookie(USER_CSRF_COOKIE, csrfSecret, {
    httpOnly: false, maxAge, path: "/",
  }));
}

export function clearPatientCookies(res) {
  res.append("Set-Cookie", serializeCookie(USER_SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" }));
  res.append("Set-Cookie", serializeCookie(USER_CSRF_COOKIE, "", { httpOnly: false, maxAge: 0, path: "/" }));
}

/** Attaches req.patient when signed in; never rejects. Signed out is normal. */
export function optionalPatientAuth(req, res, next) {
  const token = req.cookies?.[USER_SESSION_COOKIE];
  const session = touchPatientSession(token);
  if (session) {
    const account = getPatientById(session.accountId);
    if (account) req.patient = { account, session, token };
  }
  next();
}

/** For the few routes that need an account — preferences, profile, logout. */
export function requirePatientAuth(req, res, next) {
  const token = req.cookies?.[USER_SESSION_COOKIE];
  const session = touchPatientSession(token);
  if (!session) {
    clearPatientCookies(res);
    return res.status(401).json({ error: "Sign in to do that." });
  }

  const account = getPatientById(session.accountId);
  if (!account) {
    destroyPatientSession(token);
    clearPatientCookies(res);
    return res.status(401).json({ error: "This account no longer exists." });
  }

  req.patient = { account, session, token };
  next();
}

/** Double-submit CSRF, matching the staff side but on the user cookie. */
export function requirePatientCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const presented = req.get(USER_CSRF_HEADER);
  const expected = req.patient?.session?.csrfSecret;
  if (!presented || !expected) {
    return res.status(403).json({ error: "Request could not be verified. Reload and try again." });
  }

  const a = Buffer.from(String(presented));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Request could not be verified. Reload and try again." });
  }
  next();
}

// ---------------------------------------------------------------------------
// Email verification + password reset  (Point 2)
// ---------------------------------------------------------------------------
// Tokens are single-use, expiring, and stored hashed in memory — same posture
// as sessions above. A restart drops pending tokens; that only means a user
// re-requests the link, which is acceptable for a recovery flow. The raw token
// is returned to the caller exactly once (to put in the email) and never stored.

const VERIFY_TTL_MS = 24 * 60 * 60e3;   // 24 hours
const RESET_TTL_MS = 60 * 60e3;         // 1 hour
const TOKEN_URL_BYTES = 32;

const verifyTokens = new Map(); // hash(token) -> { accountId, expiresAt }
const resetTokens = new Map();  // hash(token) -> { accountId, expiresAt }

function newToken() {
  return crypto.randomBytes(TOKEN_URL_BYTES).toString("base64url");
}

// A short numeric code, offered alongside the link for anyone who cannot click
// through (feature phone forwarding the SMS, copy-paste stripping the URL).
function newCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Issue an email-verification token for an account. Returns { token, code }. */
export function createVerificationToken(accountId) {
  const token = newToken();
  const code = newCode();
  verifyTokens.set(hash(token), { accountId, code, expiresAt: Date.now() + VERIFY_TTL_MS });
  verifyTokens.set(`code:${accountId}:${code}`, { accountId, token, expiresAt: Date.now() + VERIFY_TTL_MS });
  return { token, code, ttlMs: VERIFY_TTL_MS };
}

/** Consume a verification token (or accountId+code). Marks the email verified. */
export async function verifyEmailToken({ token, accountId, code }) {
  ensureLoaded();
  let entry = null;
  let key = null;
  if (token) { key = hash(token); entry = verifyTokens.get(key); }
  else if (accountId && code) { key = `code:${accountId}:${code}`; entry = verifyTokens.get(key); }

  if (!entry || Date.now() > entry.expiresAt) return { ok: false, error: "This link has expired. Request a new one." };

  const account = findById(entry.accountId);
  if (!account) return { ok: false, error: "Account not found." };

  account.emailVerified = true;
  await saveAccount(account);
  // Invalidate both index entries for this verification.
  verifyTokens.delete(key);
  if (entry.token) verifyTokens.delete(hash(entry.token));
  if (entry.code) verifyTokens.delete(`code:${entry.accountId}:${entry.code}`);
  return { ok: true, account };
}

/**
 * Start a password reset. Looks the account up BY EMAIL — the address entered
 * at signup, exactly as the product requires ("if forgot pwd then go to gmail
 * which was entered on first login"). Returns the token+code only when a
 * matching account exists; the ROUTE always responds the same either way so
 * this cannot be used to test which emails are registered.
 */
export function createResetToken(email) {
  ensureLoaded();
  const account = findByEmail(String(email || "").trim().toLowerCase());
  if (!account || !account.email) return null;

  const token = newToken();
  const code = newCode();
  resetTokens.set(hash(token), { accountId: account.id, code, expiresAt: Date.now() + RESET_TTL_MS });
  resetTokens.set(`code:${account.id}:${code}`, { accountId: account.id, token, expiresAt: Date.now() + RESET_TTL_MS });
  return { account, token, code, ttlMs: RESET_TTL_MS };
}

/** Complete a password reset. Sets the new hash and drops every session. */
export async function resetPasswordWithToken({ token, accountId, code, newPassword }) {
  ensureLoaded();
  let entry = null; let key = null;
  if (token) { key = hash(token); entry = resetTokens.get(key); }
  else if (accountId && code) { key = `code:${accountId}:${code}`; entry = resetTokens.get(key); }

  if (!entry || Date.now() > entry.expiresAt) return { ok: false, error: "This reset link has expired. Request a new one." };

  const policy = validatePatientPassword(newPassword);
  if (!policy.ok) return { ok: false, error: policy.errors[0], details: policy.errors };

  const account = findById(entry.accountId);
  if (!account) return { ok: false, error: "Account not found." };

  account.passwordHash = await hashPassword(newPassword);
  await saveAccount(account);

  // A reset means "I lost control of this account" — kill every live session
  // for it so a stolen-but-open session cannot survive the recovery.
  for (const [skey, rec] of sessions) {
    if (rec.accountId === account.id) sessions.delete(skey);
  }
  resetTokens.delete(key);
  if (entry.token) resetTokens.delete(hash(entry.token));
  if (entry.code) resetTokens.delete(`code:${entry.accountId}:${entry.code}`);
  return { ok: true, account };
}

/** For "resend verification": find an account by handle or email. */
export function findAccountForVerification({ handle, email }) {
  ensureLoaded();
  if (handle) { const a = findByHandle(String(handle).trim().toLowerCase()); if (a) return a; }
  if (email) return findByEmail(String(email).trim().toLowerCase());
  return null;
}

// Sweep expired tokens so the maps do not grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const m of [verifyTokens, resetTokens]) {
    for (const [k, v] of m) { if (now > v.expiresAt) m.delete(k); }
  }
}, 5 * 60e3).unref();

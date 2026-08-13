// security/accounts.js
// ASHA worker accounts, backed by a JSON file with 0600 permissions.
//
// Enrollment is CLOSED: an account can only exist if the health authority
// provisioned that worker ID in the roster. A worker ID alone is not a secret —
// it is printed on an ID card and known to the whole PHC — so first-time
// activation additionally requires a one-time activation code issued
// out-of-band. Without that second factor, whoever reaches the activation
// screen first owns the account, including an attacker who simply reads a
// worker's ID off their badge.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { hashPassword, verifyPassword } from "./passwords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "asha-accounts.json");
const CODES_FILE = path.join(DATA_DIR, "ACTIVATION-CODES.txt");

// Roster provisioned by the district health authority. In a real deployment this
// is imported from the state's ASHA registry, not hardcoded.
const SEED_ROSTER = [
  { workerId: "ASHA-KA-0001", displayName: "Sunita R.", phc: "PHC Yelahanka" },
  { workerId: "ASHA-KA-0002", displayName: "Lakshmi B.", phc: "PHC Yelahanka" },
  { workerId: "ASHA-KA-0003", displayName: "Meena K.", phc: "PHC Hesaraghatta" },
  { workerId: "ANM-KA-0101", displayName: "Nurse Priya S.", phc: "PHC Yelahanka", role: "anm" },
];

export const ACCOUNT_STATUS = {
  PENDING: "pending_activation",
  ACTIVE: "active",
  REVOKED: "revoked",
};

// Lockout ladder: each additional group of failures locks the account for longer.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_STEPS_MS = [15 * 60e3, 60 * 60e3, 4 * 60 * 60e3, 24 * 60 * 60e3];

let accounts = [];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function writeSecure(file, contents) {
  // Write to a temp file then rename: a crash mid-write can't truncate the
  // account database and lock every worker out.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, contents, { mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort on filesystems without POSIX modes */
  }
}

function persist() {
  try {
    writeSecure(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
  } catch (err) {
    console.error("[accounts] Failed to persist accounts:", err.message);
  }
}

function load() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
      accounts = Array.isArray(parsed) ? parsed : [];
      return true;
    }
  } catch (err) {
    console.error("[accounts] Could not read accounts file:", err.message);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

// Ambiguous characters (0/O, 1/I/L) removed — these codes get read aloud and
// copied off paper by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateActivationCode() {
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 3 || i === 7) out += "-";
  }
  return out; // e.g. K3MP-9QRT-XW2H  (~59 bits of entropy)
}

export async function initAccounts() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (load()) {
    await provisionMissing();
    return;
  }

  accounts = [];
  const issued = [];
  for (const entry of SEED_ROSTER) {
    issued.push(await provision(entry));
  }
  persist();
  reportIssuedCodes(issued);
}

// Adds roster entries that don't have an account yet, without touching existing
// accounts — so extending the roster never resets a worker's password.
async function provisionMissing() {
  const issued = [];
  for (const entry of SEED_ROSTER) {
    if (!findAccount(entry.workerId)) {
      accounts.push(await buildAccount(entry, issued));
    }
  }
  if (issued.length > 0) {
    persist();
    reportIssuedCodes(issued);
  }
}

async function provision(entry) {
  const issued = [];
  accounts.push(await buildAccount(entry, issued));
  return issued[0];
}

async function buildAccount(entry, issuedSink) {
  const code = generateActivationCode();
  issuedSink.push({ workerId: entry.workerId, code });
  return {
    workerId: entry.workerId,
    displayName: entry.displayName,
    phc: entry.phc,
    role: entry.role || "asha",
    status: ACCOUNT_STATUS.PENDING,
    activationCodeHash: await hashPassword(code),
    activationCodeUsedAt: null,
    passwordHash: null,
    passwordUpdatedAt: null,
    failedAttempts: 0,
    lockoutCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  };
}

// The plaintext codes exist exactly once, here. In production they are handed to
// workers out-of-band (SMS to the registered number, or on paper at the PHC) and
// never written to disk.
function reportIssuedCodes(issued) {
  if (issued.length === 0) return;
  const lines = issued.map((i) => `${i.workerId}\t${i.code}`);
  const body =
    "Sakhi — one-time ASHA activation codes\n" +
    "Generated: " + new Date().toISOString() + "\n" +
    "Hand these to each worker out-of-band, then delete this file.\n" +
    "Each code works once and cannot be recovered after activation.\n\n" +
    lines.join("\n") + "\n";
  try {
    writeSecure(CODES_FILE, body);
  } catch (err) {
    console.error("[accounts] Could not write activation codes file:", err.message);
  }
  console.log("\n[accounts] Provisioned %d ASHA account(s).", issued.length);
  console.log("[accounts] One-time activation codes written to server/data/ACTIVATION-CODES.txt");
  console.log("[accounts] Distribute them out-of-band, then delete that file.\n");
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

// Worker IDs are case-insensitive on input so a worker typing "asha-ka-0001"
// still lands on their account.
export function normalizeWorkerId(raw) {
  return String(raw ?? "").trim().toUpperCase().slice(0, 64);
}

export function findAccount(workerId) {
  const id = normalizeWorkerId(workerId);
  if (!id) return null;
  return accounts.find((a) => a.workerId === id) || null;
}

export function isLockedOut(account) {
  if (!account?.lockedUntil) return false;
  return new Date(account.lockedUntil).getTime() > Date.now();
}

export function lockoutRemainingMs(account) {
  if (!isLockedOut(account)) return 0;
  return new Date(account.lockedUntil).getTime() - Date.now();
}

// ---------------------------------------------------------------------------
// Activation (first login)
// ---------------------------------------------------------------------------

export async function activateAccount({ workerId, activationCode, newPassword }) {
  const account = findAccount(workerId);

  // Uniform failure shape: never reveal whether the ID exists, whether it is
  // already activated, or which of the two secrets was wrong.
  //
  // `detail` carries the true cause for the audit log and for the dev-only demo
  // hint in routes/auth.js. It is never surfaced to a client in production —
  // doing so would turn this endpoint into a roster-enumeration oracle.
  const generic = (detail) => ({ ok: false, reason: "invalid_activation", detail });

  if (!account) return generic("unknown_worker_id");
  if (account.status === ACCOUNT_STATUS.REVOKED) return generic("revoked");
  if (account.status !== ACCOUNT_STATUS.PENDING) return generic("already_active");
  if (isLockedOut(account)) return { ok: false, reason: "locked", account };

  const codeOk = await verifyPassword(activationCode, account.activationCodeHash);
  if (!codeOk) {
    registerFailure(account);
    return generic("bad_activation_code");
  }

  account.passwordHash = await hashPassword(newPassword);
  account.passwordUpdatedAt = new Date().toISOString();
  account.status = ACCOUNT_STATUS.ACTIVE;
  // Burn the code so it can never be replayed to take the account over again.
  account.activationCodeHash = null;
  account.activationCodeUsedAt = new Date().toISOString();
  clearFailures(account);
  persist();

  return { ok: true, account };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function authenticate({ workerId, password }) {
  const account = findAccount(workerId);

  if (!account) {
    // Burn comparable CPU on unknown IDs so response time doesn't reveal
    // which worker IDs are real.
    await verifyPassword(String(password ?? ""), DUMMY_HASH);
    return { ok: false, reason: "invalid_credentials" };
  }
  if (account.status === ACCOUNT_STATUS.REVOKED) {
    await verifyPassword(String(password ?? ""), DUMMY_HASH);
    return { ok: false, reason: "invalid_credentials" };
  }
  if (isLockedOut(account)) {
    return { ok: false, reason: "locked", account, retryAfterMs: lockoutRemainingMs(account) };
  }
  if (account.status === ACCOUNT_STATUS.PENDING || !account.passwordHash) {
    await verifyPassword(String(password ?? ""), DUMMY_HASH);
    return { ok: false, reason: "not_activated", account };
  }

  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) {
    registerFailure(account);
    return {
      ok: false,
      reason: isLockedOut(account) ? "locked" : "invalid_credentials",
      account,
      retryAfterMs: lockoutRemainingMs(account),
    };
  }

  clearFailures(account);
  account.lastLoginAt = new Date().toISOString();
  persist();
  return { ok: true, account };
}

export async function changePassword({ workerId, currentPassword, newPassword }) {
  const account = findAccount(workerId);
  if (!account || account.status !== ACCOUNT_STATUS.ACTIVE) {
    return { ok: false, reason: "invalid_credentials" };
  }
  if (isLockedOut(account)) return { ok: false, reason: "locked", account };

  const ok = await verifyPassword(currentPassword, account.passwordHash);
  if (!ok) {
    registerFailure(account);
    return { ok: false, reason: "invalid_credentials", account };
  }
  // Block silently re-setting the same password.
  if (await verifyPassword(newPassword, account.passwordHash)) {
    return { ok: false, reason: "password_reused", account };
  }

  account.passwordHash = await hashPassword(newPassword);
  account.passwordUpdatedAt = new Date().toISOString();
  clearFailures(account);
  persist();
  return { ok: true, account };
}

// Verifies a password without any lockout side effects being skipped — used for
// step-up confirmation before destructive actions.
export async function verifyAccountPassword(workerId, password) {
  const account = findAccount(workerId);
  if (!account || account.status !== ACCOUNT_STATUS.ACTIVE) return false;
  if (isLockedOut(account)) return false;
  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) {
    registerFailure(account);
    return false;
  }
  clearFailures(account);
  return true;
}

// ---------------------------------------------------------------------------
// Failure tracking
// ---------------------------------------------------------------------------

function registerFailure(account) {
  account.failedAttempts = (account.failedAttempts || 0) + 1;
  if (account.failedAttempts >= LOCKOUT_THRESHOLD) {
    const step = Math.min(account.lockoutCount || 0, LOCKOUT_STEPS_MS.length - 1);
    account.lockedUntil = new Date(Date.now() + LOCKOUT_STEPS_MS[step]).toISOString();
    account.lockoutCount = (account.lockoutCount || 0) + 1;
    account.failedAttempts = 0;
  }
  persist();
}

function clearFailures(account) {
  account.failedAttempts = 0;
  account.lockedUntil = null;
  account.lockoutCount = 0;
}

// Fixed decoy hash of a random value, so unknown-ID logins do the same scrypt
// work as real ones. Generated once at module load.
const DUMMY_HASH =
  "scrypt$32768$8$1$" +
  crypto.randomBytes(32).toString("base64") + "$" +
  crypto.randomBytes(64).toString("base64");

// ---------------------------------------------------------------------------
// Development-only provisioning
// ---------------------------------------------------------------------------

/**
 * Create-or-reset a demo account with a known password. DEVELOPMENT ONLY.
 *
 * This exists so a local demo has one account that is reliably signable-in,
 * without anyone hand-editing scrypt hashes into asha-accounts.json and without
 * burning the one-time activation code on every fresh checkout.
 *
 * It deliberately reuses hashPassword() — the exact KDF the real login path
 * verifies against — so a seeded account is indistinguishable from one created
 * through the genuine activation flow. Nothing about the login, lockout, CSRF or
 * session code is bypassed; only the *provisioning* step is short-circuited.
 *
 * NEVER reachable from an HTTP route. It is called from scripts/seed-demo.js
 * only, and hard-refuses to run under NODE_ENV=production.
 *
 * @returns {Promise<{ workerId: string, action: "created" | "reset" }>}
 */
export async function devProvisionDemoAccount({ workerId, password, displayName, phc, role = "asha" }) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("devProvisionDemoAccount is disabled in production.");
  }

  const id = normalizeWorkerId(workerId);
  if (!id) throw new Error("A worker ID is required.");
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("A password is required.");
  }

  let account = findAccount(id);
  const action = account ? "reset" : "created";

  if (!account) {
    const rosterEntry = SEED_ROSTER.find((e) => e.workerId === id);
    account = {
      workerId: id,
      displayName: displayName || rosterEntry?.displayName || "Demo worker",
      phc: phc || rosterEntry?.phc || "PHC Demo",
      role: role || rosterEntry?.role || "asha",
      status: ACCOUNT_STATUS.PENDING,
      activationCodeHash: null,
      activationCodeUsedAt: null,
      passwordHash: null,
      passwordUpdatedAt: null,
      failedAttempts: 0,
      lockoutCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
  }

  // Same hash function the real activation flow uses — no special-case verify path.
  account.passwordHash = await hashPassword(password);
  account.passwordUpdatedAt = new Date().toISOString();
  account.status = ACCOUNT_STATUS.ACTIVE;
  // The account no longer needs its one-time code: it is already activated.
  account.activationCodeHash = null;
  account.activationCodeUsedAt = account.activationCodeUsedAt || new Date().toISOString();
  // Clear whatever lockout state the failed sign-in attempts left behind.
  clearFailures(account);

  persist();
  return { workerId: id, action };
}

/** Snapshot of account state for the dev seed script's console output. No hashes. */
export function devListAccounts() {
  if (process.env.NODE_ENV === "production") return [];
  return accounts.map((a) => ({
    workerId: a.workerId,
    displayName: a.displayName,
    role: a.role,
    status: a.status,
    hasPassword: Boolean(a.passwordHash),
    failedAttempts: a.failedAttempts || 0,
    lockedUntil: a.lockedUntil,
    awaitingActivationCode: Boolean(a.activationCodeHash),
  }));
}

// Safe projection — never leaks hashes to a route handler by accident.
export function publicAccount(account) {
  return {
    workerId: account.workerId,
    displayName: account.displayName,
    phc: account.phc,
    role: account.role,
    lastLoginAt: account.lastLoginAt,
    passwordUpdatedAt: account.passwordUpdatedAt,
  };
}

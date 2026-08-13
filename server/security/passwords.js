// security/passwords.js
// Password hashing and policy. Uses Node's built-in scrypt — a memory-hard KDF —
// so no third-party crypto dependency enters the supply chain.
//
// Storage format: scrypt$N$r$p$<salt-b64>$<hash-b64>. The parameters travel with
// the hash so cost can be raised later without invalidating existing accounts.

import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

// OWASP-recommended floor for scrypt (N=2^15, r=8, p=1) with a 64 MiB budget.
const PARAMS = { N: 32768, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 32;

// scrypt needs maxmem >= ~128 * N * r; give it headroom or Node throws.
const MAXMEM = 256 * PARAMS.N * PARAMS.r;

export async function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scrypt(normalize(plain), salt, PARAMS.keylen, {
    N: PARAMS.N, r: PARAMS.r, p: PARAMS.p, maxmem: MAXMEM,
  });
  return [
    "scrypt", PARAMS.N, PARAMS.r, PARAMS.p,
    salt.toString("base64"), derived.toString("base64"),
  ].join("$");
}

// Constant-time verification. Returns false on any malformed record rather than
// throwing, so a corrupted account row can never be coerced into an auth bypass.
export async function verifyPassword(plain, stored) {
  try {
    if (typeof stored !== "string") return false;
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const [, N, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scrypt(normalize(plain), salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * Number(N) * Number(r),
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// Unicode-normalize so a password typed on a different keyboard/IME still matches.
function normalize(plain) {
  return String(plain ?? "").normalize("NFKC");
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

const MIN_LENGTH = 12;
const MAX_LENGTH = 200; // bounded so a huge input can't be used as a CPU-burn DoS

// Passwords an attacker tries first against an Indian public-health deployment.
// Kept short and specific — a real deployment should swap in a full breached-password
// list (e.g. a k-anonymity range check against Have I Been Pwned).
const BLOCKLIST = new Set([
  "password", "password1", "password123", "123456789012", "qwertyuiop12",
  "asha12345678", "welcome12345", "admin1234567", "sakhi1234567", "iloveyou123",
  "letmein12345", "healthworker", "ashaworker12", "abcd12345678", "000000000000",
]);

export function validatePasswordPolicy(password, { workerId = "" } = {}) {
  const errors = [];
  const pw = normalize(password);

  if (pw.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (pw.length > MAX_LENGTH) {
    errors.push(`Password must be at most ${MAX_LENGTH} characters.`);
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) {
    errors.push("Use at least three of: lowercase, uppercase, numbers, symbols.");
  }

  // The worker ID is printed on their ID card — it must not be the password,
  // which is exactly what a "use your ID to set a password" flow tempts people into.
  const id = String(workerId || "").toLowerCase();
  if (id && pw.toLowerCase().includes(id)) {
    errors.push("Password must not contain your worker ID.");
  }
  if (BLOCKLIST.has(pw.toLowerCase())) {
    errors.push("This password is too common. Choose something less guessable.");
  }
  if (/^(.)\1+$/.test(pw)) {
    errors.push("Password must not be a single repeated character.");
  }
  if (isSequential(pw)) {
    errors.push("Password must not be a simple sequence.");
  }

  return { ok: errors.length === 0, errors };
}

function isSequential(pw) {
  if (pw.length < 4) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < pw.length; i++) {
    const delta = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
    if (delta !== 1) ascending = false;
    if (delta !== -1) descending = false;
  }
  return ascending || descending;
}

export const PASSWORD_RULES = {
  minLength: MIN_LENGTH,
  maxLength: MAX_LENGTH,
  requiredClasses: 3,
};

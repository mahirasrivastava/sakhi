// security/rateLimit.js
// In-memory sliding-window rate limiting for the auth endpoints.
//
// The account lockout in accounts.js protects one worker's account. This
// protects the endpoint itself: without it, an attacker can spray one guess
// across every worker ID in the district ("password spraying") and never trip a
// single per-account lockout.

const buckets = new Map();
const SWEEP_INTERVAL_MS = 60e3;

/**
 * @param {object} opts
 * @param {number} opts.windowMs   size of the sliding window
 * @param {number} opts.max        allowed hits per window
 * @param {string} opts.name       label used in audit records
 */
export function createLimiter({ windowMs, max, name }) {
  return {
    name,
    windowMs,
    max,
    /** @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }} */
    check(key) {
      const bucketKey = `${name}:${key}`;
      const now = Date.now();
      const hits = (buckets.get(bucketKey) || []).filter((t) => now - t < windowMs);

      if (hits.length >= max) {
        const retryAfterMs = windowMs - (now - hits[0]);
        buckets.set(bucketKey, hits);
        return { allowed: false, remaining: 0, retryAfterMs };
      }

      hits.push(now);
      buckets.set(bucketKey, hits);
      return { allowed: true, remaining: max - hits.length, retryAfterMs: 0 };
    },
    reset(key) {
      buckets.delete(`${name}:${key}`);
    },
  };
}

// Per-IP across all auth endpoints — catches spraying and enumeration sweeps.
export const authIpLimiter = createLimiter({ name: "auth-ip", windowMs: 15 * 60e3, max: 30 });

// Per worker ID regardless of source IP — catches a distributed attack on one
// account that rotates IPs to dodge the limiter above.
export const authIdLimiter = createLimiter({ name: "auth-id", windowMs: 15 * 60e3, max: 10 });

// Activation is rarer and more dangerous (it sets the first password), so it is
// tighter than ordinary login.
export const activationIpLimiter = createLimiter({ name: "activate-ip", windowMs: 60 * 60e3, max: 10 });

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    // Longest window in use is one hour; drop anything fully outside it.
    const live = hits.filter((t) => now - t < 60 * 60e3);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}, SWEEP_INTERVAL_MS);
sweep.unref?.();

// security/middleware.js
// Cookie handling, security headers, and the auth/CSRF guards.
//
// Cookies are parsed and serialized here by hand rather than pulling in
// cookie-parser: it is ~20 lines, and every dependency added to a service
// holding minors' health data is another supply-chain entry point.

import { touchSession, verifyCsrf, destroySession } from "./authSessions.js";
import { findAccount, ACCOUNT_STATUS } from "./accounts.js";
import { audit, AUDIT } from "./audit.js";

export const SESSION_COOKIE = "sakhi_asha_session";
export const CSRF_COOKIE = "sakhi_csrf";
export const CSRF_HEADER = "x-csrf-token";

const isProduction = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export function cookieParser(req, res, next) {
  const header = req.headers.cookie;
  req.cookies = {};
  if (header) {
    for (const part of header.split(";")) {
      const idx = part.indexOf("=");
      if (idx < 1) continue;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!(key in req.cookies)) {
        try {
          req.cookies[key] = decodeURIComponent(value);
        } catch {
          req.cookies[key] = value;
        }
      }
    }
  }
  next();
}

function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
  parts.push(`Path=${opts.path || "/"}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  // Strict (not Lax) — there is no legitimate cross-site navigation into the
  // dashboard, and Strict is the strongest CSRF backstop the browser offers.
  parts.push(`SameSite=${opts.sameSite || "Strict"}`);
  // Secure is required in production; omitted on localhost so http dev works.
  if (opts.secure ?? isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function setAuthCookies(res, { token, csrfSecret, maxAge }) {
  res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,   // unreadable from JavaScript, so XSS cannot exfiltrate it
    maxAge,
    path: "/",
  }));
  // The CSRF secret is deliberately readable by JS — the client must echo it
  // back in a header. That echo is what a cross-site attacker cannot perform.
  res.append("Set-Cookie", serializeCookie(CSRF_COOKIE, csrfSecret, {
    httpOnly: false,
    maxAge,
    path: "/",
  }));
}

export function clearAuthCookies(res) {
  res.append("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" }));
  res.append("Set-Cookie", serializeCookie(CSRF_COOKIE, "", { httpOnly: false, maxAge: 0, path: "/" }));
}

// ---------------------------------------------------------------------------
// Client IP
// ---------------------------------------------------------------------------

// Only trust X-Forwarded-For when explicitly told there is a proxy in front;
// otherwise a client can forge the header and slip every rate limit.
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

export function clientIp(req, res, next) {
  if (TRUST_PROXY) {
    const fwd = req.headers["x-forwarded-for"];
    req.clientIp = fwd ? String(fwd).split(",")[0].trim() : req.socket.remoteAddress;
  } else {
    req.clientIp = req.socket.remoteAddress;
  }
  next();
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

export function securityHeaders(req, res, next) {
  // This API serves JSON only; a page-level CSP this strict costs nothing here
  // and blocks anything injected into an error page from executing.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");           // clickjacking the dashboard
  res.setHeader("Referrer-Policy", "no-referrer");    // session IDs must not leak in Referer
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

// Patient data must never sit in a shared cache or a browser's back-forward cache.
export function noStore(req, res, next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

/**
 * Rejects the request unless it carries a live session cookie for an active
 * account. On success attaches req.auth = { workerId, account, session, token }.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const result = touchSession(token, { ip: req.clientIp, userAgent: req.get("user-agent") });

  if (!result.ok) {
    clearAuthCookies(res);
    audit(AUDIT.SESSION_REJECTED, { req, outcome: "denied", reason: result.reason });
    return res.status(401).json({
      error: "Sign in as an ASHA worker to view this.",
      reason: result.reason,
    });
  }

  const account = findAccount(result.session.workerId);
  // An account revoked mid-shift loses access on its very next request.
  if (!account || account.status !== ACCOUNT_STATUS.ACTIVE) {
    destroySession(token);
    clearAuthCookies(res);
    audit(AUDIT.SESSION_REJECTED, { req, actor: result.session.workerId, outcome: "denied", reason: "account_inactive" });
    return res.status(401).json({ error: "This account is no longer active.", reason: "account_inactive" });
  }

  if (result.ipChanged) {
    // Not fatal — mobile networks reassign addresses constantly — but a session
    // hopping addresses is exactly the shape of a stolen cookie, so it is logged.
    audit(AUDIT.SESSION_IP_CHANGED, { req, actor: account.workerId, outcome: "ok" });
  }

  req.auth = { workerId: account.workerId, account, session: result.session, token };
  next();
}

/**
 * Double-submit CSRF check for state-changing requests. The browser attaches the
 * session cookie automatically on a cross-site request; it will not attach this
 * header, and a cross-origin page cannot read the CSRF cookie to forge it.
 */
export function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const presented = req.get(CSRF_HEADER) || req.body?.csrfToken;
  const cookieValue = req.cookies?.[CSRF_COOKIE];

  // Must match the server-held secret AND the cookie — so a stale or injected
  // cookie alone is not enough.
  const matchesSession = verifyCsrf(req.auth?.session, presented);
  const matchesCookie = Boolean(cookieValue) && cookieValue === presented;

  if (!matchesSession || !matchesCookie) {
    audit(AUDIT.CSRF_REJECTED, { req, actor: req.auth?.workerId ?? null, outcome: "denied" });
    return res.status(403).json({ error: "Request blocked. Refresh the page and try again.", reason: "csrf" });
  }
  next();
}

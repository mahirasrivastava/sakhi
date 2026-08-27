const BASE = "/api";

// The session lives in an HttpOnly cookie the browser attaches automatically —
// it is never held in JS, so an XSS bug cannot read or exfiltrate it. What JS
// *can* read is the CSRF cookie, and echoing it back in a header is what proves
// the request came from our own page rather than an attacker's.
function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const csrfToken = () => readCookie("sakhi_csrf");

// Patient accounts carry their own cookie pair and their own header, kept
// separate from the staff one so a signed-in user can never be mistaken for a
// signed-in worker. See server/security/patientAuth.js.
const userCsrfToken = () => readCookie("sakhi_user_csrf");

// Set by AuthContext so an expired session anywhere in the app bounces the
// worker back to the sign-in screen instead of showing a dead page.
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

class ApiError extends Error {
  constructor(message, { status, reason, details, body } = {}) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.details = details;
    // Full response body, so callers can read dev-only diagnostic fields
    // (devMessage/devReason) and retry hints without widening this signature
    // every time the server adds one.
    this.body = body || {};
  }
}

async function req(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const userToken = userCsrfToken();
    if (userToken) headers["X-User-CSRF-Token"] = userToken;
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin", // send the session cookie
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // A 401 on a patient route is an ordinary signed-out state, not an
    // expired staff session, so it must not trigger the staff redirect.
    const isUserRoute = path.startsWith("/user/");
    if (res.status === 401 && !isUserRoute && onUnauthorized) onUnauthorized(body.reason);
    throw new ApiError(body.error || `Request failed (${res.status})`, {
      status: res.status,
      reason: body.reason,
      details: body.details,
      body,
    });
  }
  return res.json();
}

export const api = {
  // --- public, anonymous patient flow ---
  triage: (payload) => req("/triage", { method: "POST", body: JSON.stringify(payload) }),
  navigate: (payload) => req("/navigate", { method: "POST", body: JSON.stringify(payload) }),
  // payload: { frames: [[{r,g,b}...], ...], reference: [{r,g,b}...], focusScore,
  //            symptoms: string[], risks: string[] }
  anaemiaScreen: (payload) => req("/anaemia-screen", { method: "POST", body: JSON.stringify(payload) }),
  // The checklist labels come from the server so they cannot drift out of step
  // with the weights that score them.
  anaemiaQuestions: () => req("/anaemia-screen/questions"),
  // Read a prescription photo with the free vision model. imageBase64 is a bare
  // base64 string (no data: prefix); the server strips a prefix anyway.
  prescriptionRead: (imageBase64, mimeType) =>
    req("/prescription/read", { method: "POST", body: JSON.stringify({ imageBase64, mimeType }) }),
  reportSummarize: (context) =>
    req("/report/summarize", { method: "POST", body: JSON.stringify({ context }) }),
  impact: () => req("/impact"),
  knowledgeCategories: (lang) => req(`/knowledge/categories?lang=${lang}`),
  knowledgeBrowse: (category, lang) => req(`/knowledge/browse?category=${category}&lang=${lang}`),
  knowledgeSearch: (q, lang, category) => {
    const params = new URLSearchParams({ q, lang });
    if (category) params.set("category", category);
    return req(`/knowledge/search?${params}`);
  },

  // --- optional patient accounts ---
  // Every route above works without any of these. An account stores a username,
  // a password hash and display preferences; health findings stay on the device.
  user: {
    register: (payload) => req("/user/register", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload) => req("/user/login", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => req("/user/logout", { method: "POST" }),
    me: () => req("/user/me"),
    setPreferences: (payload) =>
      req("/user/preferences", { method: "PATCH", body: JSON.stringify(payload) }),

    // Email verification + password recovery (Point 2)
    verifyEmail: (payload) => req("/user/verify-email", { method: "POST", body: JSON.stringify(payload) }),
    resendVerification: (payload) => req("/user/resend-verification", { method: "POST", body: JSON.stringify(payload) }),
    forgotPassword: (email) => req("/user/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    resetPassword: (payload) => req("/user/reset-password", { method: "POST", body: JSON.stringify(payload) }),

    // Opt-in, login-gated health history (Point 2). Every call is scoped to the
    // signed-in account server-side.
    saveHistory: (kind, data) => req("/user/history", { method: "POST", body: JSON.stringify({ kind, data }) }),
    listHistory: () => req("/user/history"),
    deleteHistory: (id) => req(`/user/history/${id}`, { method: "DELETE" }),
    clearHistory: () => req("/user/history", { method: "DELETE" }),
  },

  // --- ASHA authentication ---
  auth: {
    policy: () => req("/auth/policy"),
    activate: (payload) => req("/auth/activate", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload) => req("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    logout: () => req("/auth/logout", { method: "POST" }),
    me: () => req("/auth/me"),
    changePassword: (payload) => req("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  },

  // --- restricted: authenticated ASHA workers only ---
  sessions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/sessions${qs ? `?${qs}` : ""}`);
  },
  // The list is redacted; this is the audited call that reveals one record.
  session: (id) => req(`/sessions/${id}`),
  // Deletion is irreversible, so the server re-checks the worker's password.
  deleteSession: (id, password) =>
    req(`/sessions/${id}`, { method: "DELETE", body: JSON.stringify({ password }) }),
};

export { ApiError };

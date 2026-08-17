const BASE = "/api";

// The session lives in an HttpOnly cookie the browser attaches automatically —
// it is never held in JS, so an XSS bug cannot read or exfiltrate it. What JS
// *can* read is the CSRF cookie, and echoing it back in a header is what proves
// the request came from our own page rather than an attacker's.
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)sakhi_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

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
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "same-origin", // send the session cookie
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && onUnauthorized) onUnauthorized(body.reason);
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
  impact: () => req("/impact"),
  analysePrescription: (payload) =>
    req("/prescription/analyze", { method: "POST", body: JSON.stringify(payload) }),
  prescriptionFamilyOptions: () => req("/prescription/family-history-options"),
  // Which OCR engine the server can offer. Drives both the code path taken and
  // what the user is told about where their photograph goes, so it is fetched
  // before the file picker rather than after.
  ocrStatus: () => req("/prescription/ocr/status"),
  // Relays the image to the configured vision provider. The server holds the
  // API key — a key in the client bundle is a key published — and forwards the
  // image once without storing it.
  prescriptionOcr: (payload) =>
    req("/prescription/ocr", { method: "POST", body: JSON.stringify(payload) }),
  knowledgeCategories: (lang) => req(`/knowledge/categories?lang=${lang}`),
  knowledgeBrowse: (category, lang) => req(`/knowledge/browse?category=${category}&lang=${lang}`),
  knowledgeSearch: (q, lang, category) => {
    const params = new URLSearchParams({ q, lang });
    if (category) params.set("category", category);
    return req(`/knowledge/search?${params}`);
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

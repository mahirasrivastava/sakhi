const BASE = "/api";

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  triage: (payload) => req("/triage", { method: "POST", body: JSON.stringify(payload) }),
  anaemiaScreen: (pixels) => req("/anaemia-screen", { method: "POST", body: JSON.stringify({ pixels }) }),
  sessions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/sessions${qs ? `?${qs}` : ""}`);
  },
  deleteSession: (id) => req(`/sessions/${id}`, { method: "DELETE" }),
  impact: () => req("/impact"),
};

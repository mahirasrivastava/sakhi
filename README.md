# Sakhi — private health triage companion

React (Vite) frontend + Node/Express backend. Rules-first, escalate-only triage
with an optional IBM watsonx.ai Granite reasoning layer.

## Run it

Two terminals:

```bash
cd server
npm install
npm start        # http://localhost:4000
```

```bash
cd client
npm install
npm run dev       # http://localhost:5173, proxies /api to :4000
```

No API keys are required. Without `WATSONX_API_KEY` / `WATSONX_PROJECT_ID` set,
the triage agent runs in **rules-only mode** — this is a real, working fallback,
not a stub. To enable the watsonx.ai reasoning layer, set env vars on the server:

```bash
WATSONX_API_KEY=...
WATSONX_PROJECT_ID=...
WATSONX_URL=https://us-south.ml.cloud.ibm.com   # optional, region-specific
```

## What's built

- **Three agents + orchestrator**: Intake → Triage (rules engine + optional
  watsonx.ai Granite) → Routing. `server/orchestrator.js` ties them together.
- **Escalate-only guarantee**: the model can only raise the level the rules
  engine already produced — enforced in code (`enforceEscalateOnly`), not just
  by prompting. See `server/rulesEngine.js` and `server/agents/llmReasoner.js`.
- **Explainable result card**: urgency, plain-language reason, rules fired vs.
  what the model added, confidence bar, "not a diagnosis" line.
- **ASHA / clinician dashboard** at `/dashboard`: sessions ranked by urgency,
  filters, and a trace drawer showing the full reasoning + a delete-my-data control.
- **Camera-based anaemia screen** at `/anaemia`: samples eyelid-region pixels
  client-side, sends only aggregate colour data (never the photo) to the
  server for a pallor score. Always returns a screening flag, never a
  haemoglobin number.
- **Cycle & pregnancy tracker** at `/cycle`: week-by-week WHO danger-sign
  checklist.
- **Impact page** at `/impact`: real Rural Health Statistics figures + a live
  session counter pulled from the actual store.
- **EN / HI / KN** language toggle, persisted, applied across nav + all copy
  keys currently wired.
- **Safety design**: self-harm/abuse keywords in free text are intercepted in
  the Intake agent and never reach the model layer (`safetyFlag`) — routed to
  a human-review path instead.

## What's intentionally deferred (flagged, not hidden)

Given the timeline, these are documented as future scope rather than half-built:
tap-to-call SOS flow, offline service worker, accessibility mode (icon picker,
speech in/out), full `/demo` seeded-scenario route, consent screen, PDF export
of the result card. The data contracts for most of these (e.g. `bloodDonorStandby`,
`ashaAlert` on every session) already exist in the API response, so they're
additive, not a rebuild.

## Anaemia screen — accuracy note

The pallor heuristic (`server/routes/anaemia.js`) is a coarse RGB-ratio
estimate over sampled pixels, tuned toward catching more false positives
than false negatives. It is a screening flag only. Say this explicitly in
the demo — don't let it be read as a calibrated clinical instrument.

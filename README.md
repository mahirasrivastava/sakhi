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
- **ASHA / clinician dashboard** at `/dashboard`: **authenticated staff only**
  (see Security below). Sessions ranked by urgency, filters, and a trace drawer
  showing the full reasoning + a delete-my-data control.
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

## Security — the ASHA dashboard

The records in this system belong to girls and women, many of them minors, and
include what they typed in their own words. The staff dashboard is therefore
segregated from the patient-facing app and defended in layers.

### Signing in

Enrollment is **closed**. An account exists only if the district health
authority provisioned that worker ID. On first run the server provisions the
roster in `server/security/accounts.js` and writes one-time activation codes to
`server/data/ACTIVATION-CODES.txt` — hand those to workers out-of-band, then
delete the file.

1. **First-time setup** (`/asha/login` → "First-time setup"): worker ID +
   one-time activation code → choose a password. The code is then burned.
2. **Every login after that**: worker ID + password.

A worker ID on its own is *not* treated as a secret — it is printed on an ID
card and known to the whole PHC. Without the activation code as a second factor,
whoever reached the setup screen first would own the account.

### The layers

| Layer | What it stops |
|---|---|
| Session cookie, `HttpOnly` + `SameSite=Strict` | XSS reading the token; cross-site request forgery |
| Double-submit CSRF token on every write | Forged writes from another site |
| scrypt password hashing (N=32768), per-user salt | Offline cracking if the account file leaks |
| Password policy: 12+ chars, 3 character classes, no worker ID, blocklist | Guessable staff passwords |
| Account lockout: 5 failures → 15 min, escalating to 24 h | Brute force against one worker |
| Per-IP and per-ID rate limits | Password spraying across the whole roster |
| Uniform error messages | Enumerating which worker IDs exist |
| Idle timeout (15 min) + absolute timeout (8 h) | A tablet left unattended at a PHC |
| Session bound to browser fingerprint | A stolen cookie replayed elsewhere |
| Sessions in memory only, stored as hashes | A copied data directory yielding live sessions |
| **Redacted list endpoint** | A whole-database dump from one request |
| Step-up password re-entry before deletion | Irreversible loss from an unattended session |
| Append-only audit log | Not knowing whose data was read after a breach |
| Strict CORS allowlist + security headers | Any website reading the API from a worker's browser |

### Data minimization

`GET /api/sessions` returns urgency, timing, and which rules fired — never free
text, age, or pregnancy details. Those come only from `GET /api/sessions/:id`,
one record at a time, and that call is written to the audit log against the
worker's ID. Opening a girl's record is a deliberate, attributable act rather
than a side effect of loading a page.

### The audit log

`server/data/audit-log.jsonl`, append-only, 0600. Records *who* opened *which*
record — never the contents, because an audit log that copies the sensitive
payload just doubles the size of a breach. Client IPs are hashed with a
per-boot salt.

### Operational notes

- The security layer adds **no new npm dependencies** — it uses Node's built-in
  `crypto` only. Every dependency in a service holding minors' health data is
  another supply-chain entry point.
- `server/data/asha-accounts.json`, `ACTIVATION-CODES.txt` and `audit-log.jsonl`
  are written 0600 and are gitignored.
- Set `ALLOWED_ORIGINS` in production. Set `TRUST_PROXY=true` **only** behind a
  real reverse proxy — otherwise clients can forge `X-Forwarded-For` and evade
  every rate limit.
- `NODE_ENV=production` adds `Secure` to cookies and enables HSTS. Serve over
  TLS; none of the above protects a plaintext connection.
- Sessions are per-process and in memory, so restarting the server signs
  everyone out. That is deliberate.

### Still open

- `sessions.json` is stored in plaintext on disk. Encryption at rest, and a real
  database with per-record access control, is the next step before any pilot
  with live patients.
- No MFA beyond the activation code. For staff handling minors' records, TOTP
  is the natural next layer.
- Password reset is not built. Today a locked-out worker needs an administrator
  to re-provision them.

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

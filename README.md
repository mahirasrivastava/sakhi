# Sakhi — private health triage companion

React (Vite) frontend + Node/Express backend. Rules-first, escalate-only triage
for women and girls in rural India, with an optional AI reasoning layer.

**Everything needed to run Sakhi is free.** It works with **zero configuration**
(rules-only triage, local storage), and every optional feature uses a free-tier
service. There is no paid dependency anywhere.

## Prerequisites

- **Node.js 18 or newer** (`node --version`)
- npm (comes with Node)

## Setup

### 1. Install dependencies (both folders)

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Create your `.env`

The server reads secrets from `server/.env`. That file is **git-ignored** — it
holds YOUR keys and must never be committed. `server/.env.example` is the
**template** that IS committed, so anyone cloning the repo knows what to fill in.

Create your own copy:

```bash
cd server
cp .env.example .env      # Windows PowerShell: copy .env.example .env
```

You can leave `.env` exactly as-is — the app runs fine with everything blank
(rules-only triage, data in local JSON files). Fill in a section only to turn
that feature on. **Do not rename `.env.example` to `.env`** — keep both: the
example is the shared template, `.env` is your private copy.

### 3. (Optional) Turn on free AI — no Watson, no cost

The AI layer is used for smarter triage, prescription OCR, and the AI report
summary. **It is entirely optional** — with no provider, triage runs on the
deterministic rules engine and the app works fully. Pick any of:

- **IBM Granite via Ollama** — local, free, unlimited, offline. **Optional and
  installed separately** (see below); **not required to run the app**.
- **IBM Granite via Hugging Face** — free cloud token: https://huggingface.co/settings/tokens → `HF_API_KEY=...`
- **Groq** (fastest, no card): https://console.groq.com/keys → `GROQ_API_KEY=...`
- **Google Gemini** (needed for OCR vision): https://aistudio.google.com/apikey → `GEMINI_API_KEY=...`

**Provider priority** (the app uses the first one that is configured; on any
error it falls back to rules-only triage):

1. **Ollama + IBM Granite** — *only when you explicitly opt in* with `LLM_PROVIDER=ollama`
2. **Hugging Face + IBM Granite** — the cloud IBM option (`HF_API_KEY`)
3. **Groq**, then **Gemini** — free fallbacks
4. **Rules-only** — if no AI provider is configured

> **Prescription OCR** always uses **Gemini** (its vision reads handwriting
> best) — set `GEMINI_API_KEY` to enable OCR regardless of the text provider.

#### Using IBM Granite locally with Ollama (optional)

This is our preferred setup for the demo, but it is **opt-in and separate** — a
clone that doesn't do this is unaffected:

1. Install Ollama once from **https://ollama.com** (separate app, not part of this repo).
2. Download the model once: `ollama pull granite3.3` (~4.9 GB — stored by Ollama
   on your machine, **never committed to this repo**).
3. In `server/.env`, uncomment **one line**: `LLM_PROVIDER=ollama`.

Setting `OLLAMA_MODEL` / `OLLAMA_BASE_URL` only customises Ollama — they do **not**
switch it on, so Ollama can never accidentally become a requirement for someone
who just clones and runs.

Check any provider with `cd server && npm run test:llm` (it shows "🧠 running IBM
Granite" when Granite is active).

> IBM watsonx is also supported for anyone who has credits (`WATSONX_API_KEY`,
> `WATSONX_PROJECT_ID`), but it is **off by default** because it bills per call.

### 4. (Optional) Turn on Supabase (durable database)

Without this, data lives in local JSON files (fine for a demo, lost on a
redeploy). With it, everything the user creates — triage sessions, health
history, and accounts — lives in Postgres.

1. Create a project at https://supabase.com.
2. **Project Settings → API**: copy the **Project URL** and the **`service_role`**
   key into `server/.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **SQL Editor → New query**: paste and Run each migration file in order:
   `server/migrations/001_schema.sql`, then `002_patient_history.sql`, then
   `003_patient_accounts.sql`.

Full click-by-click walkthrough (plus Gmail and the scaling Q&A) is in
**`SETUP-FREE.md`**.

### 5. (Optional) Turn on email

For real password-reset / verification emails, set the `SMTP_*` values in
`server/.env` (Gmail App Password works). **Without email configured, reset and
verification links print to the server terminal** — a working dev mode, see the
"Accounts" note below.

### 6. Run it (two terminals)

```bash
cd server && npm run dev     # http://localhost:4000
```
```bash
cd client && npm run dev     # http://localhost:5173, proxies /api to :4000
```

## Accounts & data storage

- **Accounts are optional.** The entire app works signed out — triage, anaemia
  screen, cycle tracker, helplines, schemes, the printable report. An account
  only lets a returning user carry their history between devices.
- **Where data lives:** with Supabase configured, triage sessions
  (`001`), opt-in health history (`002`) and patient accounts (`003`) are all in
  Postgres. Without it, they fall back to local JSON files under `server/data/`.
  Accounts store a username, a password **hash** (never plaintext) and an
  optional recovery email — never health data.
- **Forgot username/password?** Recovery is by the email entered at signup. If
  you have **not** set up email (`SMTP_*`), the reset link is printed to the
  **server terminal** instead of sent — usable for development, but before real
  users you should configure Gmail so people can actually recover. Because
  accounts are optional, a forgotten login is not catastrophic: the person can
  keep using everything signed out, or make a new account.

## What uses AI (all optional, all free)

| Feature | Where | Needs |
|---|---|---|
| Triage compound-pattern reasoning | `/triage` | any text provider (Ollama/HF Granite, Groq, Gemini) — else rules-only |
| Prescription OCR | `/prescription` | Gemini key (vision) |
| Plain-language report summary | `/report` | any text provider |
| Retrieval (health cards) | `/sakhi` | none — built-in BM25, no external service |

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
- Password reset for **patient accounts** is built (email link / code, see
  "Accounts & data storage"). For **ASHA staff** it is deliberately not — a
  locked-out worker is re-provisioned by an administrator.

## What's intentionally deferred (flagged, not hidden)

Given the timeline, these are documented as future scope rather than half-built:
tap-to-call SOS flow, offline service worker, accessibility mode (icon picker,
speech in/out), full `/demo` seeded-scenario route, consent screen. The data contracts for most of these (e.g. `bloodDonorStandby`,
`ashaAlert` on every session) already exist in the API response, so they're
additive, not a rebuild.

## Anaemia screen — accuracy note

The pallor heuristic (`server/routes/anaemia.js`) is a coarse RGB-ratio
estimate over sampled pixels, tuned toward catching more false positives
than false negatives. It is a screening flag only. Say this explicitly in
the demo — don't let it be read as a calibrated clinical instrument.

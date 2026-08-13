# Sakhi — local development

## Run it

```bash
# once
npm run install:all

# terminal 1 — backend on :4000
npm run dev:server

# terminal 2 — frontend on :5173
npm run dev:client
```

Open <http://localhost:5173>.

## Demo ASHA/ANM sign-in

```bash
npm run seed:demo      # create or reset the demo accounts
# then RESTART the backend — it caches accounts in memory at boot
```

Sign in at <http://localhost:5173/asha/login> → **Sign in** tab:

| Worker ID | Password |
|---|---|
| `ASHA-KA-0001` | `SakhiDemo@2026!` |
| `ANM-KA-0101` | `SakhiDemo@2026!` |

`npm run reset:demo` is the same command under a name that reads better when you
are unlocking a locked-out account. `npm run accounts:list` shows account state
without changing anything.

Override the password with `DEMO_PASSWORD=... npm run seed:demo`. It is validated
against the live password policy first, so a rejected password fails at the CLI
rather than at the login screen.

**`ASHA-KA-0002` is deliberately left un-seeded** so the genuine first-time
activation flow stays testable. Its one-time code is in
`server/data/ACTIVATION-CODES.txt`.

### If sign-in fails

1. **Did you restart the backend after seeding?** `accounts.js` loads the JSON
   file once at boot. A running server keeps verifying against the old hash, and
   the seed looks like it silently did nothing. The seed script warns about this
   when it detects a server on :4000.
2. **Locked out?** Five wrong passwords locks the account for 15 minutes
   (escalating to 1h, 4h, 24h). `npm run reset:demo` clears the lock.
3. **429 Too Many Attempts?** That is the endpoint rate limiter (30/15min per IP,
   10/15min per worker ID), which is separate from the lockout and is *not*
   cleared by seeding. It is in-memory — restart the backend to clear it.

## What is development-only — DO NOT SHIP

| Thing | Where | Why it must not reach production |
|---|---|---|
| `npm run seed:demo` / `reset:demo` | `server/scripts/seed-demo.js` | Sets a known password on a real worker ID. Refuses to run under `NODE_ENV=production`, and the `devProvisionDemoAccount` helper it calls refuses independently. |
| `devProvisionDemoAccount`, `devListAccounts` | `server/security/accounts.js` | Guarded on `NODE_ENV !== "production"`. Never exposed over HTTP — CLI only. |
| `demoMode` / `demo` in `GET /api/auth/policy` | `server/routes/auth.js` | Omitted entirely in production, so the login page's demo banner cannot render there. |
| `devReason` / `devMessage` on activation failures | `server/routes/auth.js` | Precise failure causes ("already activated", "unknown worker ID") would make the endpoint a roster-enumeration oracle. Production returns only the uniform message. The audit log records the true cause in every environment. |
| The demo password itself | `server/scripts/seed-demo.js` | It lives in a dev script, never in application code. |

Set `NODE_ENV=production` and all five turn off together. `SAKHI_DEMO=0` also
forces the demo hints off in development if you want to test the production
error text locally.

### Security that was NOT weakened

Nothing in the login path changed. Still fully in force: scrypt password hashing
(N=32768), HttpOnly + SameSite=Strict session cookies, double-submit CSRF,
server-side sessions with idle + absolute timeouts and UA fingerprinting, the
escalating account lockout, per-IP and per-worker-ID rate limiting, the audit
log, the CORS allowlist, and `requireAuth` on every route that touches a patient
record. The seed script short-circuits *provisioning* only, and it hashes with
the same `hashPassword()` the real activation flow uses — a seeded account is
byte-for-byte identical in shape to a genuinely activated one.

## Other environment flags

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4000` | Backend port. |
| `NODE_ENV` | unset | `production` enables Secure cookies + HSTS and disables everything in the table above. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowlist. |
| `TRUST_PROXY` | `false` | Honour `X-Forwarded-For`. Only enable behind a real proxy — otherwise clients forge it and bypass rate limiting. |
| `SAKHI_DEMO` | on in dev | `0` forces demo hints off. |
| `DEMO_PASSWORD` | `SakhiDemo@2026!` | Password used by the seed script. |

## Notes on the other features

**Anaemia screen** (`server/routes/anaemia.js`) is an uncalibrated heuristic. The
reference values in `FEATURE_PRIORS` are literature-informed starting points, not
fitted against paired haemoglobin results. Before this is used on real patients it
needs local calibration against CBC values. See the note at the bottom of that
file for what a CNN replacement would actually require.

**Languages**: all 22 Eighth Schedule languages plus English. Everything except
English, Hindi and Kannada is marked `reviewed: false` in
`client/src/i18n/languages.js` and shows a "beta" tag in the picker. Those need a
native speaker before deployment — a mistranslated danger sign is a safety bug,
not a typo.

**DIGIPIN** (`client/src/digipin.js`) is computed on-device; coordinates are never
sent to the server. Verified round-trip accurate to within the ~3.8 m cell.

**Prescription OCR** runs in the browser via tesseract.js. The image never leaves
the device; only extracted text is posted, and nothing is persisted server-side.
The medicine knowledge base (`server/knowledge/medicines.js`) never advises
starting, stopping or changing a medicine — every output is a question to take to
a clinician.

# Deploying Sakhi

**Short version:** the frontend goes on Vercel. The backend cannot, and needs a
host that runs a normal Node process with a disk.

---

## Why the backend does not work on Vercel

Vercel runs serverless functions: each request may hit a fresh, isolated
instance, the filesystem is read-only outside `/tmp`, and nothing survives
between invocations. The Sakhi API is stateful in four places that all break
under that model:

| Code | What it does | On Vercel |
|---|---|---|
| `security/authSessions.js:23` | Sessions in an in-memory `Map` | Sign-in succeeds, then the next request lands on a different instance and 401s. Effectively nobody can stay logged in. |
| `security/rateLimit.js:9` | Rate-limit buckets in an in-memory `Map` | Each instance counts separately, so the real limit becomes N × the intended one. Password spraying stops being throttled — a security regression, not just a bug. |
| `security/accounts.js:52` | `writeFileSync` + `renameSync` on `asha-accounts.json` | Throws `EROFS`. No activation, no password changes, no lockout tracking. |
| `security/audit.js:46` | Appends to `audit-log.jsonl` | Throws, and the record of who opened which patient file is lost. |
| `store.js:26` | Writes `sessions.json` | Triage records vanish between requests. |

There are also `setInterval` sweeps in `authSessions.js` and `rateLimit.js` that
only make sense in a process that stays alive.

Making this genuinely Vercel-native is not a config change. It means replacing
sessions and rate limiting with Redis, and accounts, audit and triage records
with a database. That is a real piece of work, and worth doing only if you
actually want serverless — otherwise a $7 Node service is simpler and closer to
how the code is already written.

**Do not "solve" this by scaling to one Vercel instance or ignoring the errors.**
An audit log that silently fails to write is worse than no audit log, because
the system still behaves as though access is being recorded.

---

## The setup that works

```
Browser ──▶ Vercel (static React)
              │  /api/* rewritten server-side
              ▼
           Render (Node + disk)  ──▶  server/data/
```

The `/api` rewrite in `client/vercel.json` matters more than it looks. It keeps
the browser talking to **one origin**, so the session cookie stays
`SameSite=Strict`. If the client called the backend domain directly, the cookie
would have to be downgraded to `SameSite=None` — giving up the strongest CSRF
protection the browser offers, on an app holding minors' health records.

---

## 1. Backend on Render

1. Push to GitHub (see the git section in `DEVELOPMENT.md`).
2. On [render.com](https://render.com): **New → Blueprint**, point it at the repo.
   It reads `render.yaml` at the root.
3. Set `ALLOWED_ORIGINS` in the dashboard once you know the Vercel URL:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
4. Deploy, then confirm:
   ```bash
   curl https://sakhi-api.onrender.com/api/health
   # {"ok":true,"watsonxConfigured":false,"activeSessions":0}
   ```

### Three settings that will bite you

**`TRUST_PROXY=true` is not optional here.** Without it, `clientIp` falls back to
`req.socket.remoteAddress`, which behind Render's proxy is *the proxy*, not the
user. Every visitor then shares one rate-limit bucket and the first 30 requests
from anyone lock out everybody. It is already set in `render.yaml`; do not remove
it. Equally, never set it on a server that is *not* behind a proxy — then clients
can forge `X-Forwarded-For` and bypass rate limiting entirely.

**The disk is required.** The free plan has no persistent volume, so every
restart wipes `server/data/`. `initAccounts()` would re-provision the roster with
**new** activation codes, and every worker's password would be gone. `render.yaml`
therefore specifies the `starter` plan with a 1 GB disk. If you deploy on free
anyway, treat it as a throwaway demo and expect to re-activate after each restart.

**Keep `numInstances: 1`.** Sessions and rate limits are per-process. Two
instances means random sign-outs and a rate limiter that permits double.

---

## 2. Frontend on Vercel

1. Edit `client/vercel.json` and replace the rewrite destination with your real
   backend URL:
   ```json
   { "source": "/api/:path*", "destination": "https://YOUR-API.onrender.com/api/:path*" }
   ```
   Vercel does not expand environment variables inside `vercel.json`, so this
   has to be the literal host.

   Two things about that file, since JSON cannot carry comments: the `/api`
   rewrite must come **first** (the `/:path*` SPA fallback below it matches
   everything, so a later API rule would never be reached), and do not add
   `"comment"` keys to the rewrite or header objects — Vercel validates
   `vercel.json` against a strict schema and rejects unknown properties.
2. On [vercel.com](https://vercel.com): **Add New → Project**, import the repo, and set
   **Root Directory** to `client`. Framework, build command and output directory
   come from `vercel.json`.
3. Deploy. No environment variables are needed on the frontend — `api.js` calls
   `/api`, and the rewrite does the rest.

Or from the CLI:

```bash
npm i -g vercel
cd client
vercel        # preview
vercel --prod # production
```

---

## 3. Verify the deployment

```bash
# API reachable directly
curl https://YOUR-API.onrender.com/api/health

# API reachable through the Vercel rewrite (this is the one that matters)
curl https://YOUR-APP.vercel.app/api/health

# A session cookie comes back, and is Secure + HttpOnly + SameSite=Strict
curl -i -X POST https://YOUR-APP.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"workerId":"ASHA-KA-0001","password":"..."}' | grep -i set-cookie
```

Then in a browser: deep-link straight to `https://YOUR-APP.vercel.app/anaemia`
and refresh. If that 404s, the SPA fallback rewrite is not being applied.

---

## 4. First sign-in in production

`NODE_ENV=production` disables the demo seed entirely — by design. There is no
seeded password in production, so use the real activation flow:

1. Open the Render logs on first boot. `initAccounts()` prints that codes were
   issued and writes them to `server/data/ACTIVATION-CODES.txt` on the disk.
2. Read the code for your worker ID.
3. On the site, choose **First-time setup** and set a password.
4. Delete `ACTIVATION-CODES.txt` from the disk afterwards.

If you want a public demo where anyone can sign in, that is a deliberate
decision to run a knowingly-weakened deployment — do it on a separate instance
with obviously fake data, never one holding real records.

---

## What is not covered

- **No CDN caching of API responses.** Every `/api` route already sends
  `Cache-Control: no-store`; do not add caching in front of them.
- **Backups.** The Render disk is a single volume. Snapshot it if the data
  matters.
- **watsonx.ai.** Unset in the configs above, so the triage engine runs on rules
  only. Add the credentials as environment variables if you want the LLM path.

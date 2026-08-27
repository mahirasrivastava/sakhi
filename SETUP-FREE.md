# Sakhi — free setup (no Watson, no paid services)

Everything below is free. Nothing here needs a credit card except nothing — really. Do the steps in order.

---

## 0. Install dependencies (run in a terminal, in the project folder)

Open a terminal in `C:\Users\Sonu\Documents\sakhi` and run:

```
cd server
npm install
cd ..\client
npm install
```

The app will not start until this is done (some declared packages weren't installed yet).

To run the app after setup: `npm run dev` in `server` (one terminal) and `npm run dev` in `client` (another terminal).

---

## 1. Free AI (replaces Watson) — pick ONE

The app uses AI for three things: smarter triage, prescription reading (OCR), and the plain-language report summary. **With no key, triage still works** (rules only) — OCR and AI summary are just disabled.

You do **not** need Watson and you do **not** pay anything.

### Option A — Groq (recommended: fastest, no credit card)

1. Go to **https://console.groq.com/keys**, sign in (Google works), click **Create API Key**, copy it.
2. In `server\.env` add:
   ```
   GROQ_API_KEY=gsk_...your key...
   ```

### Option B — Google Gemini (best for prescription OCR)

1. Go to **https://aistudio.google.com/apikey**, click **Create API key**, copy it.
2. In `server\.env` add:
   ```
   GEMINI_API_KEY=AIza...your key...
   ```

### Option C — IBM Granite (free) — our preferred setup, but OPTIONAL

Granite is open-source IBM, so you can run it **free**, no paid watsonx. Two ways:

- **Cloud (easy):** free token at https://huggingface.co/settings/tokens, then in `server\.env`:
  ```
  HF_API_KEY=hf_...your token...
  ```
  (uses `ibm-granite/granite-3.3-8b-instruct` by default)

- **Local via Ollama (unlimited, offline) — optional, installed separately:**
  Ollama is a **separate app** and the model is a **separate ~4.9 GB download** —
  neither is part of this repo, and **neither is required to run Sakhi**.
  1. Install Ollama once: https://ollama.com
  2. Download the model once: `ollama pull granite3.3`
  3. Uncomment **one line** in `server\.env`:
     ```
     LLM_PROVIDER=ollama
     ```
  (`OLLAMA_MODEL` / `OLLAMA_BASE_URL` only customise it — they do NOT switch it
  on, so a plain clone never depends on Ollama.)

**Provider priority** (first configured one wins; any error → rules-only triage):
**1)** Ollama+Granite (only if you opt in) → **2)** Hugging Face+Granite →
**3)** Groq → **4)** Gemini → **5)** rules-only. OCR always uses Gemini.

With HF or Ollama, `npm run test:llm` shows **"🧠 running IBM Granite"**, and
triage results are labelled *(IBM Granite)*.

**Best combo:** set **both**. Groq handles the fast triage text; Gemini handles the prescription photos (its free vision reads handwriting best). The app auto-uses whichever fits.

### Test it

```
cd server
npm run test:llm
```

You want green ticks for the text call (and the vision call if you set Gemini). If a model name ever errors as "decommissioned", open the provider's model list and update `GROQ_MODEL` / `GEMINI_MODEL` in `.env` — that's the only thing that changes.

> If a hackathon rule *requires* watsonx: it's still supported. Set `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` and it'll be used — but it's off by default so you don't get billed.

---

## 2. Supabase — exact steps (your project is empty; this fills it)

You already created a Supabase project. Two things to do: **get the keys**, and **run the SQL**.

### 2a. Get your keys (in the Supabase website)

1. Open your project at **https://supabase.com/dashboard**.
2. Left sidebar → **Project Settings** (the gear) → **API**.
3. Copy two values:
   - **Project URL** → this is `SUPABASE_URL`
   - Under **Project API keys**, the **`service_role`** key (click reveal) → this is `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ The `service_role` key is a secret. It goes **only** in `server\.env`, never in the client, never committed to git.

Put them in `server\.env`:
```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your service_role key...
```

### 2b. Create the tables (in the Supabase website, not a terminal)

1. Left sidebar → **SQL Editor** → **New query**.
2. Open the file `server\migrations\001_schema.sql` in your editor, copy **all** of it, paste into the SQL editor, click **Run**. You should see "Success".
3. New query again. Open `server\migrations\002_patient_history.sql`, copy all, paste, **Run**.
4. New query again. Open `server\migrations\003_patient_accounts.sql`, copy all, paste, **Run**.

That's it — no CLI, no `supabase` command needed. These three files create the triage-session, patient-history and patient-account tables, all locked down with Row Level Security.

> There is **no command line step** for Supabase here. The `npm install` in step 0 is the only terminal work; the SQL runs in the browser SQL editor.

### 2c. Verify

Restart the server (`npm run dev` in `server`). It should boot without the "falling back to JSON file" warning. If you set the keys wrong, it quietly falls back to a local file and logs a warning — check the server terminal.

> With all three migrations run, **everything a user creates is in Supabase**: triage sessions (001), health history (002), and accounts (003). With no Supabase keys, these fall back to local JSON files under `server/data/` (fine for a demo, lost on redeploy). Accounts store a username, a password **hash** (never plaintext) and an optional recovery email — never health data.

---

## 3. Gmail (for real password-reset / verification emails)

**With no SMTP set, emails print to the server terminal** — that's a real dev mode: you copy the reset link from the terminal. To send real email via your Gmail:

1. Turn on 2-Step Verification on your Google account.
2. Google Account → **Security** → **2-Step Verification** → **App passwords** → create one for "Mail". Copy the 16-character password.
3. In `server\.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=youraddress@gmail.com
   SMTP_PASS=the16charapppassword
   MAIL_FROM=Sakhi <youraddress@gmail.com>
   APP_BASE_URL=http://localhost:5173
   ```

(Use your real deployed URL for `APP_BASE_URL` in production so email links point to the right place.)

---

## 4. MediaPipe eye detection — nothing to configure

It loads its model from a free CDN at runtime and **falls back safely** if it can't (offline/blocked). Just test the anaemia screen in a browser with a webcam. If the alignment feels too strict or loose, change `ALIGN_RADIUS` in `client\src\eyeDetection.js`. (For true offline use later, the model can be bundled into the app — a follow-up.)

---

## 5. Scaling — you don't need anything extra

For the hackathon and any realistic demo, run it exactly as-is. Once you set the
Supabase keys (step 2), **all user data persists** across restarts and redeploys
— that's the only durability that matters here.

You do **not** need any add-on services (message queues, caches, background
workers, and so on), and nothing in Sakhi requires them. Serving very large traffic across many servers at once
would be a future engineering task — not something to set up now, and not
something that costs anything today.

---

## Recap: what's free here

Groq / Gemini / **IBM Granite** (AI — via Hugging Face or local Ollama) · Supabase (DB) · Gmail SMTP (email) · MediaPipe (eye detection). Total cost: ₹0.

# Sakhi — how to test every feature

Exact steps to check everything: the original features and everything added
recently (free AI, IBM Granite, OCR, accounts + recovery, anaemia eye-gate,
BM25 search, schemes, progress checklist).

Test files to download are in **`test-assets/`**:
- `sample-prescription.png` — upload this to the OCR reader.
- `anaemia-test-card.png` — show/print this for the anaemia screen.

---

## 0. Start the app

Two terminals (from `C:\Users\Sonu\Documents\sakhi`):

```
cd server
npm install
npm run dev        # http://localhost:4000
```
```
cd client
npm install
npm run dev        # http://localhost:5173  (open this in the browser)
```

Everything works with **no keys** (rules-only triage; OCR + AI summary disabled).
To test the AI features, set a free key first — see section 9.

---

## 1. Home + language (30 sec)

1. Open **http://localhost:5173**.
2. You should see the service tiles, and now a **"Your health check"** progress
   checklist, and a **"Read a prescription"** tile.
3. Toggle the language (EN / HI / KN) in the top bar — the interface text
   changes. ✅

## 2. Symptom triage — `/triage`

1. Click **Check how urgent** (or the triage tile).
2. Enter symptoms, e.g. **"heavy bleeding"** + **"dizziness"**, duration 1 day,
   severity 5.
3. Submit → you get an urgency level (self-care / routine / urgent / emergency),
   a plain-language reason, and the rules that fired. Heavy bleeding should come
   back **emergency/urgent**. ✅
4. **Escalate-only check:** with an AI key set (section 9), the "source" line
   should read your provider — and **"(IBM Granite)"** if you're on Granite. The
   AI can only *raise* the level, never lower it.

## 3. Health knowledge / Navigator — `/sakhi`  (BM25 search)

1. Open **Read trusted health information** (`/sakhi`).
2. Search **"bleeding in pregnancy"** → the most relevant cards rank first, each
   citing WHO/NHM.
3. Search nonsense like **"zzzzxq"** → no results (empty, not garbage). ✅

## 4. Anaemia screen — `/anaemia`  (camera + eye-gate + colour fix)

Have **`anaemia-test-card.png`** open on your phone or printed.

1. Open `/anaemia`, click **Start**, allow the camera.
2. Watch the light indicator (red → amber → green) as lighting changes.
3. **Eye-gate:** point at your face — it should say "Eye in position"; point at a
   wall — it should ask you to position your eye (capture stays disabled). ✅
4. **Colour test with the card:** hold **block A (healthy red)** filling the pink
   circle → capture → expect **low pallor (none/mild)**. Then **block B (pale)**
   → expect **higher pallor (moderate/strong)**. ✅
   - ⚠️ On a laptop with MediaPipe working, the eye-gate may block a flat card
     (no real eye). If so, either test the card on a **phone** (gate falls back),
     point at a **real lower eyelid**, or test the pipeline directly via the API
     in section 8.
5. Open the details table — you'll see the new **CIELAB a\*** value (redness) and
   the green-to-red ratio.

## 5. Cycle / pregnancy tracker — `/cycle`

Open `/cycle`, log a week → week-by-week danger-sign checklist appears. ✅

## 6. Nearby help + DIGIPIN — `/nearby`

Open `/nearby`, allow location → you get an ambulance call button and a **DIGIPIN
location code** you can read aloud. ✅

## 7. Helplines + Schemes — `/helplines` and inside `/report`

1. `/helplines` → national numbers grouped (ambulance, **women 181 / 1091**,
   **child 1098**, **cyber 1930**, mental health). ✅
2. Government **schemes** appear inside the printable report (section 12 below).

## 8. Prescription OCR — `/prescription`  (needs a free vision key, section 9)

1. Open the **Read a prescription** tile (`/prescription`).
2. Click **Take / choose a photo** and select **`sample-prescription.png`**.
3. It uploads (auto-shrunk), then lists the medicines it read — Paracetamol,
   Ferrous Sulphate + Folic Acid, Amoxicillin, etc. — each with a confidence
   flag and a **tick-to-confirm** box, plus the ⚠️ "confirm with your chemist"
   disclaimer. ✅
   - No key set → you get a clear "not enabled" message (that's correct).

## 9. Turn on free AI (and IBM Granite) — then re-test 2, 8, 12

Set **one** in `server/.env`, then restart the server:

- **Groq** (fastest): `GROQ_API_KEY=...` from https://console.groq.com/keys
- **Gemini** (needed for OCR vision): `GEMINI_API_KEY=...` from https://aistudio.google.com/apikey
- **IBM Granite, free — cloud:** `HF_API_KEY=...` from https://huggingface.co/settings/tokens
  (defaults to `ibm-granite/granite-3.3-8b-instruct`)
- **IBM Granite, free — local, unlimited:** install https://ollama.com, run
  `ollama pull granite3.3`, then set `LLM_PROVIDER=ollama` in `.env`.

Verify:
```
cd server
npm run test:llm
```
It prints the active provider and — on HF/Ollama/watsonx Granite — **"🧠 running
IBM Granite"**, then does a real text call (and a vision call if Gemini is set).

## 10. Accounts: register → verify → login → forgot → reset — `/account`

1. `/account` → **Create account** tab. Enter a username, an **email**, a
   password (8+), confirm. Submit → "check your email to confirm".
2. **Verification link:** if you didn't set up Gmail, look at the **server
   terminal** — the email (with the verify link) is printed there. Open that
   link → "Email confirmed". ✅
3. **Sign in** with username + password. Your handle + email show, with a
   verified badge. ✅
4. **Forgot password:** sign out → **Sign in** tab → **Forgot your password?** →
   enter the email → a reset link prints to the server terminal → open it → set a
   new password → sign in with the new one. ✅
5. **Auto-logout on tab change:** while signed in, switch to another browser tab
   for a moment, come back → you're signed out (privacy on a shared phone). ✅
6. **History:** signed in, do a triage or anaemia screen, then check it persists
   (and is deletable) — stored server-side under your account.

## 11. Print / PDF + AI summary — `/report`

1. Do a couple of tools (triage, anaemia) so the report has content.
2. Open `/report`.
3. Click **"Add a plain-language summary (AI)"** (needs an AI key) → a short
   summary + next steps appear at the top of the document. ✅
4. Click **Print / save as PDF** → your browser's print dialog → "Save as PDF".
   The AI summary and schemes print with it. ✅

## 12. Schemes in the report

In the report, the **"Entitlements and schemes"** section lists matching govt
programmes (JSY, PMMVY, POSHAN, etc.) based on what you did. ✅

## 13. ASHA staff dashboard — `/asha/login`

1. First run writes one-time activation codes to
   `server/data/ACTIVATION-CODES.txt`.
2. `/asha/login` → **First-time setup** → worker ID + a code from that file →
   set a password. Then log in → the dashboard shows sessions ranked by urgency,
   filters, and a per-record trace drawer. ✅

---

## API smoke tests (optional, fast — no clicking)

Windows: use `curl.exe` in PowerShell. Server must be running.

**Triage:**
```
curl.exe -s -X POST http://localhost:4000/api/triage -H "Content-Type: application/json" -d "{\"symptoms\":[\"fever\",\"headache\"],\"durationDays\":2,\"severity\":3}"
```
Expect JSON with a `triage.level`.

**AI report summary** (needs an AI key):
```
curl.exe -s -X POST http://localhost:4000/api/report/summarize -H "Content-Type: application/json" -d "{\"context\":\"Triage urgency: urgent. Anaemia screen: moderate pallor, blood test suggested.\"}"
```
Expect `{ summary, nextSteps, source }` — `source` names your provider.

**Anaemia pipeline** (direct, bypasses camera + eye-gate). From the `server`
folder:
```
node --input-type=module -e "const px=Array.from({length:80},(_,i)=>({r:175+(i%7),g:80+(i%5),b:85+(i%6)}));const r=await fetch('http://localhost:4000/api/anaemia-screen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pixels:px})});console.log(await r.json());"
```
Expect a `severity` + `pallorScore` + `features.labA`.

**Prescription OCR** (direct, needs Gemini/Groq key). From `server`:
```
node --input-type=module -e "import fs from 'fs';const b64=fs.readFileSync('../test-assets/sample-prescription.png').toString('base64');const r=await fetch('http://localhost:4000/api/prescription/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:b64,mimeType:'image/png'})});console.log(JSON.stringify(await r.json(),null,2));"
```
Expect the medicine list it read back.

---

## Supabase check (if you set the keys)

After running the 3 migrations and setting `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`:
- The server boot log should say `Patient accounts backend: supabase` (not `json-file`).
- In the Supabase **Table Editor** you'll see rows appear in `patient_accounts`
  after you register, and in `patient_history` after a signed-in screen.

---

## Quick troubleshooting

- **"model decommissioned / not found"** → update the matching `*_MODEL` in
  `.env` (`GROQ_MODEL`, `GEMINI_MODEL`, `HF_MODEL`, `OLLAMA_MODEL`) to a current one.
- **OCR says "not enabled"** → set `GEMINI_API_KEY` (best) or `GROQ_API_KEY`.
- **Emails never arrive** → without `SMTP_*` set, they print to the server
  terminal by design. That's where the verify/reset links are.
- **Anaemia card blocked by eye-gate on laptop** → expected; test on phone, on a
  real eyelid, or via the API snippet above.

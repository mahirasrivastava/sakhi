# Connecting IBM watsonx.ai (Granite) to Sakhi

Sakhi runs fine **without** watsonx — it falls back to the deterministic rules
engine. watsonx adds a reasoning layer that can *raise* triage urgency when a
combination of symptoms is riskier than any single rule caught (it can never
*lower* urgency — that's enforced in code). Turning it on is three env vars.

## 1. Create the credentials (one time)

1. Sign in at **https://cloud.ibm.com** (free "Lite" account is enough to start).
2. Create a **watsonx.ai** project:
   - Go to **https://dataplatform.cloud.ibm.com** → **Projects** → **New project** → *Create an empty project*.
   - Associate a **watsonx.ai Runtime** service instance when prompted (Lite plan is free).
3. Get your **Project ID**:
   - Open the project → **Manage** tab → **General** → copy **Project ID** (a UUID).
4. Get your **API key**:
   - **https://cloud.ibm.com** → top bar **Manage** → **Access (IAM)** → **API keys** → **Create** → copy it now (shown once).
5. Note your **region URL** (must match where the project lives):
   - `https://us-south.ml.cloud.ibm.com` (Dallas, default)
   - `https://eu-de.ml.cloud.ibm.com` (Frankfurt)
   - `https://au-syd.ml.cloud.ibm.com` (Sydney — closest to India users)

## 2. Put them in `server/.env`

```
WATSONX_API_KEY=your-api-key
WATSONX_PROJECT_ID=your-project-uuid
WATSONX_URL=https://au-syd.ml.cloud.ibm.com
# optional — defaults to ibm/granite-3-8b-instruct
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

`.env` is git-ignored. Never commit these. The API key is the only secret; the
project id and URL are not sensitive.

## 3. Verify it works

```
cd server
npm run test:watson
```

You want three green ticks: env vars present → IAM token exchange → a live
generation call that comes back with a word. If a step fails, the script tells
you which half is wrong (bad key vs wrong project id vs wrong region) and what
to fix. When all three pass, restart the server and `/api/health` will report
`watsonxConfigured: true`.

## What Sakhi uses it for

- **Triage reasoning** (`server/agents/llmReasoner.js`) — escalate-only, JSON-constrained, never names a drug or disease.

## Model note

The project shipped pointing at `ibm/granite-13b-instruct-v2`, which IBM is
retiring. The default is now `ibm/granite-3-8b-instruct`. If your region lists a
newer Granite instruct model, set `WATSONX_MODEL_ID` to it — no code change.
You can see the models available to your project in the watsonx.ai Prompt Lab.

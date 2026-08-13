import express from "express";
import cors from "cors";
import morgan from "morgan";
import apiRouter from "./routes/api.js";
import knowledgeRouter from "./routes/knowledge.js";
import authRouter from "./routes/auth.js";
import prescriptionRouter from "./routes/prescriptions.js";
import { isConfigured } from "./agents/llmReasoner.js";
import { initAccounts } from "./security/accounts.js";
import { cookieParser, clientIp, securityHeaders } from "./security/middleware.js";
import { sessionStats } from "./security/authSessions.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Behind a reverse proxy in production; see TRUST_PROXY in security/middleware.js
// for why the forwarded header is only honoured when explicitly enabled.
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(clientIp);

// A strict origin allowlist with credentials enabled. The previous `cors()` call
// allowed every origin, which meant any website a worker visited could read the
// dashboard API from their browser.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Same-origin and non-browser clients (curl, health checks) send no Origin.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  credentials: true,           // required for the session cookie
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  maxAge: 600,
}));

// 2 MB is needed for the anaemia pixel payload; auth routes bound their own
// fields far more tightly.
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser);

// Log method/status/timing only. The default "dev" format does not include
// bodies, so patient free text never reaches stdout.
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, watsonxConfigured: isConfigured(), activeSessions: sessionStats().active });
});

app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/prescription", prescriptionRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Error handler. Never leaks a stack trace to the client — an internal path or
// dependency version is free reconnaissance for an attacker.
app.use((err, req, res, next) => {
  if (err?.message === "Origin not allowed") {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  console.error("[error]", err?.message);
  res.status(500).json({ error: "Something went wrong." });
});

initAccounts()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Sakhi server running on http://localhost:${PORT}`);
      console.log(`watsonx.ai Granite configured: ${isConfigured()}`);
      console.log(`Dashboard API is authenticated. Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
    });
  })
  .catch((err) => {
    // If accounts cannot be initialised the dashboard cannot be protected, so
    // refuse to start rather than come up unguarded.
    console.error("[startup] Failed to initialise ASHA accounts:", err);
    process.exit(1);
  });

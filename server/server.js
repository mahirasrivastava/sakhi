import express from "express";
import cors from "cors";
import morgan from "morgan";
import apiRouter from "./routes/api.js";
import { isConfigured } from "./agents/llmReasoner.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, watsonxConfigured: isConfigured() });
});

app.use("/api", apiRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`Sakhi server running on http://localhost:${PORT}`);
  console.log(`watsonx.ai Granite configured: ${isConfigured()}`);
});

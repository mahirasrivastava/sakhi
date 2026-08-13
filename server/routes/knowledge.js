import { Router } from "express";
import { search, browseCategory } from "../knowledge/vectorSearch.js";
import { CATEGORIES } from "../knowledge/healthCorpus.js";

const router = Router();

// GET /api/knowledge/categories — for the navigator UI
router.get("/categories", (req, res) => {
  const lang = req.query.lang || "en";
  res.json(CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label[lang] || c.label.en,
    icon: c.icon,
  })));
});

// GET /api/knowledge/browse?category=maternal&lang=en
router.get("/browse", (req, res) => {
  const { category, lang } = req.query;
  if (!category) return res.status(400).json({ error: "category required" });
  res.json(browseCategory(category, lang || "en"));
});

// GET /api/knowledge/search?q=fever+3+days&lang=hi&category=infection
router.get("/search", (req, res) => {
  const { q, lang, category } = req.query;
  if (!q) return res.status(400).json({ error: "q (query) required" });
  const results = search(q, { lang: lang || "en", category: category || null });
  res.json(results);
});

export default router;

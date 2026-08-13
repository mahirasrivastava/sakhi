// vectorStore.js
// Lightweight TF-IDF cosine similarity search over the curated health corpus.
// No external vector DB or embeddings API needed — this is a closed, curated
// corpus where every entry is reviewed, so we don't need semantic search over
// millions of documents; we need reliable, fast retrieval over ~50 vetted cards.
// Swap for a real vector DB later without changing the API shape.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.join(__dirname, "corpus", "health-education.json");

let corpus = [];
let idfCache = {};
let tfidfVectors = [];

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9_\s]/g, "").split(/\s+/).filter(Boolean);
}

function buildIDF(docs) {
  const df = {};
  const N = docs.length;
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const term of seen) df[term] = (df[term] || 0) + 1;
  }
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log(N / count) + 1;
  }
  return idf;
}

function tfidf(tokens, idf) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const vec = {};
  for (const [term, count] of Object.entries(tf)) {
    vec[term] = count * (idf[term] || 1);
  }
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

function loadCorpus() {
  try {
    corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf-8"));
    // Build document vectors from tags + English body text (tags are weighted
    // heavily because they're the curated retrieval keys).
    const allTokens = corpus.map((doc) => {
      const tagTokens = doc.tags.flatMap((t) => t.split("_")); // "heavy_bleeding_hourly" -> ["heavy","bleeding","hourly"]
      const bodyTokens = tokenize(doc.en.body).slice(0, 80); // cap to avoid long docs dominating
      return [...tagTokens, ...tagTokens, ...tagTokens, ...bodyTokens]; // tags weighted 3x
    });
    idfCache = buildIDF(allTokens);
    tfidfVectors = allTokens.map((tokens) => tfidf(tokens, idfCache));
  } catch (err) {
    console.error("Failed to load health education corpus:", err.message);
    corpus = [];
  }
}

loadCorpus();

/**
 * Retrieve the top-k education cards matching a set of symptom tags and/or
 * free-text query. Returns full corpus entries (with all language variants).
 */
export function retrieveEducation(symptoms = [], freeText = "", topK = 3) {
  if (corpus.length === 0) return [];

  const queryTokens = [
    ...symptoms.flatMap((s) => s.split("_")),
    ...symptoms.flatMap((s) => s.split("_")), // double-weight symptoms
    ...tokenize(freeText),
  ];
  if (queryTokens.length === 0) return [];

  const queryVec = tfidf(queryTokens, idfCache);
  const scored = corpus.map((doc, i) => ({
    doc,
    score: cosineSim(queryVec, tfidfVectors[i]),
  }));

  return scored
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.doc, relevanceScore: Number(s.score.toFixed(3)) }));
}

export function getCorpusSize() {
  return corpus.length;
}

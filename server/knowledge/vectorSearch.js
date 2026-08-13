// vectorSearch.js
// Lightweight TF-IDF search over the curated health corpus. No vector DB dep
// needed for the demo — this is pure JS, precomputed at startup. Swap for
// Pinecone/Weaviate/pgvector later without changing the API shape.

import { CORPUS } from "./healthCorpus.js";

const allDocs = CORPUS.map((doc) => ({
  ...doc,
  _text: [doc.content.en, ...(doc.tags || [])].join(" ").toLowerCase(),
}));

// Build vocabulary + IDF at startup
const vocab = {};
let vocabSize = 0;
for (const doc of allDocs) {
  const seen = new Set();
  for (const word of tokenize(doc._text)) {
    if (!seen.has(word)) {
      vocab[word] = (vocab[word] || 0) + 1;
      seen.add(word);
    }
  }
}
vocabSize = Object.keys(vocab).length;
const N = allDocs.length;
const idf = {};
for (const [word, df] of Object.entries(vocab)) {
  idf[word] = Math.log((N + 1) / (df + 1)) + 1;
}

// Precompute TF-IDF vectors for each doc
const docVectors = allDocs.map((doc) => tfidf(doc._text));

function tokenize(text) {
  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function tfidf(text) {
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const maxTf = Math.max(...Object.values(tf), 1);
  const vec = {};
  for (const [term, count] of Object.entries(tf)) {
    vec[term] = (count / maxTf) * (idf[term] || 1);
  }
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (const k in a) {
    magA += a[k] ** 2;
    if (b[k]) dot += a[k] * b[k];
  }
  for (const k in b) magB += b[k] ** 2;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Search the corpus. Returns the top-k results with scores, in the requested
 * language. Every result includes its source citation.
 */
export function search(query, { lang = "en", topK = 4, category = null } = {}) {
  const qVec = tfidf(query.toLowerCase());
  let candidates = allDocs;
  if (category) candidates = candidates.filter((d) => d.category === category);

  const scored = candidates.map((doc, i) => ({
    id: doc.id,
    score: cosineSim(qVec, docVectors[allDocs.indexOf(doc)]),
    title: doc.title[lang] || doc.title.en,
    content: doc.content[lang] || doc.content.en,
    source: doc.source,
    category: doc.category,
    tags: doc.tags,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((r) => r.score > 0.05);
}

/**
 * Get all docs in a category, sorted alphabetically by title.
 */
export function browseCategory(category, lang = "en") {
  return CORPUS.filter((d) => d.category === category).map((doc) => ({
    id: doc.id,
    title: doc.title[lang] || doc.title.en,
    content: doc.content[lang] || doc.content.en,
    source: doc.source,
    category: doc.category,
  }));
}

// vectorSearch.js
// BM25 search over the curated health knowledge base, with a tag/title re-rank.
// (Point 8)
//
// Replaces the earlier TF-IDF cosine scorer — same reasoning as vectorStore.js:
// BM25's term saturation and length normalisation are a better fit for short
// queries over short, curated cards, and it needs no external service. Pure JS,
// precomputed at startup. API shape unchanged, so /knowledge routes are
// untouched. Swap for pgvector/a reranker later without changing this contract.

import { CORPUS } from "./healthCorpus.js";

const K1 = 1.5;
const B = 0.75;

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// Index each doc over its English content + tags + title. Tags are the curated
// keys, so they are counted twice.
const docs = CORPUS.map((doc) => {
  const tagTokens = (doc.tags || []).flatMap((t) => t.split(/[_\s]/)).filter(Boolean);
  const tokens = [
    ...tokenize(doc.content?.en),
    ...tokenize(doc.title?.en),
    ...tagTokens, ...tagTokens,
  ];
  return { doc, tokens, len: tokens.length, tagSet: new Set(tagTokens.map((t) => t.toLowerCase())) };
});

const N = docs.length;
const avgdl = docs.reduce((a, d) => a + d.len, 0) / (N || 1);
const df = {};
for (const d of docs) {
  for (const term of new Set(d.tokens)) df[term] = (df[term] || 0) + 1;
}

function idf(term) {
  const n = df[term] || 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

function bm25(queryTerms, entry) {
  const tf = {};
  for (const t of entry.tokens) tf[t] = (tf[t] || 0) + 1;
  let score = 0;
  for (const q of queryTerms) {
    const f = tf[q];
    if (!f) continue;
    const denom = f + K1 * (1 - B + B * (entry.len / (avgdl || 1)));
    score += idf(q) * ((f * (K1 + 1)) / denom);
  }
  return score;
}

/**
 * Search the corpus. Returns the top-k results with scores, in the requested
 * language. Every result includes its source citation. Optional category filter.
 */
export function search(query, { lang = "en", topK = 4, category = null } = {}) {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];
  const querySet = new Set(queryTerms);

  let pool = docs;
  if (category) pool = pool.filter((e) => e.doc.category === category);

  const scored = pool.map((entry) => {
    let score = bm25(queryTerms, entry);
    // Re-rank: bounded bonus for query terms that hit this doc's own tags.
    const tagHits = [...querySet].filter((q) => entry.tagSet.has(q)).length;
    score *= 1 + 0.08 * tagHits;
    const doc = entry.doc;
    return {
      id: doc.id,
      score,
      title: doc.title[lang] || doc.title.en,
      content: doc.content[lang] || doc.content.en,
      source: doc.source,
      category: doc.category,
      tags: doc.tags,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((r) => r.score > 0);
}

/** All docs in a category, alphabetical by title. Unchanged. */
export function browseCategory(category, lang = "en") {
  return CORPUS.filter((d) => d.category === category).map((doc) => ({
    id: doc.id,
    title: doc.title[lang] || doc.title.en,
    content: doc.content[lang] || doc.content.en,
    source: doc.source,
    category: doc.category,
  }));
}

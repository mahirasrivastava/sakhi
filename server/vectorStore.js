// vectorStore.js
// BM25 retrieval over the curated health-education corpus, with a tag-aware
// re-rank.  (Point 8)
//
// This replaces the earlier TF-IDF cosine scorer. BM25 is the better default
// for short keyword-ish queries against short documents: its term-frequency
// saturation (k1) stops a card that merely repeats a word from beating a card
// that is genuinely on-topic, and its length normalisation (b) stops longer
// cards from winning on sheer word count. Both were real failure modes of plain
// TF-IDF cosine here.
//
// Deliberately still NO external vector DB or embeddings service. This is a
// closed, curated corpus of vetted cards — every entry is reviewed — so the win
// from a heavy semantic stack (ChromaDB + a reranker microservice) does not pay
// for the deployment complexity it adds. The API shape is unchanged, so this
// can still be swapped later without touching callers.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_PATH = path.join(__dirname, "corpus", "health-education.json");

// BM25 parameters. k1 controls term-frequency saturation; b controls how much
// document length is penalised. These are the standard, robust defaults.
const K1 = 1.5;
const B = 0.75;
const TAG_WEIGHT = 3; // tags are the curated retrieval keys, counted this many times

let corpus = [];
let docTokens = [];   // token array per doc (tags repeated TAG_WEIGHT times)
let docLen = [];      // |d| per doc
let avgdl = 0;
let df = {};          // document frequency per term
let N = 0;

function tokenize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9_\s]/g, "").split(/\s+/).filter(Boolean);
}

// "heavy_bleeding_hourly" -> ["heavy","bleeding","hourly"]
function splitTag(tag) {
  return String(tag || "").split("_").filter(Boolean);
}

function buildDoc(doc) {
  const tagTokens = (doc.tags || []).flatMap(splitTag);
  const bodyTokens = tokenize(doc.en?.body).slice(0, 80); // cap so a long body can't dominate
  const titleTokens = tokenize(doc.en?.title);
  const weightedTags = [];
  for (let i = 0; i < TAG_WEIGHT; i++) weightedTags.push(...tagTokens);
  return [...weightedTags, ...titleTokens, ...bodyTokens];
}

function loadCorpus() {
  try {
    corpus = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf-8"));
    docTokens = corpus.map(buildDoc);
    docLen = docTokens.map((t) => t.length);
    N = corpus.length;
    avgdl = docLen.reduce((a, b) => a + b, 0) / (N || 1);
    df = {};
    for (const toks of docTokens) {
      for (const term of new Set(toks)) df[term] = (df[term] || 0) + 1;
    }
  } catch (err) {
    console.error("Failed to load health education corpus:", err.message);
    corpus = []; docTokens = []; docLen = []; N = 0; avgdl = 0; df = {};
  }
}
loadCorpus();

function idf(term) {
  const n = df[term] || 0;
  // BM25 idf with the +1 inside the log so it can never go negative.
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

function bm25(queryTerms, docIndex) {
  const toks = docTokens[docIndex];
  const len = docLen[docIndex] || 1;
  const tf = {};
  for (const t of toks) tf[t] = (tf[t] || 0) + 1;

  let score = 0;
  for (const q of queryTerms) {
    const f = tf[q];
    if (!f) continue;
    const denom = f + K1 * (1 - B + B * (len / (avgdl || 1)));
    score += idf(q) * ((f * (K1 + 1)) / denom);
  }
  return score;
}

/**
 * Retrieve the top-k education cards for a set of symptom tags and/or free text.
 * Returns full corpus entries (all language variants) plus a relevanceScore.
 */
export function retrieveEducation(symptoms = [], freeText = "", topK = 3) {
  if (corpus.length === 0) return [];

  const symTokens = symptoms.flatMap(splitTag);
  const queryTerms = [
    ...symTokens,
    ...symTokens, // symptoms double-weighted in the query
    ...tokenize(freeText),
  ];
  if (queryTerms.length === 0) return [];

  const querySet = new Set(queryTerms);

  const scored = corpus.map((doc, i) => {
    let score = bm25(queryTerms, i);
    // Re-rank: a small, bounded bonus when a document's OWN tags overlap the
    // query. BM25 already sees the tags (weighted) as tokens; this nudges an
    // exact tag hit above a merely lexical body match at the same BM25 score.
    const tagHits = (doc.tags || []).flatMap(splitTag).filter((t) => querySet.has(t)).length;
    score *= 1 + 0.08 * tagHits;
    return { doc, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.doc, relevanceScore: Number(s.score.toFixed(3)) }));
}

export function getCorpusSize() {
  return corpus.length;
}

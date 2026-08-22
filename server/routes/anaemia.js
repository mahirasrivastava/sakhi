// anaemia.js
// Conjunctival pallor SCREEN — not a diagnosis, and never a haemoglobin number.
//
// -------------------------------------------------------------------------
// Pipeline
// -------------------------------------------------------------------------
// Implements the benchmarked green-channel design:
//
//   1. Quality gate      — reject too dark / too bright / too uniform / too few
//   2. ROI filter        — HSV window to isolate conjunctival tissue
//   3. White balance     — scale toward a 180 target from the brightest decile
//   4. Features          — green-to-red ratio, HSV saturation, green percentage
//   5. Scoring           — weighted 0.50 / 0.30 / 0.20
//   6. Confidence        — from ROI coverage, pixel count, lighting
//   7. Output            — score, flag, severity band, confidence, features
//
// The green-to-red ratio carries 50% of the weight: haemoglobin absorbs green,
// so as Hb drops the conjunctiva reflects more green and G/R rises. That is the
// feature with the clearest clinical basis of the three.
//
// -------------------------------------------------------------------------
// KNOWN LIMITS OF THIS IMPLEMENTATION — read before trusting a result
// -------------------------------------------------------------------------
// These were measured against this exact code, not inherited from a previous
// version. They are recorded here because a future reader will otherwise spend
// the same afternoon rediscovering them.
//
// 1. STEP 3 DOES NOT CORRECT COLOUR CAST, AND CANNOT.
//    It multiplies R, G and B by one shared scalar. All three features in step
//    4 are ratios between channels, and a shared scalar cancels out of a ratio:
//
//        grRatio = (k·G) / (k·R) = G / R
//
//    Verified: the same scene at full light and at half light yields correction
//    factors of 1.628 and 3.256 and *identical* features to four decimals. The
//    step is therefore inert with respect to the score. Its only live effect is
//    through correctionFactor in step 6, where it moves the confidence.
//
//    The invariance to overall brightness that the benchmark observed is real,
//    but it comes from the features being ratios — not from this correction.
//
// 2. COLOUR TEMPERATURE IS AN UNCORRECTED CONFOUND.
//    A tungsten bulb raises R and lowers B, which no shared scalar can undo.
//    Measured on this code: a warm cast moves grRatio 0.5384 -> 0.4968 and
//    pallorScore 0.098 -> 0.052. Warm indoor light therefore biases toward
//    "healthy", which is the false-negative direction. Correcting it needs a
//    per-channel (von Kries) gain, which this pipeline does not apply.
//
// 3. THE ROI FILTER CAN REJECT THE CASES THE SCREEN EXISTS TO FIND.
//    Hue is an angle around the grey axis and becomes numerically unstable as
//    tissue approaches grey — which is exactly what pale conjunctiva does. A
//    moderate-anaemia conjunctiva measured under cool window shade sits at
//    s=0.17, hue 305 deg. That falls outside the red arc below (h < 35 or
//    h > 325) and is discarded. If enough pixels behave that way, step 2 falls
//    under 30 survivors and the capture is rejected as "couldn't isolate
//    conjunctival tissue" — on an anaemic patient.
//
//    The saturation floor compounds it in the same direction: at the anaemic
//    saturation range this design assumes (~0.10), roughly 38% of pixels fall
//    below the 0.08 floor and the surviving mean is biased about +0.03 toward
//    healthy.
//
// 4. THE THRESHOLDS ARE UNCALIBRATED AGAINST BLOOD.
//    The reference ranges are literature-informed starting points, not a model
//    fitted on this population with paired haemoglobin results. Until it is
//    locally calibrated against real CBC values, this says "this looks pale
//    enough to be worth a blood test" and nothing more.

import { rgbToHsv } from "../utils/colorSpace.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------------------
// Step 1 — Quality gate
// ---------------------------------------------------------------------------

const MIN_PIXELS = 50;
const MIN_BRIGHTNESS = 40;
const MAX_BRIGHTNESS = 235;
const MIN_VARIANCE = 50;

const brightnessOf = (p) => (p.r + p.g + p.b) / 3;

/**
 * Rejects captures that cannot be scored meaningfully.
 *
 * The pixel-count check runs first even though the specification lists it
 * third: a mean over an empty array is NaN, and every comparison against NaN is
 * false, so a zero-pixel payload would otherwise slip past both brightness
 * gates and be reported as a real reading.
 */
function qualityGate(pixels) {
  if (pixels.length < MIN_PIXELS) {
    return { rejected: true, reason: "not enough data" };
  }

  const brightnesses = pixels.map(brightnessOf);
  const mean = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;

  if (mean < MIN_BRIGHTNESS) return { rejected: true, reason: "too dark" };
  if (mean > MAX_BRIGHTNESS) return { rejected: true, reason: "too bright / washed out" };

  const variance =
    brightnesses.reduce((acc, b) => acc + (b - mean) * (b - mean), 0) / brightnesses.length;

  if (variance < MIN_VARIANCE) {
    return { rejected: true, reason: "image looks uniform — may not be an eyelid" };
  }

  return { rejected: false, meanBrightness: mean, variance };
}

// ---------------------------------------------------------------------------
// Step 2 — ROI filtering
// ---------------------------------------------------------------------------

const HUE_RED_HIGH = 35;   // degrees; keep h < this
const HUE_RED_LOW = 325;   // degrees; or h > this (the arc wraps through 0)
const MIN_SATURATION = 0.08;
const MIN_VALUE = 0.15;
const MIN_ROI_PIXELS = 30;

/**
 * Keeps pixels that sit in the red-pink arc, above a saturation floor (drops
 * near-grey sclera) and above a value floor (drops near-black eyelashes).
 *
 * See limit 3 in the header: both floors also drop pale tissue, and the hue arc
 * is least reliable on precisely the tissue this screen is looking for.
 */
function filterRoi(pixels) {
  const filtered = [];
  for (const p of pixels) {
    const { h, s, v } = rgbToHsv(p.r, p.g, p.b);
    if ((h < HUE_RED_HIGH || h > HUE_RED_LOW) && s > MIN_SATURATION && v > MIN_VALUE) {
      filtered.push(p);
    }
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Step 3 — White balance normalization
// ---------------------------------------------------------------------------

const WHITE_TARGET = 180;
const BRIGHT_FRACTION = 0.10;

/**
 * Scales the filtered pixels so the brightest decile of the *whole* frame lands
 * near WHITE_TARGET.
 *
 * The brightest decile is taken from all input pixels rather than the ROI
 * because the reference should be the lightest thing in shot — sclera or a
 * catch-light — not the tissue being measured.
 *
 * This does not change any feature in step 4 (limit 1 in the header). It is
 * kept because correctionFactor feeds the confidence estimate in step 6, where
 * a factor far from 1 is a reasonable proxy for "the exposure was poor".
 */
function whiteBalance(allPixels, roiPixels) {
  const sorted = allPixels.map(brightnessOf).sort((a, b) => b - a);
  const take = Math.max(1, Math.round(sorted.length * BRIGHT_FRACTION));
  const meanBright = sorted.slice(0, take).reduce((a, b) => a + b, 0) / take;

  // A fully black frame cannot produce a factor; the quality gate has already
  // rejected that case, so this guard only protects against division by zero.
  const correctionFactor = meanBright > 0 ? WHITE_TARGET / meanBright : 1;

  const corrected = roiPixels.map((p) => ({
    r: clamp(p.r * correctionFactor, 0, 255),
    g: clamp(p.g * correctionFactor, 0, 255),
    b: clamp(p.b * correctionFactor, 0, 255),
  }));

  return { correctionFactor, corrected };
}

// ---------------------------------------------------------------------------
// Step 4 — Feature extraction
// ---------------------------------------------------------------------------

function extractFeatures(pixels) {
  const n = pixels.length;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let satSum = 0;

  for (const p of pixels) {
    rSum += p.r;
    gSum += p.g;
    bSum += p.b;
    satSum += rgbToHsv(p.r, p.g, p.b).s;
  }

  const rMean = rSum / n;
  const gMean = gSum / n;
  const bMean = bSum / n;

  return {
    // Primary. Healthy conjunctiva ~0.45-0.55 (red dominates); anaemic
    // ~0.65-0.85 as green rises toward red.
    grRatio: gMean / rMean,
    // Secondary. Healthy ~0.30-0.45; anaemic ~0.10-0.20.
    satMean: satSum / n,
    // Tertiary. Green against the channel mean — an extra discriminator at
    // borderline haemoglobin levels.
    gPct: gMean / ((rMean + gMean + bMean) / 3),
  };
}

// ---------------------------------------------------------------------------
// Step 5 — Scoring
// ---------------------------------------------------------------------------

function score({ grRatio, satMean, gPct }) {
  const fGr = clamp((grRatio - 0.45) / 0.45, 0, 1);
  const fSat = clamp((0.32 - satMean) / 0.25 + 0.5, 0, 1);
  const fGpct = clamp((gPct - 0.85) / 0.3, 0, 1);

  // Green-to-red carries half the weight: best discriminating power in the
  // benchmark, and the clearest physical basis (haemoglobin's green absorption).
  const pallorScore = fGr * 0.50 + fSat * 0.30 + fGpct * 0.20;

  return { pallorScore, fGr, fSat, fGpct };
}

// ---------------------------------------------------------------------------
// Step 6 — Confidence estimation
// ---------------------------------------------------------------------------

const MAX_CONFIDENCE = 0.95;

function estimateConfidence({ roiRatio, roiCount, correctionFactor }) {
  let confidence = 0.40;

  // More conjunctival pixels relative to the frame = better framing.
  confidence += roiRatio > 0.5 ? 0.20 : roiRatio * 0.40;

  // More absolute pixels = a steadier mean.
  confidence += roiCount > 100 ? 0.20 : roiCount / 500;

  // A correction factor near 1 means the exposure was already about right.
  confidence += correctionFactor > 0.7 && correctionFactor < 1.5 ? 0.15 : 0;

  return Math.min(confidence, MAX_CONFIDENCE);
}

// ---------------------------------------------------------------------------
// Step 7 — Banding and output
// ---------------------------------------------------------------------------

const FLAG_THRESHOLD = 0.42;

function severityOf(pallorScore) {
  if (pallorScore < 0.35) return "none";
  if (pallorScore < 0.50) return "mild";
  if (pallorScore <= 0.65) return "moderate";
  return "strong";
}

function captureQualityOf(confidence) {
  if (confidence > 0.75) return "good";
  if (confidence > 0.50) return "acceptable";
  return "marginal";
}

const NOTE =
  "Screening estimate only — not a haemoglobin measurement. " +
  "A blood test is needed to confirm or rule out anaemia.";

const round2 = (x) => Number(x.toFixed(2));
const round3 = (x) => Number(x.toFixed(3));

/**
 * Run the screen.
 *
 * @param {Array<{r:number,g:number,b:number}>} pixels sampled conjunctiva pixels
 * @returns {object} either { rejected: true, reason } or the full result
 */
export function analyzePallor(pixels) {
  const input = Array.isArray(pixels) ? pixels : [];

  // Step 1
  const gate = qualityGate(input);
  if (gate.rejected) {
    return { rejected: true, reason: gate.reason };
  }

  // Step 2
  const roi = filterRoi(input);
  const roiRatio = roi.length / input.length;
  if (roi.length < MIN_ROI_PIXELS) {
    return { rejected: true, reason: "couldn't isolate conjunctival tissue" };
  }

  // Step 3
  const { correctionFactor, corrected } = whiteBalance(input, roi);

  // Step 4
  const features = extractFeatures(corrected);

  // Step 5
  const { pallorScore } = score(features);

  // Step 6
  const confidence = estimateConfidence({
    roiRatio,
    roiCount: roi.length,
    correctionFactor,
  });

  // Step 7
  const rounded = round2(pallorScore);
  return {
    pallorScore: rounded,
    flagged: rounded >= FLAG_THRESHOLD,
    severity: severityOf(rounded),
    confidence: round2(confidence),
    captureQuality: captureQualityOf(confidence),
    features: {
      greenRedRatio: round3(features.grRatio),
      saturationMean: round3(features.satMean),
      greenPct: round3(features.gPct),
      roiPixelCount: roi.length,
      roiRatio: round3(roiRatio),
      correctionFactor: round3(correctionFactor),
    },
    note: NOTE,
  };
}

// ---------------------------------------------------------------------------
// Checklist data
// ---------------------------------------------------------------------------
// Not consumed by analyzePallor — the pipeline above scores pixels only. These
// are served by GET /api/anaemia-screen/questions and rendered by the client, so
// the labels and any future scoring cannot drift apart.

export const SYMPTOM_OPTIONS = [
  { id: "fatigue", label: "Tiredness that sleep does not fix" },
  { id: "breathlessness", label: "Breathless climbing stairs or cooking" },
  { id: "dizziness", label: "Dizzy when you stand up" },
  { id: "heavy_periods", label: "Heavy periods — soaking a pad every hour" },
  { id: "pica", label: "Craving ice, chalk, mud or raw rice" },
  { id: "palpitations", label: "Heart racing or pounding" },
  { id: "headaches", label: "Frequent headaches" },
  { id: "brittle_nails", label: "Brittle or spoon-shaped nails" },
  { id: "cold_hands", label: "Hands and feet always cold" },
];

export const RISK_OPTIONS = [
  { id: "pregnant", label: "I am pregnant, or I might be" },
  { id: "postpartum", label: "I gave birth in the last six months" },
  { id: "adolescent", label: "I am under 20" },
  { id: "previous_anaemia", label: "I have been told I had anaemia before" },
  { id: "vegetarian", label: "I eat little or no meat" },
];

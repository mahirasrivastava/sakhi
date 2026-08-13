// anaemia.js
// Conjunctival pallor SCREEN — not a diagnosis, and never a haemoglobin number.
//
// -------------------------------------------------------------------------
// Why this was rewritten
// -------------------------------------------------------------------------
// The previous version averaged every pixel in a centred crop and mapped one
// "redness ratio" through
//
//     pallorScore = clamp((0.40 - r/(r+g+b)) / 0.10 + 0.5)
//
// Two things made that return effectively the same answer on every capture:
//
//  1. The mapping saturates. The divisor is 0.10, so the score hits 0 or 1 once
//     the redness ratio moves ±0.05 from 0.40. Real camera frames of a face sit
//     around 0.35–0.38, which lands on 1.0 — flagged, always.
//  2. Averaging over the whole crop mixes eyelashes, skin, shadow and specular
//     highlights into the conjunctiva. Those dominate, and their mean is very
//     stable frame to frame, so the input barely moved either.
//
// It also had no illuminant correction. A warm indoor bulb makes every
// conjunctiva look healthy; daylight through a window makes every conjunctiva
// look pale. That single confound swamps the actual signal.
//
// -------------------------------------------------------------------------
// What this does instead
// -------------------------------------------------------------------------
//  1. QUALITY GATE. Blurred, under/over-exposed, or badly framed captures are
//     rejected with a specific instruction, instead of being scored anyway.
//     This alone is most of the "same result every time" fix: bad frames now
//     say "move into better light" rather than silently returning 1.0.
//  2. ILLUMINANT CORRECTION. A grey-world estimate from the whole frame is
//     divided out (von Kries), so the score reflects the tissue rather than
//     the bulb.
//  3. PIXEL SELECTION. Specular highlights, shadow, lashes and non-red hues are
//     discarded. The filter is hue-based, NOT saturation-based — pale
//     conjunctiva is low-saturation, so filtering on saturation would throw
//     away exactly the cases this is meant to catch.
//  4. FOUR FEATURES, ROBUST STATISTICS. Erythema Index, CIELAB a*, HSV
//     saturation and a pallor ratio, each taken as a trimmed median so a few
//     stray pixels cannot move the result.
//  5. MULTI-FRAME. The client sends a short burst; each frame is scored and the
//     median is reported. Disagreement between frames lowers the confidence
//     rather than being hidden.
//
// -------------------------------------------------------------------------
// Honest limits — read before trusting any number here
// -------------------------------------------------------------------------
// The reference values in FEATURE_PRIORS are literature-informed starting
// points, not a model fitted on this population with paired haemoglobin
// results. Until it is locally calibrated against real CBC values, this tells
// you "this looks pale enough to be worth a blood test", nothing more. It is
// deliberately biased toward false positives: sending someone for an
// unnecessary ₹50 test is a far better error than missing anaemia in a
// pregnant adolescent.
//
// A CNN would likely beat this, and the interface below (score → band →
// confidence) is shaped so one can be dropped in behind it. See the note at the
// bottom of this file for what that would actually require.

// ---------------------------------------------------------------------------
// Colour space conversions
// ---------------------------------------------------------------------------

function rgbToHsv(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

// sRGB companding — the stored 0-255 values are gamma-encoded, and averaging or
// taking ratios of them without linearising is a real (if common) error.
function srgbToLinear(c) {
  const cn = c / 255;
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

// D65 white point, matching the sRGB primaries below.
const WHITE_D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);

  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / WHITE_D65.x;
  const y = (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) / WHITE_D65.y;
  const z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / WHITE_D65.z;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),   // + = red, - = green. The axis pallor moves along.
    b: 200 * (fy - fz),
  };
}

// ---------------------------------------------------------------------------
// Robust statistics
// ---------------------------------------------------------------------------

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Mean of the middle (1 - 2*trim) fraction. Resistant to the eyelash pixels and
// catch-lights that survive the filter, without discarding as much information
// as a bare median.
function trimmedMean(values, trim = 0.2) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * trim);
  const kept = sorted.slice(cut, sorted.length - cut);
  const slice = kept.length > 0 ? kept : sorted;
  return slice.reduce((acc, v) => acc + v, 0) / slice.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// ---------------------------------------------------------------------------
// Illuminant correction (grey-world / von Kries)
// ---------------------------------------------------------------------------

/**
 * Estimates the scene illuminant from a wide sample of the frame and returns
 * per-channel gains that neutralise it.
 *
 * Grey-world assumes the average of a whole scene is achromatic. That is a
 * crude assumption, but it is dramatically better than no correction at all:
 * without it, the warm-bulb-vs-daylight difference is several times larger than
 * the anaemic-vs-healthy difference we are trying to measure.
 */
function estimateIlluminantGains(referencePixels) {
  if (!Array.isArray(referencePixels) || referencePixels.length < 30) {
    return { gr: 1, gg: 1, gb: 1, applied: false };
  }

  // Exclude clipped pixels — a blown-out highlight carries no colour
  // information and drags the estimate toward neutral.
  const usable = referencePixels.filter(
    (p) => p.r < 250 && p.g < 250 && p.b < 250 && p.r + p.g + p.b > 45
  );
  if (usable.length < 30) return { gr: 1, gg: 1, gb: 1, applied: false };

  const mr = trimmedMean(usable.map((p) => p.r), 0.1);
  const mg = trimmedMean(usable.map((p) => p.g), 0.1);
  const mb = trimmedMean(usable.map((p) => p.b), 0.1);
  const grey = (mr + mg + mb) / 3;
  if (mr < 1 || mg < 1 || mb < 1) return { gr: 1, gg: 1, gb: 1, applied: false };

  // Bounded so a genuinely coloured background (a red sari filling the frame)
  // cannot invert the image.
  const bound = (g) => Math.max(0.6, Math.min(1.6, g));
  return { gr: bound(grey / mr), gg: bound(grey / mg), gb: bound(grey / mb), applied: true };
}

function applyGains(p, gains) {
  return {
    r: Math.min(255, p.r * gains.gr),
    g: Math.min(255, p.g * gains.gg),
    b: Math.min(255, p.b * gains.gb),
  };
}

// ---------------------------------------------------------------------------
// Pixel selection
// ---------------------------------------------------------------------------

const SPECULAR_V = 0.94;   // catch-lights on a wet conjunctiva — pure white, no tissue signal
const SHADOW_V = 0.16;     // lash shadow, pupil edge, out-of-frame darkness
const HUE_RED_LOW = 335;   // conjunctiva sits in the red/pink arc, wrapping through 0
const HUE_RED_HIGH = 42;

/**
 * Keeps only pixels that plausibly belong to conjunctival tissue.
 *
 * Note what is NOT filtered: saturation. A pale conjunctiva is pink-white and
 * genuinely low-saturation. Dropping low-saturation pixels would discard the
 * anaemic cases and leave the screen unable to detect the thing it exists for.
 */
function selectTissuePixels(pixels, gains) {
  const kept = [];
  let specular = 0;
  let shadow = 0;
  let offHue = 0;

  for (const raw of pixels) {
    const p = applyGains(raw, gains);
    const { h, v } = rgbToHsv(p.r, p.g, p.b);

    if (v >= SPECULAR_V) { specular++; continue; }
    if (v <= SHADOW_V) { shadow++; continue; }

    const inRedArc = h >= HUE_RED_LOW || h <= HUE_RED_HIGH;
    if (!inRedArc) { offHue++; continue; }

    kept.push(p);
  }

  const total = pixels.length || 1;
  return {
    kept,
    validFraction: kept.length / total,
    rejected: {
      specularFraction: specular / total,
      shadowFraction: shadow / total,
      offHueFraction: offHue / total,
    },
  };
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

/**
 * Reference distributions for each feature, on illuminant-corrected conjunctiva.
 *
 * `ref` is the value typical of a NON-anaemic conjunctiva; `sd` sets how fast
 * the score moves as you depart from it. `direction` is +1 when a value BELOW
 * the reference indicates pallor, -1 when a value ABOVE it does.
 *
 * These are literature-informed priors, NOT fitted parameters. Calibrating them
 * against paired haemoglobin results from the population being screened is the
 * single highest-value improvement available to this file.
 */
const FEATURE_PRIORS = {
  // Erythema Index: 100 * log10(R/G). The standard reflectance proxy for
  // haemoglobin concentration in tissue.
  // The spreads are deliberately wide. Narrow ones make the logistic behave like
  // a step function, which is the failure the old single-ratio version had:
  // every capture landed on one of two answers. Wide spreads keep the middle of
  // the range reachable, so "borderline — worth a test" is a real outcome.
  erythemaIndex: { ref: 14.0, sd: 9.0, weight: 1.15, direction: +1 },
  // CIELAB a*: the perceptual red-green axis, already lightness-normalised.
  labA: { ref: 24.0, sd: 14.0, weight: 1.00, direction: +1 },
  // HSV saturation: how far the tissue is from grey.
  saturation: { ref: 0.42, sd: 0.19, weight: 0.75, direction: +1 },
  // Pallor ratio (G+B)/2R: rises as red drains out. Higher = paler.
  pallorRatio: { ref: 0.66, sd: 0.19, weight: 0.90, direction: -1 },
};

// Bias term. Positive nudges the screen toward flagging: a missed anaemia in a
// pregnant adolescent is a much worse error than an unnecessary blood test.
const SCREEN_BIAS = 0.35;

function computeFeatures(pixels) {
  const eiValues = [];
  const aValues = [];
  const satValues = [];
  const ratioValues = [];
  const lightness = [];

  for (const p of pixels) {
    // +1 guards against a zero channel making the ratios explode.
    const r = p.r + 1, g = p.g + 1, b = p.b + 1;

    eiValues.push(100 * Math.log10(r / g));
    ratioValues.push((g + b) / (2 * r));

    const lab = rgbToLab(p.r, p.g, p.b);
    aValues.push(lab.a);
    lightness.push(lab.L);

    satValues.push(rgbToHsv(p.r, p.g, p.b).s);
  }

  return {
    erythemaIndex: trimmedMean(eiValues),
    labA: trimmedMean(aValues),
    saturation: trimmedMean(satValues),
    pallorRatio: trimmedMean(ratioValues),
    lightness: median(lightness),
    // Spatial spread: a real conjunctiva has texture (vessels). A flat patch is
    // usually a mis-framed cheek or a blurred smear.
    textureSpread: stdDev(aValues),
  };
}

/**
 * Combines the features into a pallor probability via a logistic model.
 * Returns a continuous 0-1 value — critically, one that does NOT saturate the
 * moment a feature moves slightly, which is what made the old version constant.
 */
function scoreFeatures(features) {
  let z = SCREEN_BIAS;
  const contributions = {};

  for (const [name, prior] of Object.entries(FEATURE_PRIORS)) {
    const value = features[name];
    // z-score, oriented so positive always means "more pallor".
    const zScore = (prior.direction * (prior.ref - value)) / prior.sd;
    // Bounded per-feature so one wild channel cannot dominate the verdict.
    const bounded = Math.max(-3, Math.min(3, zScore));
    const contribution = prior.weight * bounded;
    z += contribution;
    contributions[name] = {
      value: Number(value.toFixed(3)),
      reference: prior.ref,
      zScore: Number(bounded.toFixed(2)),
      contribution: Number(contribution.toFixed(2)),
    };
  }

  // Divide by the total weight so the logistic input stays in a sane range
  // instead of pinning to 0/1 as features are added.
  const totalWeight = Object.values(FEATURE_PRIORS).reduce((a, p) => a + p.weight, 0);
  const pallorScore = sigmoid(z / (totalWeight / 2));

  return { pallorScore, contributions, logit: z };
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

const QUALITY = {
  MIN_VALID_FRACTION: 0.22,   // below this we are not looking at conjunctiva
  MIN_LIGHTNESS: 22,          // CIELAB L*
  MAX_LIGHTNESS: 88,
  MAX_SPECULAR: 0.30,
  MIN_TEXTURE: 1.2,           // a completely flat patch is a blur or a wall
  MIN_FOCUS: 6.0,             // variance-of-Laplacian, computed on the client
  MIN_PIXELS: 200,
};

/**
 * Decides whether a capture is good enough to score at all.
 *
 * This is the part that matters most for perceived accuracy. Scoring a blurry,
 * badly-lit frame produces a confident-looking number built on nothing — which
 * is exactly how a screen ends up "giving the same result every time".
 */
function assessQuality({ selection, features, focusScore, pixelCount }) {
  const problems = [];

  if (pixelCount < QUALITY.MIN_PIXELS) {
    problems.push({
      code: "too_few_pixels",
      message: "Not enough of the eyelid was captured. Hold the camera closer and fill the box.",
    });
  }
  if (selection.validFraction < QUALITY.MIN_VALID_FRACTION) {
    problems.push({
      code: "eyelid_not_found",
      message: "The inside of the lower eyelid wasn't in the box. Gently pull the lid down so the pink inner rim fills the frame.",
    });
  }
  if (features.lightness < QUALITY.MIN_LIGHTNESS) {
    problems.push({
      code: "too_dark",
      message: "Too dark to read colour reliably. Move toward a window or daylight — avoid using the flash.",
    });
  }
  if (features.lightness > QUALITY.MAX_LIGHTNESS) {
    problems.push({
      code: "too_bright",
      message: "Overexposed — the colour is washed out. Step out of direct sunlight or shade the phone.",
    });
  }
  if (selection.rejected.specularFraction > QUALITY.MAX_SPECULAR) {
    problems.push({
      code: "glare",
      message: "Too much glare on the eye. Turn away from the light source or switch off the flash.",
    });
  }
  if (features.textureSpread < QUALITY.MIN_TEXTURE) {
    problems.push({
      code: "no_detail",
      message: "The image has no visible detail. Hold still, and tap the screen to focus before capturing.",
    });
  }
  if (typeof focusScore === "number" && focusScore < QUALITY.MIN_FOCUS) {
    problems.push({
      code: "blurry",
      message: "The photo is blurry. Rest your elbow on something and hold still for a moment.",
    });
  }

  return { usable: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Per-frame and multi-frame analysis
// ---------------------------------------------------------------------------

function analyzeFrame(pixels, referencePixels, focusScore) {
  const gains = estimateIlluminantGains(referencePixels);
  const selection = selectTissuePixels(pixels, gains);

  // Fall back to the unfiltered (but still white-balanced) pixels when the
  // filter rejected nearly everything, so the quality gate can report a real
  // feature set rather than dividing by zero.
  const target = selection.kept.length >= QUALITY.MIN_PIXELS
    ? selection.kept
    : pixels.map((p) => applyGains(p, gains));

  const features = computeFeatures(target);
  const quality = assessQuality({
    selection,
    features,
    focusScore,
    pixelCount: pixels.length,
  });
  const scored = scoreFeatures(features);

  return {
    pallorScore: scored.pallorScore,
    contributions: scored.contributions,
    features,
    selection,
    quality,
    illuminantCorrected: gains.applied,
  };
}

function bandFor(score) {
  if (score >= 0.62) return { band: "high", flagged: true };
  if (score >= 0.45) return { band: "borderline", flagged: true };
  return { band: "low", flagged: false };
}

const BAND_ADVICE = {
  high: "This screen suggests noticeable pallor. Please get a haemoglobin blood test — an ASHA worker or PHC can arrange one, and it is quick and cheap.",
  borderline: "This screen is borderline. It is worth getting a haemoglobin blood test to be sure, especially if you also feel tired, breathless, or dizzy.",
  low: "This screen did not detect pallor. That is reassuring but not conclusive — if you feel tired, breathless or dizzy, still ask for a blood test.",
};

/**
 * Entry point.
 *
 * @param {object} input
 * @param {Array<Array<{r,g,b}>>} input.frames  one pixel array per captured frame
 * @param {Array<{r,g,b}>} input.reference      wide sample of the frame, for white balance
 * @param {number} [input.focusScore]           variance-of-Laplacian from the client
 */
export function analyzePallor(input) {
  // Legacy shape: a bare pixel array. Kept so an older client still works,
  // though it gets no illuminant correction and no focus check.
  const frames = Array.isArray(input)
    ? [input]
    : (input.frames && input.frames.length ? input.frames : [input.pixels || []]);
  const reference = Array.isArray(input) ? [] : (input.reference || []);
  const focusScore = Array.isArray(input) ? undefined : input.focusScore;

  const analyses = frames
    .filter((f) => Array.isArray(f) && f.length > 0)
    .map((f) => analyzeFrame(f, reference, focusScore));

  if (analyses.length === 0) {
    return {
      ok: false,
      usable: false,
      problems: [{ code: "no_data", message: "No image data was received. Please capture again." }],
      note: NOTE,
    };
  }

  // If no frame in the burst passed the gate, report the problems from the best
  // of them rather than a number nobody should act on.
  const usableFrames = analyses.filter((a) => a.quality.usable);
  if (usableFrames.length === 0) {
    const best = analyses.reduce((a, b) =>
      a.quality.problems.length <= b.quality.problems.length ? a : b
    );
    return {
      ok: false,
      usable: false,
      problems: best.quality.problems,
      framesAnalysed: analyses.length,
      note: NOTE,
    };
  }

  const scores = usableFrames.map((a) => a.pallorScore);
  const pallorScore = median(scores);
  // Disagreement across the burst is genuine measurement uncertainty, so it is
  // surfaced as lower confidence rather than averaged away.
  const spread = scores.length > 1 ? stdDev(scores) : 0;

  const representative = usableFrames.reduce((best, a) =>
    Math.abs(a.pallorScore - pallorScore) < Math.abs(best.pallorScore - pallorScore) ? a : best
  );

  const { band, flagged } = bandFor(pallorScore);

  // Confidence blends how much of the frame was really conjunctiva, how much of
  // the burst was usable, and how much the frames agreed.
  const confidence = clamp01(
    0.45 * clamp01(representative.selection.validFraction / 0.6) +
    0.30 * (usableFrames.length / analyses.length) +
    0.25 * clamp01(1 - spread / 0.18)
  );

  return {
    ok: true,
    usable: true,
    pallorScore: Number(pallorScore.toFixed(3)),
    band,
    flagged,
    confidence: Number(confidence.toFixed(2)),
    advice: BAND_ADVICE[band],
    framesAnalysed: analyses.length,
    framesUsed: usableFrames.length,
    agreement: Number((1 - clamp01(spread / 0.18)).toFixed(2)),
    illuminantCorrected: representative.illuminantCorrected,
    // Shown in the UI so the result is inspectable rather than an oracle.
    breakdown: representative.contributions,
    coverage: {
      tissueFraction: Number(representative.selection.validFraction.toFixed(2)),
      glareFraction: Number(representative.selection.rejected.specularFraction.toFixed(2)),
      shadowFraction: Number(representative.selection.rejected.shadowFraction.toFixed(2)),
    },
    note: NOTE,
    calibration: "uncalibrated_heuristic",
  };
}

const NOTE =
  "Screening estimate only — not a haemoglobin measurement and not a diagnosis. " +
  "Only a blood test can confirm anaemia. This screen is deliberately cautious: " +
  "it would rather send you for an unnecessary test than miss anaemia.";

// ---------------------------------------------------------------------------
// On replacing this with a deep-learning model
// ---------------------------------------------------------------------------
// A CNN on conjunctiva crops (published work reports ~0.85-0.92 AUC for
// anaemia/no-anaemia at an 11 g/dL cutoff) would very likely beat the model
// above. Doing it honestly needs four things this repo does not have:
//
//   1. Labelled data: conjunctiva images paired with same-day haemoglobin from
//      a lab. Public sets exist (CP-AnemiC, Eyes-Defy-Anemia) but are small and
//      skew toward populations that may not match the district being screened.
//   2. A runtime: onnxruntime-node server-side, or onnxruntime-web /
//      TensorFlow.js in the browser. In-browser is the better fit here — the
//      image never leaves the phone, which matters for a tool used by minors.
//   3. Eyelid segmentation: the classifier's accuracy is dominated by whether
//      the crop is actually conjunctiva. A small segmentation model in front of
//      it is worth more than a bigger classifier behind it.
//   4. Prospective validation before anyone is told a number. A model validated
//      only on its training distribution will fail differently — and silently —
//      on darker skin tones and on cheaper phone cameras.
//
// Until those exist, the calibrated-heuristic path above is the honest option,
// and the shape of analyzePallor()'s return value is what a model should also
// produce: a score, a band, a confidence, and the quality gate that decides
// whether to answer at all.

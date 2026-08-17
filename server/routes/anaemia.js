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

// How much of the grey-world correction to actually apply, and how far a single
// channel may move. See the long note in estimateIlluminantGains.
const ILLUMINANT_DAMPING = 0.45;
const GAIN_MIN = 0.88;
const GAIN_MAX = 1.14;

/**
 * Estimates the illuminant cast from a wide sample of the frame and returns
 * per-channel gains that partially neutralise it.
 *
 * -------------------------------------------------------------------------
 * WHY THIS IS DAMPED, AND WHY THAT IS NOT TIMIDITY
 * -------------------------------------------------------------------------
 * The previous version applied full grey-world with gains bounded to
 * [0.6, 1.6], and it broke the screen completely — every capture came back
 * "the inside of the lower eyelid wasn't in the box", because every pixel was
 * being discarded before it was ever measured.
 *
 * Grey-world assumes the average of the scene is achromatic. The reference
 * sample here is a whole-frame downsample of a phone held at arm's length from
 * a face, so it is dominated by SKIN — which is strongly orange and nothing
 * like neutral. Grey-world therefore reads healthy skin tone as an orange
 * illuminant and "corrects" it away:
 *
 *     reference (165,124,104)  ->  gains r=0.79 g=1.06 b=1.26
 *     conjunctiva (185,100,105) hue 356 deg  ->  corrected hue 321 deg
 *     pale conjunctiva (220,188,192) hue 353 deg  ->  corrected hue 219 deg
 *
 * Those corrected pixels fall outside the red arc that selectTissuePixels
 * accepts, so validFraction collapsed to ~0 and the quality gate rejected the
 * frame. The paler the conjunctiva the worse the rotation, because a nearly
 * neutral pink has almost no hue margin to spend — so the failure was worst on
 * exactly the anaemic cases the screen exists to catch.
 *
 * Without a genuine white reference in frame there is no way to separate
 * "orange illuminant" from "orange subject", so a full correction is not
 * recoverable here. What IS safe is taking the edge off a strongly tinted bulb:
 * a damped, tightly-bounded gain reduces the tungsten-vs-daylight gap without
 * moving tissue hue far enough to matter. The residual cast is real, and it is
 * reported as reduced confidence rather than pretended away.
 */
function estimateIlluminantGains(referencePixels) {
  const none = { gr: 1, gg: 1, gb: 1, applied: false, strength: 0 };
  if (!Array.isArray(referencePixels) || referencePixels.length < 30) return none;

  // Exclude clipped pixels — a blown-out highlight carries no colour
  // information and drags the estimate toward neutral.
  const usable = referencePixels.filter(
    (p) => p.r < 250 && p.g < 250 && p.b < 250 && p.r + p.g + p.b > 45
  );
  if (usable.length < 30) return none;

  const mr = trimmedMean(usable.map((p) => p.r), 0.1);
  const mg = trimmedMean(usable.map((p) => p.g), 0.1);
  const mb = trimmedMean(usable.map((p) => p.b), 0.1);
  const grey = (mr + mg + mb) / 3;
  if (mr < 1 || mg < 1 || mb < 1) return none;

  // Damp toward 1 first, then clamp. Damping decides how much of the estimate
  // we believe; the clamp is the hard stop that keeps a red sari or a sodium
  // street lamp from rotating tissue hue regardless.
  const damp = (raw) => 1 + ILLUMINANT_DAMPING * (raw - 1);
  const bound = (g) => Math.max(GAIN_MIN, Math.min(GAIN_MAX, g));

  const gr = bound(damp(grey / mr));
  const gg = bound(damp(grey / mg));
  const gb = bound(damp(grey / mb));

  // How strong the original cast was, before damping — used to lower confidence
  // when we know a large part of it is still present.
  const rawSpread = Math.max(grey / mr, grey / mg, grey / mb) - Math.min(grey / mr, grey / mg, grey / mb);

  return { gr, gg, gb, applied: true, strength: Number(rawSpread.toFixed(3)) };
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
const SPECULAR_S = 0.20;   // ...and genuinely white: a catch-light is not a saturated red
const SHADOW_V = 0.16;     // lash shadow, pupil edge, out-of-frame darkness

// Conjunctiva sits in the red/pink arc, wrapping through 0. Widened from the
// original 335-42: measured conjunctiva runs ~348-2 deg, and a warm bulb or a
// cool shade swings that by 10-15 deg before any correction is applied. The old
// window left almost no margin on the low side, so a slightly warm photo lost
// tissue pixels for no good reason.
const HUE_RED_LOW = 320;
const HUE_RED_HIGH = 50;

// Below this saturation, hue is not a meaningful measurement — see the note in
// isTissue.
const HUE_RELIABLE_S = 0.16;

/**
 * Keeps only pixels that plausibly belong to conjunctival tissue.
 *
 * -------------------------------------------------------------------------
 * SELECTION RUNS ON RAW PIXELS. FEATURES RUN ON CORRECTED ONES.
 * -------------------------------------------------------------------------
 * This separation is the other half of the "eyelid not found on every capture"
 * fix. Selection is asking a physical question — *is this pixel flesh?* — and
 * the hue of flesh is a property of the tissue, not of our estimate of the
 * bulb. Judging it on white-balanced pixels meant an error in the illuminant
 * estimate could disqualify tissue that was plainly tissue, which is exactly
 * what happened: a skin-dominated reference rotated every conjunctiva pixel out
 * of the accepted arc and the frame was thrown away unmeasured.
 *
 * So the arc test now uses the raw pixel, and the gains are applied only to the
 * copy that goes on to be measured, where a colour cast genuinely does bias the
 * result. Both are returned.
 *
 * Note what is still NOT filtered: saturation. A pale conjunctiva is pink-white
 * and genuinely low-saturation. Dropping low-saturation pixels would discard the
 * anaemic cases and leave the screen unable to detect the thing it exists for.
 */
/**
 * Is this pixel plausibly conjunctival tissue?
 *
 * -------------------------------------------------------------------------
 * WHY THIS IS NOT A PLAIN HUE WINDOW
 * -------------------------------------------------------------------------
 * Hue is an angle around the grey axis, and as a colour approaches grey that
 * angle becomes numerically unstable — a couple of levels of sensor noise swing
 * it tens of degrees. Pale conjunctiva is, by definition, close to grey.
 *
 * So a hard hue gate is least reliable on precisely the tissue this screen
 * exists to identify. Measured: a moderate-anaemia conjunctiva under cool
 * window shade sits at s=0.17 with hue 305 deg — outside any sane red arc, not
 * because it stopped being flesh but because at that saturation the hue barely
 * means anything.
 *
 * The fix is to ask a question that stays meaningful as saturation falls. For
 * reasonably coloured pixels, the red-arc test is good and stays. For washed-out
 * pixels, the physically real statement is simply that red is the dominant
 * channel — blood-perfused tissue reflects more red than green or blue however
 * pale it gets, and that ordering is robust to noise in a way the hue angle is
 * not.
 */
function isTissue(h, s, raw) {
  // Either test passing is enough, rather than switching on saturation. A hard
  // switch put a cliff in the middle of the range and tissue fell off it:
  // moderate anaemia under cool window shade measured s=0.170, just above the
  // 0.16 threshold, so it took the hue branch, scored 305 deg, and the whole
  // frame was rejected. Two sufficient conditions have no such edge.
  const inRedArc = h >= HUE_RED_LOW || h <= HUE_RED_HIGH;
  // Red dominance: blood-perfused tissue reflects more red than green or blue
  // however pale it gets. Robust where the hue angle is not, and the margin
  // keeps true neutrals (a grey wall behind the eye) out.
  const redDominant = raw.r >= raw.g * 1.02 && raw.r >= raw.b * 1.02;
  return inRedArc || (s < HUE_RELIABLE_S * 1.6 && redDominant);
}

function selectTissuePixels(pixels, gains) {
  const kept = [];
  let specular = 0;
  let shadow = 0;
  let offHue = 0;

  for (const raw of pixels) {
    const { h, s, v } = rgbToHsv(raw.r, raw.g, raw.b);

    // A specular highlight is BRIGHT AND WHITE. Testing brightness alone threw
    // away tissue under a tungsten bulb, where warm light drives red toward
    // clipping: a genuinely red pixel at v=0.97, s=0.52 was being discarded as
    // a catch-light. Requiring low saturation as well keeps the reflection test
    // doing what it was meant to do.
    if (v >= SPECULAR_V && s < SPECULAR_S) { specular++; continue; }
    if (v <= SHADOW_V) { shadow++; continue; }

    if (!isTissue(h, s, raw)) { offHue++; continue; }

    kept.push(applyGains(raw, gains));
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
// -------------------------------------------------------------------------
// CALIBRATION — where these numbers come from
// -------------------------------------------------------------------------
// `ref` is placed at the DECISION BOUNDARY, not at "typical healthy". Each
// value is the feature measured on conjunctiva at roughly Hb 11.5 g/dL, so a
// z-score of zero means "right at the line" and the sigmoid crosses the YES
// threshold there. That puts the boundary just under WHO's 12.0 g/dL cut-off
// for non-pregnant women, which is the clinically correct place for it and
// leaves the screen still biased toward referring.
//
// The previous values were placed at neither the boundary nor at healthy, and
// the spreads were roughly double what the measured range supports. Combined
// with a heavy +0.35 bias, that pushed a non-anaemic conjunctiva to 0.52 — so
// the screen told a healthy Hb-13 woman to get a blood test, and told everyone
// below her the same thing. A screen that answers "yes" to every input is not
// screening; it is a constant function with a progress bar.
//
// Feature values across the range, measured on the tissue model in the tests:
//
//   Hb 14   EI 21.3   a* 28.1   sat 0.390   ratio 0.655   -> 0.10  no
//   Hb 13   EI 18.3   a* 25.8   sat 0.346   ratio 0.701   -> 0.21  no
//   Hb 12   EI 15.1   a* 22.7   sat 0.294   ratio 0.753   -> 0.37  borderline
//   Hb 11   EI 10.8   a* 18.1   sat 0.221   ratio 0.828   -> 0.67  yes
//   Hb 10   EI  8.3   a* 15.2   sat 0.174   ratio 0.877   -> 0.81  yes
//   Hb  8   EI  3.6   a*  9.5   sat 0.108   ratio 0.973   -> 0.95  yes
//
// These remain literature-informed priors on a synthetic tissue model, NOT
// parameters fitted against paired haemoglobin results in this population.
// Locally calibrating them against real CBC values is still the single
// highest-value improvement available to this file. What has changed is that
// the operating point is now defensible rather than arbitrary.
// -------------------------------------------------------------------------
// THE FEATURES ARE DIFFERENTIAL — CONJUNCTIVA MEASURED AGAINST THE PERSON'S
// OWN SKIN, IN THE SAME FRAME, UNDER THE SAME LIGHT
// -------------------------------------------------------------------------
// This is the fix for the failure that mattered most: under a tungsten bulb,
// mild anaemia (Hb 11) scored 0.17 and the screen said "no test needed", where
// the same conjunctiva in daylight scored 0.68 and said "yes". A false negative
// produced by the light bulb is the worst thing this screen can do.
//
// Absolute colour cannot be rescued by white balance here. The illuminant
// estimate comes from a frame filled with skin, which is not neutral, so a full
// grey-world correction rotates tissue out of range (see estimateIlluminantGains)
// and a damped one leaves most of a tungsten cast in place. Either way the
// residual is several times larger than the anaemic-vs-healthy signal.
//
// So stop measuring absolute colour. The Erythema Index is 100*log10(R/G); a
// von Kries illuminant scales R and G by constants, which shifts EI by the SAME
// constant for every surface in the frame. The DIFFERENCE between two surfaces
// is therefore exactly illuminant-invariant. Measured:
//
//                    EI conjunctiva   EI skin    difference
//     daylight            16.02        12.32        3.698
//     tungsten            23.17        19.47        3.705
//     cool shade          12.85         9.15        3.695
//
// The absolute value swings by 10 units; the difference is stable to three
// decimal places. Skin is not a calibration target — it varies between people —
// but it is lit by exactly the same light as the conjunctiva a centimetre away,
// which is the only property needed for the cast to cancel.
//
// `ref` values below are the DELTA at the decision boundary (~Hb 11.5), so the
// sigmoid crosses the YES threshold just under WHO's 12.0 g/dL cut-off for
// non-pregnant women.
const FEATURE_PRIORS = {
  // Erythema Index: 100 * log10(R/G). The standard reflectance proxy for
  // haemoglobin in tissue, exactly illuminant-invariant under the correction
  // above, and the strongest single feature here.
  erythemaIndex: { ref: 12.9, sd: 7.0, weight: 1.30, direction: +1 },
  // CIELAB a*: the perceptual red-green axis, already lightness-normalised.
  // Not a log ratio, so the cancellation is approximate — hence lower weight.
  labA: { ref: 20.4, sd: 7.0, weight: 0.85, direction: +1 },
  // HSV saturation: how far the tissue is from grey.
  saturation: { ref: 0.258, sd: 0.12, weight: 0.70, direction: +1 },
  // Pallor ratio (G+B)/2R: rises as red drains out. Higher = paler.
  pallorRatio: { ref: 0.79, sd: 0.13, weight: 0.95, direction: -1 },
};

// Typical facial skin under neutral light. Serves two purposes: the fallback
// when no reference sample was sent, and the CANONICAL value that the measured
// skin is compared against in the partial correction below.
const DEFAULT_REFERENCE = {
  erythemaIndex: 12.3,
  labA: 15.0,
  saturation: 0.37,
  pallorRatio: 0.69,
};

// -------------------------------------------------------------------------
// How much of the skin reading to subtract. This is a real trade, not a knob.
// -------------------------------------------------------------------------
// The correction applied is
//
//     value = conjunctiva - ALPHA * (skin - canonical skin)
//
// ALPHA = 1 is a pure differential: the illuminant cancels exactly, but the
// person's own skin tone now enters the result. That is not a small effect.
// Skin erythema index runs ~8 on fair skin to ~15 on deep skin — melanin
// absorbs green far more than red — which is comparable to the entire
// healthy-to-severe anaemia signal. Measured at ALPHA = 1, fair skin
// systematically under-scored (Hb 9 read as "no test needed") while deep skin
// over-scored (Hb 12 flagged). Twelve false negatives, every one of them on
// fair skin. A screen whose error depends on the user's complexion is not
// acceptable, and false negatives are the dangerous direction.
//
// ALPHA = 0 is purely absolute: skin tone drops out — conjunctiva is a mucous
// membrane with essentially no melanin, which is exactly why conjunctival
// pallor is the classic cross-ethnic clinical sign — but the illuminant is back,
// and a tungsten bulb then reads mild anaemia as healthy.
//
// Neither error is avoidable without a true white reference in frame, so ALPHA
// is set by sweeping it against the full matrix of haemoglobin level x five
// illuminants x three skin tones (120 captures, fixed RNG seed so every value
// sees identical pixels). Result:
//
//     alpha   sens    spec   false neg   worst-case spread across lighting
//      0.00   88.4%   88.9%      8            0.643
//      0.20   92.8%   91.1%      5            0.513
//      0.50   91.3%   93.3%      6            0.276
//      0.65   91.3%   91.1%      6            0.181
//      1.00   87.0%   84.4%      9            0.399
//
// 0.5 is the knee: best specificity, within one false negative of the best
// sensitivity, and less than half the lighting spread of 0.2. Both endpoints
// are worse on every axis, which is the useful confirmation that the trade
// described above is real and not an artefact of the model.
const REFERENCE_ALPHA = 0.5;

// Bias term. Still positive — a missed anaemia in a pregnant adolescent is a
// much worse error than an unnecessary free blood test — but small now that the
// reference values sit at the boundary rather than below it. At +0.35 the bias
// was doing the work the priors should have been doing, and it showed.
const SCREEN_BIAS = 0.15;

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
function scoreFeatures(features, referenceFeatures) {
  let z = SCREEN_BIAS;
  const contributions = {};

  for (const [name, prior] of Object.entries(FEATURE_PRIORS)) {
    // Partial differential: subtract how far this person's skin departs from
    // canonical skin, scaled by ALPHA. The illuminant moves conjunctiva and
    // skin together so ALPHA of it cancels; the person's complexion moves only
    // the skin term, so only ALPHA of that leaks in. See REFERENCE_ALPHA.
    const skinOffset = referenceFeatures[name] - DEFAULT_REFERENCE[name];
    const value = features[name] - REFERENCE_ALPHA * skinOffset;
    // z-score, oriented so positive always means "more pallor".
    const zScore = (prior.direction * (prior.ref - value)) / prior.sd;
    // Bounded per-feature so one wild channel cannot dominate the verdict.
    const bounded = Math.max(-3, Math.min(3, zScore));
    const contribution = prior.weight * bounded;
    z += contribution;
    contributions[name] = {
      value: Number(features[name].toFixed(3)),
      // What the UI table calls "healthy ref." — the skin value this was
      // measured against, which is the honest thing to show next to it.
      skin: Number(referenceFeatures[name].toFixed(3)),
      delta: Number(value.toFixed(3)),
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

/**
 * Measures the skin around the eye, to subtract from the conjunctiva.
 *
 * The reference sample is a whole-frame downsample, so it contains skin, hair,
 * background and the eye itself. Skin-like pixels are picked out of it the same
 * way tissue is picked out of the crop; the conjunctiva's own contribution is
 * negligible at a few pixels out of several hundred.
 */
function computeReferenceFeatures(referencePixels) {
  if (!Array.isArray(referencePixels) || referencePixels.length < 60) {
    return { features: DEFAULT_REFERENCE, measured: false };
  }

  const skin = referencePixels.filter((p) => {
    const { s, v } = rgbToHsv(p.r, p.g, p.b);
    // Mid-tone and warm: excludes hair, shadow, blown highlights and a blue
    // wall, all of which would drag the reference away from skin.
    return v > 0.18 && v < 0.95 && s > 0.08 && p.r >= p.g && p.g >= p.b;
  });

  if (skin.length < 40) return { features: DEFAULT_REFERENCE, measured: false };

  const f = computeFeatures(skin);
  return {
    features: {
      erythemaIndex: f.erythemaIndex,
      labA: f.labA,
      saturation: f.saturation,
      pallorRatio: f.pallorRatio,
    },
    measured: true,
    sampleSize: skin.length,
  };
}

function analyzeFrame(pixels, referencePixels, focusScore, referenceFeatures) {
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
  const scored = scoreFeatures(features, referenceFeatures.features);

  return {
    pallorScore: scored.pallorScore,
    contributions: scored.contributions,
    features,
    selection,
    quality,
    illuminantCorrected: gains.applied,
    referenceMeasured: referenceFeatures.measured,
  };
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------
//
// This screen answers exactly one question: DO YOU NEED A BLOOD TEST, YES OR NO.
//
// It previously answered a different question — it returned a percentage, two
// meters and a four-row table of colour features. That is the correct output
// for someone debugging the model and the wrong output for a sixteen-year-old
// holding a phone, who has to convert "pallor score 0.51, confidence 0.44" into
// an action on her own. Most people, faced with a number in the middle, do
// nothing. The breakdown is still there, one tap down, for the ASHA worker and
// for anyone who wants it — but the answer comes first and in words.
//
// The cutoff is deliberately LOW. Consider the two errors:
//
//   False positive: she walks to the sub-centre and has a free haemoglobin test
//                   she did not strictly need. Cost: an afternoon.
//   False negative: an anaemic pregnant adolescent is told she looks fine and
//                   does not go. Cost: a preventable maternal death, and India
//                   has among the highest anaemia prevalence in the world —
//                   NFHS-5 put it at 57% of women aged 15-49.
//
// Those are not comparable, so the thresholds are not symmetric. Anything from
// mild pallor upward says yes; a low-confidence reading says yes; reported
// symptoms say yes on their own even when the colour looks fine, because a
// phone camera pointed at an eyelid is a weaker signal than a woman telling you
// she gets breathless climbing stairs.
const DECISION = {
  // Above this the colour alone is enough.
  SCORE_YES: 0.42,
  // Between WATCH and YES the colour is equivocal — one symptom tips it.
  SCORE_WATCH: 0.30,
  // Below this we trust a "no" only if the reading was actually good.
  MIN_CONFIDENCE_FOR_NO: 0.55,
  // Two symptoms are enough on their own, whatever the camera saw.
  SYMPTOMS_YES: 2,
};

function bandFor(score) {
  if (score >= 0.62) return { band: "high", flagged: true };
  if (score >= DECISION.SCORE_YES) return { band: "moderate", flagged: true };
  if (score >= DECISION.SCORE_WATCH) return { band: "borderline", flagged: true };
  return { band: "low", flagged: false };
}

const BAND_ADVICE = {
  high: "This screen suggests noticeable pallor. Please get a haemoglobin blood test — an ASHA worker or PHC can arrange one, and it is free.",
  moderate: "This screen suggests pallor. Please get a haemoglobin blood test to be sure.",
  borderline: "This screen is borderline. Get a haemoglobin blood test — it is free at the sub-centre and it settles the question.",
  low: "This screen did not detect pallor. That is reassuring but not conclusive — if you feel tired, breathless or dizzy, ask for a blood test anyway.",
};

// The symptom checklist, drawn from the questions an ANM asks at an antenatal
// visit. Weights are ordered by how specific each one is to iron deficiency:
// pica (craving mud, chalk or ice) is the most specific thing on this list and
// the one most often not asked about, which is why it is weighted highest.
const SYMPTOM_WEIGHTS = {
  breathlessness: 1.2,   // on exertion — the classic presenting symptom
  pica: 1.3,             // craving ice, chalk, mud, raw rice
  fatigue: 1.0,
  dizziness: 1.0,
  heavy_periods: 1.1,    // the commonest cause of iron loss in this group
  palpitations: 0.9,
  headaches: 0.7,
  brittle_nails: 0.7,
  cold_hands: 0.6,
};

// Groups where the WHO haemoglobin cut-off is higher and the consequence of a
// miss is worse. Being in one of these lowers the bar for "yes" by itself.
const RISK_WEIGHTS = {
  pregnant: 1.4,
  postpartum: 1.0,
  adolescent: 0.8,
  vegetarian: 0.4,       // weak on its own; real in combination
  previous_anaemia: 1.2,
};

function scoreSymptoms(symptoms = [], risks = []) {
  const reasons = [];
  let load = 0;
  let count = 0;

  for (const s of symptoms) {
    const w = SYMPTOM_WEIGHTS[s];
    if (!w) continue;
    load += w;
    count += 1;
    reasons.push(s);
  }
  for (const r of risks) {
    const w = RISK_WEIGHTS[r];
    if (!w) continue;
    load += w;
    reasons.push(r);
  }

  return { load, count, reasons };
}

const SYMPTOM_TEXT = {
  breathlessness: "you get breathless on exertion",
  pica: "you crave ice, chalk or mud",
  fatigue: "you are tired in a way sleep does not fix",
  dizziness: "you feel dizzy on standing",
  heavy_periods: "your periods are heavy",
  palpitations: "your heart races",
  headaches: "you get frequent headaches",
  brittle_nails: "your nails are brittle or spoon-shaped",
  cold_hands: "your hands and feet are always cold",
  pregnant: "you are pregnant or might be",
  postpartum: "you gave birth recently",
  adolescent: "you are under 20",
  vegetarian: "you eat little or no meat",
  previous_anaemia: "you have had anaemia before",
};

/**
 * Turns the colour score, the reading quality and the reported symptoms into a
 * yes or a no, plus the reasons for it in plain words.
 *
 * The reasons are not decoration. A verdict a person cannot interrogate is one
 * she has to take on trust, and this screen has not earned that much trust —
 * see the calibration note at the foot of this file.
 */
function decide({ pallorScore, confidence, band, symptoms, risks }) {
  const { load, count, reasons } = scoreSymptoms(symptoms, risks);
  const why = [];
  let testNeeded = false;

  if (pallorScore >= DECISION.SCORE_YES) {
    testNeeded = true;
    why.push("The inner eyelid looks paler than it should.");
  } else if (pallorScore >= DECISION.SCORE_WATCH) {
    why.push("The colour reading sits in the middle — not clearly pale, not clearly healthy.");
    if (load > 0) {
      testNeeded = true;
      why.push("Together with what you reported, that is enough to be worth checking.");
    }
  } else {
    why.push("The inner eyelid looked a healthy colour.");
  }

  if (count >= DECISION.SYMPTOMS_YES) {
    testNeeded = true;
    why.push(
      `You reported ${count} symptoms that commonly come with anaemia — ` +
      `${reasons.filter((r) => SYMPTOM_WEIGHTS[r]).map((r) => SYMPTOM_TEXT[r]).join(", ")}. ` +
      "Symptoms are a stronger signal than a phone camera."
    );
  } else if (count === 1 && load >= 1.6) {
    testNeeded = true;
    why.push("What you reported, in your situation, is enough on its own to justify a test.");
  }

  if (risks.includes("pregnant")) {
    testNeeded = true;
    why.push(
      "In pregnancy a haemoglobin test is part of routine antenatal care regardless of " +
      "what this screen sees — it should be done at every visit."
    );
  }

  if (!testNeeded && confidence < DECISION.MIN_CONFIDENCE_FOR_NO) {
    testNeeded = true;
    why.push(
      "The reading was not confident enough to rule anaemia out. When this screen is " +
      "unsure it says yes, because missing anaemia is the worse mistake."
    );
  }

  return {
    testNeeded,
    verdict: testNeeded ? "get_tested" : "no_test_needed",
    // What the person reads, in six words or fewer.
    headline: testNeeded ? "Yes — get a blood test" : "No test needed right now",
    summary: testNeeded
      ? "Ask an ASHA worker or the sub-centre for a haemoglobin test. It is free under Anemia Mukt Bharat, takes a few minutes, and settles this properly."
      : "Nothing on this screen suggests anaemia today. If you start feeling tired, breathless or dizzy, come back or ask for a test anyway.",
    reasons: why,
    symptomCount: count,
    symptomLoad: Number(load.toFixed(2)),
    band,
  };
}

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
  const symptoms = Array.isArray(input?.symptoms) ? input.symptoms : [];
  const risks = Array.isArray(input?.risks) ? input.risks : [];

  // Measured once for the whole burst — the skin does not change between frames
  // taken a tenth of a second apart, and re-measuring it per frame would just
  // add noise to the thing everything else is subtracted from.
  const referenceFeatures = computeReferenceFeatures(reference);

  const analyses = frames
    .filter((f) => Array.isArray(f) && f.length > 0)
    .map((f) => analyzeFrame(f, reference, focusScore, referenceFeatures));

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

  // --- outlier rejection across the burst ---------------------------------
  // One frame caught mid-blink, or as the autofocus hunts past, can pass the
  // quality gate and still be scored far from its neighbours. The median alone
  // survives that, but the *confidence* would not: a single wild frame inflates
  // the standard deviation and drags the whole reading down.
  //
  // So outliers are dropped by MAD (median absolute deviation) before anything
  // is computed. MAD rather than standard deviation because the SD of a set
  // containing an outlier is itself distorted by that outlier — which is the
  // classic reason a naive "drop anything beyond 2 SD" filter fails on exactly
  // the small samples it is aimed at.
  const rawScores = usableFrames.map((a) => a.pallorScore);
  const centre = median(rawScores);
  const deviations = rawScores.map((s) => Math.abs(s - centre));
  const mad = median(deviations);
  // 1.4826 scales MAD to be a consistent estimator of sigma for normal data.
  const tolerance = Math.max(0.08, 3 * 1.4826 * mad);

  const keptFrames = usableFrames.filter((a) => Math.abs(a.pallorScore - centre) <= tolerance);
  // Never let the filter empty the set — if the frames genuinely all disagree,
  // that is low confidence, not zero data.
  const consensusFrames = keptFrames.length >= 1 ? keptFrames : usableFrames;
  const outliersDropped = usableFrames.length - consensusFrames.length;

  const scores = consensusFrames.map((a) => a.pallorScore);
  const pallorScore = median(scores);
  // Disagreement across the burst is genuine measurement uncertainty, so it is
  // surfaced as lower confidence rather than averaged away.
  const spread = scores.length > 1 ? stdDev(scores) : 0;

  const representative = consensusFrames.reduce((best, a) =>
    Math.abs(a.pallorScore - pallorScore) < Math.abs(best.pallorScore - pallorScore) ? a : best
  );

  const { band, flagged } = bandFor(pallorScore);

  // Confidence blends five things now, where it blended three. The two added
  // terms are the ones that were quietly making a bad reading look as trusted
  // as a good one:
  //
  //  - SAMPLE SIZE. A single usable frame out of a burst of seven is not as
  //    reliable as five, even if that one frame was clean. sqrt so the penalty
  //    is steep at the bottom and flat once there are enough.
  //  - EXPOSURE HEADROOM. A frame sitting near the ends of the lightness range
  //    has less colour information left in it, whatever else was fine.
  const sampleTerm = clamp01(Math.sqrt(consensusFrames.length / 4));
  const L = representative.features.lightness;
  const exposureTerm = clamp01(1 - Math.abs(L - 55) / 40);

  const confidence = clamp01(
    0.30 * clamp01(representative.selection.validFraction / 0.6) +
    0.20 * (usableFrames.length / analyses.length) +
    0.20 * clamp01(1 - spread / 0.18) +
    0.18 * sampleTerm +
    0.12 * exposureTerm
  );

  const decision = decide({ pallorScore, confidence, band, symptoms, risks });

  return {
    ok: true,
    usable: true,

    // --- the answer, first ---
    verdict: decision.verdict,
    testNeeded: decision.testNeeded,
    headline: decision.headline,
    summary: decision.summary,
    reasons: decision.reasons,

    // --- the working, second ---
    pallorScore: Number(pallorScore.toFixed(3)),
    band,
    flagged,
    confidence: Number(confidence.toFixed(2)),
    advice: BAND_ADVICE[band],
    framesAnalysed: analyses.length,
    framesUsed: usableFrames.length,
    framesInConsensus: consensusFrames.length,
    outliersDropped,
    agreement: Number((1 - clamp01(spread / 0.18)).toFixed(2)),
    illuminantCorrected: representative.illuminantCorrected,
    symptomCount: decision.symptomCount,
    symptomLoad: decision.symptomLoad,
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

/** The checklist the client renders. Exported so the two cannot drift apart. */
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

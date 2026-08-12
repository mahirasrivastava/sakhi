// anaemia.js
// Turns sampled eyelid-region pixel colours into a pallor SCREEN, not a
// diagnosis and never a haemoglobin number. Redness/saturation below a
// threshold is flagged as "get a real blood test", full stop.
//
// pixels: [{r,g,b}, ...] sampled from the client-side canvas crop of the
// lower eyelid (conjunctiva) region.

const FLAG_THRESHOLD = 0.42; // tuned conservatively toward false positives, not false negatives

export function analyzePallor(pixels) {
  let rSum = 0, gSum = 0, bSum = 0;
  for (const p of pixels) {
    rSum += p.r; gSum += p.g; bSum += p.b;
  }
  const n = pixels.length;
  const r = rSum / n, g = gSum / n, b = bSum / n;

  // Redness ratio: healthy conjunctiva skews red relative to green/blue.
  // Pale conjunctiva flattens toward grey/pink — lower redness ratio.
  const total = r + g + b || 1;
  const rednessRatio = r / total;

  // Normalise into a 0-1 "pallor score" where higher = paler = more concerning.
  // rednessRatio typically ranges ~0.33 (neutral) to ~0.45 (healthy red) in practice;
  // this is a coarse screening heuristic, not a calibrated clinical instrument.
  const pallorScore = Math.max(0, Math.min(1, (0.40 - rednessRatio) / 0.10 + 0.5));
  const flagged = pallorScore >= FLAG_THRESHOLD;

  return {
    pallorScore: Number(pallorScore.toFixed(2)),
    flagged,
    note: "Screening estimate only — not a haemoglobin measurement. A real blood test is needed to confirm anaemia.",
  };
}

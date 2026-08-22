// utils/colorSpace.js
// Pure-JS colour space conversions. No dependencies — each is ~30 lines of
// arithmetic, and a screening tool that runs on low-end hardware does not need
// a matrix library to divide three numbers.
//
// rgbToHsv drives the ROI filter in routes/anaemia.js. rgbToLab is not on the
// current scoring path; it is kept because CIELAB a* is the perceptual
// red-green axis, which is the axis conjunctival pallor actually moves along,
// and any future feature work will want it.

/**
 * sRGB -> HSV.
 *
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{ h: number, s: number, v: number }} h in [0,360), s and v in [0,1]
 */
export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

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

  return {
    h,
    // Saturation is undefined at black; 0 is the conventional answer.
    s: max === 0 ? 0 : d / max,
    v: max,
  };
}

// ---------------------------------------------------------------------------
// CIELAB
// ---------------------------------------------------------------------------

/**
 * sRGB companding. The stored 0-255 values are gamma-encoded, so they must be
 * linearised before any matrix multiply. Skipping this is a common error that
 * quietly biases every downstream number.
 */
function srgbToLinear(c) {
  const cn = c / 255;
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

// D65 white point, matching the sRGB primaries used in the matrix below.
const WHITE_D65 = { x: 0.95047, y: 1.0, z: 1.08883 };

// CIE constants, written as the exact fractions they are rather than the
// rounded 0.008856 / 7.787 that most implementations copy from each other.
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

/**
 * sRGB -> CIELAB, D65.
 *
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{ L: number, a: number, b: number }} L in [0,100], a and b roughly [-128,127]
 */
export function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  // Linear sRGB -> XYZ, then normalised by the white point.
  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / WHITE_D65.x;
  const y = (0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) / WHITE_D65.y;
  const z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / WHITE_D65.z;

  const f = (t) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy), // + = red, - = green. The axis pallor moves along.
    b: 200 * (fy - fz), // + = yellow, - = blue.
  };
}

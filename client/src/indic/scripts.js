// indic/scripts.js
// The character inventory behind the on-screen keyboard and the phonetic
// transliterator.
//
// Nine of the eleven scripts here are Brahmic, and Unicode lays every Brahmic
// block out in the same order at a fixed offset from Devanagari (U+0900):
// Bengali is +0x80, Gurmukhi +0x100, and so on. So instead of eleven hand-typed
// layouts that drift apart, there is ONE table of offsets and a per-script list
// of what that script genuinely does not have.
//
// `missing` is the honest part. Tamil has no separate ख/ग/घ, Bengali writes व
// with ব, Gurmukhi has no ऋ. `alias` says what to substitute so a phonetic
// keystroke still produces something a reader recognises, rather than a tofu box.
//
// Ol Chiki (Santali) and Perso-Arabic (Urdu, Kashmiri, Sindhi) are not Brahmic
// and are defined explicitly at the bottom.

/** Offsets from the start of a Brahmic block, using Devanagari as the reference. */
export const O = {
  candrabindu: 0x01, anusvara: 0x02, visarga: 0x03,
  // Independent vowels
  a: 0x05, aa: 0x06, i: 0x07, ii: 0x08, u: 0x09, uu: 0x0a,
  vocalR: 0x0b, vocalL: 0x0c,
  candraE: 0x0d, shortE: 0x0e, e: 0x0f, ai: 0x10,
  candraO: 0x11, shortO: 0x12, o: 0x13, au: 0x14,
  // Consonants
  ka: 0x15, kha: 0x16, ga: 0x17, gha: 0x18, nga: 0x19,
  ca: 0x1a, cha: 0x1b, ja: 0x1c, jha: 0x1d, nya: 0x1e,
  tta: 0x1f, ttha: 0x20, dda: 0x21, ddha: 0x22, nna: 0x23,
  ta: 0x24, tha: 0x25, da: 0x26, dha: 0x27, na: 0x28, nnna: 0x29,
  pa: 0x2a, pha: 0x2b, ba: 0x2c, bha: 0x2d, ma: 0x2e,
  ya: 0x2f, ra: 0x30, rra: 0x31, la: 0x32, lla: 0x33, llla: 0x34,
  va: 0x35, sha: 0x36, ssa: 0x37, sa: 0x38, ha: 0x39,
  nukta: 0x3c, avagraha: 0x3d,
  // Dependent vowel signs (matras)
  mAa: 0x3e, mI: 0x3f, mII: 0x40, mU: 0x41, mUU: 0x42,
  mVocalR: 0x43, mVocalRR: 0x44,
  mCandraE: 0x45, mShortE: 0x46, mE: 0x47, mAi: 0x48,
  mCandraO: 0x49, mShortO: 0x4a, mO: 0x4b, mAu: 0x4c,
  virama: 0x4d,
  digitZero: 0x66,
};

export const INDEPENDENT_VOWELS = [
  O.a, O.aa, O.i, O.ii, O.u, O.uu, O.vocalR, O.vocalL,
  O.candraE, O.shortE, O.e, O.ai, O.candraO, O.shortO, O.o, O.au,
];

export const MATRAS = [
  O.mAa, O.mI, O.mII, O.mU, O.mUU, O.mVocalR, O.mVocalRR,
  O.mCandraE, O.mShortE, O.mE, O.mAi, O.mCandraO, O.mShortO, O.mO, O.mAu,
];

export const CONSONANTS = [
  O.ka, O.kha, O.ga, O.gha, O.nga,
  O.ca, O.cha, O.ja, O.jha, O.nya,
  O.tta, O.ttha, O.dda, O.ddha, O.nna,
  O.ta, O.tha, O.da, O.dha, O.na, O.nnna,
  O.pa, O.pha, O.ba, O.bha, O.ma,
  O.ya, O.ra, O.rra, O.la, O.lla, O.llla,
  O.va, O.sha, O.ssa, O.sa, O.ha,
];

export const SIGNS = [O.anusvara, O.candrabindu, O.visarga, O.virama, O.nukta, O.avagraha];

// Substitutions shared by most scripts: the Southern short e/o and the
// Northern candra vowels collapse onto their plain counterparts.
const NO_SHORT = { [O.shortE]: O.e, [O.mShortE]: O.mE, [O.shortO]: O.o, [O.mShortO]: O.mO };
const NO_CANDRA = { [O.candraE]: O.e, [O.mCandraE]: O.mE, [O.candraO]: O.o, [O.mCandraO]: O.mO };
const NO_NNNA_RRA = { [O.nnna]: O.na, [O.rra]: O.ra };

/**
 * A Brahmic script.
 *  base          first code point of the Unicode block
 *  missing       offsets the script does not encode
 *  alias         what to type instead — an offset, or a literal string
 *  extra         letters outside the shared layout (nukta forms, Assamese ৰ …)
 *  finalVirama   true where a word-final consonant keeps its virama/pulli
 */
const BRAHMIC = {
  deva: {
    base: 0x0900, name: "Devanagari",
    missing: [], alias: {},
    extra: ["क़", "ख़", "ग़", "ज़", "ड़", "ढ़", "फ़", "य़", "ॐ"],
    finalVirama: false,
  },
  beng: {
    base: 0x0980, name: "Bengali",
    missing: [O.candraE, O.shortE, O.candraO, O.shortO, O.nnna, O.rra, O.lla, O.llla, O.va,
      O.mCandraE, O.mShortE, O.mCandraO, O.mShortO],
    alias: {
      ...NO_SHORT, ...NO_CANDRA, ...NO_NNNA_RRA,
      [O.lla]: O.la, [O.llla]: O.la,
      // Bengali writes व with ব — the same letter as ba.
      [O.va]: O.ba,
    },
    extra: ["ৎ", "ড়", "ঢ়", "য়", "ৰ", "ৱ"],
    finalVirama: false,
  },
  guru: {
    base: 0x0a00, name: "Gurmukhi",
    missing: [O.vocalR, O.vocalL, O.candraE, O.shortE, O.candraO, O.shortO, O.nnna, O.rra,
      O.llla, O.ssa, O.avagraha, O.mVocalR, O.mVocalRR, O.mCandraE, O.mShortE, O.mCandraO, O.mShortO],
    alias: {
      ...NO_SHORT, ...NO_CANDRA, ...NO_NNNA_RRA,
      [O.vocalR]: "ਰਿ", [O.vocalL]: "ਲਿ",
      [O.mVocalR]: O.mI, [O.mVocalRR]: O.mII,
      [O.llla]: O.lla, [O.ssa]: O.sha,
    },
    extra: ["ਖ਼", "ਗ਼", "ਜ਼", "ੜ", "ਫ਼", "ੰ", "ੱ"],
    finalVirama: false,
  },
  gujr: {
    base: 0x0a80, name: "Gujarati",
    missing: [O.shortE, O.shortO, O.nnna, O.rra, O.llla, O.mShortE, O.mShortO],
    alias: { ...NO_SHORT, ...NO_NNNA_RRA, [O.llla]: O.lla },
    extra: [],
    finalVirama: false,
  },
  orya: {
    base: 0x0b00, name: "Odia",
    missing: [O.candraE, O.shortE, O.candraO, O.shortO, O.nnna, O.rra, O.llla,
      O.mCandraE, O.mShortE, O.mCandraO, O.mShortO],
    alias: { ...NO_SHORT, ...NO_CANDRA, ...NO_NNNA_RRA, [O.llla]: O.lla },
    extra: ["ଡ଼", "ଢ଼", "ୟ", "ୱ"],
    finalVirama: false,
  },
  taml: {
    // Tamil encodes no voiced or aspirated stops — voicing is positional. A
    // phonetic keystroke for "gh" must still land on க rather than nothing.
    base: 0x0b80, name: "Tamil",
    missing: [O.candrabindu, O.vocalR, O.vocalL, O.candraE, O.candraO,
      O.kha, O.ga, O.gha, O.cha, O.jha, O.ttha, O.dda, O.ddha,
      O.tha, O.da, O.dha, O.pha, O.ba, O.bha,
      O.nukta, O.avagraha, O.mVocalR, O.mVocalRR, O.mCandraE, O.mCandraO],
    alias: {
      [O.candrabindu]: O.anusvara,
      [O.kha]: O.ka, [O.ga]: O.ka, [O.gha]: O.ka,
      [O.cha]: O.ca, [O.jha]: O.ja,
      [O.ttha]: O.tta, [O.dda]: O.tta, [O.ddha]: O.tta,
      [O.tha]: O.ta, [O.da]: O.ta, [O.dha]: O.ta,
      [O.pha]: O.pa, [O.ba]: O.pa, [O.bha]: O.pa,
      [O.vocalR]: "ரி", [O.vocalL]: O.la,
      [O.mVocalR]: O.mI, [O.mVocalRR]: O.mII,
      [O.candraE]: O.shortE, [O.candraO]: O.shortO,
      [O.mCandraE]: O.mShortE, [O.mCandraO]: O.mShortO,
    },
    extra: ["ஃ"],
    finalVirama: true,
  },
  telu: {
    base: 0x0c00, name: "Telugu",
    missing: [O.candraE, O.candraO, O.nnna, O.rra, O.llla, O.mCandraE, O.mCandraO],
    alias: { ...NO_CANDRA, ...NO_NNNA_RRA, [O.llla]: O.lla },
    extra: ["ౘ", "ౙ"],
    finalVirama: false,
  },
  knda: {
    base: 0x0c80, name: "Kannada",
    missing: [O.candraE, O.candraO, O.nnna, O.llla, O.mCandraE, O.mCandraO],
    alias: { ...NO_CANDRA, [O.nnna]: O.na, [O.llla]: O.lla },
    extra: ["ೞ"],
    finalVirama: false,
  },
  mlym: {
    base: 0x0d00, name: "Malayalam",
    missing: [O.candraE, O.candraO, O.nnna, O.mCandraE, O.mCandraO],
    alias: { ...NO_CANDRA, [O.nnna]: O.na },
    extra: ["ൺ", "ൻ", "ർ", "ൽ", "ൾ"],
    finalVirama: true,
  },
};

// Assamese writes r and w with ৰ and ৱ, not the Bengali র and ব. Same script,
// different letters — a Bengali keyboard handed to an Assamese speaker is wrong
// in exactly the two places she uses most.
const LANG_CHAR_OVERRIDES = {
  as: { [O.ra]: "ৰ", [O.va]: "ৱ" },
};

/** Ol Chiki — Santali. An alphabet, not an abugida: every vowel is written. */
const OLCK = {
  base: 0x1c50, name: "Ol Chiki", kind: "alphabet", dir: "ltr",
  // Ordered as the script is taught, paired with the Latin key that produces it.
  letters: [
    ["ᱚ", "o"], ["ᱛ", "t"], ["ᱜ", "g"], ["ᱝ", "ng"], ["ᱞ", "l"],
    ["ᱟ", "a"], ["ᱠ", "k"], ["ᱡ", "j"], ["ᱢ", "m"], ["ᱣ", "w"],
    ["ᱤ", "i"], ["ᱥ", "s"], ["ᱦ", "h"], ["ᱧ", "ny"], ["ᱨ", "r"],
    ["ᱩ", "u"], ["ᱪ", "c"], ["ᱫ", "d"], ["ᱬ", "nn"], ["ᱭ", "y"],
    ["ᱮ", "e"], ["ᱯ", "p"], ["ᱰ", "dd"], ["ᱱ", "n"], ["ᱲ", "rr"],
    ["ᱳ", "oo"], ["ᱴ", "tt"], ["ᱵ", "b"], ["ᱶ", "v"], ["ᱷ", "hh"],
  ],
  signs: ["ᱸ", "ᱹ", "ᱺ", "ᱻ", "ᱼ", "ᱽ", "᱾", "᱿"],
  digits: ["᱐", "᱑", "᱒", "᱓", "᱔", "᱕", "᱖", "᱗", "᱘", "᱙"],
};

/** Perso-Arabic. Urdu is the base; Sindhi and Kashmiri add their own letters. */
const ARAB = {
  name: "Perso-Arabic", kind: "abjad", dir: "rtl",
  letters: [
    "ا", "آ", "ب", "پ", "ت", "ٹ", "ث", "ج", "چ",
    "ح", "خ", "د", "ڈ", "ذ", "ر", "ڑ", "ز", "ژ",
    "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
    "ق", "ک", "گ", "ل", "م", "ن", "ں", "و", "ہ",
    "ھ", "ء", "ی", "ے",
  ],
  signs: ["َ", "ِ", "ُ", "ّ", "ْ", "ٔ", "ٰ", "ۂ", "ۓ", "،", "؟", "۔"],
  digits: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
  extraByLang: {
    sd: ["ٻ", "ڀ", "ٺ", "ٿ", "ڄ", "ڃ", "ڊ", "ڍ",
      "ڏ", "ڌ", "ڪ", "ڳ", "ڱ", "ڻ", "ڦ", "ڬ"],
    ks: ["ۆ", "ۄ", "ۍ", "ؠ", "ٕ"],
  },
};

export const SCRIPTS = { ...BRAHMIC, olck: OLCK, arab: ARAB, latn: { name: "Latin", kind: "latin", dir: "ltr" } };

/** Which script each of the 23 languages is written in. */
export const LANG_SCRIPT = {
  en: "latn",
  hi: "deva", mr: "deva", mai: "deva", ne: "deva", kok: "deva", doi: "deva", brx: "deva", sa: "deva",
  bn: "beng", as: "beng", mni: "beng",
  gu: "gujr", pa: "guru", kn: "knda", ml: "mlym", or: "orya", ta: "taml", te: "telu",
  sat: "olck",
  ur: "arab", ks: "arab", sd: "arab",
};

export function scriptFor(lang) {
  return LANG_SCRIPT[lang] || "latn";
}

export function scriptMeta(id) {
  return SCRIPTS[id] || SCRIPTS.latn;
}

export function isBrahmic(id) {
  return Object.prototype.hasOwnProperty.call(BRAHMIC, id);
}

/**
 * The character a Brahmic offset produces in a given script, after `missing`
 * and `alias` have been applied. Returns "" when the script has no way at all
 * to write it — callers must not emit a code point the script does not encode.
 */
export function charAt(scriptId, offset, lang) {
  const s = BRAHMIC[scriptId];
  if (!s) return "";
  const override = lang && LANG_CHAR_OVERRIDES[lang]?.[offset];
  if (override) return override;

  if (!s.missing.includes(offset)) return String.fromCodePoint(s.base + offset);

  const sub = s.alias[offset];
  if (sub === undefined) return "";
  if (typeof sub === "string") return sub;
  // An alias may itself be absent (it never is today, but the guard keeps a
  // future script edit from emitting an unassigned code point).
  return s.missing.includes(sub) ? "" : String.fromCodePoint(s.base + sub);
}

/** True where a word-final consonant keeps its virama (Tamil pulli, Malayalam). */
export function finalViramaFor(scriptId) {
  return Boolean(BRAHMIC[scriptId]?.finalVirama);
}

/** The letters a script adds outside the shared Brahmic layout. */
export function extraLetters(scriptId, lang) {
  if (BRAHMIC[scriptId]) return BRAHMIC[scriptId].extra;
  if (scriptId === "arab") return ARAB.extraByLang[lang] || [];
  return [];
}

/** True when the script writes this offset itself, without substitution. */
export function has(scriptId, offset) {
  const s = BRAHMIC[scriptId];
  return Boolean(s) && !s.missing.includes(offset);
}

/** Native digits 0–9 for a script, or Latin digits when it has none of its own. */
export function digitsFor(scriptId) {
  const s = BRAHMIC[scriptId];
  if (s) return Array.from({ length: 10 }, (_, n) => String.fromCodePoint(s.base + O.digitZero + n));
  if (scriptId === "olck") return OLCK.digits;
  if (scriptId === "arab") return ARAB.digits;
  return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
}

/** Maps native digits of every supported script back to ASCII. */
const DIGIT_TO_ASCII = (() => {
  const map = {};
  for (const id of Object.keys(SCRIPTS)) {
    digitsFor(id).forEach((d, n) => { map[d] = String(n); });
  }
  return map;
})();

export function asciiDigits(text) {
  return String(text).replace(/./gu, (ch) => DIGIT_TO_ASCII[ch] ?? ch);
}

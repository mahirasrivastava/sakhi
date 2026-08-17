// indic/transliterate.js
// Phonetic input: someone types "pet me dard" on the keyboard her phone already
// has, and gets "पेट मे दर्द". This is what most people in India actually use to
// type their own language — tapping 40 unfamiliar glyphs is the fallback, not
// the primary path.
//
// It is an input method, not a translator. It converts sound to script; the
// words stay the user's own.
//
// One phonetic table drives all nine Brahmic scripts, because scripts.js has
// already reduced them to a shared set of offsets. Perso-Arabic and Ol Chiki
// have their own passes at the bottom.

import { O, charAt, scriptFor, isBrahmic, digitsFor, finalViramaFor } from "./scripts.js";

// Longest match wins, so "kh" beats "k" and "chh" beats "ch". Capitals give the
// retroflex/dental distinction for people who know the convention; the doubled
// forms ("tt", "dd") give it to everyone else.
const CONSONANT_KEYS = [
  ["kSh", [O.ka, O.virama, O.ssa]], ["ksh", [O.ka, O.virama, O.ssa]], ["x", [O.ka, O.virama, O.ssa]],
  ["gy", [O.ja, O.virama, O.nya]], ["jn", [O.ja, O.virama, O.nya]],
  ["chh", [O.cha]], ["Ch", [O.cha]],
  ["kh", [O.kha]], ["gh", [O.gha]], ["ng", [O.nga]], ["~N", [O.nga]],
  ["ch", [O.ca]], ["jh", [O.jha]], ["ny", [O.nya]], ["~n", [O.nya]],
  ["Th", [O.ttha]], ["tth", [O.ttha]], ["Dh", [O.ddha]], ["ddh", [O.ddha]],
  ["tt", [O.tta]], ["dd", [O.dda]], ["nn", [O.nna]],
  ["th", [O.tha]], ["dh", [O.dha]],
  ["ph", [O.pha]], ["bh", [O.bha]], ["sh", [O.sha]], ["Sh", [O.ssa]], ["shh", [O.ssa]],
  ["k", [O.ka]], ["g", [O.ga]], ["c", [O.ca]], ["j", [O.ja]],
  ["T", [O.tta]], ["D", [O.dda]], ["N", [O.nna]],
  ["t", [O.ta]], ["d", [O.da]], ["n", [O.na]],
  ["p", [O.pa]], ["f", [O.pha]], ["b", [O.ba]], ["m", [O.ma]],
  ["y", [O.ya]], ["r", [O.ra]], ["L", [O.lla]], ["l", [O.la]],
  ["v", [O.va]], ["w", [O.va]], ["S", [O.ssa]], ["s", [O.sa]], ["h", [O.ha]],
  ["z", [O.ja]], ["q", [O.ka]],
];

// [key, independent vowel, matra]. "a" has no matra — it is the inherent vowel.
const VOWEL_KEYS = [
  ["aa", O.aa, O.mAa], ["A", O.aa, O.mAa],
  ["ai", O.ai, O.mAi], ["au", O.au, O.mAu], ["ou", O.au, O.mAu],
  ["ee", O.ii, O.mII], ["ii", O.ii, O.mII], ["I", O.ii, O.mII],
  ["oo", O.uu, O.mUU], ["uu", O.uu, O.mUU], ["U", O.uu, O.mUU],
  ["ri", O.vocalR, O.mVocalR], ["R", O.vocalR, O.mVocalR],
  ["a", O.a, null], ["i", O.i, O.mI], ["u", O.u, O.mU],
  ["e", O.e, O.mE], ["o", O.o, O.mO],
];

const SIGN_KEYS = [
  ["M", [O.anusvara]], ["H", [O.visarga]], [".n", [O.candrabindu]], ["^", [O.candrabindu]],
];

const ALL_KEYS = [...CONSONANT_KEYS, ...VOWEL_KEYS.map(([k]) => [k, null]), ...SIGN_KEYS]
  .map(([k]) => k)
  .sort((a, b) => b.length - a.length);

const VOWEL_BY_KEY = Object.fromEntries(VOWEL_KEYS.map(([k, ind, mat]) => [k, { ind, mat }]));
const CONSONANT_BY_KEY = Object.fromEntries(CONSONANT_KEYS);
const SIGN_BY_KEY = Object.fromEntries(SIGN_KEYS);

/** Splits a Latin run into phonetic tokens, longest match first. */
function tokenize(latin) {
  const tokens = [];
  let i = 0;
  while (i < latin.length) {
    const key = ALL_KEYS.find((k) => latin.startsWith(k, i));
    if (!key) {
      tokens.push({ type: "raw", text: latin[i] });
      i += 1;
      continue;
    }
    if (VOWEL_BY_KEY[key]) tokens.push({ type: "vowel", key });
    else if (CONSONANT_BY_KEY[key]) tokens.push({ type: "consonant", key });
    else tokens.push({ type: "sign", key });
    i += key.length;
  }
  return tokens;
}

function emit(script, lang, offsets) {
  return offsets.map((off) => charAt(script, off, lang)).join("");
}

/**
 * Latin → Brahmic. A consonant carries its inherent "a" unless a vowel follows
 * (then a matra) or another consonant follows (then a virama). Word-finally the
 * inherent vowel stays in the North and is killed in Tamil and Malayalam, which
 * is what `finalVirama` in scripts.js records.
 */
function brahmicFromLatin(latin, script, lang, { finalVirama }) {
  const tokens = tokenize(latin);
  let out = "";

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];

    if (tok.type === "raw") { out += tok.text; continue; }

    if (tok.type === "sign") { out += emit(script, lang, SIGN_BY_KEY[tok.key]); continue; }

    if (tok.type === "vowel") {
      const v = VOWEL_BY_KEY[tok.key];
      const prev = tokens[i - 1];
      // A vowel right after a consonant is written as a matra; anywhere else it
      // takes its independent form.
      if (prev && prev.type === "consonant") {
        out += v.mat === null ? "" : charAt(script, v.mat, lang);
      } else {
        out += charAt(script, v.ind, lang);
      }
      continue;
    }

    // Consonant
    out += emit(script, lang, CONSONANT_BY_KEY[tok.key]);
    const followedByVowel = next && next.type === "vowel";
    if (followedByVowel) continue;               // matra is emitted by the vowel
    if (next) out += charAt(script, O.virama, lang); // cluster
    else if (finalVirama) out += charAt(script, O.virama, lang);
  }

  return out;
}

// --- Perso-Arabic -----------------------------------------------------------
// Urdu writes long vowels and leaves short ones out, except word-initially where
// every vowel needs an alif to sit on. Following that rule is what turns
// "bukhaar" into بخار rather than بوخار.

const ARAB_CONSONANTS = [
  ["kh", "خ"], ["gh", "غ"], ["ch", "چ"], ["sh", "ش"], ["zh", "ژ"], ["th", "تھ"],
  ["ph", "پھ"], ["bh", "بھ"], ["dh", "دھ"], ["jh", "جھ"],
  ["T", "ٹ"], ["D", "ڈ"], ["R", "ڑ"], ["S", "ص"], ["Z", "ض"], ["N", "ں"],
  ["b", "ب"], ["p", "پ"], ["t", "ت"], ["s", "س"], ["j", "ج"], ["H", "ح"],
  ["d", "د"], ["z", "ز"], ["r", "ر"], ["f", "ف"], ["q", "ق"], ["k", "ک"],
  ["g", "گ"], ["l", "ل"], ["m", "م"], ["n", "ن"], ["v", "و"], ["w", "و"],
  ["h", "ہ"], ["y", "ی"], ["'", "ع"],
];

// [key, word-initial, medial, word-final]
const ARAB_VOWELS = [
  ["aa", "آ", "ا", "ا"], ["A", "آ", "ا", "ا"],
  ["ai", "اے", "ی", "ے"], ["au", "او", "و", "و"],
  ["ee", "ای", "ی", "ی"], ["ii", "ای", "ی", "ی"], ["I", "ای", "ی", "ی"],
  ["oo", "او", "و", "و"], ["uu", "او", "و", "و"], ["U", "او", "و", "و"],
  ["e", "اے", "ی", "ے"], ["o", "او", "و", "و"],
  ["a", "ا", "", "ہ"], ["i", "ا", "", "ی"], ["u", "ا", "", "و"],
];

const ARAB_KEYS = [...ARAB_CONSONANTS, ...ARAB_VOWELS.map((v) => [v[0]])]
  .map(([k]) => k)
  .sort((a, b) => b.length - a.length);

const ARAB_CONSONANT_BY_KEY = Object.fromEntries(ARAB_CONSONANTS);
const ARAB_VOWEL_BY_KEY = Object.fromEntries(ARAB_VOWELS.map(([k, ...forms]) => [k, forms]));

function arabicFromLatin(latin) {
  let out = "";
  let i = 0;
  let atStart = true;

  while (i < latin.length) {
    const key = ARAB_KEYS.find((k) => latin.startsWith(k, i));
    if (!key) { out += latin[i]; i += 1; atStart = false; continue; }

    const consonant = ARAB_CONSONANT_BY_KEY[key];
    if (consonant) {
      out += consonant;
    } else {
      const [initial, medial, final] = ARAB_VOWEL_BY_KEY[key];
      const atEnd = i + key.length >= latin.length;
      out += atStart ? initial : atEnd ? final : medial;
    }
    i += key.length;
    atStart = false;
  }
  return out;
}

// --- Ol Chiki ---------------------------------------------------------------

const OLCK_KEYS = (() => {
  const pairs = [
    ["ng", "ᱝ"], ["ny", "ᱧ"], ["nn", "ᱬ"], ["dd", "ᱰ"], ["rr", "ᱲ"],
    ["tt", "ᱴ"], ["hh", "ᱷ"], ["oo", "ᱳ"],
    ["a", "ᱟ"], ["b", "ᱵ"], ["c", "ᱪ"], ["d", "ᱫ"], ["e", "ᱮ"], ["g", "ᱜ"],
    ["h", "ᱦ"], ["i", "ᱤ"], ["j", "ᱡ"], ["k", "ᱠ"], ["l", "ᱞ"], ["m", "ᱢ"],
    ["n", "ᱱ"], ["o", "ᱚ"], ["p", "ᱯ"], ["r", "ᱨ"], ["s", "ᱥ"], ["t", "ᱛ"],
    ["u", "ᱩ"], ["v", "ᱶ"], ["w", "ᱣ"], ["y", "ᱭ"],
  ];
  return { order: pairs.map(([k]) => k).sort((a, b) => b.length - a.length), map: Object.fromEntries(pairs) };
})();

function olChikiFromLatin(latin) {
  let out = "";
  let i = 0;
  while (i < latin.length) {
    const key = OLCK_KEYS.order.find((k) => latin.startsWith(k, i));
    if (!key) { out += latin[i]; i += 1; continue; }
    out += OLCK_KEYS.map[key];
    i += key.length;
  }
  return out;
}

// --- Public API -------------------------------------------------------------

/** True when typing Latin letters in this language can produce its own script. */
export function transliterationSupported(lang) {
  return scriptFor(lang) !== "latn";
}

/**
 * Converts one run of Latin letters into the script of `lang`.
 * Digits and anything unrecognised pass through untouched.
 */
export function transliterate(latin, lang) {
  if (!latin) return "";
  const script = scriptFor(lang);
  if (script === "latn") return latin;
  if (script === "arab") return arabicFromLatin(latin);
  if (script === "olck") return olChikiFromLatin(latin);
  if (!isBrahmic(script)) return latin;

  return brahmicFromLatin(latin, script, lang, { finalVirama: finalViramaFor(script) });
}

/** Native digits for the language, used by the numeric keypad's display row. */
export function nativeDigits(lang) {
  return digitsFor(scriptFor(lang));
}

// i18n/languages.js
// The 22 languages of the Eighth Schedule to the Constitution of India, plus
// English (which is an official language of the Union but not in the Schedule).
//
// `endonym` is the language's name in its own script — that is what a speaker
// actually recognises in a picker. Showing "Malayalam" to someone who reads
// Malayalam is a small daily indignity that costs nothing to avoid.
//
// `dir: "rtl"` matters for Urdu, Kashmiri and Sindhi: without it the Perso-Arabic
// text renders with punctuation and numerals in the wrong place.
//
// `reviewed: false` marks translations that have NOT been checked by a native
// speaker. This is a health app — a mistranslated danger sign is a safety bug,
// not a typo — so the UI surfaces that state rather than hiding it.

export const LANGUAGES = [
  { code: "en",  endonym: "English",    english: "English",            dir: "ltr", script: "Latin",      reviewed: true  },
  { code: "hi",  endonym: "हिन्दी",       english: "Hindi",              dir: "ltr", script: "Devanagari", reviewed: true  },
  { code: "bn",  endonym: "বাংলা",       english: "Bengali",            dir: "ltr", script: "Bengali",    reviewed: false },
  { code: "mr",  endonym: "मराठी",       english: "Marathi",            dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "te",  endonym: "తెలుగు",      english: "Telugu",             dir: "ltr", script: "Telugu",     reviewed: false },
  { code: "ta",  endonym: "தமிழ்",       english: "Tamil",              dir: "ltr", script: "Tamil",      reviewed: false },
  { code: "gu",  endonym: "ગુજરાતી",      english: "Gujarati",           dir: "ltr", script: "Gujarati",   reviewed: false },
  { code: "ur",  endonym: "اردو",        english: "Urdu",               dir: "rtl", script: "Perso-Arabic", reviewed: false },
  { code: "kn",  endonym: "ಕನ್ನಡ",       english: "Kannada",            dir: "ltr", script: "Kannada",    reviewed: true  },
  { code: "or",  endonym: "ଓଡ଼ିଆ",        english: "Odia",               dir: "ltr", script: "Odia",       reviewed: false },
  { code: "ml",  endonym: "മലയാളം",     english: "Malayalam",          dir: "ltr", script: "Malayalam",  reviewed: false },
  { code: "pa",  endonym: "ਪੰਜਾਬੀ",       english: "Punjabi",            dir: "ltr", script: "Gurmukhi",   reviewed: false },
  { code: "as",  endonym: "অসমীয়া",      english: "Assamese",           dir: "ltr", script: "Assamese",   reviewed: false },
  { code: "mai", endonym: "मैथिली",       english: "Maithili",           dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "sat", endonym: "ᱥᱟᱱᱛᱟᱲᱤ",   english: "Santali",            dir: "ltr", script: "Ol Chiki",   reviewed: false },
  { code: "ks",  endonym: "کٲشُر",        english: "Kashmiri",           dir: "rtl", script: "Perso-Arabic", reviewed: false },
  { code: "ne",  endonym: "नेपाली",       english: "Nepali",             dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "sd",  endonym: "سنڌي",        english: "Sindhi",             dir: "rtl", script: "Perso-Arabic", reviewed: false },
  { code: "kok", endonym: "कोंकणी",       english: "Konkani",            dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "doi", endonym: "डोगरी",        english: "Dogri",              dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "mni", endonym: "মৈতৈলোন্",     english: "Manipuri (Meitei)",  dir: "ltr", script: "Bengali",    reviewed: false },
  { code: "brx", endonym: "बर’",          english: "Bodo",               dir: "ltr", script: "Devanagari", reviewed: false },
  { code: "sa",  endonym: "संस्कृतम्",      english: "Sanskrit",           dir: "ltr", script: "Devanagari", reviewed: false },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE = "en";

export function getLanguage(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
}

// Best-effort match against the browser's preferred languages, so a phone set to
// Marathi opens in Marathi instead of English. Falls back to the base tag, so
// "bn-IN" still resolves to "bn".
export function detectBrowserLanguage() {
  const preferred = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);

  for (const tag of preferred) {
    const lower = String(tag).toLowerCase();
    const exact = LANGUAGE_CODES.find((c) => c === lower);
    if (exact) return exact;
    const base = lower.split("-")[0];
    const match = LANGUAGE_CODES.find((c) => c === base);
    if (match) return match;
  }
  return DEFAULT_LANGUAGE;
}

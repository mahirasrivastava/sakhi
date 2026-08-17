// indic/layouts.js
// Builds the on-screen keyboard's key rows for a language.
//
// Nothing here is hand-authored per script. The rows fall out of the offset
// tables in scripts.js, so a script the app supports can never end up with a
// keyboard that silently disagrees with its transliterator.

import {
  O, INDEPENDENT_VOWELS, MATRAS, CONSONANTS, SIGNS,
  scriptFor, scriptMeta, isBrahmic, charAt, has, digitsFor, extraLetters,
} from "./scripts.js";

// Matras are combining marks: rendered alone they either vanish or attach to
// whatever precedes them. U+25CC DOTTED CIRCLE is the Unicode-sanctioned way to
// show one as a standalone key.
const DOTTED_CIRCLE = "◌";

const COMBINING = new Set([...MATRAS, O.virama, O.anusvara, O.candrabindu, O.nukta]);

const PUNCTUATION = [".", ",", "?", "!", "-", "/", "(", ")", ":", "'"];

function key(char, { label } = {}) {
  return { char, label: label ?? char };
}

function chunk(keys, perRow) {
  const rows = [];
  for (let i = 0; i < keys.length; i += perRow) rows.push(keys.slice(i, i + perRow));
  return rows;
}

function brahmicLayers(script, lang) {
  const consonants = CONSONANTS
    .filter((off) => has(script, off))
    .map((off) => key(charAt(script, off, lang)));

  const extras = extraLetters(script, lang).map((c) => key(c));

  const vowels = INDEPENDENT_VOWELS
    .filter((off) => has(script, off))
    .map((off) => key(charAt(script, off, lang)));

  const matras = MATRAS
    .filter((off) => has(script, off))
    .map((off) => {
      const c = charAt(script, off, lang);
      return key(c, { label: DOTTED_CIRCLE + c });
    });

  const signs = SIGNS
    .filter((off) => has(script, off))
    .map((off) => {
      const c = charAt(script, off, lang);
      return key(c, { label: COMBINING.has(off) ? DOTTED_CIRCLE + c : c });
    });

  return [
    {
      id: "letters",
      label: charAt(script, O.ka, lang) || "क",
      rows: [...chunk(consonants, 10), ...(extras.length ? chunk(extras, 10) : [])],
    },
    {
      id: "vowels",
      label: charAt(script, O.aa, lang) || "आ",
      rows: [...chunk(vowels, 8), ...chunk(matras, 8), ...chunk(signs, 8)],
    },
  ];
}

function alphabetLayers(script, lang) {
  const meta = scriptMeta(script);
  const letters = (meta.letters || []).map((entry) =>
    key(Array.isArray(entry) ? entry[0] : entry));
  const extras = extraLetters(script, lang).map((c) => key(c));
  const signs = (meta.signs || []).map((c) => key(c, { label: DOTTED_CIRCLE + c }));

  return [
    { id: "letters", label: letters[0]?.char || "A", rows: chunk([...letters, ...extras], 10) },
    { id: "vowels", label: signs[0]?.char ? DOTTED_CIRCLE + signs[0].char : "◌", rows: chunk(signs, 8) },
  ];
}

const QWERTY = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

function latinLayers() {
  return [
    { id: "letters", label: "abc", rows: QWERTY.map((row) => row.map((c) => key(c))) },
    { id: "vowels", label: "ABC", rows: QWERTY.map((row) => row.map((c) => key(c.toUpperCase()))) },
  ];
}

function digitLayer(script) {
  const native = digitsFor(script);
  const ascii = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const rows = [ascii.map((d) => key(d))];
  // Only worth a second row where the script has digits of its own — otherwise
  // it would duplicate the row above.
  if (native.join("") !== ascii.join("")) rows.push(native.map((d) => key(d)));
  rows.push(PUNCTUATION.map((p) => key(p)));
  return { id: "digits", label: "123", rows };
}

/**
 * Layers for a language's keyboard: letters, vowels/marks, and digits.
 * Every layer is a list of rows; every key is { char, label }.
 */
export function layersFor(lang) {
  const script = scriptFor(lang);
  const base = isBrahmic(script)
    ? brahmicLayers(script, lang)
    : script === "latn"
      ? latinLayers()
      : alphabetLayers(script, lang);
  return [...base, digitLayer(script)];
}

/**
 * One character that stands for the language's script, for the button that
 * opens the keyboard. "क" says "types Hindi" faster than any label could.
 */
export function scriptBadge(lang) {
  const script = scriptFor(lang);
  if (isBrahmic(script)) return charAt(script, O.ka, lang);
  if (script === "arab") return "ا";
  if (script === "olck") return "ᱚ";
  return "A";
}

/** The keypad shown for number fields. Digits stay ASCII so Number() still works. */
export function numericRows() {
  return [
    ["1", "2", "3"].map((d) => key(d)),
    ["4", "5", "6"].map((d) => key(d)),
    ["7", "8", "9"].map((d) => key(d)),
    [key("."), key("0"), key("-")],
  ];
}

export { DOTTED_CIRCLE };

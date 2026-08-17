import React, { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useKeyboard } from "../context/KeyboardContext.jsx";
import { transliterate, transliterationSupported } from "../indic/transliterate.js";
import { scriptBadge } from "../indic/layouts.js";

/**
 * Every text field in Sakhi.
 *
 * It is a plain <input>/<textarea> with two things added:
 *
 *  1. A button that opens the shared on-screen keyboard in the user's script,
 *     for the very common case of a phone with no Indic keyboard installed.
 *  2. Phonetic typing — "bukhaar" becomes "बुखार" as she types, on the Latin
 *     keyboard she already has. This is how most people in India type their own
 *     language, and it is far faster than hunting for glyphs.
 *
 * Both are opt-in per keystroke and neither changes what the field stores: the
 * value is always the text as it appears.
 *
 * `keyboard`:
 *   "indic"   follow the app language (default)
 *   "latin"   force Latin — worker IDs, activation codes, passwords, which are
 *             ASCII on the card in the worker's hand and must not be "helped"
 *   "numeric" digit pad, ASCII digits so Number() still works
 *   "off"     no keyboard affordance at all
 */

// Anything that moves the caret ends the run of Latin letters being converted,
// so a later keystroke is never folded into a word the user has walked away from.
const RUN_BREAKING_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End", "PageUp", "PageDown", "Enter", "Tab", "Escape", " ",
]);

// selectionStart is null on these, per the HTML spec, so caret arithmetic is
// unavailable and edits go to the end of the value instead.
const NO_SELECTION_TYPES = new Set(["number", "email", "date", "range", "color"]);

export default function ScriptField({
  as = "input",
  value,
  onValueChange,
  keyboard = "indic",
  onEnter,
  adornmentInset = 8,
  wrapperStyle,
  inputRef,
  ...rest
}) {
  const { lang, t } = useLanguage();
  const kbd = useKeyboard();
  const reactId = useId();
  const id = rest.id || reactId;

  const elRef = useRef(null);
  const caretRef = useRef(null);
  const runRef = useRef(null);

  const text = value == null ? "" : String(value);
  const canSelect = as === "textarea" || !NO_SELECTION_TYPES.has(rest.type);
  const enabled = keyboard !== "off";
  const fieldLang = keyboard === "latin" || keyboard === "numeric" ? "en" : lang;
  const translitActive =
    keyboard === "indic" && kbd.translit && transliterationSupported(lang);

  const setEl = useCallback((node) => {
    elRef.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);

  const commit = useCallback((next, caret) => {
    if (caret != null) caretRef.current = caret;
    onValueChange?.(next);
  }, [onValueChange]);

  // Restoring the caret has to wait for React to paint the new value, or the
  // browser drops it to the end of the field on every keystroke.
  useEffect(() => {
    const el = elRef.current;
    if (!el || caretRef.current == null) return;
    if (canSelect && document.activeElement === el) {
      const pos = Math.min(caretRef.current, el.value.length);
      el.setSelectionRange(pos, pos);
    }
    caretRef.current = null;
  });

  const endRun = useCallback(() => { runRef.current = null; }, []);

  // --- keys arriving from the on-screen keyboard ---------------------------

  const insert = useCallback((chars) => {
    const el = elRef.current;
    const current = el ? el.value : text;
    if (!canSelect || !el) {
      commit(current + chars);
      el?.focus();
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? start;
    commit(current.slice(0, start) + chars + current.slice(end), start + chars.length);
    el.focus();
  }, [canSelect, commit, text]);

  const backspace = useCallback(() => {
    const el = elRef.current;
    const current = el ? el.value : text;
    if (!canSelect || !el) {
      commit(current.slice(0, -1));
      el?.focus();
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? start;
    if (start !== end) {
      commit(current.slice(0, start) + current.slice(end), start);
    } else if (start > 0) {
      // Step back a whole code point so an emoji or a surrogate pair does not
      // get cut in half.
      const back = /[\uDC00-\uDFFF]/.test(current[start - 1]) && start > 1 ? 2 : 1;
      commit(current.slice(0, start - back) + current.slice(start), start - back);
    }
    el.focus();
  }, [canSelect, commit, text]);

  const enter = useCallback(() => {
    if (onEnter) { onEnter(); return; }
    elRef.current?.form?.requestSubmit?.();
  }, [onEnter]);

  // The handlers close over the current value, so they change identity on every
  // keystroke. Registering those directly would tear the field down and rebuild
  // it between letters, so registration goes through a ref and happens once.
  const liveRef = useRef(null);
  liveRef.current = { insert, backspace, enter, endRun, lang: fieldLang, kind: keyboard };

  const { register } = kbd;
  useEffect(() => {
    if (!enabled) return undefined;
    return register(id, {
      insert: (chars) => liveRef.current.insert(chars),
      backspace: () => liveRef.current.backspace(),
      enter: () => liveRef.current.enter(),
      endRun: () => liveRef.current.endRun(),
      get lang() { return liveRef.current.lang; },
      get kind() { return liveRef.current.kind; },
    });
  }, [enabled, register, id]);

  // --- keys arriving from the physical keyboard ----------------------------

  const handleChange = useCallback((e) => {
    const next = e.target.value;
    if (!translitActive) { runRef.current = null; onValueChange?.(next); return; }

    const prev = text;
    const caret = e.target.selectionStart;
    const typed = next.length === prev.length + 1 && caret > 0 ? next[caret - 1] : null;
    const isPlainInsert =
      typed !== null &&
      next.slice(0, caret - 1) === prev.slice(0, caret - 1) &&
      next.slice(caret) === prev.slice(caret - 1);

    if (!isPlainInsert || !/^[A-Za-z]$/.test(typed)) {
      runRef.current = null;
      onValueChange?.(next);
      return;
    }

    // Re-convert the whole Latin word each keystroke rather than the new letter
    // alone: "n" is न but "na" is ना and "nam" is नम्, and only the full run
    // knows which.
    const run = runRef.current;
    const continuing = run && run.end === caret - 1;
    const start = continuing ? run.start : caret - 1;
    const latin = continuing ? run.latin + typed : typed;
    const converted = transliterate(latin, lang);

    runRef.current = { start, latin, end: start + converted.length };
    commit(next.slice(0, start) + converted + next.slice(caret), start + converted.length);
  }, [translitActive, text, lang, commit, onValueChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && as !== "textarea" && onEnter) {
      e.preventDefault();
      onEnter();
      return;
    }

    const run = runRef.current;
    if (!translitActive || !run) {
      if (RUN_BREAKING_KEYS.has(e.key)) runRef.current = null;
      return;
    }

    // Backspace inside a converted word walks back through the Latin the user
    // actually typed, not through the glyphs it produced — otherwise deleting
    // "ना" one keystroke at a time leaves an orphan matra behind.
    const el = e.target;
    if (e.key === "Backspace" && el.selectionStart === el.selectionEnd && el.selectionStart === run.end) {
      e.preventDefault();
      const latin = run.latin.slice(0, -1);
      const converted = transliterate(latin, lang);
      const next = text.slice(0, run.start) + converted + text.slice(run.end);
      runRef.current = latin ? { start: run.start, latin, end: run.start + converted.length } : null;
      commit(next, run.start + converted.length);
      return;
    }

    if (RUN_BREAKING_KEYS.has(e.key)) runRef.current = null;
  }, [as, onEnter, translitActive, lang, text, commit]);

  const badge = useMemo(() => scriptBadge(fieldLang), [fieldLang]);
  const isActive = kbd.open && kbd.field?.id === id;

  const Element = as;
  const control = (
    <Element
      {...rest}
      id={id}
      ref={setEl}
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={(e) => { kbd.focusField(id); rest.onFocus?.(e); }}
      onBlur={(e) => { endRun(); rest.onBlur?.(e); }}
      onClick={(e) => { endRun(); rest.onClick?.(e); }}
      lang={keyboard === "indic" ? lang : "en"}
    />
  );

  if (!enabled) return control;

  return (
    <span className="script-field" style={wrapperStyle}>
      {control}
      <button
        type="button"
        className={`script-field-btn${isActive ? " is-active" : ""}`}
        style={{ insetInlineEnd: adornmentInset }}
        onClick={() => kbd.toggleFor(id)}
        onMouseDown={(e) => e.preventDefault()} // keep focus in the field
        aria-pressed={isActive}
        aria-controls="sakhi-keyboard"
        aria-label={`${t("kbd_open")} (${badge})`}
        title={t("kbd_open")}
      >
        {/* The badge is the script's own letter — "क" says "types Hindi" faster
            than any label or icon could, so it beats a keyboard pictogram here. */}
        <span aria-hidden="true">{keyboard === "numeric" ? "123" : badge}</span>
      </button>
    </span>
  );
}

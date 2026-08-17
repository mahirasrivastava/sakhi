import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useKeyboard } from "../context/KeyboardContext.jsx";
import { layersFor, numericRows } from "../indic/layouts.js";
import { scriptFor, scriptMeta } from "../indic/scripts.js";
import { transliterationSupported } from "../indic/transliterate.js";
import Icon from "./Icon.jsx";

/**
 * The single on-screen keyboard, docked to the bottom of the viewport.
 *
 * Sakhi is for people whose phone very often has no keyboard installed for the
 * language they actually speak — a shared handset set up by someone else, or a
 * script (Santali's Ol Chiki, Meitei, Dogri) that ships on almost nothing. If
 * the only way to describe a symptom is to type English, the free-text box may
 * as well not be there.
 *
 * Keys are big, because this is used one-handed, outdoors, sometimes by someone
 * in pain.
 */
export default function VirtualKeyboard() {
  const { t } = useLanguage();
  const { open, field, translit, toggleTranslit, close, press } = useKeyboard();

  const lang = field?.lang || "en";
  const kind = field?.kind || "indic";
  const script = scriptFor(lang);
  const meta = scriptMeta(script);

  const layers = useMemo(
    () => (kind === "numeric"
      ? [{ id: "digits", label: "123", rows: numericRows() }]
      : layersFor(lang)),
    [kind, lang]
  );

  const [layerId, setLayerId] = useState(layers[0].id);

  // A language switch mid-session must not leave the user staring at a layer
  // the new script does not have.
  useEffect(() => { setLayerId(layers[0].id); }, [layers]);

  const layer = layers.find((l) => l.id === layerId) || layers[0];
  const canTransliterate = kind === "indic" && transliterationSupported(lang);

  if (!open || !field) return null;

  return (
    <div id="sakhi-keyboard" className="kbd" role="group" aria-label={t("kbd_title")}>
      <div className="kbd-bar">
        <span className="kbd-script">{meta.name}</span>

        {canTransliterate && (
          <button
            type="button"
            className={`kbd-toggle${translit ? " is-on" : ""}`}
            onClick={toggleTranslit}
            aria-pressed={translit}
            // The one control that needs explaining, so it says what it does
            // rather than naming a feature.
            title={t("kbd_translit_hint")}
          >
            {translit && <Icon name="check" size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 4 }} />}
            abc <Icon name="arrowRight" size={12} style={{ display: "inline-block", verticalAlign: "-1px" }} /> {layers[0].label}
          </button>
        )}

        <button type="button" className="kbd-close" onClick={close} aria-label={t("kbd_hide")}>
          <Icon name="close" size={15} />
        </button>
      </div>

      {canTransliterate && translit && (
        <p className="kbd-hint">{t("kbd_translit_hint")}</p>
      )}

      <div className="kbd-keys" dir={meta.dir || "ltr"}>
        {layer.rows.map((row, i) => (
          <div className="kbd-row" key={`${layer.id}-${i}`}>
            {row.map((k) => (
              <button
                type="button"
                key={k.char}
                className="kbd-key"
                lang={lang}
                onMouseDown={(e) => e.preventDefault()} // never steal focus from the field
                onClick={() => press("insert", k.char)}
              >
                {k.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="kbd-row kbd-controls">
        {layers.length > 1 && layers.map((l) => (
          <button
            type="button"
            key={l.id}
            className={`kbd-key kbd-layer${l.id === layer.id ? " is-active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLayerId(l.id)}
            aria-pressed={l.id === layer.id}
          >
            {l.label}
          </button>
        ))}

        <button
          type="button"
          className="kbd-key kbd-space"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press("insert", " ")}
          aria-label={t("kbd_space")}
        >
          {t("kbd_space")}
        </button>

        <button
          type="button"
          className="kbd-key kbd-wide"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press("backspace")}
          aria-label={t("kbd_backspace")}
        >
          {/* Drawn rather than the ⌫ character: U+232B is missing from the
              default font on a good number of the budget Android handsets this
              is aimed at, and a delete key that renders as a tofu box is worse
              than no key at all. */}
          <Icon name="arrowLeft" size={19} style={{ margin: "0 auto" }} />
        </button>

        <button
          type="button"
          className="kbd-key kbd-wide"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => press("enter")}
          aria-label={t("kbd_enter")}
        >
          <Icon name="check" size={19} style={{ margin: "0 auto" }} />
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { speak, stopSpeaking, speechSynthesisSupported } from "../speech.js";
import Icon from "./Icon.jsx";

/**
 * Read-aloud control.
 *
 * Literacy in the language on screen is not a given for the people this is
 * built for, and a health instruction that cannot be read is not an instruction.
 * Anywhere the app tells someone what to do, it should be able to say it.
 *
 * @param {() => string} getText  built lazily, so the caller can assemble the
 *                                current text at press time rather than on
 *                                every render
 */
export default function SpeakButton({ getText, label, className = "btn btn-ghost btn-sm" }) {
  const { t, lang } = useLanguage();
  const [speaking, setSpeaking] = useState(false);

  // Speech outlives the component — navigating away mid-sentence would
  // otherwise leave the phone talking about a symptom in a shared room.
  useEffect(() => () => stopSpeaking(), []);

  if (!speechSynthesisSupported()) return null;

  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const text = (getText() || "").trim();
    if (!text) return;
    speak(text, lang);
    setSpeaking(true);
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-pressed={speaking}>
      <Icon name={speaking ? "pause" : "speaker"} size={15} />
      <span>{speaking ? t("speak_stop") : (label || t("speak_listen"))}</span>
    </button>
  );
}

import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";

const ICONS = { light: "☀️", dark: "🌙", system: "🌗" };
const LABELS = {
  light: "Light",
  dark: "Dark",
  system: "Auto",
};
const NEXT = { light: "dark", dark: "system", system: "light" };

/**
 * Light / dark / auto toggle.
 *
 * One button cycling three states rather than a switch, because "follow my
 * phone" is a real preference and a two-state switch has nowhere to put it.
 * The accessible name announces both the current state and what pressing will
 * do, so it is usable without seeing the icon.
 */
export default function ThemeToggle() {
  const { mode, resolved, cycle } = useTheme();

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABELS[mode]}${mode === "system" ? ` (currently ${resolved})` : ""} — tap for ${LABELS[NEXT[mode]]}`}
      aria-label={`Theme: ${LABELS[mode]}. Switch to ${LABELS[NEXT[mode]]}.`}
      className="util-btn"
    >
      <span aria-hidden="true" style={{ fontSize: 13 }}>{ICONS[mode]}</span>
      <span style={styles.label}>{LABELS[mode]}</span>
    </button>
  );
}

const styles = {
  label: { whiteSpace: "nowrap" },
};

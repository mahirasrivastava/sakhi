import React from "react";

/**
 * The icon set.
 *
 * Every pictogram in Sakhi is one of these, and none of them is an emoji.
 *
 * Emoji were the wrong tool here for three separate reasons, and the third is
 * the one that actually forced this file:
 *
 *  1. They are not the same picture twice. 🩺 renders as a different object on
 *     Android, iOS, Windows and a cheap Chinese handset, and a few of the ones
 *     this app used (🫁, ❤️‍🩹, 🩻) are recent enough that a five-year-old phone —
 *     exactly the phone this is built for — draws an empty box instead.
 *  2. They cannot inherit colour. An emoji stays full-colour on a dark theme,
 *     inside a rose button, next to a red emergency label. Nothing in the design
 *     system reaches them.
 *  3. A public health tool that uses 🤰 and 🩸 to label a medical form reads as a
 *     chat message. The reference points here are the government service apps
 *     people already trust, and none of them puts a smiley next to a symptom.
 *
 * So: one flat, stroked, 24-grid geometric set, drawn in `currentColor`, sized
 * by the `size` prop, and always paired with a text label. Decorative by default
 * (`aria-hidden`); pass `title` on the rare occasion an icon stands alone and
 * needs an accessible name.
 */

// Stroke geometry, shared so the whole set reads as one hand.
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// Each entry is the inside of a 24x24 viewBox. Kept as plain JSX fragments so
// individual glyphs can mix stroked and filled parts where that reads better.
const PATHS = {
  // --- navigation ---------------------------------------------------------
  home: (
    <>
      <path d="M3 10.2 12 3l9 7.2" />
      <path d="M5.5 9.4V20h13V9.4" />
      <path d="M9.8 20v-5.4h4.4V20" />
    </>
  ),
  triage: (
    <>
      <path d="M13.2 2.5 4.5 13.6h6.2L10 21.5l8.8-11.1h-6.3z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.6 8.4 13.9 14 8.4 15.6 10.1 10z" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v5a4 4 0 0 0 8 0V3" />
      <path d="M6 3H4.6M14 3h1.4" />
      <path d="M10 12v2.5a5 5 0 0 0 5 5h.4" />
      <circle cx="18.2" cy="17.6" r="2.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10.4" r="2.6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6.4 5.8 12 5.8 21.5 12 21.5 12 17.6 18.2 12 18.2 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="16" rx="2.4" />
      <path d="M3.2 9.8h17.6M8.2 3v4M15.8 3v4" />
      <path d="M7.6 13.6h2.2M13.6 13.6h2.8M7.6 17.2h2.2M13.6 17.2h2.8" />
    </>
  ),
  document: (
    <>
      <path d="M13.6 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.2z" />
      <path d="M13.6 2.8v5.4H19" />
      <path d="M8.6 12.8h6.8M8.6 16.4h4.6" />
    </>
  ),
  chart: (
    <>
      <path d="M3.6 20.4h16.8" />
      <path d="M6.8 20.4v-6.6M11.6 20.4V6.6M16.4 20.4v-9.4" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.4 16 12l-6 3.6z" />
    </>
  ),
  report: (
    <>
      <path d="M6.6 2.8h8.2L19 7v14.2H6.6z" />
      <path d="M14.8 2.8V7H19" />
      <path d="M9.4 12h6.2M9.4 15.2h6.2M9.4 18.2h3.6" />
    </>
  ),

  // --- emergency ----------------------------------------------------------
  phone: (
    <>
      <path d="M7.4 3.4 4.2 5.1c-1 .6-1.4 1.9-.9 3A19.4 19.4 0 0 0 15.5 20c1.2.5 2.5.1 3.1-1l1.7-3.1-4.5-2.6-1.9 2.2a14.5 14.5 0 0 1-4.5-4.5l2.2-1.9z" />
    </>
  ),
  ambulance: (
    <>
      <path d="M2.6 16.4V8.2a1.4 1.4 0 0 1 1.4-1.4h9.4v9.6" />
      <path d="M13.4 10h3.4l3.6 3.6v2.8" />
      <path d="M2.6 16.4h1.8M10.2 16.4h4.2M18.6 16.4h1.8" />
      <circle cx="6.6" cy="17.6" r="1.9" />
      <circle cx="16.6" cy="17.6" r="1.9" />
      <path d="M8 11.4h-3M6.5 9.9v3" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.6 21 19.4H3z" />
      <path d="M12 9.6v4.4M12 17.1h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.8 4.8 5.7v6c0 4.6 3 8 7.2 9.5 4.2-1.5 7.2-4.9 7.2-9.5v-6z" />
      <path d="M8.9 12.1l2.2 2.2 4-4.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.2 20c0-3.5 3-6.2 6.8-6.2s6.8 2.7 6.8 6.2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.6" y="10.2" width="14.8" height="10.6" rx="2.2" />
      <path d="M8.2 10.2V7.4a3.8 3.8 0 0 1 7.6 0v2.8" />
      <path d="M12 14.2v2.6" />
    </>
  ),
  woman: (
    <>
      <circle cx="12" cy="6.2" r="3.4" />
      <path d="M8.4 21.2 12 10.2l3.6 11" />
      <path d="M9.2 17.6h5.6" />
    </>
  ),
  child: (
    <>
      <circle cx="12" cy="6" r="3.2" />
      <path d="M6.6 21v-5.4a5.4 5.4 0 0 1 10.8 0V21" />
      <path d="M9.6 21v-3.6M14.4 21v-3.6" />
    </>
  ),
  pregnancy: (
    <>
      <circle cx="11" cy="4.6" r="2.6" />
      <path d="M11 8.2c-2 0-3 1.6-3 3.6v9.6" />
      <path d="M11 10.4c3 0 5 1.9 5 4.3s-2 4.1-5 4.1" />
    </>
  ),
  mind: (
    <>
      <path d="M9.4 20.8v-2.4A6.6 6.6 0 0 1 6 12.6 6.4 6.4 0 0 1 18.6 11c.2 1 .8 1.7 1.6 2.3.4.3.4.9-.1 1.1l-1.6.7v2.1a2 2 0 0 1-2 2h-1.4v1.6" />
    </>
  ),
  police: (
    <>
      <path d="M12 2.8 4.8 5.9v5.4c0 4.6 3 8.2 7.2 9.9 4.2-1.7 7.2-5.3 7.2-9.9V5.9z" />
      <path d="M12 8v6M9 11h6" />
    </>
  ),
  fire: (
    <>
      <path d="M12 2.8c3.4 3 5.4 5.6 5.4 8.6a5.4 5.4 0 1 1-10.8 0c0-1.4.5-2.6 1.4-3.7.4 1 1 1.6 1.8 1.9 0-2.6.7-4.8 2.2-6.8z" />
    </>
  ),

  // --- actions ------------------------------------------------------------
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="M15.6 15.6 20.4 20.4" />
    </>
  ),
  mic: (
    <>
      <rect x="9.2" y="2.8" width="5.6" height="10.6" rx="2.8" />
      <path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0" />
      <path d="M12 17.6v3.6M9 21.2h6" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.4h3.4L12 5.4v13.2l-4.6-4H4z" />
      <path d="M15.4 9.6a3.4 3.4 0 0 1 0 4.8M18 7a7 7 0 0 1 0 10" />
    </>
  ),
  pause: (
    <>
      <rect x="7" y="4.8" width="3.6" height="14.4" rx="1.2" />
      <rect x="13.4" y="4.8" width="3.6" height="14.4" rx="1.2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 9V3.4h10V9" />
      <rect x="3.6" y="9" width="16.8" height="7.4" rx="2" />
      <path d="M7 13.4h10v7.2H7z" />
    </>
  ),
  camera: (
    <>
      <path d="M3.4 8.4h3.4l1.6-2.6h7.2l1.6 2.6h3.4v11H3.4z" />
      <circle cx="12" cy="13.6" r="3.6" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.6" y="6" width="18.8" height="12" rx="2.2" />
      <path d="M6.4 9.6h.01M9.8 9.6h.01M13.2 9.6h.01M16.6 9.6h.01M6.4 12.8h.01M9.8 12.8h.01M13.2 12.8h.01M16.6 12.8h.01" />
      <path d="M8 15.6h8" />
    </>
  ),
  check: <path d="M4.6 12.4 9.6 17.4 19.4 6.8" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M3.6 6.6h16.8M3.6 12h16.8M3.6 17.4h16.8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowRight: (
    <>
      <path d="M4.4 12h15" />
      <path d="M13.6 6.2 19.4 12l-5.8 5.8" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19.6 12h-15" />
      <path d="M10.4 6.2 4.6 12l5.8 5.8" />
    </>
  ),
  chevronDown: <path d="M6.4 9.4 12 15l5.6-5.6" />,
  refresh: (
    <>
      <path d="M20.2 11.4a8.2 8.2 0 1 0-.7 4.6" />
      <path d="M20.4 20.2v-4.6h-4.6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.6v11.6" />
      <path d="M7.6 11.2 12 15.6l4.4-4.4" />
      <path d="M4.4 18.4v1.4a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-1.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 12h17.6" />
      <path d="M12 3a14.4 14.4 0 0 1 0 18 14.4 14.4 0 0 1 0-18z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </>
  ),
  moon: <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 3.2v17.6a8.8 8.8 0 0 0 0-17.6z" fill="currentColor" stroke="none" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.4M12 7.8h.01" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </>
  ),
  handshake: (
    <>
      <path d="M2.8 13.4 6 10.2l3 1.6 3-2.6 3 2.6 3-1.6 3.2 3.2" />
      <path d="M6 10.2V7.6h4.4M18 10.2V7.6h-4.4" />
      <path d="M9 16.4l2.2 2 2-1.6 2 1.6 2.2-2" />
    </>
  ),

  // --- clinical topics ----------------------------------------------------
  thermometer: (
    <>
      <path d="M13.8 13.6V5.2a2.2 2.2 0 0 0-4.4 0v8.4a4 4 0 1 0 4.4 0z" />
      <path d="M11.6 9.4v6.4" />
    </>
  ),
  lungs: (
    <>
      <path d="M12 3.2v8.4" />
      <path d="M12 8.6c-1 0-2-.7-2.6-1.8-.6 1-3.6 5-3.6 8.6 0 3 1.4 4.4 3.2 4.4 1.6 0 3-1.2 3-3.2z" />
      <path d="M12 8.6c1 0 2-.7 2.6-1.8.6 1 3.6 5 3.6 8.6 0 3-1.4 4.4-3.2 4.4-1.6 0-3-1.2-3-3.2z" />
    </>
  ),
  heart: (
    <>
      <path d="M12 20.4S3.6 15.4 3.6 9.4a4.6 4.6 0 0 1 8.4-2.6 4.6 4.6 0 0 1 8.4 2.6c0 6-8.4 11-8.4 11z" />
    </>
  ),
  drop: (
    <>
      <path d="M12 3.2c3 3.6 5.4 6.6 5.4 9.4a5.4 5.4 0 1 1-10.8 0c0-2.8 2.4-5.8 5.4-9.4z" />
    </>
  ),
  bone: (
    <>
      <path d="M6.4 17.6 17.6 6.4" />
      <circle cx="4.8" cy="19.2" r="2.2" />
      <circle cx="7.4" cy="20.4" r="1.9" />
      <circle cx="19.2" cy="4.8" r="2.2" />
      <circle cx="16.6" cy="3.6" r="1.9" />
    </>
  ),
  brain: (
    <>
      <path d="M12 4.4a3 3 0 0 0-5.6 1.2A2.8 2.8 0 0 0 4.6 10a3 3 0 0 0 1 4.6A3 3 0 0 0 8.8 19a3 3 0 0 0 3.2-1z" />
      <path d="M12 4.4a3 3 0 0 1 5.6 1.2A2.8 2.8 0 0 1 19.4 10a3 3 0 0 1-1 4.6A3 3 0 0 1 15.2 19a3 3 0 0 1-3.2-1z" />
      <path d="M12 4.4v13.6" />
    </>
  ),
  dizzy: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M8.4 9.2 10.2 11M10.2 9.2 8.4 11M13.8 9.2l1.8 1.8M15.6 9.2l-1.8 1.8" />
      <path d="M8.8 16c1.8-1.4 4.6-1.4 6.4 0" />
    </>
  ),
  sleep: (
    <>
      <path d="M13.6 3.4h5.6l-5.6 6.4h5.6" />
      <path d="M4.4 13.4h5.2l-5.2 6h5.2" />
    </>
  ),
  stomach: (
    <>
      <path d="M9.4 3.6v4.2c0 2.2-1.6 2.8-3 4-1.6 1.4-2 3.4-1 5.4a5.6 5.6 0 0 0 9.8.4c1-1.8 3-2 4.2-3.4" />
      <path d="M19.4 14.2c.8-1.4.6-3.4-.8-4.4" />
    </>
  ),
  rash: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4" />
      <path d="M8.2 8.2h.01M12 7.4h.01M15.8 9.4h.01M8.8 12.6h.01M13 12h.01M16.4 14.4h.01M9.6 16.4h.01M13.4 16h.01" />
    </>
  ),
  water: (
    <>
      <path d="M3.4 15.4c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 2 1 2.8.4" />
      <path d="M3.4 19.4c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 2 1 2.8.4" />
      <path d="M12 3.2c2 2.4 3.4 4.2 3.4 5.8a3.4 3.4 0 1 1-6.8 0c0-1.6 1.4-3.4 3.4-5.8z" />
    </>
  ),
  toilet: (
    <>
      <path d="M5.4 4.2v6.4c0 3.4 2.6 6.2 6 6.2s6-2.8 6-6.2V4.2" />
      <path d="M4 10.6h16" />
      <path d="M11.4 16.8v4M7.6 20.8h7.6" />
    </>
  ),
  cough: (
    <>
      <path d="M14.4 6.4A5 5 0 0 0 5 8.4a4 4 0 0 0 .8 7.8h8.6" />
      <path d="M17.4 8.6l2.6-1.4M18.4 12.4h3M17.4 16.2l2.6 1.4" />
    </>
  ),
  vomit: (
    <>
      <circle cx="12" cy="9.4" r="6.2" />
      <path d="M9.4 7.4h.01M14.6 7.4h.01" />
      <path d="M9.8 12.4h4.4l-.8 8.4h-2.8z" />
    </>
  ),
  bandage: (
    <>
      <rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)" />
      <path d="M10.4 10.4h.01M13.6 10.4h.01M10.4 13.6h.01M13.6 13.6h.01M12 12h.01" />
    </>
  ),
  glasses: (
    <>
      <circle cx="6.4" cy="14" r="3.4" />
      <circle cx="17.6" cy="14" r="3.4" />
      <path d="M9.8 13.4c1.4-.8 3-.8 4.4 0" />
      <path d="M3 12.4 5 7.4h3M21 12.4 19 7.4h-3" />
    </>
  ),
  faint: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M7.8 9.4 10.6 9.4M13.4 9.4h2.8" />
      <path d="M8.6 16.4c1.8-1.6 5-1.6 6.8 0" />
    </>
  ),
  seedling: (
    <>
      <path d="M12 21v-8.4" />
      <path d="M12 12.6C9.4 12.6 7 10.6 7 7.6c3 0 5 2 5 5z" />
      <path d="M12 14.6c2.6 0 5-2 5-5-3 0-5 2-5 5z" />
    </>
  ),
  soap: (
    <>
      <rect x="4.2" y="11" width="15.6" height="9.4" rx="3" />
      <path d="M8.6 11V8.4a3.4 3.4 0 0 1 6.8 0V11" />
      <path d="M8 3.6c.8.7.8 1.5 0 2.2M12 2.4c.8.7.8 1.5 0 2.2" />
    </>
  ),
  nutrition: (
    <>
      <path d="M12 20.6c-3.4 0-6-3.4-6-7.4 0-3 2-5 4.2-5 1 0 1.6.4 1.8.4s.8-.4 1.8-.4c2.2 0 4.2 2 4.2 5 0 4-2.6 7.4-6 7.4z" />
      <path d="M12 8.2c0-2 1.2-3.6 3-4.2" />
    </>
  ),
  pill: (
    <>
      <rect x="2.6" y="8.4" width="18.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)" />
      <path d="M8.4 8.4 15.6 15.6" />
    </>
  ),
  joint: (
    <>
      <path d="M9 3.6v5.6a3 3 0 0 0 6 0V3.6" />
      <path d="M9 20.4v-5.6a3 3 0 0 1 6 0v5.6" />
      <path d="M8.4 12h7.2" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({ name, size = 20, title, style, className, strokeWidth }) {
  const glyph = PATHS[name];
  // A missing name renders nothing rather than a broken box — an icon is never
  // load-bearing on its own here, so a typo must not blank a whole button.
  if (!glyph) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      focusable="false"
      className={className}
      style={{ flexShrink: 0, display: "block", ...style }}
      {...STROKE}
      strokeWidth={strokeWidth ?? STROKE.strokeWidth}
    >
      {title && <title>{title}</title>}
      {glyph}
    </svg>
  );
}

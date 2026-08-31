import React from "react";

/**
 * The Sakhi brand mark: a woman holding the hand of a teenage girl.
 *
 * Geometry and colour values are reproduced exactly from the brand handoff
 * (turn 7 / id 7a of the logo design document) — nothing here is
 * approximated. Four variants cover every context the mark appears in:
 *
 *   primary  — on a light surface (the header, most of the app)
 *   reversed — on the brand pink itself
 *   icon     — for a gradient-tile app icon (see favicon.svg / public/)
 *   small    — anything rendered at or below ~32px
 *
 * `small` additionally drops the hair, the ground shadow, and the woman's
 * far arm — per the handoff, those details "close up into mud" below
 * roughly 32px. Everything else stays.
 *
 * Motion (sway, hair flutter, the hand-hold pulse) is decorative only — the
 * still frame is the logo of record. It is switched off under
 * prefers-reduced-motion and in print by index.css, and this component
 * never animates the `small` variant (it has no hair or hold circle to
 * animate, and it is never used large enough for the sway to read).
 */

const PALETTES = {
  primary: {
    womanBody: "#C9256B", womanHair: "#6F0F38",
    girlBody: "#F080AE", girlHair: "#6F0F38",
    hold: "#A81C58", shadow: "#FBD9E6",
  },
  reversed: {
    womanBody: "#FFFDFE", womanHair: "#F7A9C6",
    girlBody: "#F7C9DC", girlHair: "#F7A9C6",
    hold: "#FFFDFE", shadow: null,
  },
  icon: {
    womanBody: "#C9256B", womanHair: "#6F0F38",
    girlBody: "#FFFDFE", girlHair: "#6F0F38",
    hold: "#A81C58", shadow: null,
  },
  small: {
    womanBody: "#C9256B", womanHair: null,
    girlBody: "#F080AE", girlHair: null,
    hold: null, shadow: null,
  },
};

export default function Logo({
  variant = "primary",
  size = 44,
  animated = true,
  decorative = false,
  title = "Sakhi: a woman holding the hand of a teenage girl",
  className,
  style,
}) {
  const c = PALETTES[variant] || PALETTES.primary;
  const dropDetail = variant === "small";
  const sway = animated && !dropDetail;

  return (
    <svg
      viewBox="0 0 200 240"
      width={size}
      height={size * 1.2}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : title}
      className={className}
      style={style}
    >
      {decorative || <title>{title}</title>}

      {c.shadow && (
        <ellipse cx="100" cy="222" rx="86" ry="12" fill={c.shadow} className={sway ? "logo-halo" : undefined} />
      )}

      <g className={sway ? "logo-sway" : undefined}>
        {/* Woman — faces right */}
        {c.womanHair && (
          <g className={sway ? "logo-flutter" : undefined}>
            <path d="M52 31 C 39 38, 34 57, 41 72 C 44 79, 55 77, 52 68 C 48 56, 50 42, 58 34 Z" fill={c.womanHair} />
            <ellipse cx="42" cy="45" rx="9" ry="10" fill={c.womanHair} />
          </g>
        )}
        <ellipse cx="63" cy="45" rx="15" ry="17" fill={c.womanBody} />
        {c.womanHair && (
          <path d="M47 48 C 45 31, 56 24, 66 26 C 76 28, 80 35, 79 45 C 75 36, 70 32, 62 33 C 54 35, 49 40, 48 49 Z" fill={c.womanHair} />
        )}
        <path d="M56 60 h 14 v 10 h -14 Z" fill={c.womanBody} />
        <path d="M63 66 C 45 71, 39 97, 41 127 L 30 219 L 97 219 L 85 127 C 87 97, 81 71, 63 66 Z" fill={c.womanBody} />
        {!dropDetail && (
          <path d="M48 78 C 37 102, 35 122, 39 140" fill="none" stroke={c.womanBody} strokeWidth="9" strokeLinecap="round" />
        )}
        <path d="M78 78 C 98 94, 110 110, 117 120" fill="none" stroke={c.womanBody} strokeWidth="9" strokeLinecap="round" />

        {/* Girl — faces left */}
        {c.girlHair && (
          <path d="M147 83 C 159 89, 163 107, 159 124 C 157 132, 147 131, 150 122 C 154 108, 153 94, 144 86 Z" fill={c.girlHair} />
        )}
        <ellipse cx="141" cy="97" rx="13" ry="15" fill={c.girlBody} />
        {c.girlHair && (
          <path d="M129 99 C 127 85, 136 78, 144 80 C 152 82, 156 89, 155 98 C 151 89, 146 86, 139 87 C 133 89, 130 93, 129 100 Z" fill={c.girlHair} />
        )}
        <path d="M135 110 h 12 v 9 h -12 Z" fill={c.girlBody} />
        <path d="M141 115 C 127 119, 123 141, 125 163 L 119 197 L 163 197 L 157 163 C 159 141, 155 119, 141 115 Z" fill={c.girlBody} />
        <path d="M129 124 C 122 122, 119 121, 117 120" fill="none" stroke={c.girlBody} strokeWidth="8" strokeLinecap="round" />
        <path d="M155 126 C 163 145, 165 159, 163 172" fill="none" stroke={c.girlBody} strokeWidth="8" strokeLinecap="round" />
        <path d="M131 199 L 129 219" fill="none" stroke={c.girlBody} strokeWidth="9" strokeLinecap="round" />
        <path d="M151 199 L 153 219" fill="none" stroke={c.girlBody} strokeWidth="9" strokeLinecap="round" />

        {/* Hand-hold — the semantic centre of the mark; never crop it out */}
        {c.hold && (
          <circle cx="117" cy="120" r="7" fill={c.hold} className={sway ? "logo-hold" : undefined} />
        )}
      </g>
    </svg>
  );
}

/**
 * Mark + wordmark, side by side. सखी sits above SAKHI in the mark's own
 * type pair (Tiro Devanagari Hindi / Mukta — loaded in index.html), not the
 * app's Fraunces/Inter: the wordmark is part of the logo, not UI text.
 */
export function LogoLockup({ variant = "primary", size = 44, animated = true, className, style }) {
  return (
    <span className={`logo-lockup${className ? ` ${className}` : ""}`} style={style}>
      <Logo variant={variant} size={size} animated={animated} />
      <span className={`logo-wordmark${variant === "reversed" ? " logo-wordmark-reversed" : ""}`}>
        <span className="logo-wordmark-dv">सखी</span>
        <span className="logo-wordmark-en">SAKHI</span>
      </span>
    </span>
  );
}

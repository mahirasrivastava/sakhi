import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

/**
 * Language picker for all 22 Eighth Schedule languages plus English.
 *
 * Three buttons in a row worked at three languages; at 23 it would wrap into a
 * wall. This is a popover list instead, with a type-to-filter box — someone
 * looking for Malayalam should not have to scan 23 unfamiliar scripts to find
 * it, so the filter matches both the endonym and the English name.
 *
 * Each option renders in its own script at a comfortable size. That is the whole
 * point: a speaker recognises "ਪੰਜਾਬੀ" instantly and "Punjabi" only if they
 * already read Latin script.
 */
export default function LanguagePicker() {
  const { lang, changeLang, languages, meta, loading } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Focus the filter so a keyboard user can start typing immediately.
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? languages.filter(
        (l) =>
          l.english.toLowerCase().includes(q) ||
          l.endonym.toLowerCase().includes(q) ||
          l.code.includes(q)
      )
    : languages;

  return (
    <div ref={wrapRef} style={styles.wrap}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Language: ${meta.english}. Change language`}
        className="util-btn"
      >
        <span aria-hidden="true">🌐</span>
        <span style={styles.triggerLabel}>{meta.endonym}</span>
        <span aria-hidden="true" style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {loading && <span style={styles.loading} role="status">…</span>}

      {open && (
        <div style={styles.panel} role="listbox" aria-label="Choose a language">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search language…"
            aria-label="Search language"
            style={styles.search}
          />

          <div style={styles.list}>
            {filtered.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { changeLang(l.code); setOpen(false); }}
                  style={{ ...styles.option, ...(active ? styles.optionActive : {}) }}
                >
                  <span style={{ ...styles.endonym, direction: l.dir }} lang={l.code}>
                    {l.endonym}
                  </span>
                  <span style={styles.english}>
                    {l.english}
                    {/* Machine translations are flagged rather than passed off as
                        checked. In a health app a mistranslated danger sign is a
                        safety bug, and hiding that would be the wrong default. */}
                    {!l.reviewed && (
                      <span title="Machine translation — not yet checked by a native speaker" style={styles.unreviewed}>
                        {" "}· beta
                      </span>
                    )}
                  </span>
                  {active && <span aria-hidden="true" style={styles.tick}>✓</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <p style={styles.empty}>No language matches “{query}”.</p>}
          </div>

          <p style={styles.foot}>
            22 languages of the Eighth Schedule, plus English.
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { position: "relative", display: "inline-flex", alignItems: "center", gap: 4 },
  triggerLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  loading: { fontSize: 12, color: "var(--on-utility)", opacity: 0.8 },
  panel: {
    position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0, zIndex: 60,
    width: 288, maxWidth: "calc(100vw - 40px)",
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, boxShadow: "var(--shadow)", padding: 10,
  },
  search: {
    width: "100%", padding: "8px 10px", borderRadius: 9,
    border: "1px solid var(--border)", fontSize: 13,
    background: "var(--cream)", color: "var(--ink)", marginBottom: 8,
  },
  list: { maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 },
  option: {
    display: "flex", alignItems: "baseline", gap: 8, width: "100%",
    padding: "8px 10px", borderRadius: 9, border: "none",
    background: "transparent", color: "var(--ink)", textAlign: "start",
  },
  optionActive: { background: "var(--rose-soft)", color: "var(--rose-deep)" },
  endonym: { fontSize: 14.5, fontWeight: 600, flexShrink: 0 },
  english: { fontSize: 11.5, color: "var(--ink-muted)", flex: 1 },
  unreviewed: { color: "var(--warn-ink)", fontWeight: 600 },
  tick: { fontSize: 12, color: "var(--rose-deep)" },
  empty: { fontSize: 12.5, color: "var(--ink-muted)", padding: "10px 4px", margin: 0 },
  foot: {
    fontSize: 10.5, color: "var(--ink-muted)", margin: "8px 2px 0",
    borderTop: "1px solid var(--border)", paddingTop: 7, lineHeight: 1.5,
  },
};

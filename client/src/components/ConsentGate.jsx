import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { TERMS_SECTIONS } from "../terms.js";

const CONSENT_KEY = "sakhi_consent_given";

/**
 * The one place someone is required to read the Terms and Conditions.
 *
 * This used to be a four-bullet summary with an always-enabled button — easy
 * to dismiss without reading a word of it. It is now the full terms (see
 * terms.js, the same content the /terms page renders), in a box that tracks
 * its own scroll position, with the accept button disabled until the reader
 * has actually reached the bottom. A person can still choose not to read
 * carefully, but they cannot continue by reflex.
 */
export default function ConsentGate({ children }) {
  const { t } = useLanguage();
  const [consented, setConsented] = useState(true); // avoid flash before check
  const [checked, setChecked] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setConsented(sessionStorage.getItem(CONSENT_KEY) === "true");
    setChecked(true);
  }, []);

  const onScroll = useCallback((e) => {
    const el = e.target;
    // A few pixels of slack — "at the bottom" should not require a pixel-perfect
    // scroll on a device where the viewport height itself is a moving target.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReachedEnd(true);
  }, []);

  // A box short enough to need no scrolling at all must not silently skip the
  // requirement — check once on mount in case the content already fits.
  useEffect(() => {
    if (checked && !consented && scrollRef.current) {
      const el = scrollRef.current;
      if (el.scrollHeight <= el.clientHeight + 12) setReachedEnd(true);
    }
  }, [checked, consented]);

  function accept() {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setConsented(true);
  }

  if (!checked) return null;
  if (consented) return children;

  return (
    <div style={overlay}>
      <div className="card" style={modal}>
        <h3 className="display" style={{ fontSize: 20, color: "var(--rose-deep)", padding: "22px 24px 4px" }}>
          {t("terms_page_title")}
        </h3>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={scrollBox}
        >
          {TERMS_SECTIONS.map((s) => (
            <section key={s.titleKey} style={{ marginBottom: 16 }}>
              <h4 style={sectionTitle}>{t(s.titleKey)}</h4>
              <p style={sectionBody}>{t(s.bodyKey)}</p>
            </section>
          ))}
        </div>

        <div style={{ padding: "14px 24px 22px" }}>
          {!reachedEnd && <p style={hint}>{t("terms_gate_hint")}</p>}
          <button
            className="btn btn-primary"
            onClick={accept}
            disabled={!reachedEnd}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {t("terms_gate_accept")}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "var(--overlay)",
  zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const modal = { maxWidth: 480, width: "100%", padding: 0, display: "flex", flexDirection: "column", maxHeight: "min(640px, 88vh)" };
const scrollBox = {
  overflowY: "auto", padding: "10px 24px", borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)", flex: 1, minHeight: 0,
};
const sectionTitle = { fontSize: 13.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" };
const sectionBody = { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 };
const hint = { fontSize: 12, color: "var(--ink-muted)", textAlign: "center", margin: "0 0 10px" };

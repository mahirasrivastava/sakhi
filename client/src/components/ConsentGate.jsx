import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { LANGUAGES } from "../i18n/languages.js";
import { TERMS_SECTIONS } from "../terms.js";
import { callsFor } from "../helplines.js";
import Icon from "./Icon.jsx";

const CONSENT_KEY = "sakhi_consent_given"; // sessionStorage — terms accepted this browser tab
const ONBOARDED_KEY = "sakhi_onboarded";   // localStorage — welcome seen once, ever

const INTRO_POINTS = [
  { icon: "handshake", titleKey: "onboarding_intro_p1_title", textKey: "onboarding_intro_p1_text" },
  { icon: "shield", titleKey: "onboarding_intro_p2_title", textKey: "onboarding_intro_p2_text" },
  { icon: "lock", titleKey: "onboarding_intro_p3_title", textKey: "onboarding_intro_p3_text" },
];

/**
 * First visit: language -> orientation -> terms. Every visit after that:
 * terms only — language and "what Sakhi is" are stored once (localStorage)
 * and never repeated. The terms step stays mandatory (full scroll, no
 * skip, same as before); language and orientation each have their own
 * dismiss, because forcing a stranger through a legal document before she
 * even knows what this is or can read it in her language was the wrong
 * order to ask for trust in.
 *
 * An emergency quick-dial sits above every step and is never covered by
 * it — seeing "here's what this app is" must never come before "here's
 * 108" for someone who actually needs it right now.
 */
export default function ConsentGate({ children }) {
  const { t, changeLang } = useLanguage();
  const [consented, setConsented] = useState(true); // avoid flash before check
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState("terms");
  const [reachedEnd, setReachedEnd] = useState(false);
  const scrollRef = useRef(null);
  const modalRef = useRef(null);
  const gateRef = useRef(null); // wraps the emergency bar + the modal, so Tab cycles through both
  const titleId = "consent-gate-title";

  useEffect(() => {
    const isConsented = sessionStorage.getItem(CONSENT_KEY) === "true";
    let isOnboarded = true;
    try { isOnboarded = localStorage.getItem(ONBOARDED_KEY) === "true"; } catch { /* private mode */ }
    setConsented(isConsented);
    setStep(isOnboarded ? "terms" : "language");
    setChecked(true);
  }, []);

  const showing = checked && !consented;

  // A modal that only *looks* blocking isn't one: lock the page behind it,
  // hide the bottom tab bar (it shares the header's z-index with nothing
  // that should ever sit above this), and keep Tab cycling within the gate
  // — which includes the emergency bar, deliberately. A keyboard or
  // screen-reader user who needs 108 must be able to Tab to it, not just
  // see it.
  useEffect(() => {
    if (!showing) return;
    document.body.classList.add("consent-open");

    const onKeyDown = (e) => {
      if (e.key !== "Tab" || !gateRef.current) return;
      const focusables = gateRef.current.querySelectorAll(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("consent-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showing]);

  // Re-focus the dialog and re-check "does this even need scrolling" every
  // time the step changes, same as on first open.
  useEffect(() => {
    if (!showing) return;
    modalRef.current?.focus();
    if (step === "terms" && scrollRef.current) {
      const el = scrollRef.current;
      setReachedEnd(el.scrollHeight <= el.clientHeight + 12);
    } else if (step !== "terms") {
      setReachedEnd(false);
    }
  }, [showing, step]);

  const onScroll = useCallback((e) => {
    const el = e.target;
    // A few pixels of slack — "at the bottom" should not require a pixel-perfect
    // scroll on a device where the viewport height itself is a moving target.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) setReachedEnd(true);
  }, []);

  function markOnboarded() {
    try { localStorage.setItem(ONBOARDED_KEY, "true"); } catch { /* private mode */ }
  }

  function accept() {
    sessionStorage.setItem(CONSENT_KEY, "true");
    markOnboarded();
    setConsented(true);
  }

  function pickLanguage(code) {
    changeLang(code);
    setStep("intro");
  }

  if (!checked) return null;
  if (consented) return children;

  return (
    <div style={overlay} ref={gateRef}>
      <EmergencyBar />
      <div style={overlayCenter}>
        <div
          ref={modalRef}
          className="card"
          style={modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          {step === "language" && (
            <LanguageStep titleId={titleId} onPick={pickLanguage} onSkip={() => setStep("intro")} />
          )}
          {step === "intro" && (
            <IntroStep titleId={titleId} onNext={() => setStep("terms")} />
          )}
          {step === "terms" && (
            <TermsStep
              titleId={titleId}
              scrollRef={scrollRef}
              onScroll={onScroll}
              reachedEnd={reachedEnd}
              onAccept={accept}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmergencyBar() {
  const { t } = useLanguage();
  const lines = callsFor({ limit: 3 });
  return (
    <div style={emergencyBar} role="region" aria-label={t("onboarding_emergency_label")}>
      <Icon name="alert" size={14} />
      <span style={{ marginInlineEnd: 2 }}>{t("onboarding_emergency_label")}</span>
      {lines.map((h) => (
        <a key={h.number} href={`tel:${h.dial}`} style={emergencyBarLink}>
          {h.label} <b>{h.number}</b>
        </a>
      ))}
    </div>
  );
}

function LanguageStep({ titleId, onPick, onSkip }) {
  const { t } = useLanguage();
  return (
    <>
      <div style={{ padding: "22px 24px 4px" }}>
        <h3 id={titleId} className="display" style={stepTitleStyle}>{t("onboarding_language_title")}</h3>
        <p style={stepSub}>{t("onboarding_language_sub")}</p>
      </div>
      <div style={scrollBox}>
        <div style={langGrid}>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" onClick={() => onPick(l.code)} style={langBtn}>
              <span lang={l.code} dir={l.dir} style={langEndonym}>{l.endonym}</span>
              <span style={langEnglish}>{l.english}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "14px 24px 22px", display: "flex", justifyContent: "center" }}>
        <button type="button" className="btn-text" onClick={onSkip}>
          {t("onboarding_skip")}
        </button>
      </div>
    </>
  );
}

function IntroStep({ titleId, onNext }) {
  const { t } = useLanguage();
  return (
    <>
      <div style={{ padding: "22px 24px 4px" }}>
        <h3 id={titleId} className="display" style={stepTitleStyle}>{t("onboarding_intro_title")}</h3>
      </div>
      <div style={{ ...scrollBox, borderTop: "none" }}>
        {INTRO_POINTS.map((p) => (
          <div key={p.titleKey} style={introPoint}>
            <span style={introIcon}><Icon name={p.icon} size={20} /></span>
            <div>
              <p style={introPointTitle}>{t(p.titleKey)}</p>
              <p style={introPointText}>{t(p.textKey)}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 24px 22px" }}>
        <button type="button" className="btn btn-primary" onClick={onNext} style={{ width: "100%", justifyContent: "center" }}>
          {t("onboarding_intro_continue")}
        </button>
      </div>
    </>
  );
}

function TermsStep({ titleId, scrollRef, onScroll, reachedEnd, onAccept }) {
  const { t } = useLanguage();
  return (
    <>
      <div style={{ padding: "22px 24px 4px" }}>
        <h3 id={titleId} className="display" style={stepTitleStyle}>{t("terms_page_title")}</h3>
      </div>
      <div ref={scrollRef} onScroll={onScroll} style={scrollBox} tabIndex={0} role="document">
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
          onClick={onAccept}
          disabled={!reachedEnd}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {t("terms_gate_accept")}
        </button>
      </div>
    </>
  );
}

const overlay = {
  // Above everything else in the app on purpose — the virtual keyboard (90)
  // included. A "mandatory" gate that another fixed-position element can
  // out-rank isn't mandatory. A flex column, not a single centred box, so
  // the emergency bar below can reserve its own permanent strip instead of
  // fighting the modal for z-index.
  position: "fixed", inset: 0, zIndex: 100,
  display: "flex", flexDirection: "column",
  background: "var(--overlay)",
};
const overlayCenter = {
  flex: 1, minHeight: 0, display: "flex",
  alignItems: "center", justifyContent: "center",
  padding: 20, overflow: "auto",
};
const emergencyBar = {
  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
  background: "var(--emergency-bg)", color: "var(--emergency-ink)",
  borderBottom: "1px solid var(--emergency-border)",
  padding: "10px 16px", fontSize: 12.5, fontWeight: 700, flexShrink: 0,
};
const emergencyBarLink = {
  display: "inline-flex", alignItems: "center", gap: 4,
  color: "var(--emergency-ink)", textDecoration: "underline",
};
const modal = { maxWidth: 480, width: "100%", padding: 0, display: "flex", flexDirection: "column", maxHeight: "min(640px, 88vh)" };
const scrollBox = {
  overflowY: "auto", padding: "10px 24px", borderTop: "1px solid var(--border)",
  borderBottom: "1px solid var(--border)", flex: 1, minHeight: 0,
};
const stepTitleStyle = { fontSize: 20, color: "var(--rose-deep)", margin: 0 };
const stepSub = { fontSize: 13, color: "var(--ink-soft)", margin: "6px 0 0", lineHeight: 1.5 };
const sectionTitle = { fontSize: 13.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" };
const sectionBody = { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 };
const hint = { fontSize: 12, color: "var(--ink-muted)", textAlign: "center", margin: "0 0 10px" };

const langGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 };
const langBtn = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
  padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--surface)", cursor: "pointer", textAlign: "start",
  minHeight: "var(--tap-min)",
};
const langEndonym = { fontSize: 15, fontWeight: 700, color: "var(--ink)" };
const langEnglish = { fontSize: 11, color: "var(--ink-muted)" };

const introPoint = { display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0" };
const introIcon = {
  width: 36, height: 36, borderRadius: 10, background: "var(--rose-soft)",
  color: "var(--rose-deep)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const introPointTitle = { margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" };
const introPointText = { margin: "3px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55 };

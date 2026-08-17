import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import HelplineDirectory from "../components/HelplineDirectory.jsx";
import Icon from "../components/Icon.jsx";
import { HELPLINES, callsFor } from "../helplines.js";

/**
 * The helpline directory as a page of its own.
 *
 * It exists because the three numbers in the header answer one kind of trouble
 * and this app is used for several. Someone who is being hit at home, someone
 * who cannot stop crying, someone whose hospital is demanding money for a
 * PM-JAY procedure — none of them need an ambulance, and all three previously
 * had nowhere to go from here.
 *
 * The page is also the offline-ish fallback: it needs no location permission,
 * no camera, no server call, and every row is a plain `tel:` link, so it works
 * when the rest of Sakhi does not.
 */
export default function Helplines() {
  const { t } = useLanguage();
  const top = callsFor({ limit: 3 });

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ maxWidth: 760 }}>
        <span className="section-eyebrow">
          <Icon name="phone" size={13} /> {t("nav_helplines")}
        </span>
        <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15, marginTop: 8 }}>
          Every national helpline, in one place
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
          All {HELPLINES.length} of these are toll-free and answered by the service itself
          — Sakhi is not in the middle of the call. They are grouped by what has happened
          to you rather than by which ministry runs them.
        </p>
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div>
          <HelplineDirectory />
        </div>

        <div className="aside-sticky" style={{ display: "grid", gap: 16 }}>
          <div className="aside-card" style={{ borderInlineStart: "4px solid var(--emergency)" }}>
            <div className="aside-title" style={{ color: "var(--emergency)" }}>Right now</div>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {top.map((h, i) => (
                <a
                  key={h.number}
                  href={`tel:${h.dial}`}
                  className={`btn ${i === 0 ? "btn-emergency" : "btn-ghost"}`}
                  style={styles.btn}
                >
                  <Icon name={h.icon} size={16} />
                  <span>{h.label}</span>
                  <strong style={styles.num}>{h.number}</strong>
                </a>
              ))}
            </div>
          </div>

          <div className="aside-card">
            <div className="aside-title">What to say when they answer</div>
            <ol style={styles.list}>
              <li>Say <strong>where you are</strong> before anything else — village, panchayat, nearest landmark.</li>
              <li>Say what has happened in one sentence.</li>
              <li>Say who it is happening to, and their age.</li>
              <li>Stay on the line. Do not hang up to call somebody else.</li>
            </ol>
            <Link to="/nearby" className="btn-text" style={{ marginTop: 12 }}>
              <Icon name="pin" size={13} /> Get a location code you can read out
            </Link>
          </div>

          <div className="aside-card">
            <div className="aside-title">If you cannot speak freely</div>
            <p style={styles.text}>
              112 can be triggered by pressing the phone's power button five times, without
              opening any app. On a keypad phone, pressing 5 or 9 for three seconds does the
              same. The call connects even with no balance and no SIM card.
            </p>
          </div>

          <div className="aside-card">
            <div className="aside-title">Nothing here is logged</div>
            <p style={styles.text}>
              Sakhi does not record which number you tap, does not place the call, and has
              no way to know that you opened this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  btn: { justifyContent: "flex-start", textDecoration: "none", fontSize: 14, padding: "11px 14px" },
  num: { marginInlineStart: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  list: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
  text: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 },
};

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentPosition, reverseGeocode } from "../geo.js";
import { encodeDigipin, formatDigipin, buildLocationMessage } from "../digipin.js";
import { callsFor } from "../helplines.js";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";

/**
 * "Call an ambulance and tell them where you are."
 *
 * The hard part of a rural medical emergency is rarely the phone number — it is
 * the address. A DIGIPIN turns the phone's coordinates into ten characters that
 * can be read aloud over a bad line, which is why it is the largest thing on
 * this card.
 *
 * Design decisions worth stating:
 *  - The call buttons are never gated on location. They render regardless of
 *    which location state we're in — only their position moved, below the
 *    DIGIPIN capture, because reading out a location code is what most rural
 *    dispatch calls actually get stuck on, and that is worth leading with.
 *    Waiting on a GPS fix to show a dial button would still be an actively
 *    dangerous ordering, and this never does that.
 *  - Location is computed entirely on the device. Nothing here is sent to our
 *    server; the only optional network call is the area-name lookup, which is
 *    allowed to fail silently.
 *  - `autoStart` is off by default. Prompting for location the moment someone
 *    opens a page is how people learn to deny the permission — it is requested
 *    when they ask for it, or on a screen that is already about an emergency.
 */
export default function EmergencyLocator({
  autoStart = false,
  maternal = false,
  compact = false,
  safety = false,
}) {
  const { t } = useLanguage();
  const [loc, setLoc] = useState(null);
  const [placeName, setPlaceName] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | locating | ready | error
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const locate = useCallback(async () => {
    setStatus("locating");
    setError(null);
    try {
      const { lat, lon } = await getCurrentPosition();
      let digipin = null;
      let digipinError = null;
      try {
        digipin = formatDigipin(encodeDigipin(lat, lon));
      } catch (err) {
        // Outside the DIGIPIN grid (i.e. outside India). Coordinates still work,
        // so this degrades rather than failing.
        digipinError = err.message;
      }
      setLoc({ lat, lon, digipin, digipinError });
      setStatus("ready");

      // Purely a comfort label — "Yelahanka, Karnataka" reads as a place in a
      // way a coordinate pair never will. Not load-bearing, so it is fetched
      // after the code is already on screen.
      reverseGeocode(lat, lon).then(setPlaceName).catch(() => {});
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (autoStart) locate();
  }, [autoStart, locate]);

  const message = loc
    ? buildLocationMessage({
        digipin: loc.digipin || "not available outside India",
        lat: loc.lat,
        lon: loc.lon,
        placeName,
        note: "I need an ambulance. My location:",
      })
    : null;

  async function copyMessage() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy automatically — select the text below and copy it.");
    }
  }

  // Ordered by situation: the maternity line first for a pregnancy, and the
  // abuse/self-harm lines first when the intake flagged one — an ambulance is
  // not what someone disclosing violence at home is asking for.
  const numbers = callsFor({ maternal, safety, limit: safety ? 4 : 3 });

  return (
    <div style={styles.wrap}>
      {!compact && (
        <>
          <h2 className="display" style={styles.heading}>
            {t(safety ? "locator_heading_safety" : "locator_heading_ambulance")}
          </h2>
          <p style={styles.lead}>{t("locator_lead")}</p>
        </>
      )}

      {status === "idle" && (
        <button className="btn btn-primary btn-lg" onClick={locate} style={{ width: "100%", justifyContent: "center" }}>
          <Icon name="pin" size={19} /> {t("locator_find_button")}
        </button>
      )}

      {status === "locating" && <p style={styles.muted}>{t("locator_finding")}</p>}

      {status === "error" && (
        <div>
          <p style={styles.error}>{error}</p>
          <button className="btn btn-ghost" onClick={locate} style={{ marginTop: 8 }}>{t("locator_try_again")}</button>
          <p style={styles.muted}>{t("locator_error_tip")}</p>
        </div>
      )}

      {status === "ready" && loc && (
        <div>
          {loc.digipin ? (
            <>
              <p style={styles.digipinLabel}>{t("locator_read_aloud_label")}</p>
              <p style={styles.digipin} aria-label={`Your DIGIPIN is ${loc.digipin.split("").join(" ")}`}>
                {loc.digipin}
              </p>
              <p style={styles.digipinHelp}>{t("locator_say_help")}</p>
            </>
          ) : (
            <p style={styles.error}>{loc.digipinError} {t("locator_use_coords")}</p>
          )}

          <dl style={styles.details}>
            <div style={styles.detailRow}>
              <dt style={styles.dt}>{t("locator_coordinates")}</dt>
              <dd style={styles.dd}>{loc.lat.toFixed(6)}, {loc.lon.toFixed(6)}</dd>
            </div>
            {placeName && (
              <div style={styles.detailRow}>
                <dt style={styles.dt}>{t("locator_area")}</dt>
                <dd style={styles.dd}>{placeName}</dd>
              </div>
            )}
          </dl>

          <div style={styles.actions}>
            <button className="btn btn-ghost" onClick={copyMessage} style={styles.actionBtn}>
              {copied && <Icon name="check" size={15} />}
              {copied ? t("locator_copied") : t("locator_copy")}
            </button>
            {/* An SMS carries where a call drops. The body is pre-filled so nobody
                has to type coordinates while panicking. */}
            <a
              className="btn btn-ghost"
              href={`sms:?&body=${encodeURIComponent(message || "")}`}
              style={styles.actionBtn}
            >
              {t("locator_sms")}
            </a>
            <a
              className="btn btn-ghost"
              href={`https://www.google.com/maps?q=${loc.lat.toFixed(6)},${loc.lon.toFixed(6)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.actionBtn}
            >
              {t("locator_maps")}
            </a>
          </div>

          <details style={styles.messageBox}>
            <summary style={styles.summary}>{t("locator_show_message")}</summary>
            <pre style={styles.pre}>{message}</pre>
          </details>

          <p style={styles.privacy}>{t("locator_privacy")}</p>
        </div>
      )}

      <div style={styles.divider} />

      <div style={styles.callRow}>
        {numbers.map((n, i) => (
          <a
            key={n.number}
            href={`tel:${n.dial}`}
            className={`btn ${i === 0 ? "btn-emergency" : "btn-ghost"}`}
            style={styles.callBtn}
          >
            <Icon name={n.icon} size={17} />
            <span>{n.label} {n.number}</span>
          </a>
        ))}
      </div>

      <ul style={styles.numberNotes}>
        {numbers.map((n) => <li key={n.number}><strong>{n.number}</strong> — {n.detail}</li>)}
      </ul>

      <Link to="/helplines" className="btn-text" style={{ marginTop: 10 }}>
        {t("locator_all_helplines")} <Icon name="arrowRight" size={13} />
      </Link>
    </div>
  );
}

const styles = {
  wrap: { display: "block" },
  heading: { fontSize: 20, marginBottom: 6 },
  lead: { fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.65, marginTop: 0, marginBottom: 16 },
  callRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  callBtn: { textDecoration: "none", flex: "1 1 auto", justifyContent: "center", minWidth: 150 },
  numberNotes: {
    fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7,
    paddingInlineStart: 18, marginTop: 12, marginBottom: 0,
  },
  divider: { height: 1, background: "var(--border)", margin: "18px 0" },
  muted: { fontSize: 13, color: "var(--ink-muted)", marginTop: 10, lineHeight: 1.6 },
  error: { fontSize: 13.5, color: "var(--emergency)", lineHeight: 1.6 },
  digipinLabel: {
    fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
    color: "var(--ink-muted)", margin: 0,
  },
  digipin: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "clamp(26px, 8vw, 40px)", fontWeight: 700, letterSpacing: "0.06em",
    color: "var(--rose-deep)", background: "var(--rose-soft)",
    padding: "14px 12px", borderRadius: 12, textAlign: "center",
    margin: "8px 0 6px", wordBreak: "break-word",
  },
  digipinHelp: { fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 },
  details: { margin: "16px 0 0" },
  detailRow: { display: "flex", gap: 10, fontSize: 13, padding: "5px 0", borderTop: "1px solid var(--border)" },
  dt: { color: "var(--ink-muted)", minWidth: 96, margin: 0 },
  dd: { margin: 0, color: "var(--ink)", fontFamily: "ui-monospace, monospace", fontSize: 12.5 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 },
  actionBtn: { fontSize: 13, padding: "9px 14px", textDecoration: "none" },
  messageBox: { marginTop: 14 },
  summary: { fontSize: 12.5, color: "var(--rose-deep)", fontWeight: 600, cursor: "pointer" },
  pre: {
    fontSize: 12, background: "var(--cream-dim)", padding: 12, borderRadius: 10,
    whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--ink-soft)",
    marginTop: 8, fontFamily: "ui-monospace, monospace", lineHeight: 1.6,
  },
  privacy: {
    fontSize: 11.5, color: "var(--ink-muted)", marginTop: 14, lineHeight: 1.6,
    borderTop: "1px solid var(--border)", paddingTop: 10,
  },
};

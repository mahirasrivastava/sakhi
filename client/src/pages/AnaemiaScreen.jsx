import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useReport } from "../context/ReportContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { speak, stopSpeaking, speechSynthesisSupported } from "../speech.js";
import { inspectFrame, warmUpEyeDetection, isEyeDetectionAvailable } from "../eyeDetection.js";

// ---------------------------------------------------------------------------
// Capture geometry
// ---------------------------------------------------------------------------
// The conjunctiva is an oval strip, not a square, so the analysis region is an
// ellipse inscribed in the centre 30% of the frame. A square crop of the same
// span pulls in lash line at the top corners and skin at the bottom ones, and
// both are darker and less saturated than the tissue — they drag the mean the
// wrong way.
//
// 50x50 downsample, ellipse mask, every 4th surviving pixel: about 490 samples.
// That is enough for a stable mean without sending a payload that a 2G
// connection will time out on.
const ANALYSIS_PX = 50;
const SAMPLE_STRIDE = 4;
const CROP_FRACTION = 0.30;

// The live check runs on a much smaller draw — it only needs a brightness
// reading, and it runs twice a second on a phone that may be five years old.
const LIVE_PX = 10;
const LIVE_INTERVAL_MS = 500;

// Traffic-light thresholds. Red mirrors the server's own reject bounds, so the
// indicator never goes green on a frame the server would refuse. Amber is the
// band that will produce a reading but not a confident one.
const LIGHT = { REJECT_LOW: 40, REJECT_HIGH: 235, IDEAL_LOW: 70, IDEAL_HIGH: 200, MIN_VARIANCE: 50 };

// Maps the server's rejection reasons onto translation keys. The server returns
// English, which is right for logs and wrong for a girl holding the phone.
const REJECT_KEYS = {
  "too dark": "anaemia_reject_dark",
  "too bright / washed out": "anaemia_reject_bright",
  "image looks uniform — may not be an eyelid": "anaemia_reject_uniform",
  "not enough data": "anaemia_reject_nodata",
  "couldn't isolate conjunctival tissue": "anaemia_reject_notissue",
};

const SEVERITY_KEYS = {
  none: "anaemia_severity_none",
  mild: "anaemia_severity_mild",
  moderate: "anaemia_severity_moderate",
  strong: "anaemia_severity_strong",
};

// Colour is carried by the existing palette tokens rather than new hex values,
// so the severity ladder stays consistent with the triage pills elsewhere.
const SEVERITY_STYLE = {
  none: { color: "var(--selfcare)", background: "var(--pill-selfcare-bg)" },
  mild: { color: "var(--gold)", background: "var(--warn-bg)" },
  moderate: { color: "var(--urgent)", background: "var(--pill-urgent-bg)" },
  strong: { color: "var(--emergency)", background: "var(--pill-emergency-bg)" },
};

const QUALITY_KEYS = {
  good: "anaemia_confidence_good",
  acceptable: "anaemia_confidence_ok",
  marginal: "anaemia_confidence_low",
};

export default function AnaemiaScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectingRef = useRef(false);

  const { recordAnaemia } = useReport();
  const { t, lang } = useLanguage();

  const [streaming, setStreaming] = useState(false);
  const [light, setLight] = useState("red");
  // Eye-presence gate (Point 4a). "unknown" until the model reports in; if the
  // model is unavailable we never block on it (graceful degradation).
  const [eyeStatus, setEyeStatus] = useState("unknown"); // unknown|searching|aligned|noface|unavailable
  const [result, setResult] = useState(null);
  const [rejection, setRejection] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // A live camera left running on a health app is its own privacy problem —
  // stop the track as soon as the page goes away, and stop any speech with it.
  useEffect(() => () => { stopCamera(); stopSpeaking(); }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setEyeStatus("unknown");
  }

  async function startCamera() {
    setError(null);
    setRejection(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);

      // Kick off the eye-detection model. If it cannot load (offline, blocked
      // CDN, missing dep) the gate quietly disables itself and the screen works
      // as before.
      setEyeStatus("searching");
      warmUpEyeDetection().then((ready) => {
        if (!ready) setEyeStatus("unavailable");
      });
    } catch {
      setError(t("anaemia_no_camera"));
    }
  }

  // -------------------------------------------------------------------------
  // Live lighting check
  // -------------------------------------------------------------------------
  const assessLight = useCallback(() => {
    const video = videoRef.current;
    const canvas = liveCanvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const side = Math.min(video.videoWidth, video.videoHeight) * CROP_FRACTION;
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side,
      0, 0, LIVE_PX, LIVE_PX
    );

    const data = ctx.getImageData(0, 0, LIVE_PX, LIVE_PX).data;

    // 100 drawn pixels, every other one taken: the 50 samples the check needs.
    const brightnesses = [];
    for (let i = 0; i < LIVE_PX * LIVE_PX; i += 2) {
      const o = i * 4;
      brightnesses.push((data[o] + data[o + 1] + data[o + 2]) / 3);
    }

    const mean = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    const variance =
      brightnesses.reduce((acc, b) => acc + (b - mean) * (b - mean), 0) / brightnesses.length;

    if (mean < LIGHT.REJECT_LOW || mean > LIGHT.REJECT_HIGH) setLight("red");
    else if (mean < LIGHT.IDEAL_LOW || mean > LIGHT.IDEAL_HIGH || variance < LIGHT.MIN_VARIANCE) setLight("amber");
    else setLight("green");
  }, []);

  useEffect(() => {
    if (!streaming || result) return undefined;
    const id = setInterval(assessLight, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [streaming, result, assessLight]);

  // Eye-presence loop (Point 4a). Runs the FaceLandmarker over the live frame
  // and reports whether an eye sits over the sampling ring. Reentrancy-guarded
  // because a frame inference can outlast the interval on a slow device.
  const checkEye = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || detectingRef.current) return;
    if (!isEyeDetectionAvailable()) { setEyeStatus("unavailable"); return; }
    detectingRef.current = true;
    try {
      const r = await inspectFrame(video, performance.now());
      if (!r.available) setEyeStatus("unavailable");
      else if (!r.faceFound) setEyeStatus("noface");
      else setEyeStatus(r.aligned ? "aligned" : "noface");
    } catch {
      setEyeStatus("unavailable");
    } finally {
      detectingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!streaming || result) return undefined;
    const id = setInterval(checkEye, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [streaming, result, checkEye]);

  // -------------------------------------------------------------------------
  // Capture
  // -------------------------------------------------------------------------
  /**
   * Samples the elliptical ROI. Nothing here is stored or uploaded as an image:
   * the frame is drawn to an offscreen canvas, reduced to a list of colours, and
   * the canvas is overwritten on the next capture. What leaves the device is a
   * few hundred {r,g,b} triples that cannot be reassembled into a face.
   */
  function samplePixels() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return [];

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const side = Math.min(video.videoWidth, video.videoHeight) * CROP_FRACTION;
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side,
      0, 0, ANALYSIS_PX, ANALYSIS_PX
    );

    const data = ctx.getImageData(0, 0, ANALYSIS_PX, ANALYSIS_PX).data;
    const centre = (ANALYSIS_PX - 1) / 2;
    const radius = ANALYSIS_PX / 2;

    const pixels = [];
    let inside = 0;
    for (let y = 0; y < ANALYSIS_PX; y++) {
      for (let x = 0; x < ANALYSIS_PX; x++) {
        const dx = (x - centre) / radius;
        const dy = (y - centre) / radius;
        if (dx * dx + dy * dy > 1) continue;      // outside the ellipse

        // The stride counts pixels inside the ellipse, not raster position, so
        // the sample stays evenly spread across the tissue.
        if (inside++ % SAMPLE_STRIDE !== 0) continue;

        const o = (y * ANALYSIS_PX + x) * 4;
        pixels.push({ r: data[o], g: data[o + 1], b: data[o + 2] });
      }
    }
    return pixels;
  }

  async function capture() {
    setLoading(true);
    setError(null);
    setRejection(null);
    stopSpeaking();

    try {
      const pixels = samplePixels();
      if (pixels.length === 0) {
        setError(t("anaemia_no_frame"));
        return;
      }

      const res = await api.anaemiaScreen({ pixels });
      setResult(res);
      stopCamera();
      setStreaming(false);

      // Bridge to the printable report. `testNeeded` is what the report's action
      // list keys off, and it is the same question `flagged` answers.
      recordAnaemia({ ...res, testNeeded: res.flagged, severityLabel: t(SEVERITY_KEYS[res.severity]) });
    } catch (err) {
      // 422 is the server's quality gate, and it carries a reason worth showing.
      if (err?.status === 422 && err?.body?.reason) {
        setRejection(err.body.reason);
      } else if (err?.status === 400) {
        setError(err.message);
      } else {
        // Anything else — offline, DNS, 500 — gets the same honest instruction.
        setError(t("anaemia_offline"));
      }
    } finally {
      setLoading(false);
    }
  }

  function retake() {
    stopSpeaking();
    setResult(null);
    setRejection(null);
    setError(null);
    setShowDetails(false);
    startCamera();
  }

  // -------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------
  const spoken = useCallback((res) => [
    t(SEVERITY_KEYS[res.severity]),
    t(QUALITY_KEYS[res.captureQuality]),
    t("anaemia_disclaimer"),
  ].join(". "), [t]);

  const readAloud = useCallback((res) => {
    if (!speechSynthesisSupported()) return;
    speak(spoken(res), lang);
  }, [lang, spoken]);

  // Read the result as soon as it lands. Someone who cannot read the screen is
  // exactly the person this screen is for.
  useEffect(() => {
    if (result) readAloud(result);
  }, [result, readAloud]);

  const lightCopy = { red: t("anaemia_light_dark"), amber: t("anaemia_light_ok"), green: t("anaemia_light_good") };
  // The eye gate only tightens capture when the model is actually working. When
  // it is unavailable or still warming up we fall back to the lighting gate
  // alone, so a user who cannot load the model is never locked out.
  const eyeOk = eyeStatus === "aligned" || eyeStatus === "unavailable" || eyeStatus === "unknown";
  const canCapture = streaming && !loading && (light === "amber" || light === "green") && eyeOk;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 64, maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: 28, marginBottom: 6 }}>{t("anaemia_title")}</h1>
      <p style={styles.subtitle}>{t("anaemia_subtitle")}</p>

      {/* Offscreen working canvases. Never displayed, never uploaded. */}
      <canvas ref={canvasRef} width={ANALYSIS_PX} height={ANALYSIS_PX} style={{ display: "none" }} />
      <canvas ref={liveCanvasRef} width={LIVE_PX} height={LIVE_PX} style={{ display: "none" }} />

      {!result && (
        <div className="card" style={{ marginTop: 20 }}>
          <div style={styles.preview}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ ...styles.video, display: streaming ? "block" : "none" }}
            />
            {!streaming && (
              <div style={styles.placeholder}>
                <Icon name="camera" size={30} />
              </div>
            )}
            {streaming && <div style={styles.oval} aria-hidden="true" />}
          </div>

          <p style={styles.guide}>{t("anaemia_guide")}</p>

          {streaming && (
            <div style={styles.lightRow} role="status" aria-live="polite">
              <span style={{ ...styles.lamp, background: LAMP[light] }} aria-hidden="true" />
              <span style={{ ...styles.lightText, color: LAMP_TEXT[light] }}>{lightCopy[light]}</span>
            </div>
          )}

          {streaming && (eyeStatus === "searching" || eyeStatus === "noface") && (
            <p style={styles.eyeHint} role="status" aria-live="polite">
              {eyeStatus === "searching"
                ? "Getting the camera ready…"
                : "Gently pull down your lower eyelid and place the pink inner rim inside the circle."}
            </p>
          )}
          {streaming && eyeStatus === "aligned" && (
            <p style={{ ...styles.eyeHint, color: "var(--routine)" }} role="status" aria-live="polite">
              Eye in position — hold still and capture.
            </p>
          )}

          <div style={styles.actions}>
            {!streaming ? (
              <button className="btn btn-primary" onClick={startCamera}>{t("anaemia_start")}</button>
            ) : (
              <button className="btn btn-primary" onClick={capture} disabled={!canCapture}>
                {loading ? t("anaemia_capturing") : t("anaemia_capture")}
              </button>
            )}
          </div>

          {rejection && (
            <p style={styles.reject}>{t(REJECT_KEYS[rejection] || "anaemia_reject_generic")}</p>
          )}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      {result && (
        <Result
          result={result}
          t={t}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails((v) => !v)}
          onRetake={retake}
          onReadAloud={() => readAloud(result)}
        />
      )}

      <p style={styles.disclaimer}>{t("anaemia_disclaimer")}</p>

      <p style={{ marginTop: 18, fontSize: 13.5 }}>
        <Link to="/report">{t("anaemia_add_to_report")}</Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function Result({ result, t, showDetails, onToggleDetails, onRetake, onReadAloud }) {
  const tone = SEVERITY_STYLE[result.severity] || SEVERITY_STYLE.none;
  const pct = Math.round(result.confidence * 100);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <span className="pill" style={{ ...tone, fontWeight: 700 }}>
        {t(SEVERITY_KEYS[result.severity])}
      </span>

      {/* Confidence as a bar as well as a number: "marginal" is the thing a user
          most needs to notice, and a number alone does not carry it. */}
      <div style={styles.confidenceWrap}>
        <div style={styles.confidenceHead}>
          <span style={styles.confidenceLabel}>{t(QUALITY_KEYS[result.captureQuality])}</span>
          <span style={styles.confidencePct}>{pct}%</span>
        </div>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${pct}%`, background: tone.color }} />
        </div>
      </div>

      {result.captureQuality === "marginal" && (
        <p style={styles.marginal}>{t("anaemia_marginal")}</p>
      )}

      <div style={styles.actions}>
        <button className="btn btn-primary" onClick={onRetake}>{t("anaemia_retake")}</button>
        {speechSynthesisSupported() && (
          <button className="btn" onClick={onReadAloud}>{t("anaemia_read_aloud")}</button>
        )}
      </div>

      <button
        className="btn"
        onClick={onToggleDetails}
        aria-expanded={showDetails}
        style={styles.detailsToggle}
      >
        {t("anaemia_details")} {showDetails ? "▲" : "▼"}
      </button>

      {showDetails && (
        <table style={styles.table}>
          <tbody>
            <Row k="Pallor score" v={`${result.pallorScore} / 1.00`} />
            <Row k="Flagged" v={String(result.flagged)} />
            <Row k="Green-to-red ratio" v={result.features.greenRedRatio} />
            <Row k="Saturation mean" v={result.features.saturationMean} />
            <Row k="Green percentage" v={result.features.greenPct} />
            <Row k="CIELAB a* (redness)" v={result.features.labA} />
            <Row k="ROI pixels" v={result.features.roiPixelCount} />
            <Row k="ROI ratio" v={result.features.roiRatio} />
            <Row k="Correction factor" v={result.features.correctionFactor} />
          </tbody>
        </table>
      )}

      <p style={styles.note}>{result.note}</p>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <tr>
      <td style={styles.td}>{k}</td>
      <td style={{ ...styles.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v}</td>
    </tr>
  );
}

const LAMP = { red: "var(--emergency)", amber: "var(--urgent)", green: "var(--selfcare)" };
const LAMP_TEXT = { red: "var(--emergency)", amber: "var(--urgent)", green: "var(--routine)" };

const styles = {
  subtitle: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 },

  preview: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 14,
    overflow: "hidden",
    background: "var(--cream-dim)",
    display: "grid",
    placeItems: "center",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  placeholder: { color: "var(--ink-muted)" },

  // Mirrors the elliptical crop that is actually sampled, so the user frames
  // the same region the pipeline measures.
  oval: {
    position: "absolute",
    left: "35%",
    top: "35%",
    width: "30%",
    height: "30%",
    border: "2px solid var(--rose)",
    borderRadius: "50%",
    boxShadow: "0 0 0 9999px rgba(43, 30, 34, 0.35)",
    pointerEvents: "none",
  },

  guide: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 14 },
  eyeHint: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 10, fontWeight: 600 },

  lightRow: { display: "flex", alignItems: "center", gap: 9, marginTop: 12 },
  lamp: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  lightText: { fontSize: 13.5, fontWeight: 600 },

  actions: { marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" },

  reject: { color: "var(--urgent)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 },
  error: { color: "var(--emergency)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 },

  confidenceWrap: { marginTop: 16 },
  confidenceHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  confidenceLabel: { fontSize: 13, color: "var(--ink-soft)", fontWeight: 600 },
  confidencePct: { fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" },
  barTrack: {
    height: 7,
    borderRadius: 999,
    background: "var(--cream-dim)",
    marginTop: 6,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, transition: "width 0.3s ease" },

  marginal: {
    fontSize: 13,
    color: "var(--warn-ink)",
    background: "var(--warn-bg)",
    border: "1px solid var(--warn-border)",
    borderRadius: 10,
    padding: "10px 12px",
    marginTop: 12,
    lineHeight: 1.6,
  },

  detailsToggle: { marginTop: 14, fontSize: 13 },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 12 },
  td: { padding: "6px 4px", borderBottom: "1px solid var(--border)", color: "var(--ink-soft)" },

  note: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.7, marginTop: 14 },
  disclaimer: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.7, marginTop: 18 },
};

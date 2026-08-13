import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

// The on-screen guide box, as a fraction of the (square) preview. The crop sent
// for analysis is computed from these same numbers — previously the box was
// drawn at 32%-68% while the crop was taken at a different size, so the pixels
// scored were never quite the pixels the user was aiming at.
const BOX = { left: 0.30, top: 0.36, width: 0.40, height: 0.24 };

const CROP_PX = 160;      // analysis crop resolution
const REFERENCE_PX = 64;  // whole-frame downsample, used for white balance
const BURST_FRAMES = 5;
const BURST_INTERVAL_MS = 180;

export default function AnaemiaScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const refCanvasRef = useRef(null);
  const streamRef = useRef(null);

  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // A live camera left running on a health app is its own privacy problem —
  // stop the track as soon as the page goes away.
  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
    } catch {
      setError("Couldn't access the camera. Check camera permissions, or skip this screen.");
    }
  }

  /** Reads the guide-box region out of the current video frame. */
  function grabCropPixels() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = CROP_PX;
    canvas.height = CROP_PX;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // The preview is rendered with object-fit: cover on a square box, so the
    // visible area is the centred square of the source frame. The guide box
    // fractions are relative to that square, not to the raw video.
    const square = Math.min(vw, vh);
    const originX = (vw - square) / 2;
    const originY = (vh - square) / 2;

    ctx.drawImage(
      video,
      originX + BOX.left * square,
      originY + BOX.top * square,
      BOX.width * square,
      BOX.height * square,
      0, 0, CROP_PX, CROP_PX
    );

    const { data } = ctx.getImageData(0, 0, CROP_PX, CROP_PX);
    const pixels = [];
    // Every 2nd pixel: enough detail for robust statistics, small enough payload.
    for (let i = 0; i < data.length; i += 4 * 2) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    return { pixels, imageData: data };
  }

  /** Whole-frame downsample — the illuminant estimate needs the scene, not the crop. */
  function grabReferencePixels() {
    const video = videoRef.current;
    const canvas = refCanvasRef.current;
    canvas.width = REFERENCE_PX;
    canvas.height = REFERENCE_PX;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, REFERENCE_PX, REFERENCE_PX);

    const { data } = ctx.getImageData(0, 0, REFERENCE_PX, REFERENCE_PX);
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    return pixels;
  }

  /**
   * Variance of the Laplacian — the standard cheap focus measure. A blurred
   * frame has little high-frequency energy, so this collapses toward zero.
   * Computed here rather than server-side because it needs the 2D grid, which
   * the flat pixel list sent over the wire no longer has.
   */
  function focusScore(imageData, size = CROP_PX) {
    const grey = new Float32Array(size * size);
    for (let i = 0, p = 0; i < imageData.length; i += 4, p++) {
      grey[p] = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
    }

    const values = [];
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const idx = y * size + x;
        values.push(
          -4 * grey[idx] +
          grey[idx - 1] + grey[idx + 1] +
          grey[idx - size] + grey[idx + size]
        );
      }
    }
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  }

  async function capture() {
    setLoading(true);
    setError(null);
    setProblems([]);
    setResult(null);
    setProgress(0);

    try {
      const frames = [];
      let focus = 0;

      // A burst, not a single shot. One frame can be caught mid-blink or during
      // an autofocus hunt; five spread over a second cannot all be.
      for (let i = 0; i < BURST_FRAMES; i++) {
        const grab = grabCropPixels();
        if (grab) {
          frames.push(grab.pixels);
          focus = Math.max(focus, focusScore(grab.imageData));
        }
        setProgress(Math.round(((i + 1) / BURST_FRAMES) * 100));
        if (i < BURST_FRAMES - 1) {
          await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
        }
      }

      if (frames.length === 0) {
        setError("The camera didn't return an image. Try turning it off and on again.");
        return;
      }

      const res = await api.anaemiaScreen({
        frames,
        reference: grabReferencePixels(),
        focusScore: focus,
      });
      setResult(res);
    } catch (err) {
      // 422 = the capture was readable but not good enough to score. The server
      // says exactly what to fix, so show that instead of a generic failure.
      if (err.status === 422 && err.body?.problems?.length) {
        setProblems(err.body.problems);
      } else {
        setError("Screening failed — please try again in good, indirect light.");
      }
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ maxWidth: 720 }}>
        <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15 }}>
          Anaemia screen
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
          Gently pull down your lower eyelid so the pink inner rim fills the box, in good
          indirect light. This is a screening flag, never a haemoglobin number — a blood
          test is the only way to confirm anaemia.
        </p>
      </div>

      <div className="split" style={{ marginTop: 26 }}>
      <div>
      <div className="card" style={{ textAlign: "center" }}>
        <div style={styles.preview}>
          <video
            ref={videoRef}
            style={{ ...styles.video, display: streaming ? "block" : "none" }}
            muted
            playsInline
          />
          {!streaming && <div style={styles.placeholder}>Camera preview</div>}
          <div style={styles.frameBox} aria-hidden="true">
            <span style={styles.frameLabel}>inner eyelid here</span>
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <canvas ref={refCanvasRef} style={{ display: "none" }} />

        {error && <p style={styles.error}>{error}</p>}

        {loading && (
          <div style={{ marginTop: 14 }}>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
            <p style={styles.progressLabel}>Capturing {BURST_FRAMES} frames — hold still…</p>
          </div>
        )}

        <div style={styles.actions}>
          {!streaming && (
            <button className="btn btn-primary" onClick={startCamera}>Turn on camera</button>
          )}
          {streaming && (
            <>
              <button className="btn btn-primary" onClick={capture} disabled={loading}>
                {loading ? "Analysing…" : "Capture & screen"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => { stopCamera(); setStreaming(false); }}
                disabled={loading}
              >
                Turn off camera
              </button>
            </>
          )}
        </div>
      </div>

      {/* A capture that failed the quality gate. Actionable, and explicitly not
          a result — showing a score from an unusable frame is how a screen ends
          up looking confident and being wrong. */}
      {problems.length > 0 && (
        <div className="card" style={{ marginTop: 18, borderLeft: "4px solid var(--urgent)" }}>
          <strong style={{ fontSize: 15 }}>Couldn't read this capture</strong>
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 6 }}>
            No result was produced — nothing here is a screening outcome. Fix the following
            and capture again:
          </p>
          <ul style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
            {problems.map((p) => <li key={p.code}>{p.message}</li>)}
          </ul>
        </div>
      )}

      {result?.ok && <ResultPanel result={result} />}
      </div>

      <div className="aside-sticky" style={{ display: "grid", gap: 16 }}>
        <div className="aside-card">
          <div className="aside-title">How to get a good reading</div>
          <ol style={asideStyles.list}>
            <li>Stand near a window in <strong>daylight</strong>. Do not use the flash.</li>
            <li>Gently pull the lower lid down so the <strong>pink inner rim</strong> shows.</li>
            <li>Fill the dashed box with that pink area, not the whole eye.</li>
            <li>Rest your elbow on something and hold still while it captures.</li>
          </ol>
          <p style={asideStyles.note}>
            If the capture is rejected, that is the screen refusing to guess from a bad
            photo. Fix what it asks for and try again.
          </p>
        </div>

        <div className="aside-card" style={{ borderInlineStart: "4px solid var(--urgent)" }}>
          <div className="aside-title" style={{ color: "var(--urgent)" }}>This is not a blood test</div>
          <p style={asideStyles.note}>
            It looks at colour only. It cannot give a haemoglobin number and it cannot
            rule anaemia out. If you feel tired, breathless or dizzy, ask for a blood
            test even if this screen finds nothing.
          </p>
        </div>

        <div className="aside-card">
          <div className="aside-title">Signs worth acting on</div>
          <ul style={asideStyles.list}>
            <li>Getting breathless on stairs or while cooking</li>
            <li>Tiredness that sleep does not fix</li>
            <li>Dizziness on standing up</li>
            <li>Heavy periods, soaking a pad every hour</li>
            <li>Craving ice, chalk or mud</li>
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}

const asideStyles = {
  list: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
  note: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 10 },
};

function ResultPanel({ result }) {
  const [showDetail, setShowDetail] = useState(false);

  const pillClass = {
    high: "pill-urgent",
    borderline: "pill-routine",
    low: "pill-selfcare",
  }[result.band] || "pill-routine";

  const bandLabel = {
    high: "Pallor detected — get a blood test",
    borderline: "Borderline — a blood test is advisable",
    low: "No pallor detected by this screen",
  }[result.band];

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <span className={`pill ${pillClass}`}>{bandLabel}</span>

      <div style={{ marginTop: 16 }}>
        <Meter label="Pallor score" value={result.pallorScore} />
        <Meter label="Confidence in this reading" value={result.confidence} />
      </div>

      <p style={{ marginTop: 14, fontSize: 14.5, color: "var(--ink)", lineHeight: 1.65 }}>
        {result.advice}
      </p>

      {result.confidence < 0.5 && (
        <p style={styles.lowConfidence}>
          Confidence is low, so treat this as inconclusive rather than reassuring.
          Capturing again in better light will give a more reliable reading.
        </p>
      )}

      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
        {result.note}
      </p>

      <button
        type="button"
        onClick={() => setShowDetail((s) => !s)}
        style={styles.detailToggle}
      >
        {showDetail ? "Hide" : "Show"} how this was measured
      </button>

      {showDetail && (
        <div style={styles.detail}>
          <p style={{ marginBottom: 10 }}>
            {result.framesUsed} of {result.framesAnalysed} captured frames were usable;
            they agreed {Math.round(result.agreement * 100)}%.
            {result.illuminantCorrected
              ? " Lighting colour was corrected using the whole scene."
              : " Lighting colour could not be corrected — the result is more sensitive to the light source."}
          </p>
          <p style={{ marginBottom: 10 }}>
            {Math.round(result.coverage.tissueFraction * 100)}% of the box looked like
            eyelid tissue; {Math.round(result.coverage.glareFraction * 100)}% was glare.
          </p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Measure</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Healthy ref.</th>
                <th style={styles.th}>Pushes toward</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.breakdown).map(([name, m]) => (
                <tr key={name}>
                  <td style={styles.td}>{FEATURE_LABELS[name] || name}</td>
                  <td style={styles.td}>{m.value}</td>
                  <td style={styles.td}>{m.reference}</td>
                  <td style={{ ...styles.td, color: m.contribution > 0 ? "var(--urgent)" : "var(--selfcare)" }}>
                    {m.contribution > 0 ? "paler" : "healthier"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 10, fontStyle: "italic" }}>
            These thresholds are uncalibrated starting values, not fitted to this
            population against real haemoglobin results. Treat the direction as
            meaningful and the exact number as approximate.
          </p>
        </div>
      )}
    </div>
  );
}

const FEATURE_LABELS = {
  erythemaIndex: "Erythema index (blood in tissue)",
  labA: "Red–green axis (a*)",
  saturation: "Colour saturation",
  pallorRatio: "Pallor ratio",
};

function Meter({ label, value }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={styles.meterRow}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={styles.meterTrack}>
        <div style={{ ...styles.meterFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

const styles = {
  preview: {
    // The preview is square, so in a wide column an uncapped width makes it
    // taller than the viewport. Capped and centred instead.
    position: "relative", width: "100%", maxWidth: 460, margin: "0 auto",
    aspectRatio: "1", background: "var(--cream-dim)",
    borderRadius: 14, overflow: "hidden",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  placeholder: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: "100%", color: "var(--ink-soft)",
  },
  frameBox: {
    position: "absolute",
    left: `${BOX.left * 100}%`, top: `${BOX.top * 100}%`,
    width: `${BOX.width * 100}%`, height: `${BOX.height * 100}%`,
    border: "2px dashed var(--rose)", borderRadius: 10,
  },
  frameLabel: {
    position: "absolute", bottom: -22, left: 0, right: 0, textAlign: "center",
    fontSize: 11, color: "var(--rose)", fontWeight: 600, letterSpacing: "0.03em",
  },
  actions: { marginTop: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  error: { color: "var(--emergency)", fontSize: 13.5, marginTop: 12 },
  progressTrack: {
    height: 5, borderRadius: 999, background: "var(--cream-dim)", overflow: "hidden",
  },
  progressFill: { height: "100%", background: "var(--rose)", transition: "width 0.15s ease" },
  progressLabel: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 7 },
  meterRow: {
    display: "flex", justifyContent: "space-between",
    fontSize: 13, color: "var(--ink-soft)", marginBottom: 5,
  },
  meterTrack: { height: 8, borderRadius: 999, background: "var(--cream-dim)", overflow: "hidden" },
  meterFill: { height: "100%", background: "var(--rose)", borderRadius: 999 },
  lowConfidence: {
    marginTop: 12, padding: "10px 12px", borderRadius: 10,
    background: "var(--cream-dim)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6,
  },
  detailToggle: {
    marginTop: 14, background: "none", border: "none", padding: 0,
    color: "var(--rose-deep)", fontWeight: 600, fontSize: 13, textDecoration: "underline",
  },
  detail: {
    marginTop: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.65,
    borderTop: "1px solid var(--cream-dim)", paddingTop: 12,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    textAlign: "left", padding: "6px 4px", borderBottom: "1px solid var(--cream-dim)",
    color: "var(--ink-soft)", fontWeight: 600,
  },
  td: { padding: "6px 4px", borderBottom: "1px solid var(--cream-dim)" },
};

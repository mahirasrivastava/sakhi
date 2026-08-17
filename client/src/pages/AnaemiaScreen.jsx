import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useReport } from "../context/ReportContext.jsx";

// The on-screen guide box, as a fraction of the (square) preview. The crop sent
// for analysis is computed from these same numbers — previously the box was
// drawn at 32%-68% while the crop was taken at a different size, so the pixels
// scored were never quite the pixels the user was aiming at.
const BOX = { left: 0.30, top: 0.36, width: 0.40, height: 0.24 };

const CROP_PX = 160;      // analysis crop resolution
const REFERENCE_PX = 64;  // whole-frame downsample, used for white balance

// Seven frames rather than five. The burst is the cheapest robustness available
// here — the frames cost nothing but a second of holding still, and the server
// now discards outliers by MAD before taking the median, which needs a few more
// samples than five to be worth doing.
const BURST_FRAMES = 7;
const BURST_INTERVAL_MS = 150;

export default function AnaemiaScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const refCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const { recordAnaemia } = useReport();

  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // The checklist. This is not a nicety — a phone camera pointed at an eyelid
  // is a weak signal, and "I get breathless on stairs" is a strong one. The
  // server weights them together, and either can produce a yes on its own.
  const [questions, setQuestions] = useState({ symptoms: [], risks: [] });
  const [symptoms, setSymptoms] = useState([]);
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    api.anaemiaQuestions().then(setQuestions).catch(() => {});
  }, []);

  // A live camera left running on a health app is its own privacy problem —
  // stop the track as soon as the page goes away.
  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function toggle(setter) {
    return (id) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      setError("Couldn't access the camera. Check camera permissions, or answer the questions below instead — they alone can give you an answer.");
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
      // an autofocus hunt; seven spread over a second cannot all be.
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
        symptoms,
        risks,
      });
      setResult(res);
      recordAnaemia({
        verdict: res.verdict,
        testNeeded: res.testNeeded,
        headline: res.headline,
        summary: res.summary,
        reasons: res.reasons,
        band: res.band,
        pallorScore: res.pallorScore,
        confidence: res.confidence,
        framesUsed: res.framesUsed,
        framesAnalysed: res.framesAnalysed,
        symptomLabels: symptoms
          .map((id) => questions.symptoms.find((o) => o.id === id)?.label)
          .filter(Boolean),
        riskLabels: risks
          .map((id) => questions.risks.find((o) => o.id === id)?.label)
          .filter(Boolean),
      });
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
      <div style={{ maxWidth: 760 }}>
        <span className="section-eyebrow">
          <Icon name="eye" size={13} /> Anaemia screening
        </span>
        <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15, marginTop: 8 }}>
          Do you need a blood test?
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
          Two things together: the colour of your inner eyelid, and what you have been
          feeling. You get one answer — yes or no. This is a screening flag, never a
          haemoglobin number, and a blood test is the only way to confirm anaemia.
        </p>
      </div>

      <div className="split" style={{ marginTop: 26 }}>
        <div>
          {result && <VerdictPanel result={result} />}

          {/* A capture that failed the quality gate. Actionable, and explicitly not
              a result — showing a score from an unusable frame is how a screen ends
              up looking confident and being wrong. */}
          {problems.length > 0 && (
            <div className="card" style={{ marginBottom: 18, borderInlineStart: "4px solid var(--urgent)" }}>
              <strong style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="alert" size={17} style={{ color: "var(--urgent)" }} />
                Couldn't read this capture
              </strong>
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 6 }}>
                No result was produced — nothing here is a screening outcome. Fix the following
                and capture again:
              </p>
              <ul style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.8, paddingInlineStart: 20, marginTop: 8 }}>
                {problems.map((p) => <li key={p.code}>{p.message}</li>)}
              </ul>
            </div>
          )}

          <div className="card" style={{ textAlign: "center" }}>
            <div style={styles.preview}>
              <video
                ref={videoRef}
                style={{ ...styles.video, display: streaming ? "block" : "none" }}
                muted
                playsInline
              />
              {!streaming && (
                <div style={styles.placeholder}>
                  <Icon name="camera" size={34} />
                  <span style={{ fontSize: 13.5 }}>Camera preview</span>
                </div>
              )}
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
                <button className="btn btn-primary" onClick={startCamera}>
                  <Icon name="camera" size={17} /> Turn on camera
                </button>
              )}
              {streaming && (
                <>
                  <button className="btn btn-primary" onClick={capture} disabled={loading}>
                    <Icon name="eye" size={17} />
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

          {/* The checklist. Placed under the camera, but it is not secondary:
              two of these ticked will produce a "yes" whatever the camera saw. */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <span className="section-eyebrow">
                <Icon name="check" size={13} /> Step 2 — how you have been feeling
              </span>
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.6 }}>
                Tick anything true for the last few weeks. These count as much as the
                photograph — often more.
              </p>
            </div>

            <div className="choice-grid">
              {questions.symptoms.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="choice"
                  aria-pressed={symptoms.includes(o.id)}
                  onClick={() => toggle(setSymptoms)(o.id)}
                >
                  <span className="choice-icon">
                    <Icon name={symptoms.includes(o.id) ? "check" : "minus"} size={17} />
                  </span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>

            <p style={{ ...styles.subhead, marginTop: 20 }}>Anything else that applies</p>
            <div className="choice-grid">
              {questions.risks.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="choice"
                  aria-pressed={risks.includes(o.id)}
                  onClick={() => toggle(setRisks)(o.id)}
                >
                  <span className="choice-icon">
                    <Icon name={risks.includes(o.id) ? "check" : "minus"} size={17} />
                  </span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>

            <p style={styles.checklistNote}>
              {symptoms.length + risks.length === 0
                ? "Nothing ticked yet."
                : `${symptoms.length + risks.length} ticked — these are sent with the capture and weighed alongside it.`}
            </p>
          </div>
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
              It looks at colour and at what you told us. It cannot give a haemoglobin
              number and it cannot rule anaemia out. When it is unsure it says
              <strong> yes, get tested</strong> — because an unnecessary free test costs an
              afternoon and a missed anaemia costs far more.
            </p>
          </div>

          <div className="aside-card">
            <div className="aside-title">The test is free</div>
            <p style={asideStyles.note}>
              Under <strong>Anemia Mukt Bharat</strong>, haemoglobin testing and iron-folic
              acid tablets are free at the sub-centre and the Health and Wellness Centre.
              Ask the ASHA worker or the ANM — you do not need a referral or a card.
            </p>
            <Link to="/report" className="btn-text" style={{ marginTop: 10 }}>
              <Icon name="report" size={13} /> Put this in my health report
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The answer.
 *
 * The old version led with a pill, then two percentage meters, then a paragraph.
 * A person reading that has to do the interpretation herself, and the most
 * common outcome of "51%, confidence 44%" is that nobody does anything. So the
 * verdict is now the largest thing on the page, in words, with the reasons under
 * it and the numbers folded away behind a toggle for whoever wants them.
 */
function VerdictPanel({ result }) {
  const [showDetail, setShowDetail] = useState(false);
  const yes = result.testNeeded;

  return (
    <div className={`verdict ${yes ? "verdict-yes" : "verdict-no"}`} style={{ marginBottom: 18 }}>
      <span className="verdict-eyebrow">
        {yes ? "Screening result — action needed" : "Screening result"}
      </span>

      <div className="verdict-answer">
        <span className="verdict-mark">
          <Icon name={yes ? "alert" : "check"} size={26} strokeWidth={2.2} />
        </span>
        <span>{result.headline}</span>
      </div>

      <p className="verdict-because">{result.summary}</p>

      {result.reasons?.length > 0 && (
        <>
          <span className="verdict-eyebrow">Why</span>
          <ul className="verdict-reasons">
            {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>
      )}

      {yes && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <a href="tel:104" className="btn btn-emergency btn-sm">
            <Icon name="phone" size={15} /> Health advice 104
          </a>
          <Link to="/report" className="btn btn-ghost btn-sm">
            <Icon name="report" size={15} /> Add to my report
          </Link>
          <Link to="/nearby" className="btn btn-ghost btn-sm">
            <Icon name="pin" size={15} /> Nearest centre
          </Link>
        </div>
      )}

      <button type="button" onClick={() => setShowDetail((s) => !s)} className="btn-text">
        {showDetail ? "Hide" : "Show"} how this was measured
        <Icon name={showDetail ? "minus" : "plus"} size={13} />
      </button>

      {showDetail && <Detail result={result} />}
    </div>
  );
}

function Detail({ result }) {
  return (
    <div style={styles.detail}>
      <div className="data-list">
        <div className="data-row">
          <span className="data-key">Pallor score</span>
          <span className="data-value">{result.pallorScore} ({result.band})</span>
        </div>
        <div className="data-row">
          <span className="data-key">Confidence in the reading</span>
          <span className="data-value">{Math.round(result.confidence * 100)}%</span>
        </div>
        <div className="data-row">
          <span className="data-key">Frames captured / usable / in consensus</span>
          <span className="data-value">
            {result.framesAnalysed} / {result.framesUsed} / {result.framesInConsensus ?? result.framesUsed}
          </span>
        </div>
        {result.outliersDropped > 0 && (
          <div className="data-row">
            <span className="data-key">Outlier frames discarded</span>
            <span className="data-value">{result.outliersDropped}</span>
          </div>
        )}
        <div className="data-row">
          <span className="data-key">Frames agreed</span>
          <span className="data-value">{Math.round(result.agreement * 100)}%</span>
        </div>
        <div className="data-row">
          <span className="data-key">Lighting colour corrected</span>
          <span className="data-value">{result.illuminantCorrected ? "Yes" : "No"}</span>
        </div>
        <div className="data-row">
          <span className="data-key">Box that looked like eyelid tissue</span>
          <span className="data-value">{Math.round(result.coverage.tissueFraction * 100)}%</span>
        </div>
        <div className="data-row">
          <span className="data-key">Glare in the box</span>
          <span className="data-value">{Math.round(result.coverage.glareFraction * 100)}%</span>
        </div>
        <div className="data-row">
          <span className="data-key">Symptoms counted</span>
          <span className="data-value">{result.symptomCount ?? 0}</span>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Colour measure</th>
            <th style={styles.th}>Eyelid</th>
            <th style={styles.th}>Your skin</th>
            <th style={styles.th}>Boundary</th>
            <th style={styles.th}>Pushes toward</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(result.breakdown).map(([name, m]) => (
            <tr key={name}>
              <td style={styles.td}>{FEATURE_LABELS[name] || name}</td>
              <td style={styles.td}>{m.value}</td>
              <td style={styles.td}>{m.skin ?? "—"}</td>
              <td style={styles.td}>{m.reference}</td>
              <td style={{ ...styles.td, fontWeight: 600 }}>
                {m.contribution > 0 ? "paler" : "healthier"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 10, fontStyle: "italic", fontSize: 12 }}>
        Each measure is compared against the skin around your eye, which is lit by the
        same light — that is what stops a yellow bulb or a cloudy day changing the
        answer. The boundary column is roughly where mild anaemia begins. These are
        literature-informed values, not fitted to this population against real
        haemoglobin results, so treat the direction as meaningful and the exact number
        as approximate. {result.note}
      </p>
    </div>
  );
}

const FEATURE_LABELS = {
  erythemaIndex: "Erythema index (blood in tissue)",
  labA: "Red–green axis (a*)",
  saturation: "Colour saturation",
  pallorRatio: "Pallor ratio",
};

const asideStyles = {
  list: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
  note: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 10 },
};

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
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 10, height: "100%", color: "var(--ink-muted)",
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
  error: { color: "var(--emergency)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 },
  progressTrack: {
    height: 5, borderRadius: 999, background: "var(--cream-dim)", overflow: "hidden",
  },
  progressFill: { height: "100%", background: "var(--rose)", transition: "width 0.15s ease" },
  progressLabel: { fontSize: 12.5, color: "var(--ink-soft)", marginTop: 7 },
  subhead: {
    fontSize: 12, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.07em", color: "var(--rose-deep)", marginBottom: 10,
  },
  checklistNote: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 14, fontWeight: 600 },
  detail: {
    marginTop: 4, fontSize: 12.5, lineHeight: 1.65,
    borderTop: "1px solid currentColor", paddingTop: 12, opacity: 0.95,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 14 },
  th: {
    textAlign: "start", padding: "6px 4px", borderBottom: "1px solid currentColor",
    fontWeight: 600, opacity: 0.75,
  },
  td: { padding: "6px 4px", borderBottom: "1px solid currentColor" },
};

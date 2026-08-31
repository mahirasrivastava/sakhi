import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import ErrorNote from "../components/ErrorNote.jsx";

/**
 * Prescription reader (point 4b) — a FREE vision model reads a photo of a
 * prescription. This is an aid, never an instruction: the result is shown as a
 * "please confirm each line" checklist, with confidence flags and a standing
 * disclaimer. Nothing here tells the patient to take anything.
 *
 * The photo is downscaled on the device before upload (keeps it under the
 * server limit and off slow connections), and it is not stored server-side.
 * English literals for now, like the other new screens.
 */
const MAX_DIM = 1600;   // longest edge after downscale
const JPEG_QUALITY = 0.8;

export default function PrescriptionReader() {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmed, setConfirmed] = useState({}); // index -> bool

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setResult(null); setConfirmed({});
    try {
      const { base64, dataUrl } = await downscale(file);
      setPreview(dataUrl);
      setBusy(true);
      const res = await api.prescriptionRead(base64, "image/jpeg");
      setResult(res);
    } catch (err) {
      if (err?.status === 503) setError("Prescription reading isn't enabled yet on the server (needs a free vision key).");
      else setError(err?.message || "Could not read that photo. Try a clearer, well-lit picture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container container-narrow" style={{ paddingTop: 40, paddingBottom: 64 }}>
      <h1 className="display" style={{ fontSize: 26, marginBottom: 6 }}>Read a prescription</h1>
      <p style={styles.sub}>
        Take a photo of a paper prescription and Sakhi will try to read it out for you. It can make
        mistakes — always check each medicine with your doctor or chemist.
      </p>

      <div className="card" style={{ marginTop: 18 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPick}
          style={{ display: "none" }}
        />
        <button className="btn btn-primary btn-lg" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? "Reading…" : preview ? "Choose another photo" : "Take / choose a photo"}
        </button>

        <p style={styles.privacy}>
          Unlike the eyelid check, this photo is sent to the AI to be read. It is not saved, but it
          does leave your phone — only upload a prescription you're comfortable sharing.
        </p>

        {preview && (
          <img src={preview} alt="prescription preview" style={styles.preview} />
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <p style={styles.disclaimer}>⚠️ {result.disclaimer}</p>

          {result.items?.length > 0 ? (
            <>
              <p style={styles.h}>What we think it says — tick each one you've confirmed:</p>
              <ul style={styles.list}>
                {result.items.map((it, i) => (
                  <li key={i} style={styles.item}>
                    <label style={styles.itemRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(confirmed[i])}
                        onChange={() => setConfirmed((c) => ({ ...c, [i]: !c[i] }))}
                        style={{ marginTop: 4 }}
                      />
                      <span>
                        <strong>{it.medicine || "(unreadable)"}</strong>
                        {it.strength ? ` · ${it.strength}` : ""}
                        {it.frequency ? ` · ${it.frequency}` : ""}
                        {it.duration ? ` · ${it.duration}` : ""}
                        <span style={{ ...styles.conf, ...confStyle(it.confidence) }}>
                          {it.confidence || "low"} confidence
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={styles.h}>We couldn't pick out clear medicine lines. Here's the raw reading:</p>
          )}

          {result.legibleText && (
            <details style={{ marginTop: 12 }}>
              <summary style={styles.summary}>Show the full text we read</summary>
              <pre style={styles.raw}>{result.legibleText}</pre>
            </details>
          )}

          {result.notes && <p style={styles.notes}>Note: {result.notes}</p>}
          {result.unreadable && (
            <p style={styles.notes}>Parts of this were hard to read — please double-check with the chemist.</p>
          )}
        </div>
      )}

      <p style={{ marginTop: 18, fontSize: 13.5 }}>
        <Link to="/report">Back to my report</Link>
      </p>
    </div>
  );
}

// Draw the chosen image onto a canvas at a bounded size and re-encode as JPEG.
function downscale(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ dataUrl, base64: dataUrl.split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not open that image.")); };
    img.src = url;
  });
}

function confStyle(c) {
  if (c === "high") return { color: "var(--routine)", background: "var(--pill-selfcare-bg)" };
  if (c === "medium") return { color: "var(--gold)", background: "var(--warn-bg)" };
  return { color: "var(--emergency)", background: "var(--pill-emergency-bg)" };
}

const styles = {
  sub: { fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 },
  privacy: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 12 },
  preview: { width: "100%", borderRadius: 12, marginTop: 14, maxHeight: 320, objectFit: "contain", background: "var(--cream-dim)" },
  disclaimer: {
    fontSize: 13.5, color: "var(--emergency)", background: "var(--pill-emergency-bg)",
    border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", margin: 0, lineHeight: 1.6,
  },
  h: { fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 },
  item: { borderBottom: "1px solid var(--border)", paddingBottom: 10 },
  itemRow: { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.5, cursor: "pointer" },
  conf: { display: "inline-block", marginLeft: 8, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 8px" },
  summary: { fontSize: 13, cursor: "pointer", color: "var(--ink-soft)" },
  raw: { whiteSpace: "pre-wrap", fontSize: 12.5, color: "var(--ink-soft)", background: "var(--cream-dim)", padding: 10, borderRadius: 8, marginTop: 8, overflowX: "auto" },
  notes: { fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, marginTop: 12 },
};

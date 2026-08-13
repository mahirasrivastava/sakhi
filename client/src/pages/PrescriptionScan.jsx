import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

/**
 * Prescription reader.
 *
 * OCR runs in this browser tab, not on a server. The photograph of someone's
 * prescription — which carries their name, their doctor, and their diagnosis —
 * never leaves the device. Only the extracted text is posted for analysis, and
 * the user is told that plainly before they upload anything.
 *
 * tesseract.js is loaded lazily: it pulls a multi-megabyte WASM core and a
 * language model, and nobody visiting the home page should pay for that.
 */
export default function PrescriptionScan() {
  const [imageUrl, setImageUrl] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | ocr | done | error
  const [error, setError] = useState(null);

  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [pregnant, setPregnant] = useState(false);

  const [result, setResult] = useState(null);
  const [analysing, setAnalysing] = useState(false);

  const objectUrlRef = useRef(null);

  useEffect(() => {
    api.prescriptionFamilyOptions().then(setFamilyOptions).catch(() => {});
    // Revoke the blob URL on unmount so the image is not left resident.
    return () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); };
  }, []);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setOcrText("");
    setStage("ocr");
    setProgress(0);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImageUrl(objectUrlRef.current);

    try {
      // Dynamic import: the OCR engine is fetched only when someone actually
      // scans something.
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      setOcrText(data.text || "");
      setStage("done");
      if (!data.text || data.text.trim().length < 10) {
        setError("Very little text was readable. Try a straighter, brighter photo — or type the medicine names in yourself below.");
        setEditing(true);
      }
    } catch (err) {
      setError("Couldn't read the image. You can type the medicine names in below instead.");
      setStage("error");
      setEditing(true);
    } finally {
      setProgress(null);
    }
  }

  function toggleFamily(id) {
    setFamilyHistory((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  async function analyse() {
    setAnalysing(true);
    setError(null);
    try {
      const res = await api.analysePrescription({
        text: ocrText,
        familyHistory,
        isPregnantOrPossible: pregnant,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || "Could not analyse the prescription.");
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 620 }}>
      <h1 className="display" style={{ fontSize: 28 }}>Read a prescription</h1>
      <p style={styles.lead}>
        Photograph a prescription to see what the medicines are usually for, what
        related problems are worth asking about, and what to raise with a doctor.
      </p>

      <div style={styles.privacyNote}>
        <strong>The photo stays on this phone.</strong> The text is read here in your
        browser; only the words — never the image — are sent for analysis, and nothing
        is saved. Close the tab and it is gone.
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <label style={styles.uploadLabel}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <span className="btn btn-primary" style={{ pointerEvents: "none" }}>
            📄 Take or choose a photo
          </span>
        </label>
        <p style={styles.uploadHint}>
          Lay the paper flat, fill the frame, and avoid shadows. Printed prescriptions
          read far better than handwriting — if it is handwritten, expect to correct
          the text below.
        </p>

        {imageUrl && (
          <img src={imageUrl} alt="The prescription you uploaded" style={styles.preview} />
        )}

        {stage === "ocr" && (
          <div style={{ marginTop: 14 }}>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress ?? 5}%` }} />
            </div>
            <p style={styles.muted}>
              Reading the text on this device{progress != null ? ` — ${progress}%` : "…"}
            </p>
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </div>

      {(ocrText || editing) && (
        <div className="card" style={{ marginTop: 18 }}>
          <div style={styles.rowBetween}>
            <h2 className="display" style={{ fontSize: 17 }}>Text found</h2>
            <button type="button" onClick={() => setEditing((v) => !v)} style={styles.linkBtn}>
              {editing ? "Done editing" : "Correct the text"}
            </button>
          </div>
          <p style={styles.muted}>
            OCR misreads handwriting often. Fixing a medicine name here makes the rest
            far more accurate.
          </p>
          {editing ? (
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={8}
              style={styles.textarea}
              placeholder="Type the medicine names, one per line"
            />
          ) : (
            <pre style={styles.ocrText}>{ocrText}</pre>
          )}

          <div style={styles.divider} />

          <h3 style={styles.sectionHeading}>Family history (optional)</h3>
          <p style={styles.muted}>
            Tick anything a parent, brother or sister has had. This is what turns a list
            of medicines into a picture of what to watch for.
          </p>
          <div style={styles.chips}>
            {familyOptions.map((o) => {
              const on = familyHistory.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleFamily(o.id)}
                  aria-pressed={on}
                  style={{ ...styles.chip, ...(on ? styles.chipOn : {}) }}
                >
                  {on ? "✓ " : ""}{o.label}
                </button>
              );
            })}
          </div>

          <label style={styles.check}>
            <input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} />
            <span>I am pregnant, or I might be</span>
          </label>

          <button
            className="btn btn-primary"
            onClick={analyse}
            disabled={analysing || !ocrText.trim()}
            style={{ marginTop: 18 }}
          >
            {analysing ? "Analysing…" : "Analyse this prescription"}
          </button>
        </div>
      )}

      {result && <Analysis result={result} />}
    </div>
  );
}

function Analysis({ result }) {
  return (
    <>
      {result.pregnancyNotes.length > 0 && (
        <div className="card" style={{ ...styles.alertCard, marginTop: 18 }}>
          <h2 className="display" style={{ fontSize: 17, color: "var(--emergency-ink)" }}>
            Check these with a doctor before your next dose
          </h2>
          {result.pregnancyNotes.map((n) => (
            <p key={n.medicine} style={styles.alertLine}>
              <strong>{n.medicine}:</strong> {n.warning}
            </p>
          ))}
          <p style={styles.alertFoot}>
            Do not stop anything on your own — for several of these, stopping suddenly is
            more dangerous than continuing until you can be seen.
          </p>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <h2 className="display" style={{ fontSize: 18 }}>Medicines recognised</h2>
        {result.unrecognised ? (
          <p style={styles.muted}>
            No medicine names were recognised. Try correcting the text above — even
            getting one or two names right is enough to work from.
          </p>
        ) : (
          <ul style={styles.list}>
            {result.medicines.map((m) => (
              <li key={m.id} style={{ marginBottom: 10 }}>
                <strong>{m.label}</strong>
                <span style={styles.matchedOn}> (read as “{m.matchedOn[0]}”)</span>
                {m.note && <div style={styles.subNote}>{m.note}</div>}
              </li>
            ))}
          </ul>
        )}

        {result.conditions.length > 0 && (
          <>
            <h3 style={styles.sectionHeading}>Usually prescribed for</h3>
            <ul style={styles.list}>
              {result.conditions.map((c) => (
                <li key={c.id}>
                  <strong>{c.label}</strong>
                  <span style={styles.subNote}> — from {c.from.join(", ")}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {result.interlinked.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 className="display" style={{ fontSize: 18 }}>Worth asking about</h2>
          <p style={styles.muted}>
            These are connected to what is already being treated, and are not on this
            prescription. That does not mean they are present — it means they are the
            things most often missed.
          </p>
          {result.interlinked.map((item) => (
            <div key={item.id} style={styles.linkItem}>
              <strong style={{ fontSize: 14.5 }}>{item.label}</strong>
              <ul style={styles.reasonList}>
                {item.reasons.map((r, i) => (
                  <li key={i}><em>{r.from}:</em> {r.why}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {result.familyRisks.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2 className="display" style={{ fontSize: 18 }}>Family history</h2>
          {result.familyRisks.map((f) => (
            <div
              key={f.id}
              style={{
                ...styles.linkItem,
                ...(f.priority === "high" ? styles.linkItemHigh : {}),
              }}
            >
              <strong style={{ fontSize: 14.5 }}>
                {f.label}
                {f.priority === "high" && (
                  <span style={styles.highTag}>overlaps your current treatment</span>
                )}
              </strong>
              {f.reinforces.length > 0 && (
                <p style={styles.subNote}>
                  You are already being treated for {f.reinforces.join(" and ").toLowerCase()},
                  and this also runs in your family — that combination raises the case for
                  earlier and more regular checks.
                </p>
              )}
              <p style={styles.reasonText}>{f.advice}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <h2 className="display" style={{ fontSize: 18 }}>Questions to take with you</h2>
        <p style={styles.muted}>
          Read these out at your next visit. A consultation is short — having the
          questions written down is what gets them answered.
        </p>
        <ol style={styles.questionList}>
          {result.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
        <button className="btn btn-ghost" onClick={() => window.print()} style={{ marginTop: 14 }}>
          Print or save these questions
        </button>
      </div>

      <p style={styles.disclaimer}>{result.disclaimer}</p>
    </>
  );
}

const styles = {
  lead: { color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.65 },
  privacyNote: {
    marginTop: 16, padding: "12px 14px", borderRadius: 12,
    background: "var(--cream-dim)", border: "1px solid var(--border)",
    fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7,
  },
  uploadLabel: { display: "inline-block", cursor: "pointer" },
  uploadHint: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 10, lineHeight: 1.65 },
  preview: {
    marginTop: 14, width: "100%", maxHeight: 260, objectFit: "contain",
    borderRadius: 12, background: "var(--cream-dim)", border: "1px solid var(--border)",
  },
  progressTrack: { height: 5, borderRadius: 999, background: "var(--cream-dim)", overflow: "hidden" },
  progressFill: { height: "100%", background: "var(--rose)", transition: "width 0.2s ease" },
  muted: { fontSize: 12.5, color: "var(--ink-muted)", marginTop: 8, lineHeight: 1.65 },
  error: { fontSize: 13.5, color: "var(--emergency)", marginTop: 12, lineHeight: 1.6 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  linkBtn: {
    background: "none", border: "none", padding: 0, color: "var(--rose-deep)",
    fontWeight: 600, fontSize: 12.5, textDecoration: "underline",
  },
  textarea: {
    width: "100%", marginTop: 10, padding: 12, borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--cream)",
    color: "var(--ink)", fontSize: 13.5, fontFamily: "ui-monospace, monospace", lineHeight: 1.6,
  },
  ocrText: {
    marginTop: 10, padding: 12, borderRadius: 10, background: "var(--cream-dim)",
    fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "pre-wrap",
    maxHeight: 200, overflowY: "auto", fontFamily: "ui-monospace, monospace", lineHeight: 1.6,
  },
  divider: { height: 1, background: "var(--border)", margin: "18px 0" },
  sectionHeading: { fontSize: 14.5, fontWeight: 700, color: "var(--rose-deep)", marginTop: 16, marginBottom: 4 },
  chips: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 },
  chip: {
    padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-soft)",
  },
  chipOn: { background: "var(--rose-soft)", borderColor: "var(--rose)", color: "var(--rose-deep)" },
  check: {
    display: "flex", alignItems: "center", gap: 9, marginTop: 16,
    fontSize: 14, color: "var(--ink)",
  },
  list: { fontSize: 14, color: "var(--ink)", lineHeight: 1.7, paddingInlineStart: 20, marginTop: 10 },
  matchedOn: { fontSize: 12, color: "var(--ink-muted)" },
  subNote: { fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 2 },
  linkItem: {
    marginTop: 12, padding: "12px 14px", borderRadius: 12,
    background: "var(--cream-dim)", borderInlineStart: "3px solid var(--rose-soft)",
  },
  linkItemHigh: { background: "var(--warn-bg)", borderInlineStart: "3px solid var(--urgent)" },
  highTag: {
    marginInlineStart: 8, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--warn-ink)",
  },
  reasonList: {
    fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 18, marginTop: 6, marginBottom: 0,
  },
  reasonText: { fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 6, marginBottom: 0 },
  questionList: { fontSize: 14, color: "var(--ink)", lineHeight: 1.8, paddingInlineStart: 20, marginTop: 10 },
  alertCard: { background: "var(--emergency-bg)", border: "1px solid var(--emergency-border)" },
  alertLine: { fontSize: 13.5, color: "var(--emergency-ink)", lineHeight: 1.7, marginTop: 10 },
  alertFoot: { fontSize: 12.5, color: "var(--emergency-ink)", marginTop: 12, fontWeight: 600, lineHeight: 1.6 },
  disclaimer: {
    fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.7,
    marginTop: 18, padding: "12px 14px", borderRadius: 12, border: "1px dashed var(--border)",
  },
};

import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import ScriptField from "../components/ScriptField.jsx";
import { useReport } from "../context/ReportContext.jsx";
import { readPrescription, disposeOcr, ocrStatus } from "../ocr.js";

const PHASE_LABEL = {
  preparing: "Preparing the photo on this device",
  uploading: "Sending to the reading service",
  loading: "Loading the on-device model (first scan only)",
  reading: "Reading the text on this device",
};

/**
 * Prescription reader.
 *
 * OCR runs in this browser tab, not on a server. The photograph of someone's
 * prescription — which carries their name, their doctor, and their diagnosis —
 * never leaves the device. Only the extracted text is posted for analysis, and
 * the user is told that plainly before they upload anything.
 *
 * The engine, the model and every speed decision live in ../ocr.js; the short
 * version is that the previous code handed a 12-megapixel JPEG straight to
 * Tesseract inside a worker it rebuilt on every scan. See that file's header.
 */
export default function PrescriptionScan() {
  const [imageUrl, setImageUrl] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [phase, setPhase] = useState(null);
  const [stage, setStage] = useState("idle"); // idle | ocr | done | error
  const [error, setError] = useState(null);
  const [timing, setTiming] = useState(null);

  const [familyOptions, setFamilyOptions] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [pregnant, setPregnant] = useState(false);

  const [result, setResult] = useState(null);
  const [analysing, setAnalysing] = useState(false);

  // Which engine the server can offer, and the user's choice to override it.
  // Fetched before the file picker is used, because it determines what we have
  // to tell them about where their photograph goes.
  const [engine, setEngine] = useState(null);
  const [forceOnDevice, setForceOnDevice] = useState(false);
  const [reading, setReading] = useState(null);

  const objectUrlRef = useRef(null);
  const { recordPrescription } = useReport();

  useEffect(() => {
    api.prescriptionFamilyOptions().then(setFamilyOptions).catch(() => {});
    ocrStatus().then(setEngine).catch(() => {});
    return () => {
      // Revoke the blob URL so the image is not left resident, and free the
      // WASM core and the ~2 MB model along with it.
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      disposeOcr();
    };
  }, []);

  const usingCloud = Boolean(engine?.configured) && !forceOnDevice;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResult(null);
    setOcrText("");
    setTiming(null);
    setStage("ocr");
    setPhase("preparing");
    setProgress(0);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImageUrl(objectUrlRef.current);

    try {
      const res = await readPrescription(
        file,
        (nextPhase, ratio) => {
          setPhase(nextPhase);
          setProgress(Math.round((ratio ?? 0) * 100));
        },
        { forceOnDevice }
      );

      setOcrText(res.text);
      setReading(res);
      setTiming({ ms: res.ms, confidence: res.confidence, ...res.prepared });
      setStage("done");
      if (!res.text || res.text.trim().length < 10) {
        setError("Very little text was readable. Try a straighter, brighter photo — or type the medicine names in yourself below.");
        setEditing(true);
      }
    } catch {
      setError("Couldn't read the image. You can type the medicine names in below instead.");
      setStage("error");
      setEditing(true);
    } finally {
      setProgress(null);
      setPhase(null);
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
      recordPrescription({
        medicines: res.medicines.map((m) => ({ label: m.label, matchedOn: m.matchedOn[0] })),
        conditions: res.conditions.map((c) => c.label),
        interlinked: res.interlinked.map((i) => ({ label: i.label, why: i.reasons[0]?.why })),
        familyRisks: res.familyRisks.map((f) => ({
          label: f.label, priority: f.priority, advice: f.advice,
        })),
        pregnancyNotes: res.pregnancyNotes,
        questionsForDoctor: res.questionsForDoctor,
        isPregnantOrPossible: pregnant,
        // The report names the engine, because "OCR read this" means something
        // different depending on which one ran.
        engine: reading?.engine?.model || "unknown",
        structured: reading?.medicines?.length ? reading.medicines : null,
      });
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

      {/* The disclosure has to match what actually happens, and what happens now
          depends on how the server is configured. Saying "stays on your phone"
          while uploading the image would be the single worst thing this page
          could do — so the copy is driven by the live engine status, and it is
          placed above the file picker, not below the result. */}
      <div style={{ ...styles.privacyNote, ...(usingCloud ? styles.privacyNoteCloud : null) }}>
        <Icon
          name={usingCloud ? "info" : "lock"}
          size={16}
          style={{ float: "inline-start", marginInlineEnd: 8, marginTop: 2 }}
        />
        {usingCloud ? (
          <>
            <strong>Your photo is sent to be read.</strong> To read handwriting
            accurately the image goes to {engine?.engine || "a reading service"}, is
            read there, and is not stored by Sakhi. A prescription shows your name and
            your diagnosis — if you would rather it never left this phone, switch to
            on-device reading below. That is private and works offline, but it is much
            worse at handwriting.
          </>
        ) : (
          <>
            <strong>The photo stays on this phone.</strong> The text is read here in
            your browser; only the words — never the image — are sent for analysis, and
            nothing is saved. Close the tab and it is gone.
          </>
        )}
      </div>

      {engine?.configured && (
        <label style={styles.engineToggle}>
          <input
            type="checkbox"
            checked={forceOnDevice}
            onChange={(e) => setForceOnDevice(e.target.checked)}
          />
          <span>
            Read on this device only — never upload my photo
            <span style={styles.engineToggleHint}>
              Uses {engine.fallback?.engine || "Tesseract"}. Private and offline, but it
              often misreads handwritten prescriptions.
            </span>
          </span>
        </label>
      )}

      {/* Not configured. This has to be loud.
          Tesseract cannot read a handwritten prescription reliably — that is a
          property of the model, not of the photo — so silently falling back to
          it produces confidently wrong drug names while the page looks like it
          is working. Someone then blames their handwriting and retakes the
          photo ten times. Say what is actually wrong and how to fix it. */}
      {engine && !engine.configured && (
        <div style={styles.notConfigured}>
          <Icon name="alert" size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Accurate reading is switched off on this server.</strong>
            <p style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
              No reading-service key is configured, so this falls back to the on-device
              engine. That engine reads <em>printed</em> text reasonably and
              <strong> handwriting badly</strong> — expect wrong drug names, and check
              every line against the paper. This is the most likely reason a scan comes
              back looking like nonsense.
            </p>
            <details style={{ marginTop: 9 }}>
              <summary style={styles.engineSummary}>How to turn it on</summary>
              <p style={{ fontSize: 12.5, lineHeight: 1.75, marginTop: 7, color: "var(--ink-soft)" }}>
                Get a key at <strong>aistudio.google.com/apikey</strong>, put it in{" "}
                <code>server/.env</code> as <code>GEMINI_API_KEY=your-key</code>, and
                restart the server. See <code>server/.env.example</code>. Note that this
                sends the photo to Google — the notice above changes to say so.
              </p>
            </details>
          </div>
        </div>
      )}

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
            <Icon name="camera" size={18} /> Take or choose a photo
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
              {PHASE_LABEL[phase] || "Working"}
              {progress != null ? ` — ${progress}%` : "…"}
            </p>
          </div>
        )}

        {timing && (
          <p style={styles.timing}>
            <Icon name="check" size={14} style={{ color: "var(--success-ink)" }} />
            Read in {(timing.ms / 1000).toFixed(1)}s
            {timing.confidence != null && ` · confidence ${Math.round(timing.confidence * 100)}%`}
            {reading && ` · ${reading.onDevice ? "read on this device" : "read by " + (reading.engine?.engine || "the reading service")}`}
          </p>
        )}

        {/* A silent downgrade to the weaker engine would be the worst outcome
            here: the person would blame their handwriting for a network fault
            and keep retaking the photo. */}
        {reading?.degradedFrom && (
          <p style={styles.degraded}>
            <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              The reading service could not be reached, so this was read on your device
              instead — which is much worse at handwriting. Check the text carefully, or
              try again when you have signal. ({reading.degradedFrom})
            </span>
          </p>
        )}

        {error && <p style={styles.error}>{error}</p>}

        {/* Which model, said plainly. A tool that reads a medical document and
            will not say what read it is asking for trust it has not earned. */}
        <details style={styles.engineBox}>
          <summary style={styles.engineSummary}>
            <Icon name="info" size={14} /> Which model reads this
          </summary>
          <div className="data-list" style={{ marginTop: 8 }}>
            <div className="data-row">
              <span className="data-key">Engine</span>
              <span className="data-value">{reading?.engine?.engine || engine?.engine || "—"}</span>
            </div>
            <div className="data-row">
              <span className="data-key">Model</span>
              <span className="data-value">{reading?.engine?.model || engine?.model || "—"}</span>
            </div>
            <div className="data-row">
              <span className="data-key">Configuration</span>
              <span className="data-value">{reading?.engine?.mode || engine?.mode || "—"}</span>
            </div>
            <div className="data-row">
              <span className="data-key">Where it runs</span>
              <span className="data-value">{reading?.engine?.where || engine?.where || "—"}</span>
            </div>
            {engine?.configured && (
              <div className="data-row">
                <span className="data-key">Offline fallback</span>
                <span className="data-value">{engine.fallback?.engine} — {engine.fallback?.model}</span>
              </div>
            )}
          </div>
          <p style={styles.engineNote}>
            Tesseract reads rendered text well and handwriting badly — drug names are
            out-of-vocabulary proper nouns, and its language model pulls an unfamiliar
            string toward a familiar English word, so "Ranitidine" comes back
            "Rantidine". Dosage notation like <code>1-0-1</code> or <code>T.D.S.</code>{" "}
            means nothing to it. A vision model reads the page knowing it is a
            prescription, which is why it is the default when a key is configured.
          </p>
        </details>
      </div>

      {/* Structured output. Only the vision model returns this; Tesseract gives
          a flat string, and inventing rows from it would misrepresent where the
          reading came from. */}
      {reading?.medicines?.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="section-eyebrow">
            <Icon name="pill" size={13} /> What was read
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "8px 0 14px", lineHeight: 1.6 }}>
            Check every line against the paper before relying on it. Anything marked
            unclear was not read confidently.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="doc-table" style={{ minWidth: 460 }}>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Strength</th>
                  <th>How often</th>
                  <th>For how long</th>
                </tr>
              </thead>
              <tbody>
                {reading.medicines.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>
                      {m.name || "—"}
                      {m.form && <span style={styles.formTag}>{m.form}</span>}
                      {!m.legible && <span style={styles.unclearTag}>unclear</span>}
                    </td>
                    <td>{m.strength || "—"}</td>
                    <td>{m.frequency || "—"}</td>
                    <td>{m.duration || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reading.quality && (
            <p style={styles.engineNote}>
              Image quality judged <strong>{reading.quality}</strong>
              {reading.handwritten ? ", handwritten" : ", printed"}
              {reading.notes ? ` — ${reading.notes}` : "."}
            </p>
          )}
        </div>
      )}

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
            // Latin, not the app language: a drug name is printed in Latin
            // letters on the strip in her hand, and transliterating "Ferrous"
            // into Devanagari would stop the server matching it.
            <ScriptField
              as="textarea"
              value={ocrText}
              onValueChange={setOcrText}
              keyboard="latin"
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
                  {on && <Icon name="check" size={13} />}
                  {o.label}
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Link to="/report" className="btn btn-primary btn-sm">
            <Icon name="report" size={15} /> Put this in my health report
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Icon name="printer" size={15} /> Print these questions
          </button>
        </div>
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
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-soft)",
  },
  timing: {
    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
    fontSize: 12, color: "var(--ink-soft)", marginTop: 12, lineHeight: 1.6,
  },
  engineBox: {
    marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12,
  },
  engineSummary: {
    display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
    fontSize: 12.5, fontWeight: 600, color: "var(--rose-deep)",
  },
  engineNote: {
    fontSize: 11.5, color: "var(--ink-muted)", lineHeight: 1.7, marginTop: 10,
  },
  notConfigured: {
    display: "flex", gap: 11, marginTop: 12, padding: "13px 15px",
    borderRadius: 11, background: "var(--emergency-bg)",
    border: "1px solid var(--emergency-border)", color: "var(--emergency-ink)",
    fontSize: 13.5, lineHeight: 1.6,
  },
  privacyNoteCloud: {
    background: "var(--warn-bg, var(--cream-dim))",
    borderColor: "var(--warn-border, var(--border))",
  },
  engineToggle: {
    display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10,
    padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 10,
    background: "var(--surface)", fontSize: 13.5, cursor: "pointer", lineHeight: 1.5,
  },
  engineToggleHint: {
    display: "block", fontSize: 12, color: "var(--ink-muted)", marginTop: 3, lineHeight: 1.6,
  },
  degraded: {
    display: "flex", gap: 8, marginTop: 12, padding: "10px 12px",
    borderRadius: 9, background: "var(--emergency-bg)", color: "var(--emergency-ink)",
    fontSize: 12.5, lineHeight: 1.6,
  },
  formTag: {
    marginInlineStart: 7, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.04em", color: "var(--ink-muted)",
  },
  unclearTag: {
    marginInlineStart: 7, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.04em", color: "var(--emergency)",
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

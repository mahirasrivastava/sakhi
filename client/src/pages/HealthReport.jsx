import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useReport } from "../context/ReportContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "../components/Icon.jsx";
import { schemesFor, SOURCE_DOCUMENTS } from "../schemes.js";
import { HELPLINES } from "../helplines.js";

/**
 * The individual health report.
 *
 * This is the artefact a woman carries out of the app. Everything else here is
 * a screen she looks at once; this is a page she prints, folds, and hands to
 * somebody at a Primary Health Centre who has four minutes and has never heard
 * of Sakhi.
 *
 * That reader is the whole design brief, and it forces three decisions:
 *
 *  1. It is typeset as a DOCUMENT, not as an app screen. Reference number,
 *     issue timestamp, numbered clauses, a fixed measure, ruled tables, and a
 *     signature block at the foot. A clinician skims for structure; a stack of
 *     rounded cards has none.
 *  2. It states its own limits IN the document, not in a tooltip. Section 1
 *     says in as many words that nothing here is a diagnosis and that the
 *     anaemia screen is an uncalibrated heuristic. A report that oversells
 *     itself to a clinician is worse than no report, because it wastes the four
 *     minutes.
 *  3. It carries ENTITLEMENTS. This is the part that is genuinely worth
 *     printing. "Get a haemoglobin test" is advice she probably already had.
 *     "Under Anemia Mukt Bharat this test and the tablets are free at your
 *     sub-centre, ask the ANM" is a thing she can act on, and it cites the
 *     ministry that owes it to her.
 *
 * Nothing on this page is fetched. It renders from ReportContext, which lives
 * in sessionStorage and never leaves the device — see that file for why.
 */
export default function HealthReport() {
  const { report, hasContent, clearReport } = useReport();
  const { meta } = useLanguage();

  const issued = useMemo(() => new Date(), []);

  // The facts that decide which entitlements print. Broad on purpose: an
  // entitlement wrongly shown costs ten seconds of reading, an entitlement
  // wrongly hidden costs her the entitlement.
  const facts = useMemo(() => {
    const f = new Set();
    const { triage, anaemia, prescription, cycle } = report;

    if (anaemia?.testNeeded) f.add("anaemia_flagged");
    if (anaemia?.symptomLabels?.length) f.add("anaemia_symptoms");
    if (anaemia?.riskLabels?.some((l) => /pregnan/i.test(l))) f.add("pregnancy");
    if (anaemia?.riskLabels?.some((l) => /under 20/i.test(l))) f.add("adolescent");

    if (triage?.isPregnantOrPossible) f.add("pregnancy");
    if (triage?.session?.triage?.level === "emergency") f.add("emergency");
    if (triage?.session?.triage?.level === "urgent") f.add("urgent");
    if (["emergency", "urgent"].includes(triage?.session?.triage?.level)) f.add("hospital_referral");
    if (triage?.session?.intake?.safetyFlag) f.add("safety_flag");

    if (prescription?.isPregnantOrPossible) f.add("pregnancy");
    if (prescription?.conditions?.some((c) => /anaemia|anemia/i.test(c))) f.add("anaemia_flagged");
    if (prescription?.conditions?.some((c) => /mental|depress|anxiet/i.test(c))) f.add("mental_health");
    if (prescription?.interlinked?.some((i) => /mental|depress|anxiet/i.test(i.label))) f.add("mental_health");

    if (cycle) f.add("menstrual");

    return [...f];
  }, [report]);

  const schemes = useMemo(() => schemesFor(facts), [facts]);

  if (!hasContent) return <EmptyReport />;

  // Numbered as the document renders, so the clause numbers stay contiguous
  // when a section is absent — a report that jumps from 3 to 5 reads as one
  // with a page missing.
  let clause = 0;
  const next = () => ++clause;

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <ReportToolbar onClear={clearReport} />

      <article className="doc">
        <header className="doc-masthead">
          <span className="doc-emblem" aria-hidden="true">स</span>
          <div className="doc-masthead-text">
            <div className="doc-issuer">Sakhi · Community Health Screening Tool</div>
            <h1 className="doc-title">Personal Health Screening Record</h1>
            <p className="doc-subtitle">
              A self-administered screening summary, prepared for presentation to an
              ASHA worker, ANM, Community Health Officer or Medical Officer.
            </p>
          </div>
          <div className="doc-refblock">
            <span>Reference</span>
            <strong>{report.reference}</strong>
            <span>Issued</span>
            <strong>{issued.toLocaleDateString()} {issued.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
            <span>Language</span>
            <strong>{meta.english}</strong>
          </div>
        </header>

        <div className="doc-body">
          <Clause n={next()} title="Status of this document">
            <p className="doc-text">
              This record was generated by software from answers and images supplied by
              the person named nowhere in it. <strong>It is not a diagnosis, not a
              prescription, and not a laboratory result.</strong> It records what a
              screening tool observed, on what basis, and what it therefore recommends.
              Every finding below requires confirmation by a qualified clinician.
            </p>
            <p className="doc-text">
              No identifying information is held. The reference number above is a random
              string issued at the time of screening and is not derived from any personal
              detail. It exists so that this sheet can be cited in a paper register.
            </p>
            <div className="doc-callout">
              <strong>For the clinician:</strong> the anaemia screen in section{" "}
              {report.anaemia ? "3" : "—"} is an uncalibrated colour heuristic run on a
              consumer phone camera. It has not been validated against paired haemoglobin
              results in this population. It is tuned to over-refer. Please treat a
              positive as a prompt to test, not as evidence of anaemia, and a negative as
              carrying no weight against clinical judgement.
            </div>
          </Clause>

          <Clause n={next()} title="Screening undertaken">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Completed</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                <ModuleRow
                  name="Symptom triage"
                  entry={report.triage}
                  outcome={report.triage && `Urgency: ${report.triage.session?.triage?.level ?? "—"}`}
                />
                <ModuleRow
                  name="Conjunctival pallor screen"
                  entry={report.anaemia}
                  outcome={report.anaemia?.headline}
                />
                <ModuleRow
                  name="Prescription reading"
                  entry={report.prescription}
                  outcome={
                    report.prescription &&
                    `${report.prescription.medicines?.length ?? 0} medicine(s) recognised`
                  }
                />
                <ModuleRow
                  name="Cycle / pregnancy log"
                  entry={report.cycle}
                  outcome={report.cycle && `Week ${report.cycle.week}`}
                />
              </tbody>
            </table>
          </Clause>

          {report.anaemia && <AnaemiaClause n={next()} a={report.anaemia} />}
          {report.triage && <TriageClause n={next()} t={report.triage} />}
          {report.prescription && <PrescriptionClause n={next()} p={report.prescription} />}
          {report.cycle && <CycleClause n={next()} c={report.cycle} />}

          <Clause n={next()} title="Recommended next steps">
            <ol className="doc-text" style={{ paddingInlineStart: 22, lineHeight: 1.9 }}>
              {buildActions(report).map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </Clause>

          <Clause
            n={next()}
            title="Entitlements and schemes that apply"
            lead="These are government programmes under which the steps above are provided free of charge. The person presenting this document is not required to produce a referral for any of them."
          >
            {schemes.map((s) => (
              <div key={s.id} className="doc-scheme">
                <div className="doc-scheme-name">{s.name}</div>
                <div className="doc-scheme-org">{s.ministry} · {s.programme}</div>
                <div className="doc-scheme-field">
                  <span className="doc-scheme-label">Provides</span>
                  <span className="doc-scheme-value">{s.what}</span>
                </div>
                <div className="doc-scheme-field">
                  <span className="doc-scheme-label">Who is eligible</span>
                  <span className="doc-scheme-value">{s.eligibility}</span>
                </div>
                <div className="doc-scheme-field">
                  <span className="doc-scheme-label">What to ask for</span>
                  <span className="doc-scheme-value">{s.ask}</span>
                </div>
              </div>
            ))}
          </Clause>

          <Clause n={next()} title="Helplines">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Service</th>
                  <th>Operated by</th>
                </tr>
              </thead>
              <tbody>
                {REPORT_HELPLINES.map((num) => {
                  const h = HELPLINES.find((x) => x.number === num);
                  if (!h) return null;
                  return (
                    <tr key={h.number}>
                      <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {h.number}
                      </td>
                      <td>{h.label}</td>
                      <td style={{ color: "var(--ink-soft)" }}>{h.authority}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="doc-note">All numbers are toll-free. 112 connects with no balance and no SIM.</p>
          </Clause>

          <Clause
            n={next()}
            title="Basis and sources"
            lead="The guidance in this document is drawn from the following. Where a recommendation departs from them it is marked as a screening heuristic."
          >
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Issued by</th>
                  <th>Used for</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_DOCUMENTS.map((d) => (
                  <tr key={d.title}>
                    <td>{d.title}</td>
                    <td style={{ color: "var(--ink-soft)" }}>{d.body}</td>
                    <td style={{ color: "var(--ink-soft)" }}>{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Clause>

          <Clause n={next()} title="Verification">
            <p className="doc-text">
              To be completed by the health worker who reviews this record. Sakhi does not
              countersign anything and has no authority to; this block exists so that the
              sheet can be filed as evidence that a review took place.
            </p>
            <div className="doc-signblock">
              <div className="doc-signbox">
                <div className="doc-signbox-label">Name and designation of reviewing health worker</div>
              </div>
              <div className="doc-signbox">
                <div className="doc-signbox-label">Facility / sub-centre and district</div>
              </div>
              <div className="doc-signbox">
                <div className="doc-signbox-label">Date of review</div>
              </div>
              <div className="doc-signbox">
                <div className="doc-signbox-label">Signature</div>
              </div>
            </div>
          </Clause>
        </div>

        <footer className="doc-foot">
          <p style={{ margin: 0 }}>
            <strong>Sakhi</strong> is a student project built for the SkillUp Hackathon with
            IBM SkillsBuild. It is <strong>not</strong> an official Government of India
            service, is not affiliated with any ministry, and issues no official document.
            Scheme names and ministries are cited so that entitlements can be verified at
            source; scheme terms are set by the issuing ministry and may change.
          </p>
          <p style={{ margin: "8px 0 0" }}>
            Record {report.reference} · generated on this device · never transmitted ·
            erased when this browser tab is closed.
          </p>
        </footer>
      </article>
    </div>
  );
}

const REPORT_HELPLINES = ["112", "108", "102", "104", "181", "1098", "14416", "14555"];

function Clause({ n, title, lead, children }) {
  return (
    <section className="doc-section">
      <div className="doc-section-head">
        <span className="doc-section-num">{String(n).padStart(2, "0")}</span>
        <h2 className="doc-section-title">{title}</h2>
      </div>
      {lead && <p className="doc-text">{lead}</p>}
      {children}
    </section>
  );
}

function ModuleRow({ name, entry, outcome }) {
  return (
    <tr>
      <td className="doc-cell-key">{name}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        {entry ? new Date(entry.recordedAt).toLocaleString() : "Not completed"}
      </td>
      <td>{entry ? outcome || "Recorded" : "—"}</td>
    </tr>
  );
}

function AnaemiaClause({ n, a }) {
  return (
    <Clause n={n} title="Anaemia screening — conjunctival pallor">
      <div className={`doc-callout${a.testNeeded ? " doc-callout-urgent" : ""}`}>
        <strong>Screening conclusion: {a.headline}.</strong> {a.summary}
      </div>

      <table className="doc-table">
        <tbody>
          <tr>
            <td className="doc-cell-key">Method</td>
            <td>
              Conjunctival colour analysis of {a.framesAnalysed} camera frames
              ({a.framesUsed} passed the quality gate), illuminant-corrected, combined with
              a reported-symptom checklist.
            </td>
          </tr>
          <tr>
            <td className="doc-cell-key">Pallor score</td>
            <td>{a.pallorScore} of 1.00 (band: {a.band})</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Reading confidence</td>
            <td>{Math.round(a.confidence * 100)}%</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Symptoms reported</td>
            <td>{a.symptomLabels?.length ? a.symptomLabels.join("; ") : "None reported"}</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Other factors reported</td>
            <td>{a.riskLabels?.length ? a.riskLabels.join("; ") : "None reported"}</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Calibration status</td>
            <td>
              Uncalibrated heuristic. Thresholds are literature-informed priors, not fitted
              against paired haemoglobin results in this population.
            </td>
          </tr>
        </tbody>
      </table>

      {a.reasons?.length > 0 && (
        <>
          <p className="doc-note" style={{ fontWeight: 700, marginTop: 14 }}>Basis for this conclusion</p>
          <ul className="doc-text" style={{ paddingInlineStart: 22 }}>
            {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </>
      )}

      <p className="doc-note">
        Confirmatory test indicated: haemoglobin estimation (WHO cut-offs — 12.0 g/dL
        non-pregnant women, 11.0 g/dL pregnant women). Free under Anemia Mukt Bharat.
      </p>
    </Clause>
  );
}

function TriageClause({ n, t }) {
  const s = t.session || {};
  const triage = s.triage || {};
  const routing = s.routing || {};

  return (
    <Clause n={n} title="Symptom triage">
      <div className={`doc-callout${triage.level === "emergency" ? " doc-callout-urgent" : ""}`}>
        <strong>Urgency assessed as: {triage.level}.</strong> {triage.modelReason}
      </div>

      <table className="doc-table">
        <tbody>
          <tr>
            <td className="doc-cell-key">Reported symptoms</td>
            <td>{t.symptomLabels?.length ? t.symptomLabels.join("; ") : "None selected"}</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Duration</td>
            <td>{t.durationDays} day(s)</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Reported severity</td>
            <td>{t.severity} of 5</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Pregnant or possibly pregnant</td>
            <td>{t.isPregnantOrPossible ? "Yes, or possibly" : "No"}</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Red-flag rules fired</td>
            <td>
              {triage.firedRules?.length
                ? triage.firedRules.map((r) => `${r.id} — ${r.description}`).join("; ")
                : "None"}
            </td>
          </tr>
          <tr>
            <td className="doc-cell-key">Assessment confidence</td>
            <td>{Math.round((triage.confidence ?? 0) * 100)}%</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Routing action</td>
            <td>{routing.action || "—"}</td>
          </tr>
        </tbody>
      </table>

      {routing.instructions?.length > 0 && (
        <>
          <p className="doc-note" style={{ fontWeight: 700, marginTop: 14 }}>Instructions issued</p>
          <ul className="doc-text" style={{ paddingInlineStart: 22 }}>
            {routing.instructions.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </>
      )}

      <p className="doc-note">
        Triage assigns urgency only. No differential diagnosis was generated or is implied.
      </p>
    </Clause>
  );
}

function PrescriptionClause({ n, p }) {
  return (
    <Clause n={n} title="Current medication — as read from a prescription">
      <p className="doc-text">
        The following was read from a photograph by on-device optical character
        recognition ({p.engine}). <strong>OCR of a handwritten prescription is
        unreliable</strong> and the list below must be checked against the physical
        prescription or the medicine strips before it is relied upon.
      </p>

      <table className="doc-table">
        <thead>
          <tr>
            <th>Medicine recognised</th>
            <th>Read as</th>
          </tr>
        </thead>
        <tbody>
          {p.medicines?.length ? p.medicines.map((m) => (
            <tr key={m.label}>
              <td>{m.label}</td>
              <td style={{ fontFamily: "ui-monospace, monospace", color: "var(--ink-soft)" }}>
                “{m.matchedOn}”
              </td>
            </tr>
          )) : (
            <tr><td colSpan={2}>No medicine names were recognised.</td></tr>
          )}
        </tbody>
      </table>

      {p.conditions?.length > 0 && (
        <p className="doc-text" style={{ marginTop: 12 }}>
          <strong>Conditions implied by this medication:</strong> {p.conditions.join("; ")}.
        </p>
      )}

      {p.pregnancyNotes?.length > 0 && (
        <div className="doc-callout doc-callout-urgent">
          <strong>Pregnancy cautions flagged.</strong>{" "}
          {p.pregnancyNotes.map((note) => `${note.medicine}: ${note.warning}`).join(" ")}
          {" "}Nothing was stopped or changed on this advice — for several of these,
          stopping abruptly carries more risk than continuing to review.
        </div>
      )}

      {p.interlinked?.length > 0 && (
        <>
          <p className="doc-note" style={{ fontWeight: 700, marginTop: 14 }}>
            Associated conditions not currently addressed on this prescription
          </p>
          <ul className="doc-text" style={{ paddingInlineStart: 22 }}>
            {p.interlinked.map((i) => <li key={i.label}><strong>{i.label}</strong> — {i.why}</li>)}
          </ul>
        </>
      )}

      {p.familyRisks?.length > 0 && (
        <>
          <p className="doc-note" style={{ fontWeight: 700, marginTop: 14 }}>Family history declared</p>
          <ul className="doc-text" style={{ paddingInlineStart: 22 }}>
            {p.familyRisks.map((f) => (
              <li key={f.label}>
                <strong>{f.label}</strong>
                {f.priority === "high" && " (overlaps current treatment)"} — {f.advice}
              </li>
            ))}
          </ul>
        </>
      )}

      {p.questionsForDoctor?.length > 0 && (
        <>
          <p className="doc-note" style={{ fontWeight: 700, marginTop: 14 }}>
            Questions the patient wishes to raise
          </p>
          <ol className="doc-text" style={{ paddingInlineStart: 22 }}>
            {p.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </>
      )}
    </Clause>
  );
}

function CycleClause({ n, c }) {
  return (
    <Clause n={n} title="Cycle and pregnancy log">
      <table className="doc-table">
        <tbody>
          <tr>
            <td className="doc-cell-key">Week recorded</td>
            <td>{c.week}</td>
          </tr>
          <tr>
            <td className="doc-cell-key">Danger signs reported</td>
            <td>{c.dangerSignLabels?.length ? c.dangerSignLabels.join("; ") : "None"}</td>
          </tr>
        </tbody>
      </table>
      {c.dangerSignLabels?.length > 0 && (
        <div className="doc-callout doc-callout-urgent">
          Obstetric danger signs were reported. These require same-day assessment at a
          facility with obstetric capability, per the Ministry of Health and Family
          Welfare's antenatal care guidelines.
        </div>
      )}
    </Clause>
  );
}

/**
 * The action list.
 *
 * Ordered by clinical urgency, not by the order the person happened to use the
 * app in — an emergency triage result must not print below a prescription note.
 */
function buildActions(report) {
  const actions = [];
  const level = report.triage?.session?.triage?.level;

  if (level === "emergency") {
    actions.push(
      "IMMEDIATE: the triage assessment returned an emergency-level result. Attend a facility now, or call 108 (ambulance) or 102 (pregnancy transport). Do not wait for the other steps below."
    );
  } else if (level === "urgent") {
    actions.push(
      "Attend a Primary Health Centre or Health and Wellness Centre within 24 hours for the symptoms recorded in this document."
    );
  }

  if (report.anaemia?.testNeeded) {
    actions.push(
      "Request a haemoglobin estimation from the ASHA worker, ANM or sub-centre. It is free under Anemia Mukt Bharat and no referral is required."
    );
  }

  if (report.triage?.isPregnantOrPossible || report.prescription?.isPregnantOrPossible) {
    actions.push(
      "Register or confirm the pregnancy with the ASHA worker, obtain the Mother and Child Protection (MCP) card, and attend the free antenatal check-up held on the 9th of each month under PMSMA."
    );
  }

  if (report.prescription?.medicines?.length) {
    actions.push(
      "Take this document and the physical prescription to the next consultation so the medication list can be verified. Do not start, stop or change any medicine on the basis of this document."
    );
  }

  if (report.cycle?.dangerSignLabels?.length) {
    actions.push(
      "Obstetric danger signs were logged — attend a facility with obstetric capability the same day."
    );
  }

  actions.push(
    "Retain this record and present it at the next visit. It is not a substitute for the MCP card or any facility register."
  );

  return actions;
}

function ReportToolbar({ onClear }) {
  return (
    <div className="no-print" style={toolbar.wrap}>
      <div>
        <span className="section-eyebrow">
          <Icon name="report" size={13} /> Your record
        </span>
        <p style={toolbar.note}>
          Print this or save it as a PDF and take it with you. It is held only in this
          browser tab and is erased when the tab closes.
        </p>
      </div>
      <div style={toolbar.actions}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="printer" size={17} /> Print / save as PDF
        </button>
        <button className="btn btn-ghost" onClick={onClear}>
          <Icon name="close" size={16} /> Erase this record
        </button>
      </div>
    </div>
  );
}

function EmptyReport() {
  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 720 }}>
      <span className="section-eyebrow">
        <Icon name="report" size={13} /> Health report
      </span>
      <h1 className="display section-title">Nothing to report yet</h1>
      <p className="section-sub">
        Use any of the tools below and the findings are collected here as one printable
        record — with the government schemes that cover whatever it recommends, and a
        signature block for the health worker who reviews it.
      </p>
      <div className="section-rule" />

      <div className="tile-grid" style={{ marginTop: 26 }}>
        <Link to="/triage" className="tile tile-primary">
          <span className="tile-mark"><Icon name="triage" size={24} /></span>
          <span className="tile-title">Symptom triage</span>
          <span className="tile-desc">Adds an urgency assessment with the rules that fired.</span>
          <span className="tile-go">Start <Icon name="arrowRight" size={14} /></span>
        </Link>
        <Link to="/anaemia" className="tile">
          <span className="tile-mark"><Icon name="eye" size={24} /></span>
          <span className="tile-title">Anaemia screen</span>
          <span className="tile-desc">Adds a yes/no on a blood test, with the basis for it.</span>
          <span className="tile-go">Start <Icon name="arrowRight" size={14} /></span>
        </Link>
        <Link to="/prescription" className="tile">
          <span className="tile-mark"><Icon name="document" size={24} /></span>
          <span className="tile-title">Prescription reader</span>
          <span className="tile-desc">Adds your medication list and questions for the doctor.</span>
          <span className="tile-go">Start <Icon name="arrowRight" size={14} /></span>
        </Link>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 24, lineHeight: 1.7 }}>
        Nothing in the report is sent anywhere. It is built on this device, held only for
        as long as this tab is open, and can be erased at any time.
      </p>
    </div>
  );
}

const toolbar = {
  wrap: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    gap: 18, flexWrap: "wrap", marginBottom: 20,
    maxWidth: 860, marginInline: "auto",
  },
  note: { fontSize: 13.5, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.6, maxWidth: 460 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
};

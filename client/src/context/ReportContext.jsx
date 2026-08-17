import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * The health report store.
 *
 * Sakhi has five tools that each produce a real finding — a triage level, a
 * pallor verdict, a prescription reading, a cycle log, a location code — and
 * until now every one of them ended at a card that disappeared when the tab
 * closed. That is the wrong end state for this user. A woman who walks to a PHC
 * gets four minutes with a clinician, and "an app said I should get a blood
 * test" is not something a clinician can act on. One printed page that says
 * what was screened, when, on what basis, and which entitlement covers the next
 * step, is.
 *
 * PRIVACY — the reason this is sessionStorage and not the server
 * -------------------------------------------------------------------------
 * Everything here stays in this tab. sessionStorage, not localStorage: a shared
 * handset is the normal case, not the edge case, and a report about a
 * pregnancy scare must not still be sitting in the browser when the phone goes
 * back to whoever owns it. Closing the tab is a delete, and `clearReport()` is
 * offered as an explicit one.
 *
 * Nothing here is ever posted. The server already stores triage sessions under
 * an anonymous id for the ASHA queue; this store is the patient's own copy and
 * has no reason to leave the device.
 */

const ReportContext = createContext(null);

const STORE_KEY = "sakhi_report";

const EMPTY = {
  reference: null,
  startedAt: null,
  triage: null,
  anaemia: null,
  prescription: null,
  cycle: null,
  location: null,
};

/**
 * A human-readable reference for the document.
 *
 * Deliberately NOT derived from anything about the person — no device id, no
 * hash of her answers. It is the date plus four random characters, which is
 * enough for a clinician to say "the report from the 14th, ending 7K2P" and
 * carries no identity if the page is photographed or left open.
 */
function makeReference(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  // Ambiguous glyphs (0/O, 1/I) are excluded — this gets read aloud and copied
  // by hand onto a paper register.
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY2346789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `SKH/${stamp}/${tail}`;
}

function readStore() {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    // A corrupt store must not blank the app — an empty report is recoverable,
    // a crash on every page load is not.
    return EMPTY;
  }
}

export function ReportProvider({ children }) {
  const [report, setReport] = useState(readStore);

  useEffect(() => {
    try {
      // An untouched report is not worth persisting, and writing one would put
      // a reference number in storage for someone who never used a tool.
      if (!report.startedAt) sessionStorage.removeItem(STORE_KEY);
      else sessionStorage.setItem(STORE_KEY, JSON.stringify(report));
    } catch {
      // Private browsing with storage disabled. The report still works for the
      // life of this page, which is the case that matters.
    }
  }, [report]);

  /** Stamps the reference and start time on first use, then merges the section. */
  const put = useCallback((section, value) => {
    setReport((prev) => {
      const now = new Date();
      return {
        ...prev,
        reference: prev.reference || makeReference(now),
        startedAt: prev.startedAt || now.toISOString(),
        [section]: value ? { ...value, recordedAt: now.toISOString() } : null,
      };
    });
  }, []);

  const recordTriage = useCallback((v) => put("triage", v), [put]);
  const recordAnaemia = useCallback((v) => put("anaemia", v), [put]);
  const recordPrescription = useCallback((v) => put("prescription", v), [put]);
  const recordCycle = useCallback((v) => put("cycle", v), [put]);
  const recordLocation = useCallback((v) => put("location", v), [put]);

  const clearReport = useCallback(() => {
    setReport(EMPTY);
    try { sessionStorage.removeItem(STORE_KEY); } catch { /* see above */ }
  }, []);

  const sections = useMemo(
    () => ["triage", "anaemia", "prescription", "cycle", "location"].filter((k) => report[k]),
    [report]
  );

  const value = useMemo(() => ({
    report,
    sections,
    hasContent: sections.length > 0,
    recordTriage,
    recordAnaemia,
    recordPrescription,
    recordCycle,
    recordLocation,
    clearReport,
  }), [report, sections, recordTriage, recordAnaemia, recordPrescription, recordCycle, recordLocation, clearReport]);

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside ReportProvider");
  return ctx;
}

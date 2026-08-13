import React, { useEffect, useState } from "react";

const CONSENT_KEY = "sakhi_consent_given";

export default function ConsentGate({ children }) {
  const [consented, setConsented] = useState(true); // avoid flash before check
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setConsented(sessionStorage.getItem(CONSENT_KEY) === "true");
    setChecked(true);
  }, []);

  function accept() {
    sessionStorage.setItem(CONSENT_KEY, "true");
    setConsented(true);
  }

  if (!checked) return null;
  if (consented) return children;

  return (
    <div style={overlay}>
      <div className="card" style={modal}>
        <h3 className="display" style={{ fontSize: 20, color: "var(--rose-deep)" }}>Before you continue</h3>
        <ul style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.7, paddingLeft: 18, marginTop: 12 }}>
          <li>No name or account is required — nothing here is tied to your identity.</li>
          <li>Sakhi triages urgency and connects you to care. It never diagnoses or prescribes.</li>
          <li>If anything you share suggests abuse or self-harm, you'll be routed straight to a real person — never handled by the AI model.</li>
          <li>You can delete any session's data at any time from the dashboard.</li>
        </ul>
        <button className="btn btn-primary" onClick={accept} style={{ marginTop: 18 }}>
          I understand, continue
        </button>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, background: "var(--overlay)",
  zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};
const modal = { maxWidth: 440, width: "100%" };

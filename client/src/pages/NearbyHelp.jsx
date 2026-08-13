import React from "react";
import NearbyFacilities from "../components/NearbyFacilities.jsx";
import EmergencyLocator from "../components/EmergencyLocator.jsx";

export default function NearbyHelp() {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ maxWidth: 720 }}>
        <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15 }}>
          Find help nearby
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
          Call an ambulance and get a location code you can read out over the phone.
          This works even if the rest of Sakhi is down — it only needs your device's
          location and an internet connection.
        </p>
      </div>

      {/* The ambulance card gets the wide column: it is the reason someone opens
          this page in a hurry. The facility list is support, not the headline. */}
      <div className="split" style={{ marginTop: 26 }}>
        <div className="card" style={{ borderInlineStart: "4px solid var(--emergency)", padding: 26 }}>
          <EmergencyLocator />
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <h2 className="display" style={{ fontSize: 19, marginBottom: 12 }}>
              Hospitals and clinics near you
            </h2>
            <NearbyFacilities />
          </div>

          <div className="aside-card">
            <div className="aside-title">If you cannot get a signal</div>
            <ul style={styles.tips}>
              <li>Tell the dispatcher your <strong>village and panchayat name</strong> first.</li>
              <li>Then the nearest landmark — a temple, school, bus stop or PHC.</li>
              <li>Say which side of the road, and roughly how far from the landmark.</li>
              <li>Stay on the line. Do not hang up to call someone else.</li>
            </ul>
          </div>

          <div className="aside-card">
            <div className="aside-title">What a DIGIPIN is</div>
            <p style={styles.text}>
              A ten-character code from India Post that names a square about four metres
              across. It works anywhere in India, including places with no street address,
              and it is far easier to say correctly over a bad line than latitude and
              longitude.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  tips: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
  text: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 },
};

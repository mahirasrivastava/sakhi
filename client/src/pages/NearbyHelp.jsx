import React from "react";
import NearbyFacilities from "../components/NearbyFacilities.jsx";

export default function NearbyHelp() {
  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 640 }}>
      <h1 className="display" style={{ fontSize: 28 }}>Find help nearby</h1>
      <p style={{ color: "#6B5A5F", marginTop: 8 }}>
        Works with the backend down — this only needs your device's location and an internet connection.
        No triage check-in required.
      </p>

      <div className="card" style={{ marginTop: 22 }}>
        <NearbyFacilities />
      </div>
    </div>
  );
}

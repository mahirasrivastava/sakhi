import React, { useState } from "react";
import {
  getCurrentPosition,
  fetchNearbyFacilities,
  reverseGeocode,
  mapsSearchUrl,
  directionsUrl,
} from "../geo.js";

export default function NearbyFacilities({ compact = false }) {
  const [locStatus, setLocStatus] = useState("idle"); // idle | locating | error | done
  const [locError, setLocError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [areaName, setAreaName] = useState(null);

  const [listStatus, setListStatus] = useState("idle"); // idle | searching | done | error
  const [facilities, setFacilities] = useState([]);
  const [listError, setListError] = useState(null);

  async function findNearby() {
    setLocStatus("locating");
    setLocError(null);
    setFacilities([]);
    setListStatus("idle");
    setAreaName(null);

    let pos;
    try {
      pos = await getCurrentPosition();
      setCoords(pos);
      setLocStatus("done");
    } catch (err) {
      console.error("Location failed:", err);
      setLocError(err.message);
      setLocStatus("error");
      return;
    }

    // Area name is best-effort and shown as soon as it resolves — doesn't
    // block or get blocked by the hospital list below.
    reverseGeocode(pos.lat, pos.lon).then(setAreaName);

    setListStatus("searching");
    try {
      const results = await fetchNearbyFacilities(pos.lat, pos.lon);
      setFacilities(results);
      setListStatus("done");
    } catch (err) {
      console.error("Nearby facilities lookup failed:", err);
      setListError(err.message);
      setListStatus("error");
    }
  }

  return (
    <div style={{ marginTop: compact ? 14 : 24 }}>
      {!compact && (
        <>
          <h3 className="display" style={{ fontSize: 19, color: "#7E2F44" }}>Nearest hospitals</h3>
          <p style={{ fontSize: 13.5, color: "#6B5A5F", marginTop: 6 }}>
            Uses your device's location, checked only when you tap the button. Nothing is stored.
          </p>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: compact ? 8 : 14, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={findNearby} disabled={locStatus === "locating"}>
          {locStatus === "locating" ? "Getting your location..." : "Find nearest hospital"}
        </button>
        <a href="tel:108" className="btn btn-ghost" style={{ color: "#B0342C", borderColor: "#F3C9C4" }}>Call 108</a>
        <a href="tel:112" className="btn btn-ghost" style={{ color: "#B0342C", borderColor: "#F3C9C4" }}>Call 112</a>
      </div>

      {locStatus === "error" && (
        <div style={{ marginTop: 12, padding: 12, background: "#FBE4E1", borderRadius: 10, fontSize: 13.5, color: "#7A241D" }}>
          {locError}
        </div>
      )}

      {/* As soon as we have coordinates, show something useful — regardless
          of whether the exact hospital list ever loads. */}
      {coords && (
        <div style={{ marginTop: 14, padding: 14, background: "#F5ECE8", borderRadius: 12 }}>
          <p style={{ fontSize: 13.5, color: "#3C2A2F", margin: 0 }}>
            {areaName ? <>You're near <strong>{areaName}</strong>.</> : "Location found."}
          </p>
          <a
            href={mapsSearchUrl(coords.lat, coords.lon)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 10, padding: "8px 16px", fontSize: 13.5 }}
          >
            Open hospitals near you in Maps →
          </a>
        </div>
      )}

      {listStatus === "searching" && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#9C8A8F" }}>Looking up exact distances...</p>
      )}

      {listStatus === "error" && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#9C8A8F" }}>
          Couldn't fetch an exact distance-sorted list right now — the Maps link above still works.
        </p>
      )}

      {listStatus === "done" && facilities.length === 0 && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#9C8A8F" }}>
          Nothing tagged in this data source nearby — the Maps link above is the more complete option here.
        </p>
      )}

      {listStatus === "done" && facilities.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {facilities.map((f) => (
            <div key={f.id} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong style={{ fontSize: 14.5 }}>{f.name}</strong>
                <div style={{ fontSize: 12.5, color: "#9C8A8F", marginTop: 2 }}>
                  {f.type === "hospital" ? "Hospital" : "Clinic"} · {f.distanceKm.toFixed(1)} km away
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {f.phone && <a href={`tel:${f.phone}`} className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>Call</a>}
                <a href={directionsUrl(f.lat, f.lon)} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12.5 }}>Directions</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

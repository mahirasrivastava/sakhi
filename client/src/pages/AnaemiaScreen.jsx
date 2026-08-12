import React, { useRef, useState } from "react";
import { api } from "../api.js";

export default function AnaemiaScreen() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
    } catch (err) {
      setError("Couldn't access the camera. You can also skip this screen.");
    }
  }

  async function capture() {
    setLoading(true);
    setError(null);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = 120;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Sample a centered square — in a real deployment the user is guided to
      // frame their lower eyelid (conjunctiva) inside this box.
      const vw = video.videoWidth, vh = video.videoHeight;
      const cropSize = Math.min(vw, vh) * 0.35;
      ctx.drawImage(video, (vw - cropSize) / 2, (vh - cropSize) / 2, cropSize, cropSize, 0, 0, size, size);

      const { data } = ctx.getImageData(0, 0, size, size);
      const pixels = [];
      for (let i = 0; i < data.length; i += 4 * 20) { // sample every 20th pixel for speed
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }

      const res = await api.anaemiaScreen(pixels);
      setResult(res);
    } catch (err) {
      setError("Screening failed — please try again in good lighting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 44, paddingBottom: 60, maxWidth: 560 }}>
      <h1 className="display" style={{ fontSize: 28 }}>Anaemia screen</h1>
      <p style={{ color: "#6B5A5F", marginTop: 8 }}>
        Gently pull down your lower eyelid and frame it in the box, in good light. This is a screening flag,
        never a haemoglobin number — a real blood test is the only way to confirm anaemia.
      </p>

      <div className="card" style={{ marginTop: 20, textAlign: "center" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "#F5ECE8", borderRadius: 14, overflow: "hidden" }}>
          <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: streaming ? "block" : "none" }} muted playsInline />
          {!streaming && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#B0A0A4" }}>Camera preview</div>}
          <div style={frameBoxStyle} aria-hidden="true" />
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {error && <p style={{ color: "#B0342C", fontSize: 13.5, marginTop: 12 }}>{error}</p>}

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {!streaming && <button className="btn btn-primary" onClick={startCamera}>Turn on camera</button>}
          {streaming && <button className="btn btn-primary" onClick={capture} disabled={loading}>
            {loading ? "Analysing..." : "Capture & screen"}
          </button>}
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 18 }}>
          <span className={`pill ${result.flagged ? "pill-urgent" : "pill-selfcare"}`}>
            {result.flagged ? "Flagged — get a blood test" : "No flag from this screen"}
          </span>
          <p style={{ marginTop: 12, fontSize: 14, color: "#3C2A2F", lineHeight: 1.6 }}>{result.note}</p>
        </div>
      )}
    </div>
  );
}

const frameBoxStyle = {
  position: "absolute", top: "32%", left: "32%", width: "36%", height: "36%",
  border: "2px dashed #B04A63", borderRadius: 12,
};

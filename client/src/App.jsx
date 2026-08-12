import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ConsentGate from "./components/ConsentGate.jsx";
import Home from "./pages/Home.jsx";
import Triage from "./pages/Triage.jsx";
import GeneralTriage from "./pages/GeneralTriage.jsx";
import NearbyHelp from "./pages/NearbyHelp.jsx";
import AnaemiaScreen from "./pages/AnaemiaScreen.jsx";
import CycleTracker from "./pages/CycleTracker.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Impact from "./pages/Impact.jsx";
import Demo from "./pages/Demo.jsx";

export default function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <ConsentGate>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/triage" element={<Triage />} />
            <Route path="/general" element={<GeneralTriage />} />
            <Route path="/nearby" element={<NearbyHelp />} />
            <Route path="/anaemia" element={<AnaemiaScreen />} />
            <Route path="/cycle" element={<CycleTracker />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/impact" element={<Impact />} />
            <Route path="/demo" element={<Demo />} />
          </Routes>
        </ConsentGate>
      </main>
      <Footer />
    </div>
  );
}

import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ConsentGate from "./components/ConsentGate.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import Home from "./pages/Home.jsx";
import Triage from "./pages/Triage.jsx";
import SakhiNavigator from "./pages/SakhiNavigator.jsx";
import GeneralTriage from "./pages/GeneralTriage.jsx";
import NearbyHelp from "./pages/NearbyHelp.jsx";
import AnaemiaScreen from "./pages/AnaemiaScreen.jsx";
import CycleTracker from "./pages/CycleTracker.jsx";
import PrescriptionScan from "./pages/PrescriptionScan.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AshaLogin from "./pages/AshaLogin.jsx";
import Impact from "./pages/Impact.jsx";
import Demo from "./pages/Demo.jsx";

export default function App() {
  return (
    <AuthProvider>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <ConsentGate>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/sakhi" element={<SakhiNavigator />} />
              <Route path="/general" element={<GeneralTriage />} />
              <Route path="/nearby" element={<NearbyHelp />} />
              <Route path="/anaemia" element={<AnaemiaScreen />} />
              <Route path="/cycle" element={<CycleTracker />} />
              <Route path="/prescription" element={<PrescriptionScan />} />
              <Route path="/impact" element={<Impact />} />
              <Route path="/demo" element={<Demo />} />

              {/* Staff-only area, segregated from the patient-facing app. */}
              <Route path="/asha/login" element={<AshaLogin />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ConsentGate>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

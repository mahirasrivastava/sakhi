import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import OfflineBanner from "./components/OfflineBanner.jsx";
import Footer from "./components/Footer.jsx";
import ConsentGate from "./components/ConsentGate.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import VirtualKeyboard from "./components/VirtualKeyboard.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { UserProvider } from "./context/UserContext.jsx";
import { ReportProvider } from "./context/ReportContext.jsx";
import Home from "./pages/Home.jsx";
import Helplines from "./pages/Helplines.jsx";
import HealthReport from "./pages/HealthReport.jsx";
import Triage from "./pages/Triage.jsx";
import SakhiNavigator from "./pages/SakhiNavigator.jsx";
import GeneralTriage from "./pages/GeneralTriage.jsx";
import NearbyHelp from "./pages/NearbyHelp.jsx";
import AnaemiaScreen from "./pages/AnaemiaScreen.jsx";
import CycleTracker from "./pages/CycleTracker.jsx";
import PregnancyTracker from "./pages/PregnancyTracker.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AshaLogin from "./pages/AshaLogin.jsx";
import UserAccount from "./pages/UserAccount.jsx";
import AccountRecovery from "./pages/AccountRecovery.jsx";
import PrescriptionReader from "./pages/PrescriptionReader.jsx";
import Impact from "./pages/Impact.jsx";
import Demo from "./pages/Demo.jsx";
import TermsAndConditions from "./pages/TermsAndConditions.jsx";

export default function App() {
  return (
    <AuthProvider>
      {/* Optional patient accounts. Separate from AuthProvider, which is the
          ASHA worker session — the two never share a cookie or a code path. */}
      <UserProvider>
      {/* The report collects findings from several pages, so it wraps the whole
          router rather than living inside any one of them. It is sessionStorage
          only — see ReportContext for why nothing here reaches the server. */}
      <ReportProvider>
      <div className="app-shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Navbar />
        <OfflineBanner />
        <main style={{ flex: 1 }}>
          <ConsentGate>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/sakhi" element={<SakhiNavigator />} />
              <Route path="/general" element={<GeneralTriage />} />
              <Route path="/nearby" element={<NearbyHelp />} />
              <Route path="/helplines" element={<Helplines />} />
              <Route path="/report" element={<HealthReport />} />
              <Route path="/anaemia" element={<AnaemiaScreen />} />
              <Route path="/prescription" element={<PrescriptionReader />} />
              <Route path="/cycle" element={<CycleTracker />} />
              <Route path="/pregnancy" element={<PregnancyTracker />} />
              <Route path="/account" element={<UserAccount />} />
              <Route path="/account/verify" element={<AccountRecovery mode="verify" />} />
              <Route path="/account/reset" element={<AccountRecovery mode="reset" />} />
              <Route path="/impact" element={<Impact />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/terms" element={<TermsAndConditions />} />

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
        {/* One keyboard for the whole app — every ScriptField routes into it. */}
        <VirtualKeyboard />
        <BottomNav />
      </div>
      </ReportProvider>
      </UserProvider>
    </AuthProvider>
  );
}

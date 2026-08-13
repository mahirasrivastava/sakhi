import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Route guard for the ASHA dashboard.
 *
 * This is a usability layer, not the security boundary — anyone can edit client
 * state in a browser. The real enforcement is requireAuth on the server, which
 * refuses to return a single record without a valid session cookie. This just
 * means an unauthenticated visitor sees a sign-in page instead of an empty
 * dashboard full of failed requests.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return (
      <div className="container" style={{ paddingTop: 60, textAlign: "center", color: "var(--ink-muted)" }}>
        Checking your sign-in…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/asha/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setUnauthorizedHandler } from "../api.js";

const AuthContext = createContext(null);

// Mirrors the server's idle timeout. The server is the authority — this is only
// so a tablet left on a bench at the PHC clears the screen instead of sitting on
// a girl's record until someone walks past.
const IDLE_LIMIT_MS = 15 * 60e3;
const IDLE_TICK_MS = 30e3;

export function AuthProvider({ children }) {
  const [worker, setWorker] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState(null);
  const lastActivity = useRef(Date.now());

  // No worker identity is cached in localStorage. The cookie is the only source
  // of truth, so closing the tab or the server restarting really does sign out.
  const refresh = useCallback(async () => {
    try {
      const { worker: w } = await api.auth.me();
      setWorker(w);
      return w;
    } catch {
      setWorker(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Any 401 from anywhere in the app drops us back to signed-out state.
  useEffect(() => {
    setUnauthorizedHandler((reason) => {
      setWorker(null);
      if (reason === "expired_idle") setNotice("Signed out after 15 minutes of inactivity.");
      else if (reason === "expired_absolute") setNotice("Your shift session expired. Please sign in again.");
      else if (reason === "fingerprint_mismatch") setNotice("Session ended for security reasons. Please sign in again.");
      else if (reason === "account_inactive") setNotice("This account is no longer active.");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Client-side idle watchdog.
  useEffect(() => {
    if (!worker) return undefined;

    const bump = () => { lastActivity.current = Date.now(); };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) {
        api.auth.logout().catch(() => {});
        setWorker(null);
        setNotice("Signed out after 15 minutes of inactivity.");
      }
    }, IDLE_TICK_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [worker]);

  const login = useCallback(async (workerId, password) => {
    const result = await api.auth.login({ workerId, password });
    setWorker(result.worker);
    setNotice(null);
    lastActivity.current = Date.now();
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setWorker(null);
      setNotice("You have been signed out.");
    }
  }, []);

  const activate = useCallback(
    (workerId, activationCode, newPassword) =>
      api.auth.activate({ workerId, activationCode, newPassword }),
    []
  );

  const value = {
    worker,
    checking,
    notice,
    setNotice,
    isAuthenticated: Boolean(worker),
    login,
    logout,
    activate,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

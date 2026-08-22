import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Connection state and low-bandwidth mode.
 *
 * Two related things live here because they answer the same question — how much
 * should this page try to do right now:
 *
 *   online   — is there a network at all
 *   lite     — should we spend bytes and CPU as if there barely is one
 *
 * Lite mode is not only for slow connections. On a five-year-old handset the
 * blur filters and shadows cost more than the bytes do, so it also turns those
 * off. It is remembered per device.
 */
const ConnectionContext = createContext(null);

const STORAGE_KEY = "sakhi_lite";

function initialLite() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "on") return true;
    if (stored === "off") return false;
  } catch { /* private mode or storage disabled */ }

  // No stored choice: follow what the browser already knows. Data Saver being
  // on is an explicit statement by the user that bytes are expensive for them,
  // and 2g/slow-2g says the same thing from measurement.
  const conn = navigator.connection;
  if (conn?.saveData) return true;
  if (conn && ["slow-2g", "2g"].includes(conn.effectiveType)) return true;
  return false;
}

export function ConnectionProvider({ children }) {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [lite, setLite] = useState(initialLite);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Drives the CSS in index.css. Set on <html> so it is available to every
  // rule without any component needing to know about it.
  useEffect(() => {
    document.documentElement.setAttribute("data-lite", lite ? "on" : "off");
  }, [lite]);

  const toggleLite = useCallback(() => {
    setLite((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "on" : "off"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ online, lite, toggleLite }), [online, lite, toggleLite]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside ConnectionProvider");
  return ctx;
}

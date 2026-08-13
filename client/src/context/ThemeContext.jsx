import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Three states, not two. "system" is the default and follows the OS — a phone
// that switches to dark at sunset should take the app with it. Choosing light or
// dark explicitly pins it and stops following.
const STORAGE_KEY = "sakhi_theme";
const MODES = ["light", "dark", "system"];

const ThemeContext = createContext(null);

function storedMode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return MODES.includes(saved) ? saved : "system";
}

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(storedMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Track the OS preference even while pinned, so switching back to "system"
  // resolves correctly without a reload.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    // Drives the browser's own UI — form controls, scrollbars, and the address
    // bar on mobile. Without it a dark page keeps a white scrollbar.
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setThemeMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  // The toggle cycles light -> dark -> system, so "follow my phone" stays
  // reachable from the same control rather than needing a separate settings page.
  const cycle = useCallback(() => {
    setThemeMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
  }, [mode, setThemeMode]);

  const value = useMemo(
    () => ({ mode, resolved, isDark: resolved === "dark", setThemeMode, cycle, modes: MODES }),
    [mode, resolved, setThemeMode, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

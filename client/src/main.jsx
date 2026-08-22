import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { KeyboardProvider } from "./context/KeyboardContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ConnectionProvider } from "./context/ConnectionContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Theme wraps language: it sets data-theme on <html>, which every token
          below it resolves against, including the language picker's own panel. */}
      <ThemeProvider>
        <ConnectionProvider>
        <LanguageProvider>
          {/* The keyboard sits inside LanguageProvider because which script it
              offers is entirely a function of the chosen language. */}
          <KeyboardProvider>
            <App />
          </KeyboardProvider>
        </LanguageProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Offline support. Registered after load so it never competes with the first
// paint on a slow connection — the shell being fast matters more than the
// second visit being cached.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No offline support is a degraded mode, not a failure. The app works.
    });
  });
}

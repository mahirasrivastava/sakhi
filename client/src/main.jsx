import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { KeyboardProvider } from "./context/KeyboardContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Theme wraps language: it sets data-theme on <html>, which every token
          below it resolves against, including the language picker's own panel. */}
      <ThemeProvider>
        <LanguageProvider>
          {/* The keyboard sits inside LanguageProvider because which script it
              offers is entirely a function of the chosen language. */}
          <KeyboardProvider>
            <App />
          </KeyboardProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";

/**
 * A user-facing error, styled to read as a calm hiccup rather than an alarm.
 *
 * Someone filling in a symptom form is very often already anxious — a bare
 * line of red text for "the network dropped" reads like part of the medical
 * news, not a system message. This keeps role="alert" so assistive tech
 * still announces it immediately, but the colour comes from the same warm
 * "--warn" tokens the app already uses for an uncertain-but-not-urgent
 * reading (see AnaemiaScreen's "marginal" note), not from --emergency —
 * that colour stays reserved for things that are actually medically urgent.
 */
export default function ErrorNote({ children }) {
  const { t } = useLanguage();
  return (
    <div className="error-note" role="alert">
      <Icon name="info" size={16} />
      <div>
        <p className="error-note-lead">{t("error_note_lead")}</p>
        <p className="error-note-body">{children}</p>
      </div>
    </div>
  );
}

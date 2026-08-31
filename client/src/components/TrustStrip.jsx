import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";

/**
 * The privacy promise, promoted from a small muted footnote after the form
 * to something visible before it.
 *
 * A first-time smartphone user deciding whether to trust a health form with
 * her symptoms needs to know "nothing here is linked to you" *before* she
 * starts typing, not as fine print she may never scroll to. Same message
 * everywhere it's used (TriageForm, AnaemiaScreen, CycleTracker,
 * PregnancyTracker) — one shared component so it can't drift between pages.
 */
export default function TrustStrip() {
  const { t } = useLanguage();
  return (
    <div className="trust-strip">
      <Icon name="lock" size={20} />
      <p>{t("trust_strip_text")}</p>
    </div>
  );
}

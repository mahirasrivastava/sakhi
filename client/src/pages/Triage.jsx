import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { SYMPTOM_OPTIONS } from "../symptomOptions.js";
import TriageForm from "../components/TriageForm.jsx";

export default function Triage() {
  const { t } = useLanguage();
  return (
    <TriageForm
      symptomOptions={SYMPTOM_OPTIONS}
      title={t("triage_title")}
      intro={t("triage_intro")}
      showPregnant={true}
    />
  );
}

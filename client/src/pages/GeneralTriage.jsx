import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { GENERAL_SYMPTOM_OPTIONS } from "../symptomOptions.js";
import TriageForm from "../components/TriageForm.jsx";

export default function GeneralTriage() {
  const { t } = useLanguage();
  return (
    <TriageForm
      symptomOptions={GENERAL_SYMPTOM_OPTIONS}
      title={t("general_title")}
      intro={t("general_intro")}
      showPregnant={false}
    />
  );
}

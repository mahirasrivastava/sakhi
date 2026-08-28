import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import NearbyFacilities from "../components/NearbyFacilities.jsx";
import EmergencyLocator from "../components/EmergencyLocator.jsx";

export default function NearbyHelp() {
  const { t } = useLanguage();
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <div style={{ maxWidth: 720 }}>
        <h1 className="display" style={{ fontSize: "clamp(26px, 3.4vw, 38px)", lineHeight: 1.15 }}>
          {t("nearby_title")}
        </h1>
        <p style={{ color: "var(--ink-soft)", marginTop: 10, fontSize: 16.5, lineHeight: 1.6 }}>
          {t("nearby_intro")}
        </p>
      </div>

      {/* The ambulance card gets the wide column: it is the reason someone opens
          this page in a hurry. The facility list is support, not the headline. */}
      <div className="split" style={{ marginTop: 26 }}>
        <div className="card" style={{ borderInlineStart: "4px solid var(--emergency)", padding: 26 }}>
          <EmergencyLocator />
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <h2 className="display" style={{ fontSize: 19, marginBottom: 12 }}>
              {t("nearby_facilities_title")}
            </h2>
            <NearbyFacilities />
          </div>

          <div className="aside-card">
            <div className="aside-title">{t("nearby_signal_title")}</div>
            <ul style={styles.tips}>
              <li>{t("nearby_signal_tip1")}</li>
              <li>{t("nearby_signal_tip2")}</li>
              <li>{t("nearby_signal_tip3")}</li>
              <li>{t("nearby_signal_tip4")}</li>
            </ul>
          </div>

          <div className="aside-card">
            <div className="aside-title">{t("nearby_digipin_title")}</div>
            <p style={styles.text}>{t("nearby_digipin_text")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  tips: {
    fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7,
    paddingInlineStart: 20, margin: 0, display: "grid", gap: 7,
  },
  text: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 },
};

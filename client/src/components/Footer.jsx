import React from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer style={styles.footer}>
      <div className="container" style={styles.inner}>
        <p style={styles.text}>{t("footer_disclaimer")}</p>
        <p style={styles.small}>Sakhi · SkillUp Hackathon with IBM SkillsBuild</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: { borderTop: "1px solid #F0DFE2", marginTop: 60, padding: "28px 0" },
  inner: { textAlign: "center" },
  text: { color: "#6B5A5F", fontSize: 13.5, maxWidth: 560, margin: "0 auto 6px" },
  small: { color: "#B0A0A4", fontSize: 12 },
};

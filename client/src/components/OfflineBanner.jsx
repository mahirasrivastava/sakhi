import React from "react";
import { useConnection } from "../context/ConnectionContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";

/**
 * Tells the user the network is gone, and — more usefully — what still works
 * without it. "You are offline" on its own reads as "stop trying"; the point of
 * the offline shell is that most of the app is still there.
 */
export default function OfflineBanner() {
  const { online } = useConnection();
  const { t } = useLanguage();

  if (online) return null;

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <Icon name="ban" size={16} />
      <span>
        <strong>{t("offline_title")}</strong> {t("offline_body")}
      </span>
    </div>
  );
}

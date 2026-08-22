import React from "react";
import { useConnection } from "../context/ConnectionContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import Icon from "./Icon.jsx";

/**
 * Low-bandwidth toggle, sitting on the utility strip beside language and theme
 * because it belongs to the same family: settings that change how the whole
 * site behaves rather than anything on one page.
 */
export default function LiteToggle() {
  const { lite, toggleLite } = useConnection();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      className="util-btn"
      onClick={toggleLite}
      aria-pressed={lite}
      title={lite ? t("lite_on_hint") : t("lite_off_hint")}
    >
      <Icon name={lite ? "drop" : "fill"} size={14} />
      <span>{lite ? t("lite_on") : t("lite_off")}</span>
    </button>
  );
}

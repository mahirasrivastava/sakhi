import React, { useState } from "react";
import Icon from "./Icon.jsx";
import { groupedHelplines } from "../helplines.js";

/**
 * The full national helpline directory.
 *
 * Two decisions worth stating:
 *
 *  1. Every row is itself the dial link, not a row with a small "call" button
 *     on the end. This is used one-handed, sometimes shaking, and a 44px target
 *     that spans the card is the difference between calling and mis-tapping.
 *  2. Only the emergency group is open on load. Nineteen numbers presented at
 *     once is a directory nobody reads; four numbers with the rest one tap away
 *     is a directory that gets used. The groups after the first are collapsed,
 *     never hidden.
 */
export default function HelplineDirectory({ defaultOpen = ["emergency"], compact = false }) {
  const groups = groupedHelplines();
  const [open, setOpen] = useState(() => new Set(defaultOpen));

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="helpline-directory">
      {groups.map((g) => {
        const isOpen = open.has(g.id);
        return (
          <section key={g.id} className={`helpline-group tone-${g.tone}`}>
            <button
              type="button"
              className="helpline-group-head"
              onClick={() => toggle(g.id)}
              aria-expanded={isOpen}
              aria-controls={`helplines-${g.id}`}
            >
              <span className="helpline-group-text">
                <span className="helpline-group-title">{g.title}</span>
                {!compact && <span className="helpline-group-blurb">{g.blurb}</span>}
              </span>
              <span className="helpline-group-meta">
                <span className="helpline-count">{g.lines.length}</span>
                <Icon
                  name="chevronDown"
                  size={16}
                  style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}
                />
              </span>
            </button>

            {isOpen && (
              <ul id={`helplines-${g.id}`} className="helpline-list">
                {g.lines.map((h) => (
                  <li key={h.number}>
                    <a href={`tel:${h.dial}`} className="helpline-row">
                      <span className="helpline-icon">
                        <Icon name={h.icon} size={20} />
                      </span>
                      <span className="helpline-body">
                        <span className="helpline-name">
                          {h.label}
                          <span className="helpline-number">{h.number}</span>
                        </span>
                        {!compact && <span className="helpline-detail">{h.detail}</span>}
                        <span className="helpline-authority">{h.authority}</span>
                      </span>
                      <span className="helpline-call" aria-hidden="true">
                        <Icon name="phone" size={17} />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="helpline-foot">
        All of these are toll-free and answered by the operator directly — Sakhi does not
        sit in the middle of the call. 112 works even with no balance and no SIM card.
      </p>
    </div>
  );
}

/**
 * The compact call strip: three buttons, no list.
 * Used at the top of pages where someone may already be in trouble.
 */
export function CallStrip({ lines, primaryIndex = 0 }) {
  return (
    <div className="call-strip">
      {lines.map((h, i) => (
        <a
          key={h.number}
          href={`tel:${h.dial}`}
          className={`btn ${i === primaryIndex ? "btn-emergency" : "btn-ghost"} call-strip-btn`}
        >
          <Icon name={h.icon} size={18} />
          <span>
            {h.label} <strong>{h.number}</strong>
          </span>
        </a>
      ))}
    </div>
  );
}

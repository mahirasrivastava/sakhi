// routingAgent.js
// Agent 3. Turns a triage level into a concrete action. Never names a disease,
// never suggests a drug. For emergencies, response includes what a real SOS
// flow needs (numbers, message template) even though the SOS UI itself is a
// later phase — the data contract exists now so it's a small follow-up, not a rebuild.

const CONFIDENCE_REVIEW_THRESHOLD = 0.5;

export function runRouting(triage, intake) {
  const needsReview = triage.confidence < CONFIDENCE_REVIEW_THRESHOLD;
  const level = needsReview ? escalateForReview(triage.level) : triage.level;

  const base = {
    level,
    needsHumanReview: needsReview,
    disclaimer: "This is not a diagnosis. Sakhi triages urgency and connects you to care — it does not identify or treat any condition.",
  };

  switch (level) {
    case "emergency":
      return {
        ...base,
        action: "emergency_escalation",
        instructions: [
          "Call 108 (ambulance) or 112 immediately.",
          "Alert the nearest PHC — this has been flagged for staff.",
          "A matching blood donor search has been triggered if bleeding was reported.",
        ],
        ashaAlert: true,
        bloodDonorStandby: intake.symptoms.includes("heavy_bleeding_hourly"),
      };
    case "urgent":
      return {
        ...base,
        action: "asha_home_visit_and_appointment",
        instructions: [
          "An ASHA worker in your area has been flagged to visit or call you.",
          "A same-day or next-day clinic slot will be held for you.",
        ],
        ashaAlert: true,
      };
    case "routine":
      return {
        ...base,
        action: "appointment_booked",
        instructions: [
          "A routine appointment slot has been suggested.",
          "Keep track of your symptoms — come back if anything worsens.",
        ],
        ashaAlert: false,
      };
    default:
      return {
        ...base,
        action: "self_care",
        instructions: [
          "Safe self-care guidance has been provided in your language.",
          "If symptoms last more than a few days or get worse, please check in again.",
        ],
        ashaAlert: false,
      };
  }
}

function escalateForReview(level) {
  const order = ["self-care", "routine", "urgent", "emergency"];
  const idx = order.indexOf(level);
  return order[Math.min(idx + 1, order.length - 1)];
}

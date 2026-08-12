// rulesEngine.js
// Deterministic, clinically-grounded red-flag rules.
// These ALWAYS run before any AI reasoning. The AI layer (llmReasoner.js) may
// raise the level a rule produces, but can never lower it. This file is the
// safety backbone of Sakhi and is intentionally boring, explicit, and testable.

export const RULE_VERSION = "1.0.0";

export const LEVELS = ["self-care", "routine", "urgent", "emergency"];

function levelRank(level) {
  return LEVELS.indexOf(level);
}

export function higherLevel(a, b) {
  return levelRank(a) >= levelRank(b) ? a : b;
}

// Each rule: id, category, description (for audit log / UI), level it fires at,
// and a test(intake) function. intake is the structured object produced by the
// Intake agent: { symptoms: string[], durationDays, severity (1-5), freeText,
// isPregnantOrPossible, cyclePhase, anaemiaScreen: {pallorScore, flagged}, age, language }

export const RULES = [
  // --- WHO maternal danger signs ---
  {
    id: "MDS-01",
    category: "maternal",
    level: "emergency",
    description: "Heavy vaginal bleeding (soaking a pad/cloth within an hour)",
    test: (i) => i.symptoms.includes("heavy_bleeding_hourly"),
  },
  {
    id: "MDS-02",
    category: "maternal",
    level: "emergency",
    description: "Severe headache with blurred vision or convulsions (possible pre-eclampsia/eclampsia)",
    test: (i) =>
      i.symptoms.includes("severe_headache") &&
      (i.symptoms.includes("blurred_vision") || i.symptoms.includes("convulsions")),
  },
  {
    id: "MDS-03",
    category: "maternal",
    level: "emergency",
    description: "Convulsions / fits",
    test: (i) => i.symptoms.includes("convulsions"),
  },
  {
    id: "MDS-04",
    category: "maternal",
    level: "urgent",
    description: "Reduced or absent fetal movement (if pregnant)",
    test: (i) => i.isPregnantOrPossible && i.symptoms.includes("reduced_fetal_movement"),
  },
  {
    id: "MDS-05",
    category: "maternal",
    level: "emergency",
    description: "Water breaking with signs of preterm labour",
    test: (i) => i.symptoms.includes("water_breaking") && Number(i.gestationWeeks) < 37,
  },
  {
    id: "MDS-06",
    category: "maternal",
    level: "urgent",
    description: "Severe swelling of face/hands (possible pre-eclampsia)",
    test: (i) => i.symptoms.includes("severe_swelling"),
  },
  {
    id: "MDS-07",
    category: "maternal",
    level: "emergency",
    description: "Severe abdominal pain in pregnancy",
    test: (i) => i.isPregnantOrPossible && i.symptoms.includes("severe_abdominal_pain"),
  },

  // --- Menstrual / gynaecological ---
  {
    id: "GYN-01",
    category: "gynaecological",
    level: "urgent",
    description: "Heavy menstrual bleeding soaking through protection every hour for 2+ hours",
    test: (i) => i.symptoms.includes("heavy_bleeding_hourly") && i.durationHours >= 2,
  },
  {
    id: "GYN-02",
    category: "gynaecological",
    level: "urgent",
    description: "Bleeding after menopause",
    test: (i) => i.symptoms.includes("postmenopausal_bleeding"),
  },
  {
    id: "GYN-03",
    category: "gynaecological",
    level: "routine",
    description: "Severe menstrual pain interfering with daily activity, recurring",
    test: (i) => i.symptoms.includes("severe_period_pain") && i.durationDays >= 3,
  },

  // --- General emergency red flags ---
  {
    id: "GEN-01",
    category: "general",
    level: "emergency",
    description: "Chest pain",
    test: (i) => i.symptoms.includes("chest_pain"),
  },
  {
    id: "GEN-02",
    category: "general",
    level: "emergency",
    description: "Difficulty breathing / breathlessness at rest",
    test: (i) => i.symptoms.includes("breathlessness"),
  },
  {
    id: "GEN-03",
    category: "general",
    level: "emergency",
    description: "Unconsciousness or unresponsiveness reported",
    test: (i) => i.symptoms.includes("unconscious"),
  },
  {
    id: "GEN-04",
    category: "general",
    level: "emergency",
    description: "High fever with stiff neck (possible meningitis pattern)",
    test: (i) => i.symptoms.includes("high_fever") && i.symptoms.includes("stiff_neck"),
  },
  {
    id: "GEN-05",
    category: "general",
    level: "urgent",
    description: "Fever persisting 3+ days",
    test: (i) => i.symptoms.includes("fever") && i.durationDays >= 3,
  },
  {
    id: "GEN-06",
    category: "general",
    level: "self-care",
    description: "Mild, short-duration symptoms with no red flags",
    test: (i) => i.durationDays < 2 && i.severity <= 2,
  },
  {
    id: "GEN-07",
    category: "general",
    level: "urgent",
    description: "Severe abdominal pain (general population, not pregnancy-specific)",
    test: (i) => !i.isPregnantOrPossible && i.symptoms.includes("severe_abdominal_pain"),
  },
  {
    id: "GEN-08",
    category: "general",
    level: "emergency",
    description: "Uncontrolled bleeding from an injury or wound",
    test: (i) => i.symptoms.includes("wound_bleeding_uncontrolled"),
  },
  {
    id: "GEN-09",
    category: "general",
    level: "urgent",
    description: "Diarrhoea/vomiting with signs of dehydration",
    test: (i) =>
      (i.symptoms.includes("diarrhea") || i.symptoms.includes("vomiting")) &&
      i.symptoms.includes("dehydration_signs"),
  },
  {
    id: "GEN-10",
    category: "general",
    level: "routine",
    description: "Persistent cough (3+ days) without breathlessness",
    test: (i) => i.symptoms.includes("cough") && i.durationDays >= 3 && !i.symptoms.includes("breathlessness"),
  },
  {
    id: "GEN-11",
    category: "general",
    level: "urgent",
    description: "Painful or burning urination with fever (possible infection needing prompt care)",
    test: (i) => i.symptoms.includes("urinary_pain") && (i.symptoms.includes("fever") || i.symptoms.includes("high_fever")),
  },

  // --- Anaemia screen ---
  {
    id: "ANM-01",
    category: "anaemia",
    level: "urgent",
    description: "Camera-based pallor screen flagged low, combined with reported dizziness/fatigue",
    test: (i) =>
      i.anaemiaScreen?.flagged &&
      (i.symptoms.includes("dizziness") || i.symptoms.includes("fatigue")),
  },
  {
    id: "ANM-02",
    category: "anaemia",
    level: "routine",
    description: "Camera-based pallor screen flagged low, no other symptoms — recommend a blood test",
    test: (i) => i.anaemiaScreen?.flagged,
  },

  // --- Safety escape hatch: never let the model see self-harm / abuse language ---
  {
    id: "SAF-01",
    category: "safety",
    level: "emergency",
    description: "Message contains language suggesting self-harm, suicide, or abuse — routed to human path only",
    test: (i) => i.safetyFlag === true,
  },
];

/**
 * Run all rules against structured intake. Returns the highest level fired,
 * plus the full list of fired rules for the audit log and UI.
 */
export function runRules(intake) {
  const fired = RULES.filter((r) => {
    try {
      return !!r.test(intake);
    } catch {
      return false;
    }
  });

  let level = "self-care";
  for (const r of fired) level = higherLevel(level, r.level);

  // If nothing fired at all and there's no baseline rule match, default to routine
  // rather than silently defaulting to self-care with zero evidence.
  if (fired.length === 0) level = "routine";

  return {
    level,
    firedRules: fired.map((r) => ({ id: r.id, category: r.category, description: r.description })),
    ruleVersion: RULE_VERSION,
  };
}

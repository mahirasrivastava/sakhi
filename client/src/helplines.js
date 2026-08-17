// helplines.js
// The national helpline directory.
//
// Sakhi previously carried three numbers — 108, 102, 112 — which is the right
// answer for "an ambulance is needed right now" and the wrong answer for most
// of the reasons someone actually opens this app. A girl who is being hit at
// home does not need an ambulance; she needs 181. A woman who cannot stop
// crying does not need 108; she needs Tele-MANAS. Someone who has been told a
// hospital will not treat her without money needs 14555, not a triage form.
//
// So the directory is complete, grouped by *what has happened to you* rather
// than by which ministry runs the line, and every entry says who operates it —
// because "is this an official number or someone's private service?" is a
// reasonable thing to want to know before you dial while frightened.
//
// Every number here is toll-free and reachable from any phone, including one
// with no balance and, for 112, no SIM. Nothing routes through Sakhi: the
// `tel:` link goes straight to the operator. Putting our own dispatcher between
// a girl and an ambulance would add a point of failure to the one flow that
// must never have one.
//
// Sources: MHA (ERSS 112), MoHFW (108/102/104/1075/14416), MWCD (181, 1098),
// MoSJE (14567, KIRAN), NACO (1097), NHA (14555), NALSA (15100), I4C (1930).

export const HELPLINE_GROUPS = [
  {
    id: "emergency",
    title: "Life-threatening emergency",
    blurb: "Call before you do anything else. Do not fill in a form first.",
    tone: "emergency",
  },
  {
    id: "women",
    title: "Women, girls and children",
    blurb: "Violence, abuse, forced marriage, trafficking, or a child in danger.",
    tone: "urgent",
  },
  {
    id: "health",
    title: "Health advice and counselling",
    blurb: "Free advice from a person, when it is not an emergency.",
    tone: "routine",
  },
  {
    id: "other",
    title: "Other national helplines",
    blurb: "Kept here so the number is findable when it is needed.",
    tone: "neutral",
  },
];

/**
 * @typedef {object} Helpline
 * @property {string} number     what to display
 * @property {string} dial       what to put after tel: (no spaces or dashes)
 * @property {string} label      short name for a button
 * @property {string} detail     one line: what it is actually for
 * @property {string} group      a HELPLINE_GROUPS id
 * @property {string} authority  who runs it
 * @property {string} icon       an Icon name
 * @property {boolean} [primary]  the default call button
 * @property {boolean} [maternal] promoted when the context is a pregnancy
 * @property {boolean} [safety]   promoted when abuse or self-harm is disclosed
 */
export const HELPLINES = [
  // --- life-threatening ----------------------------------------------------
  {
    number: "108",
    dial: "108",
    label: "Ambulance",
    detail: "Free emergency ambulance in most states. Any medical emergency, day or night.",
    group: "emergency",
    authority: "State emergency response (EMRI / 108 services)",
    icon: "ambulance",
    primary: true,
  },
  {
    number: "102",
    dial: "102",
    label: "Pregnancy ambulance",
    detail:
      "Free transport for pregnancy, labour, delivery and newborn emergencies. Often faster than 108 for these, and it takes you home again free under JSSK.",
    group: "emergency",
    authority: "National Health Mission (Janani Express / JSSK)",
    icon: "pregnancy",
    maternal: true,
  },
  {
    number: "112",
    dial: "112",
    label: "All emergencies",
    detail:
      "One number for police, fire and medical. Works with no balance and no SIM, and can be triggered by pressing the power button five times.",
    group: "emergency",
    authority: "Ministry of Home Affairs (Emergency Response Support System)",
    icon: "alert",
  },
  {
    number: "100",
    dial: "100",
    label: "Police",
    detail: "State police control room. Use 112 if you are unsure which service you need.",
    group: "emergency",
    authority: "State police",
    icon: "police",
  },
  {
    number: "101",
    dial: "101",
    label: "Fire and rescue",
    detail: "Fire, burns, building collapse, someone trapped.",
    group: "emergency",
    authority: "State fire services",
    icon: "fire",
  },

  // --- women, girls and children -------------------------------------------
  {
    number: "181",
    dial: "181",
    label: "Women's helpline",
    detail:
      "24x7, for any woman facing violence at home or outside it. Connects to the district One Stop Centre (Sakhi Kendra) for shelter, medical aid, police help and a lawyer.",
    group: "women",
    authority: "Ministry of Women and Child Development",
    icon: "woman",
    safety: true,
  },
  {
    number: "1091",
    dial: "1091",
    label: "Women's police helpline",
    detail: "Police women's cell — harassment, stalking, assault, and threats.",
    group: "women",
    authority: "State police women's cell",
    icon: "shield",
    safety: true,
  },
  {
    number: "1098",
    dial: "1098",
    label: "CHILDLINE",
    detail:
      "For anyone under 18, or any adult worried about a child. Child marriage, child labour, abuse, a child living alone or in danger.",
    group: "women",
    authority: "Ministry of Women and Child Development",
    icon: "child",
    safety: true,
  },
  {
    number: "15100",
    dial: "15100",
    label: "Free legal aid",
    detail:
      "A lawyer at no cost, through the district legal services authority. Maintenance, custody, domestic violence orders, dowry, property.",
    group: "women",
    authority: "National Legal Services Authority (NALSA)",
    icon: "document",
  },

  // --- health advice and counselling ---------------------------------------
  {
    number: "104",
    dial: "104",
    label: "Health advice",
    detail:
      "Talk to a health worker or doctor about a symptom, a medicine, or where to go. Free, and available in your state's languages.",
    group: "health",
    authority: "State health department helpline",
    icon: "stethoscope",
  },
  {
    number: "1075",
    dial: "1075",
    label: "National health helpline",
    detail: "National line for health information, outbreaks and service complaints.",
    group: "health",
    authority: "Ministry of Health and Family Welfare",
    icon: "info",
  },
  {
    number: "14416",
    dial: "14416",
    label: "Tele-MANAS (mental health)",
    detail:
      "Free 24x7 mental health support in 20+ languages — low mood, anxiety, sleeplessness, self-harm thoughts. Also on 1800-891-4416.",
    group: "health",
    authority: "Ministry of Health and Family Welfare",
    icon: "mind",
    safety: true,
  },
  {
    number: "1800-599-0019",
    dial: "18005990019",
    label: "KIRAN (mental health)",
    detail: "24x7 mental-health rehabilitation helpline in 13 languages.",
    group: "health",
    authority: "Ministry of Social Justice and Empowerment",
    icon: "mind",
    safety: true,
  },
  {
    number: "1097",
    dial: "1097",
    label: "HIV and STI helpline",
    detail: "Confidential advice on HIV, sexually transmitted infections, and where to test free.",
    group: "health",
    authority: "National AIDS Control Organisation (NACO)",
    icon: "drop",
  },
  {
    number: "14555",
    dial: "14555",
    label: "Ayushman Bharat (PM-JAY)",
    detail:
      "If a hospital refuses treatment or demands money from a PM-JAY cardholder, this is the number that fixes it. Also 1800-111-565.",
    group: "health",
    authority: "National Health Authority",
    icon: "shield",
  },
  {
    number: "14567",
    dial: "14567",
    label: "Elderline",
    detail: "For anyone over 60 — neglect, abuse, pension and medical help.",
    group: "health",
    authority: "Ministry of Social Justice and Empowerment",
    icon: "handshake",
  },

  // --- other ---------------------------------------------------------------
  {
    number: "1930",
    dial: "1930",
    label: "Cyber fraud",
    detail: "Money taken from your account or UPI. Call within the hour — that is what gets it frozen.",
    group: "other",
    authority: "Indian Cyber Crime Coordination Centre (I4C)",
    icon: "lock",
  },
  {
    number: "1033",
    dial: "1033",
    label: "Highway emergency",
    detail: "Accident, breakdown or medical emergency on a national highway.",
    group: "other",
    authority: "National Highways Authority of India",
    icon: "pin",
  },
  {
    number: "139",
    dial: "139",
    label: "Railway helpline",
    detail: "Medical help, security and complaints on a train or at a station.",
    group: "other",
    authority: "Ministry of Railways",
    icon: "info",
  },
];

const byGroup = (id) => HELPLINES.filter((h) => h.group === id);

/** The three numbers that belong on a button, not in a list. */
export const EMERGENCY_NUMBERS = HELPLINES.filter(
  (h) => h.group === "emergency" && ["108", "102", "112"].includes(h.number)
);

/** Everything, grouped and in display order. */
export function groupedHelplines() {
  return HELPLINE_GROUPS.map((g) => ({ ...g, lines: byGroup(g.id) })).filter(
    (g) => g.lines.length > 0
  );
}

/**
 * The call buttons for a given situation, most relevant first.
 *
 * `maternal` promotes 102 above 108 — for a pregnancy emergency the maternity
 * line is dispatched differently and is usually the faster of the two.
 * `safety` puts 181, 1098 and Tele-MANAS at the top, because when someone has
 * disclosed abuse or self-harm an ambulance is not what she is asking for.
 */
export function callsFor({ maternal = false, safety = false, limit = 3 } = {}) {
  if (safety) {
    const wanted = ["181", "1098", "14416", "112"];
    return wanted
      .map((n) => HELPLINES.find((h) => h.number === n))
      .filter(Boolean)
      .slice(0, limit);
  }

  const ordered = [...EMERGENCY_NUMBERS].sort(
    (a, b) => Number(Boolean(b.maternal)) - Number(Boolean(a.maternal))
  );
  return (maternal ? ordered : EMERGENCY_NUMBERS).slice(0, limit);
}

export function helplineByNumber(number) {
  return HELPLINES.find((h) => h.number === number) || null;
}

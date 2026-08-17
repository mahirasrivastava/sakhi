// schemes.js
// The government entitlements a screening result actually points at.
//
// This is the part of the report that is worth more than the triage level. A
// woman told "you should get a haemoglobin test" often already knew that; what
// she does not know is that under Anemia Mukt Bharat the test and the iron
// tablets are free at the sub-centre, that under JSSK the ambulance both ways
// and the delivery cost nothing, and that RKSK runs an adolescent clinic on a
// fixed weekday where nobody asks who her family is.
//
// Each entry records what it is, who is eligible, what it actually gets you,
// and where it is delivered — because "go to the PHC" is only actionable if you
// know what to ask for when you arrive.
//
// `triggers` are the report facts that surface a scheme. They are deliberately
// broad: an entitlement wrongly shown costs a reader ten seconds, an
// entitlement wrongly hidden costs her the entitlement.

export const SCHEMES = {
  amb: {
    id: "amb",
    name: "Anemia Mukt Bharat (AMB)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission · 6x6x6 strategy",
    what:
      "Free haemoglobin testing and free iron-folic acid (IFA) tablets, with deworming, delivered through the sub-centre, ASHA and the Health and Wellness Centre.",
    eligibility:
      "All women and adolescent girls. Pregnant women, lactating mothers and girls aged 10-19 are priority groups.",
    ask:
      "Ask the ASHA worker or ANM for a haemoglobin test and your IFA tablets. Pregnant women should receive 180 IFA tablets; adolescent girls receive weekly blue IFA tablets.",
    triggers: ["anaemia_flagged", "anaemia_symptoms", "pregnancy", "adolescent"],
  },
  jsy: {
    id: "jsy",
    name: "Janani Suraksha Yojana (JSY)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "A cash payment for giving birth in a government or accredited facility, paid to the mother, plus an incentive to the ASHA who accompanies her.",
    eligibility:
      "Pregnant women delivering in a public or accredited private facility. Amounts and conditions differ between High Performing and Low Performing states.",
    ask:
      "Register the pregnancy with the ASHA worker early and keep the MCP (Mother and Child Protection) card — the payment is made against it.",
    triggers: ["pregnancy"],
  },
  jssk: {
    id: "jssk",
    name: "Janani Shishu Suraksha Karyakram (JSSK)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "Completely free delivery — including caesarean — with free medicines, consumables, diagnostics, diet, blood and free transport home, in a public facility. The same applies to sick newborns and infants up to one year.",
    eligibility: "Every pregnant woman and every sick infant using a public health facility.",
    ask:
      "Nothing should be charged and nothing should be bought from outside. If money is demanded, that is a violation — call 104 or 1075.",
    triggers: ["pregnancy", "emergency", "newborn"],
  },
  pmsma: {
    id: "pmsma",
    name: "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "A guaranteed free antenatal check-up by a doctor on the 9th of every month, including the tests and an ultrasound, with high-risk pregnancies identified and marked.",
    eligibility: "Pregnant women in the second and third trimester.",
    ask: "Go to the nearest PHC/CHC on the 9th. No appointment and no fee.",
    triggers: ["pregnancy"],
  },
  suman: {
    id: "suman",
    name: "SUMAN (Surakshit Matritva Aashwasan)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "An assured package of free maternity care with zero tolerance for denial of services, including four antenatal check-ups, free delivery, and six home visits after birth.",
    eligibility: "All pregnant women, mothers up to six months after delivery, and all sick newborns.",
    ask: "If a facility turns you away, that is a reportable denial of service.",
    triggers: ["pregnancy", "newborn"],
  },
  rksk: {
    id: "rksk",
    name: "Rashtriya Kishor Swasthya Karyakram (RKSK)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "Adolescent Friendly Health Clinics (AFHC) offering confidential advice on periods, nutrition, mental health, contraception and sexual health, plus free sanitary napkins under the menstrual hygiene scheme.",
    eligibility: "Anyone aged 10-19.",
    ask:
      "Ask for the adolescent clinic day at the PHC, or for the Peer Educator / ASHA. Consultations are confidential.",
    triggers: ["adolescent", "menstrual", "mental_health"],
  },
  pmjay: {
    id: "pmjay",
    name: "Ayushman Bharat PM-JAY",
    ministry: "National Health Authority",
    programme: "Pradhan Mantri Jan Arogya Yojana",
    what:
      "Cashless hospital treatment up to ₹5 lakh per family per year at any empanelled public or private hospital, covering surgery, ICU, diagnostics and 15 days of follow-up medicine.",
    eligibility:
      "Families identified by the SECC deprivation criteria, plus everyone aged 70 and above regardless of income.",
    ask:
      "Ask for the Ayushman Mitra desk at the hospital and carry any government photo ID. If treatment is refused or money is demanded, call 14555.",
    triggers: ["emergency", "urgent", "hospital_referral"],
  },
  hwc: {
    id: "hwc",
    name: "Ayushman Arogya Mandir (Health and Wellness Centre)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "Ayushman Bharat",
    what:
      "The upgraded sub-centre or PHC nearest to you: free consultations, 12 packages of comprehensive primary care, free essential medicines and free diagnostics including haemoglobin.",
    eligibility: "Everyone. No card and no referral needed.",
    ask: "Ask the ASHA worker which building is your Ayushman Arogya Mandir and which days the CHO sits.",
    triggers: ["always"],
  },
  poshan: {
    id: "poshan",
    name: "POSHAN Abhiyaan and Supplementary Nutrition",
    ministry: "Ministry of Women and Child Development",
    programme: "Saksham Anganwadi and Poshan 2.0",
    what:
      "Take-home rations and hot cooked meals through the Anganwadi centre for pregnant women, lactating mothers, adolescent girls and children under six.",
    eligibility:
      "Pregnant and lactating women, children under six, and adolescent girls aged 14-18 in identified districts.",
    ask: "Register at the Anganwadi centre — the Anganwadi worker records it in the POSHAN tracker.",
    triggers: ["pregnancy", "anaemia_flagged", "adolescent"],
  },
  pmmvy: {
    id: "pmmvy",
    name: "Pradhan Mantri Matru Vandana Yojana (PMMVY)",
    ministry: "Ministry of Women and Child Development",
    programme: "Mission Shakti · Samarthya",
    what:
      "₹5,000 in instalments for the first living child, and ₹6,000 for a second child if that child is a girl, paid directly to the mother's bank account as partial wage compensation.",
    eligibility:
      "Pregnant and lactating mothers, for the first live birth (and a second, if a girl). Aadhaar and a bank account in the mother's own name are required.",
    ask: "Apply through the Anganwadi worker or the ASHA, or on the PMMVY portal, with the MCP card.",
    triggers: ["pregnancy"],
  },
  telemanas: {
    id: "telemanas",
    name: "Tele-MANAS",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Tele Mental Health Programme",
    what:
      "Free 24x7 mental health counselling by phone in more than 20 languages, escalating to a psychiatrist where needed.",
    eligibility: "Anyone, at any age, with no referral.",
    ask: "Call 14416 or 1800-891-4416. The call is confidential.",
    triggers: ["mental_health", "safety_flag"],
  },
  osc: {
    id: "osc",
    name: "One Stop Centre (Sakhi Kendra)",
    ministry: "Ministry of Women and Child Development",
    programme: "Mission Shakti · Sambal",
    what:
      "One place, in every district, giving a woman facing violence medical aid, police assistance, legal aid, psychosocial counselling and up to five days of temporary shelter.",
    eligibility: "Any woman facing violence, in public or in private, regardless of age or marital status.",
    ask: "Call 181 and ask for the district One Stop Centre. Nothing is charged.",
    triggers: ["safety_flag"],
  },
  rbsk: {
    id: "rbsk",
    name: "Rashtriya Bal Swasthya Karyakram (RBSK)",
    ministry: "Ministry of Health and Family Welfare",
    programme: "National Health Mission",
    what:
      "Free screening for defects at birth, deficiencies, disease and developmental delay, with free treatment including surgery at a District Early Intervention Centre.",
    eligibility: "Children from birth to 18 years.",
    ask: "The mobile health team visits the Anganwadi and the school — ask the ASHA when.",
    triggers: ["adolescent", "newborn"],
  },
};

export const SCHEME_LIST = Object.values(SCHEMES);

/**
 * Picks the entitlements a report should carry.
 *
 * `facts` is a set of trigger strings assembled from what the person actually
 * did in this session. "always" schemes are appended for everyone, because the
 * Health and Wellness Centre is the answer to "where do I go" in every branch.
 */
export function schemesFor(facts = []) {
  const wanted = new Set(facts);
  const picked = SCHEME_LIST.filter(
    (s) => s.triggers.includes("always") || s.triggers.some((t) => wanted.has(t))
  );
  // Stable, sensible reading order: what is free and nearest first.
  const order = [
    "hwc", "amb", "jssk", "pmsma", "suman", "jsy", "pmmvy",
    "poshan", "rksk", "rbsk", "pmjay", "telemanas", "osc",
  ];
  return picked.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/**
 * Standing references printed at the foot of every report.
 * These are the documents the guidance in this app is drawn from — a report
 * that cites nothing is an opinion, and this one should not read as one.
 */
export const SOURCE_DOCUMENTS = [
  {
    title: "Anemia Mukt Bharat — Operational Guidelines",
    body: "Ministry of Health and Family Welfare, Government of India",
    note: "6x6x6 strategy; anaemia cut-offs and IFA supplementation schedules.",
  },
  {
    title: "WHO — Haemoglobin concentrations for the diagnosis of anaemia",
    body: "World Health Organization",
    note: "Population cut-offs: 12.0 g/dL non-pregnant women, 11.0 g/dL pregnant women.",
  },
  {
    title: "Guidelines for Antenatal Care and Skilled Attendance at Birth",
    body: "Maternal Health Division, Ministry of Health and Family Welfare",
    note: "Obstetric danger signs and referral thresholds.",
  },
  {
    title: "WHO — Managing complications in pregnancy and childbirth",
    body: "World Health Organization",
    note: "Emergency danger-sign definitions used by the triage rules.",
  },
  {
    title: "Rashtriya Kishor Swasthya Karyakram — Operational Framework",
    body: "Adolescent Health Division, Ministry of Health and Family Welfare",
    note: "Adolescent-friendly service standards and confidentiality norms.",
  },
  {
    title: "ASHA Module 6 and 7 — Induction and Round-based training",
    body: "National Health Systems Resource Centre",
    note: "Community-level referral language used in the advice text.",
  },
];

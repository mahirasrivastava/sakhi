// knowledge/medicines.js
// A small, deliberately conservative medicine → condition map for reading
// prescriptions, plus the links between conditions that make one worth
// mentioning when another is present.
//
// WHAT THIS IS FOR
// An ASHA worker holding a girl's prescription needs to know what she is
// already being treated for, because that changes triage. "Chest tightness" in
// someone on salbutamol is a different conversation from the same words in
// someone on no medication at all.
//
// WHAT THIS IS NOT
// It is not a diagnosis, not a prescribing aid, and not an interaction checker
// fit for clinical use. It never suggests starting, stopping or changing a dose
// — the single most dangerous thing a tool like this could do is give someone a
// reason to stop taking something. Every output is phrased as a question to
// take to a clinician.
//
// Brand names skew to what is actually dispensed in Indian PHCs and chemists,
// because that is what appears on the paper being photographed.

export const MEDICINES = [
  // --- Haematinics / nutrition -------------------------------------------
  {
    id: "iron_folic",
    label: "Iron + folic acid",
    generics: ["ferrous sulphate", "ferrous sulfate", "ferrous fumarate", "ferrous ascorbate", "iron folic acid", "carbonyl iron", "ifa"],
    brands: ["fefol", "orofer", "livogen", "dexorange", "autrin", "hemfer", "feronia", "tonoferon", "ferium"],
    conditions: ["anaemia"],
    note: "Standard treatment for iron-deficiency anaemia and routine in pregnancy.",
  },
  {
    id: "folic_acid",
    label: "Folic acid",
    generics: ["folic acid", "folate"],
    brands: ["folvite", "foligraf"],
    conditions: ["anaemia", "pregnancy_care"],
    note: "Given before and during early pregnancy to prevent neural tube defects.",
  },
  {
    id: "vitamin_b12",
    label: "Vitamin B12",
    generics: ["methylcobalamin", "cyanocobalamin", "mecobalamin", "vitamin b12"],
    brands: ["nurokind", "methylcobal", "neurobion"],
    conditions: ["anaemia", "nutritional_deficiency"],
  },
  {
    id: "calcium_vitd",
    label: "Calcium + vitamin D",
    generics: ["calcium carbonate", "calcium citrate", "cholecalciferol", "vitamin d3"],
    brands: ["shelcal", "calcimax", "ostocalcium", "uprise d3"],
    conditions: ["pregnancy_care", "nutritional_deficiency"],
  },

  // --- Diabetes -----------------------------------------------------------
  {
    id: "metformin",
    label: "Metformin",
    generics: ["metformin"],
    brands: ["glycomet", "glucophage", "obimet", "carbophage", "gluconorm"],
    conditions: ["diabetes", "pcos"],
    note: "Used for type 2 diabetes, and also commonly for PCOS.",
  },
  {
    id: "sulfonylurea",
    label: "Sulfonylurea (glimepiride / glibenclamide)",
    generics: ["glimepiride", "glibenclamide", "glyburide", "gliclazide", "glipizide"],
    brands: ["amaryl", "daonil", "diamicron", "glynase"],
    conditions: ["diabetes"],
  },
  {
    id: "insulin",
    label: "Insulin",
    generics: ["insulin", "human insulin", "insulin glargine", "insulin aspart", "mixtard", "actrapid"],
    brands: ["huminsulin", "lantus", "novomix", "ryzodeg"],
    conditions: ["diabetes"],
  },

  // --- Cardiovascular -----------------------------------------------------
  {
    id: "amlodipine",
    label: "Amlodipine",
    generics: ["amlodipine"],
    brands: ["amlong", "amlopres", "stamlo", "amlokind"],
    conditions: ["hypertension"],
  },
  {
    id: "acei_arb",
    label: "ACE inhibitor / ARB",
    generics: ["telmisartan", "losartan", "enalapril", "ramipril", "olmesartan", "lisinopril"],
    brands: ["telma", "losar", "envas", "cardace", "olmesar"],
    conditions: ["hypertension", "kidney_disease"],
    pregnancyWarning:
      "This class of blood-pressure medicine is generally avoided in pregnancy. If there is any chance of pregnancy, this needs a doctor's review urgently — do not stop it on your own.",
  },
  {
    id: "beta_blocker",
    label: "Beta blocker",
    generics: ["atenolol", "metoprolol", "propranolol", "bisoprolol"],
    brands: ["betaloc", "ciplar", "metolar", "concor"],
    conditions: ["hypertension", "heart_disease", "thyroid"],
  },
  {
    id: "statin",
    label: "Statin",
    generics: ["atorvastatin", "rosuvastatin", "simvastatin"],
    brands: ["atorva", "lipvas", "rosuvas", "storvas"],
    conditions: ["high_cholesterol", "heart_disease"],
    pregnancyWarning:
      "Statins are normally stopped in pregnancy. If pregnancy is possible, ask a doctor before the next dose.",
  },
  {
    id: "antiplatelet",
    label: "Aspirin / antiplatelet",
    generics: ["aspirin", "acetylsalicylic", "clopidogrel", "ecosprin"],
    brands: ["ecosprin", "disprin", "clopilet", "deplatt"],
    conditions: ["heart_disease"],
    note: "Low-dose aspirin is also prescribed in pregnancy to lower pre-eclampsia risk — the reason matters.",
  },

  // --- Thyroid ------------------------------------------------------------
  {
    id: "levothyroxine",
    label: "Thyroxine",
    generics: ["levothyroxine", "thyroxine", "eltroxin"],
    brands: ["thyronorm", "eltroxin", "thyrox", "lethyrox"],
    conditions: ["thyroid"],
    note: "Thyroid dose usually needs raising early in pregnancy — this is a common gap.",
  },

  // --- Reproductive health ------------------------------------------------
  {
    id: "ocp",
    label: "Oral contraceptive / hormonal pill",
    generics: ["ethinylestradiol", "levonorgestrel", "desogestrel", "drospirenone", "norethisterone"],
    brands: ["mala-d", "mala-n", "ovral", "yasmin", "krimson", "ginette", "primolut", "regestrone"],
    conditions: ["contraception", "pcos", "heavy_menstrual_bleeding"],
  },
  {
    id: "tranexamic",
    label: "Tranexamic acid",
    generics: ["tranexamic acid"],
    brands: ["trapic", "pause", "texakind"],
    conditions: ["heavy_menstrual_bleeding"],
  },
  {
    id: "mefenamic",
    label: "Mefenamic acid",
    generics: ["mefenamic acid"],
    brands: ["meftal", "ponstan"],
    conditions: ["period_pain", "heavy_menstrual_bleeding"],
  },
  {
    id: "clomiphene",
    label: "Clomiphene / letrozole (ovulation)",
    generics: ["clomiphene", "clomifene", "letrozole"],
    brands: ["fertyl", "siphene", "letroz"],
    conditions: ["pcos", "infertility"],
  },

  // --- Infection ----------------------------------------------------------
  {
    id: "amoxi",
    label: "Amoxicillin (± clavulanate)",
    generics: ["amoxicillin", "amoxycillin", "clavulanate", "clavulanic"],
    brands: ["augmentin", "moxikind", "clavam", "novamox"],
    conditions: ["infection"],
  },
  {
    id: "azithro",
    label: "Azithromycin",
    generics: ["azithromycin"],
    brands: ["azithral", "azee", "zithrox"],
    conditions: ["infection"],
  },
  {
    id: "metronidazole",
    label: "Metronidazole",
    generics: ["metronidazole", "tinidazole", "ornidazole"],
    brands: ["flagyl", "metrogyl", "tiniba"],
    conditions: ["infection", "reproductive_infection"],
  },
  {
    id: "fluconazole",
    label: "Fluconazole",
    generics: ["fluconazole", "clotrimazole"],
    brands: ["forcan", "zocon", "candid"],
    conditions: ["reproductive_infection"],
  },
  {
    id: "atd",
    label: "Anti-tuberculosis treatment",
    generics: ["isoniazid", "rifampicin", "rifampin", "pyrazinamide", "ethambutol", "akt"],
    brands: ["akt-4", "akt-3", "forecox", "rcinex"],
    conditions: ["tuberculosis"],
    note: "TB treatment must be completed in full. Missing doses causes drug resistance.",
  },
  {
    id: "antimalarial",
    label: "Antimalarial",
    generics: ["chloroquine", "artesunate", "artemether", "primaquine", "hydroxychloroquine"],
    brands: ["lariago", "falcigo", "hcqs"],
    conditions: ["infection"],
  },

  // --- Pain / inflammation ------------------------------------------------
  {
    id: "paracetamol",
    label: "Paracetamol",
    generics: ["paracetamol", "acetaminophen"],
    brands: ["crocin", "dolo", "calpol", "pacimol"],
    conditions: ["pain_fever"],
  },
  {
    id: "nsaid",
    label: "NSAID painkiller",
    generics: ["ibuprofen", "diclofenac", "naproxen", "aceclofenac", "ketorolac"],
    brands: ["brufen", "voveran", "zerodol", "combiflam", "dolonex"],
    conditions: ["pain_fever"],
    pregnancyWarning:
      "NSAID painkillers are usually avoided in later pregnancy. Ask a doctor before taking these if pregnancy is possible.",
  },

  // --- Stomach ------------------------------------------------------------
  {
    id: "ppi",
    label: "Acidity medicine (PPI / H2 blocker)",
    generics: ["omeprazole", "pantoprazole", "rabeprazole", "esomeprazole", "ranitidine", "famotidine"],
    brands: ["pan", "pantocid", "omez", "razo", "rantac", "nexpro"],
    conditions: ["acidity"],
    note: "Long-term acid suppression reduces iron absorption, which matters alongside anaemia.",
  },
  {
    id: "ors_zinc",
    label: "ORS / zinc",
    generics: ["oral rehydration", "ors", "zinc sulphate", "zinc"],
    brands: ["electral", "zinconia", "walyte"],
    conditions: ["dehydration"],
  },

  // --- Respiratory --------------------------------------------------------
  {
    id: "bronchodilator",
    label: "Inhaler / bronchodilator",
    generics: ["salbutamol", "albuterol", "levosalbutamol", "formoterol", "budesonide", "ipratropium"],
    brands: ["asthalin", "seroflo", "foracort", "duolin", "budecort"],
    conditions: ["asthma"],
  },
  {
    id: "antihistamine",
    label: "Antihistamine",
    generics: ["cetirizine", "levocetirizine", "montelukast", "fexofenadine", "chlorpheniramine"],
    brands: ["cetzine", "montair", "allegra", "avil"],
    conditions: ["allergy", "asthma"],
  },

  // --- Neuro / mental health ---------------------------------------------
  {
    id: "antiepileptic",
    label: "Anti-epileptic",
    generics: ["phenytoin", "valproate", "valproic", "carbamazepine", "levetiracetam", "lamotrigine", "phenobarbitone"],
    brands: ["eptoin", "valparin", "tegretol", "levipil", "lamitor"],
    conditions: ["epilepsy"],
    pregnancyWarning:
      "Some epilepsy medicines (especially valproate) carry serious risks in pregnancy, but stopping them suddenly is more dangerous than continuing. This needs a doctor urgently, not a decision at home.",
  },
  {
    id: "ssri",
    label: "Antidepressant (SSRI)",
    generics: ["fluoxetine", "sertraline", "escitalopram", "paroxetine", "amitriptyline"],
    brands: ["prodep", "zoloft", "nexito", "cipralex"],
    conditions: ["mental_health"],
  },
];

// ---------------------------------------------------------------------------
// Conditions and how they connect
// ---------------------------------------------------------------------------
//
// `links` is what makes this more than a drug lookup: it encodes the clinically
// well-known associations that a busy PHC visit often misses. Each link says
// what to check and why, in language a health worker can repeat out loud.

export const CONDITIONS = {
  anaemia: {
    label: "Anaemia (low haemoglobin)",
    links: [
      { to: "heavy_menstrual_bleeding", why: "Heavy periods are the most common cause of anaemia in girls and women — treating the iron without asking about bleeding usually means it comes back." },
      { to: "pregnancy_care", why: "Anaemia in pregnancy raises the risk of premature birth, low birth weight and dangerous bleeding at delivery." },
      { to: "nutritional_deficiency", why: "Iron deficiency rarely travels alone — B12 and folate are often low too." },
      { to: "tuberculosis", why: "Long-standing anaemia with weight loss or evening fever should prompt a TB check." },
      { to: "acidity", why: "Long-term acidity medicines cut iron absorption, so the iron tablets may not be working." },
    ],
  },
  heavy_menstrual_bleeding: {
    label: "Heavy or irregular periods",
    links: [
      { to: "anaemia", why: "Regular heavy bleeding drains iron faster than diet can replace it — a haemoglobin test is worth asking for." },
      { to: "thyroid", why: "An underactive thyroid is a common and easily missed cause of heavy periods." },
      { to: "pcos", why: "Irregular cycles with weight gain or acne point toward PCOS." },
    ],
  },
  pcos: {
    label: "PCOS (polycystic ovary syndrome)",
    links: [
      { to: "diabetes", why: "PCOS substantially raises the lifetime risk of type 2 diabetes — a sugar test every year or two is standard advice." },
      { to: "hypertension", why: "PCOS clusters with raised blood pressure and cholesterol." },
      { to: "infertility", why: "PCOS is a leading cause of difficulty conceiving, and it is treatable." },
      { to: "mental_health", why: "Depression and anxiety are markedly more common with PCOS and often go unasked about." },
    ],
  },
  diabetes: {
    label: "Diabetes",
    links: [
      { to: "hypertension", why: "Diabetes and high blood pressure together multiply heart and kidney risk rather than just adding to it." },
      { to: "kidney_disease", why: "Kidney damage from diabetes is silent early — an annual urine protein test catches it in time." },
      { to: "pregnancy_care", why: "Blood sugar needs tight control before and during pregnancy; several diabetes tablets are switched to insulin." },
      { to: "tuberculosis", why: "Diabetes roughly triples TB risk, which matters in high-burden districts." },
      { to: "infection", why: "Wounds and infections heal slowly and turn serious faster with diabetes." },
    ],
  },
  hypertension: {
    label: "High blood pressure",
    links: [
      { to: "heart_disease", why: "Untreated high blood pressure is the largest single contributor to heart attack and stroke." },
      { to: "kidney_disease", why: "The kidneys are damaged silently by years of raised pressure." },
      { to: "pregnancy_care", why: "Pre-existing high blood pressure raises pre-eclampsia risk and needs closer antenatal monitoring." },
    ],
  },
  thyroid: {
    label: "Thyroid problem",
    links: [
      { to: "heavy_menstrual_bleeding", why: "Thyroid disorders disturb the menstrual cycle in both directions." },
      { to: "pregnancy_care", why: "Thyroid requirements rise early in pregnancy — the dose usually needs review as soon as pregnancy is confirmed." },
      { to: "infertility", why: "Untreated thyroid disease is a reversible cause of difficulty conceiving." },
      { to: "anaemia", why: "Hypothyroidism itself causes anaemia that iron alone will not fix." },
    ],
  },
  pregnancy_care: {
    label: "Pregnancy care",
    links: [
      { to: "anaemia", why: "Haemoglobin should be checked each trimester — anaemia is the commonest treatable risk in Indian pregnancies." },
      { to: "hypertension", why: "Rising blood pressure with swelling or headache is pre-eclampsia until proven otherwise." },
      { to: "diabetes", why: "Gestational diabetes screening is routine and easy to miss." },
    ],
  },
  tuberculosis: {
    label: "Tuberculosis",
    links: [
      { to: "anaemia", why: "TB commonly causes anaemia that improves only once the TB is treated." },
      { to: "diabetes", why: "TB and diabetes worsen each other; both should be screened for when one is found." },
      { to: "nutritional_deficiency", why: "Nutritional support is part of TB treatment, not an optional extra." },
    ],
  },
  kidney_disease: { label: "Kidney problem", links: [
    { to: "anaemia", why: "Kidney disease causes anaemia that iron tablets alone will not correct." },
    { to: "hypertension", why: "Kidney disease and blood pressure drive each other in a loop." },
  ] },
  heart_disease: { label: "Heart disease", links: [
    { to: "hypertension", why: "Blood pressure control is the main lever on future heart risk." },
    { to: "diabetes", why: "Diabetes is one of the strongest drivers of heart disease in South Asians, at lower BMI than in other populations." },
  ] },
  high_cholesterol: { label: "High cholesterol", links: [
    { to: "heart_disease", why: "Cholesterol matters mainly through its effect on heart and stroke risk." },
  ] },
  asthma: { label: "Asthma or breathing problem", links: [
    { to: "allergy", why: "Allergy and asthma usually travel together; controlling one helps the other." },
    { to: "pregnancy_care", why: "Asthma control should be kept up in pregnancy — uncontrolled asthma is riskier to a baby than the inhalers are." },
  ] },
  allergy: { label: "Allergy", links: [] },
  infection: { label: "Infection", links: [] },
  reproductive_infection: { label: "Reproductive tract infection", links: [
    { to: "infertility", why: "Untreated or repeated infections can scar the tubes and affect fertility later." },
  ] },
  infertility: { label: "Difficulty conceiving", links: [
    { to: "thyroid", why: "Thyroid and PCOS are both treatable causes worth ruling out early." },
    { to: "pcos", why: "PCOS is the most common cause, and responds well to treatment." },
  ] },
  mental_health: { label: "Mental health treatment", links: [
    { to: "pregnancy_care", why: "Some psychiatric medicines are reviewed in pregnancy — but stopping them abruptly is itself a serious risk." },
  ] },
  epilepsy: { label: "Epilepsy", links: [
    { to: "pregnancy_care", why: "Epilepsy medicines and pregnancy need planning together, ideally before conceiving." },
  ] },
  nutritional_deficiency: { label: "Nutritional deficiency", links: [
    { to: "anaemia", why: "Deficiencies commonly overlap — correcting only one often leaves the tiredness unexplained." },
  ] },
  acidity: { label: "Acidity / reflux", links: [] },
  contraception: { label: "Contraception", links: [] },
  period_pain: { label: "Period pain", links: [
    { to: "heavy_menstrual_bleeding", why: "Severe pain with heavy bleeding deserves a look for fibroids or endometriosis rather than repeat painkillers." },
  ] },
  pain_fever: { label: "Pain or fever", links: [] },
  dehydration: { label: "Dehydration", links: [] },
};

// ---------------------------------------------------------------------------
// Family history
// ---------------------------------------------------------------------------
//
// Family history changes what is worth screening for and when. Each entry maps
// a reported family condition to the personal conditions it raises risk for.

export const FAMILY_HISTORY_OPTIONS = [
  { id: "diabetes", label: "Diabetes" },
  { id: "hypertension", label: "High blood pressure" },
  { id: "heart_disease", label: "Heart attack or stroke" },
  { id: "tuberculosis", label: "Tuberculosis" },
  { id: "thyroid", label: "Thyroid problem" },
  { id: "anaemia", label: "Anaemia or blood disorder" },
  { id: "cancer_breast_ovarian", label: "Breast or ovarian cancer" },
  { id: "pcos", label: "PCOS" },
  { id: "kidney_disease", label: "Kidney disease" },
  { id: "mental_health", label: "Depression or mental illness" },
  { id: "sickle_thalassemia", label: "Sickle cell or thalassaemia" },
];

export const FAMILY_RISK = {
  diabetes: {
    raises: ["diabetes", "pcos"],
    advice: "A parent or sibling with diabetes roughly doubles the risk, and South Asians develop it younger and at lower body weight. A fasting sugar test every year or two is reasonable from the twenties onward.",
  },
  hypertension: {
    raises: ["hypertension", "heart_disease"],
    advice: "Family high blood pressure makes it worth having blood pressure checked at every clinic visit rather than only when unwell.",
  },
  heart_disease: {
    raises: ["heart_disease", "high_cholesterol", "hypertension"],
    advice: "Early heart disease in a parent (before about 55 in men, 65 in women) is a strong signal. Blood pressure, sugar and cholesterol are all worth checking earlier than usual.",
  },
  tuberculosis: {
    raises: ["tuberculosis"],
    advice: "A household TB contact means any cough lasting more than two weeks, evening fever or weight loss should be tested promptly, not watched.",
  },
  thyroid: {
    raises: ["thyroid", "heavy_menstrual_bleeding"],
    advice: "Thyroid disease runs strongly in families and is a simple blood test — worth asking for if periods, weight or energy have changed.",
  },
  anaemia: {
    raises: ["anaemia"],
    advice: "Anaemia that runs in a family may be inherited rather than dietary. If iron tablets have not helped, ask whether it could be thalassaemia trait.",
  },
  sickle_thalassemia: {
    raises: ["anaemia"],
    advice: "This is inherited. Anaemia that does not respond to iron needs a haemoglobin electrophoresis test, and carrier testing matters before or early in pregnancy.",
  },
  cancer_breast_ovarian: {
    raises: [],
    advice: "Breast or ovarian cancer in a close relative means screening should start earlier. Learning breast self-examination and mentioning the family history at every visit is the practical step.",
  },
  pcos: {
    raises: ["pcos", "diabetes"],
    advice: "PCOS clusters in families. Irregular periods, acne or unusual hair growth are worth raising rather than waiting.",
  },
  kidney_disease: {
    raises: ["kidney_disease", "hypertension"],
    advice: "Family kidney disease makes an annual urine protein check worthwhile, especially alongside diabetes or high blood pressure.",
  },
  mental_health: {
    raises: ["mental_health"],
    advice: "Family history raises risk but is not destiny. It is a reason to take low mood or anxiety seriously early rather than to expect illness.",
  },
};

// rag.js
// Closed-corpus retrieval for self-care guidance. Deliberately NOT a general
// web-connected RAG — the corpus is small, curated, and reviewed, because this
// is a health context where an ungrounded answer is a safety failure, not just
// a bad UX. Uses simple TF-IDF-style term scoring; swap for a real vector store
// later without changing the API shape.

const CORPUS = [
  {
    id: "sc-fever-mild",
    tags: ["fever", "mild"],
    en: "Rest, drink plenty of fluids, and monitor your temperature. If fever crosses 3 days or you feel worse, come back in.",
    hi: "आराम करें, खूब पानी पिएं और तापमान पर नज़र रखें। यदि बुखार 3 दिन से ज़्यादा रहे या हालत बिगड़े, दोबारा संपर्क करें।",
    kn: "ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ, ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ ಮತ್ತು ದೇಹದ ಉಷ್ಣತೆ ಗಮನಿಸಿ. ಜ್ವರ 3 ದಿನ ಮೀರಿದರೆ ಮತ್ತೆ ಸಂಪರ್ಕಿಸಿ.",
  },
  {
    id: "sc-period-pain",
    tags: ["severe_period_pain", "cramps"],
    en: "A warm compress on the lower abdomen and rest can help with cramps. If pain stops you from daily activities repeatedly, please get it checked.",
    hi: "पेट के निचले हिस्से पर गर्म सिकाई और आराम ऐंठन में मदद कर सकता है। यदि दर्द बार-बार रोज़मर्रा के काम में बाधा डाले, तो जांच करवाएं।",
    kn: "ಹೊಟ್ಟೆಯ ಕೆಳಭಾಗದಲ್ಲಿ ಬೆಚ್ಚಗಿನ ಶಾಖ ಮತ್ತು ವಿಶ್ರಾಂತಿ ಸಹಾಯ ಮಾಡಬಹುದು. ನೋವು ಪದೇ ಪದೇ ದೈನಂದಿನ ಕೆಲಸಕ್ಕೆ ಅಡ್ಡಿಯಾದರೆ ತಪಾಸಣೆ ಮಾಡಿಸಿ.",
  },
  {
    id: "sc-fatigue-anaemia",
    tags: ["fatigue", "dizziness", "anaemia"],
    en: "Iron-rich foods (leafy greens, jaggery, legumes) can help, but a real blood test is the only way to confirm anaemia — please get one done.",
    hi: "आयरन युक्त भोजन (हरी सब्ज़ियां, गुड़, दालें) मदद कर सकता है, लेकिन एनीमिया की पुष्टि केवल रक्त जांच से होती है — कृपया जांच करवाएं।",
    kn: "ಕಬ್ಬಿಣಾಂಶಯುಕ್ತ ಆಹಾರ (ಸೊಪ್ಪು, ಬೆಲ್ಲ, ಬೇಳೆಕಾಳುಗಳು) ಸಹಾಯಕವಾಗಬಹುದು, ಆದರೆ ರಕ್ತಹೀನತೆ ಖಚಿತಪಡಿಸಲು ರಕ್ತ ಪರೀಕ್ಷೆಯೊಂದೇ ದಾರಿ — ದಯವಿಟ್ಟು ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ.",
  },
  {
    id: "sc-general-mild",
    tags: ["general", "mild"],
    en: "Rest and stay hydrated. If new symptoms appear or things don't improve in a couple of days, check in again.",
    hi: "आराम करें और पानी पीते रहें। नए लक्षण दिखें या कुछ दिनों में सुधार न हो, तो दोबारा संपर्क करें।",
    kn: "ವಿಶ್ರಾಂತಿ ಪಡೆದು ನೀರು ಕುಡಿಯಿರಿ. ಹೊಸ ಲಕ್ಷಣಗಳು ಕಂಡುಬಂದರೆ ಅಥವಾ ಕೆಲವು ದಿನಗಳಲ್ಲಿ ಸುಧಾರಣೆ ಇಲ್ಲದಿದ್ದರೆ ಮತ್ತೆ ಸಂಪರ್ಕಿಸಿ.",
  },
  {
    id: "sc-diarrhea-mild",
    tags: ["diarrhea", "vomiting"],
    en: "Sip oral rehydration solution or salt-sugar water often, in small amounts. If you see sunken eyes, very little urine, or it lasts past 2 days, get seen.",
    hi: "थोड़ी-थोड़ी मात्रा में ओआरएस या नमक-चीनी का घोल बार-बार पिएं। आंखें धंसी हों, पेशाब बहुत कम हो, या 2 दिन से ज़्यादा रहे तो जांच करवाएं।",
    kn: "ಸ್ವಲ್ಪ ಸ್ವಲ್ಪವಾಗಿ ಪದೇ ಪದೇ ಒಆರ್‌ಎಸ್ ಅಥವಾ ಉಪ್ಪು-ಸಕ್ಕರೆ ನೀರು ಕುಡಿಯಿರಿ. ಕಣ್ಣುಗಳು ಒಳಸೇರಿದರೆ, ಮೂತ್ರ ಕಡಿಮೆಯಾದರೆ, ಅಥವಾ 2 ದಿನ ಮೀರಿದರೆ ತಪಾಸಣೆ ಮಾಡಿಸಿ.",
  },
  {
    id: "sc-cough-mild",
    tags: ["cough"],
    en: "Warm fluids and rest usually help. If breathlessness starts, or it passes a week without easing, please get checked.",
    hi: "गर्म तरल पदार्थ और आराम आमतौर पर मदद करते हैं। सांस फूलने लगे या एक हफ्ते में आराम न मिले तो जांच करवाएं।",
    kn: "ಬಿಸಿ ದ್ರವಗಳು ಮತ್ತು ವಿಶ್ರಾಂತಿ ಸಾಮಾನ್ಯವಾಗಿ ಸಹಾಯ ಮಾಡುತ್ತವೆ. ಉಸಿರಾಟದ ತೊಂದರೆ ಆರಂಭವಾದರೆ ಅಥವಾ ಒಂದು ವಾರ ಕಳೆದರೂ ಕಡಿಮೆಯಾಗದಿದ್ದರೆ ತಪಾಸಣೆ ಮಾಡಿಸಿ.",
  },
];

export function retrieveSelfCare(intake, language = "en") {
  const terms = new Set([...intake.symptoms, intake.durationDays < 2 ? "mild" : ""].filter(Boolean));

  let best = CORPUS[CORPUS.length - 1]; // general fallback
  let bestScore = -1;
  for (const doc of CORPUS) {
    const score = doc.tags.filter((t) => terms.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  return { id: best.id, text: best[language] || best.en };
}

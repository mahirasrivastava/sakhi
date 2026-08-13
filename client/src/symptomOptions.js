export const SYMPTOM_OPTIONS = [
  { id: "fever", icon: "🌡️", en: "Fever", hi: "बुखार", kn: "ಜ್ವರ" },
  { id: "high_fever", icon: "🔥", en: "Very high fever", hi: "तेज़ बुखार", kn: "ತೀವ್ರ ಜ್ವರ" },
  { id: "stiff_neck", icon: "🦴", en: "Stiff neck", hi: "गर्दन में अकड़न", kn: "ಕುತ್ತಿಗೆ ಬಿಗಿತ" },
  { id: "chest_pain", icon: "❤️‍🩹", en: "Chest pain", hi: "छाती में दर्द", kn: "ಎದೆ ನೋವು" },
  { id: "breathlessness", icon: "🫁", en: "Difficulty breathing", hi: "सांस लेने में तकलीफ", kn: "ಉಸಿರಾಟದ ತೊಂದರೆ" },
  { id: "unconscious", icon: "😵", en: "Fainting / unresponsive", hi: "बेहोशी", kn: "ಮೂರ್ಛೆ" },
  { id: "dizziness", icon: "💫", en: "Dizziness", hi: "चक्कर आना", kn: "ತಲೆ ಸುತ್ತುವಿಕೆ" },
  { id: "fatigue", icon: "😴", en: "Constant tiredness", hi: "लगातार थकान", kn: "ನಿರಂತರ ಆಯಾಸ" },
  { id: "heavy_bleeding_hourly", icon: "🩸", en: "Heavy bleeding, soaking a pad every hour", hi: "भारी रक्तस्राव, हर घंटे पैड भीगना", kn: "ಭಾರೀ ರಕ್ತಸ್ರಾವ, ಪ್ರತಿ ಗಂಟೆಗೂ ಪ್ಯಾಡ್ ತೊಯ್ಯುವಿಕೆ" },
  { id: "postmenopausal_bleeding", icon: "🩸", en: "Bleeding after menopause", hi: "मेनोपॉज़ के बाद रक्तस्राव", kn: "ಋತುಬಂಧದ ನಂತರ ರಕ್ತಸ್ರಾವ" },
  { id: "severe_period_pain", icon: "😖", en: "Severe period pain", hi: "गंभीर मासिक दर्द", kn: "ತೀವ್ರ ಮುಟ್ಟಿನ ನೋವು" },
  { id: "severe_headache", icon: "🤕", en: "Severe headache", hi: "तेज़ सिरदर्द", kn: "ತೀವ್ರ ತಲೆನೋವು" },
  { id: "blurred_vision", icon: "👓", en: "Blurred vision", hi: "धुंधला दिखना", kn: "ಮಸುಕಾದ ದೃಷ್ಟಿ" },
  { id: "convulsions", icon: "⚡", en: "Convulsions / fits", hi: "दौरे पड़ना", kn: "ಸೆಳೆತ" },
  { id: "reduced_fetal_movement", icon: "🤰", en: "Reduced baby movement (if pregnant)", hi: "गर्भ में हलचल कम होना", kn: "ಗರ್ಭದಲ್ಲಿ ಚಲನೆ ಕಡಿಮೆಯಾಗುವುದು" },
  { id: "water_breaking", icon: "💧", en: "Water breaking", hi: "पानी की थैली फटना", kn: "ನೀರು ಒಡೆಯುವುದು" },
  { id: "severe_swelling", icon: "🫧", en: "Severe swelling of face/hands", hi: "चेहरे/हाथों में सूजन", kn: "ಮುಖ/ಕೈಗಳ ಊತ" },
  { id: "severe_abdominal_pain", icon: "😣", en: "Severe abdominal pain", hi: "पेट में तेज़ दर्द", kn: "ತೀವ್ರ ಹೊಟ್ಟೆ ನೋವು" },
];

// General-population symptoms — not tied to reproductive health, used on the
// General Triage (MediMind) page so it reads as a triage tool for anyone.
export const GENERAL_SYMPTOM_OPTIONS = [
  { id: "fever", icon: "🌡️", en: "Fever", hi: "बुखार", kn: "ಜ್ವರ" },
  { id: "high_fever", icon: "🔥", en: "Very high fever", hi: "तेज़ बुखार", kn: "ತೀವ್ರ ಜ್ವರ" },
  { id: "stiff_neck", icon: "🦴", en: "Stiff neck", hi: "गर्दन में अकड़न", kn: "ಕುತ್ತಿಗೆ ಬಿಗಿತ" },
  { id: "chest_pain", icon: "❤️‍🩹", en: "Chest pain", hi: "छाती में दर्द", kn: "ಎದೆ ನೋವು" },
  { id: "breathlessness", icon: "🫁", en: "Difficulty breathing", hi: "सांस लेने में तकलीफ", kn: "ಉಸಿರಾಟದ ತೊಂದರೆ" },
  { id: "unconscious", icon: "😵", en: "Fainting / unresponsive", hi: "बेहोशी", kn: "ಮೂರ್ಛೆ" },
  { id: "cough", icon: "😷", en: "Cough", hi: "खांसी", kn: "ಕೆಮ್ಮು" },
  { id: "diarrhea", icon: "🚻", en: "Diarrhoea", hi: "दस्त", kn: "ಅತಿಸಾರ" },
  { id: "vomiting", icon: "🤮", en: "Vomiting", hi: "उल्टी", kn: "ವಾಂತಿ" },
  { id: "dehydration_signs", icon: "🥤", en: "Very little urine / sunken eyes", hi: "बहुत कम पेशाब / धंसी आंखें", kn: "ಕಡಿಮೆ ಮೂತ್ರ / ಒಳಸೇರಿದ ಕಣ್ಣುಗಳು" },
  { id: "severe_abdominal_pain", icon: "😣", en: "Severe stomach pain", hi: "पेट में तेज़ दर्द", kn: "ತೀವ್ರ ಹೊಟ್ಟೆ ನೋವು" },
  { id: "wound_bleeding_uncontrolled", icon: "🩹", en: "Injury with uncontrolled bleeding", hi: "चोट से बेकाबू खून बहना", kn: "ಗಾಯದಿಂದ ಅನಿಯಂತ್ರಿತ ರಕ್ತಸ್ರಾವ" },
  { id: "urinary_pain", icon: "🚽", en: "Pain or burning while urinating", hi: "पेशाब में दर्द या जलन", kn: "ಮೂತ್ರ ವಿಸರ್ಜನೆಯಲ್ಲಿ ನೋವು/ಉರಿ" },
  { id: "joint_pain", icon: "🦵", en: "Joint or body pain", hi: "जोड़ों/शरीर में दर्द", kn: "ಕೀಲು/ದೇಹ ನೋವು" },
  { id: "skin_rash", icon: "🩻", en: "Skin rash", hi: "त्वचा पर चकत्ते", kn: "ಚರ್ಮದ ದದ್ದು" },
  { id: "dizziness", icon: "💫", en: "Dizziness", hi: "चक्कर आना", kn: "ತಲೆ ಸುತ್ತುವಿಕೆ" },
  { id: "fatigue", icon: "😴", en: "Constant tiredness", hi: "लगातार थकान", kn: "ನಿರಂತರ ಆಯಾಸ" },
];

export function symptomLabel(id, lang) {
  const opt = SYMPTOM_OPTIONS.find((o) => o.id === id);
  if (!opt) return id;
  return opt[lang] || opt.en;
}

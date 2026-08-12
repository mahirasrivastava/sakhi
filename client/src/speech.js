// speech.js
// Thin wrapper around the Web Speech API. Both recognition and synthesis are
// optional enhancements — every caller must work fine if the browser doesn't
// support them (Safari/iOS in particular is patchy on recognition).

const LANG_CODES = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" };

export function speechRecognitionSupported() {
  return typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function speechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Starts listening and streams interim + final transcripts to onResult.
 * Returns a stop() function. Caller decides when to append the final
 * transcript into whatever text field it's driving.
 */
export function startListening(lang, { onResult, onEnd, onError }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    onError?.(new Error("Voice input isn't supported in this browser."));
    return () => {};
  }

  const recognition = new Recognition();
  recognition.lang = LANG_CODES[lang] || "en-IN";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    onResult?.(transcript, event.results[event.results.length - 1].isFinal);
  };
  recognition.onerror = (event) => onError?.(new Error(event.error || "Voice input failed."));
  recognition.onend = () => onEnd?.();

  try {
    recognition.start();
  } catch (err) {
    onError?.(err);
  }

  return () => recognition.stop();
}

export function speak(text, lang) {
  if (!speechSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel(); // don't stack multiple readouts
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_CODES[lang] || "en-IN";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}

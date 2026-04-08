import { useCallback, useEffect, useRef } from "react";


function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}


export function useLeafSpeech() {
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!isSpeechSupported()) {
      return;
    }

    const synth = window.speechSynthesis;

    const chooseVoice = () => {
      const voices = synth.getVoices();
      preferredVoiceRef.current =
        voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
        voices[0] ??
        null;
    };

    chooseVoice();
    synth.onvoiceschanged = chooseVoice;

    return () => {
      synth.cancel();
      synth.onvoiceschanged = null;
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!isSpeechSupported()) {
      return;
    }

    window.speechSynthesis.cancel();
  }, []);

  const speakText = useCallback((text: string) => {
    if (!isSpeechSupported() || text.trim().length === 0) {
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = 1;

    if (preferredVoiceRef.current) {
      utterance.voice = preferredVoiceRef.current;
    }

    synth.speak(utterance);
  }, []);

  const bindTextToSpeech = useCallback(
    (text: string) => ({
      onMouseEnter: () => speakText(text),
      onFocus: () => speakText(text),
      onTouchStart: () => speakText(text),
      onMouseLeave: () => stopSpeaking(),
      onBlur: () => stopSpeaking(),
    }),
    [speakText, stopSpeaking],
  );

  return {
    speechSupported: isSpeechSupported(),
    speakText,
    stopSpeaking,
    bindTextToSpeech,
  };
}


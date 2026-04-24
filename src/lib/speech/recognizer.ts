// Wrapper do Web Speech API (reconhecimento de voz contínuo com resultados interim).
// Suporte: Chrome / Edge (nativo). Safari: parcial. Firefox: sem suporte.

type WebkitWindow = Window & {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
};

function getRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WebkitWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export type RecognizerHandlers = {
  onInterim?: (interim: string, accumulatedFinal: string) => void;
  onFinal?: (chunk: string, accumulatedFinal: string) => void;
  onError?: (error: string, event: SpeechRecognitionErrorEvent) => void;
  onEnd?: (accumulatedFinal: string) => void;
};

export type Recognizer = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  getFinal: () => string;
  resetTranscript: () => void;
};

export function createRecognizer({
  lang = "pt-BR",
  ...handlers
}: { lang?: string } & RecognizerHandlers = {}): Recognizer {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    throw new Error("Seu browser não suporta Web Speech API. Use Chrome ou Edge.");
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = "";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) {
        finalTranscript += text + " ";
        handlers.onFinal?.(text, finalTranscript.trim());
      } else {
        interim += text;
      }
    }
    handlers.onInterim?.(interim, finalTranscript.trim());
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    handlers.onError?.(event.error, event);
  };

  recognition.onend = () => {
    handlers.onEnd?.(finalTranscript.trim());
  };

  return {
    start: () => {
      finalTranscript = "";
      try {
        recognition.start();
      } catch {
        // Ignora "already started".
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {}
    },
    getFinal: () => finalTranscript.trim(),
    resetTranscript: () => {
      finalTranscript = "";
    },
  };
}

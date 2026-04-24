// Abstração comum sobre Web Speech API e Whisper (gpt-4o-transcribe).
// O composer depende só desta interface — a escolha entre engines é um
// detalhe de factory + persistência (ver src/lib/store/voice-engine.ts).
//
// Diferenças importantes entre as duas implementações:
//   - Web Speech emite interim + vários onFinal conforme o usuário fala.
//   - Whisper é one-shot: sem interim, um único onFinal depois do stop().
//
// Ambas emitem onFinal com (chunk, accumulatedFinal) — no Whisper os dois
// são iguais, então o consumidor pode tratar o acumulado uniformemente.

export type VoiceEngineKind = "whisper" | "web-speech";

export type VoiceEngineState = "idle" | "recording" | "transcribing";

export type VoiceEngineHandlers = {
  onInterim?: (interim: string, accumulatedFinal: string) => void;
  onFinal?: (chunk: string, accumulatedFinal: string) => void;
  onError?: (message: string) => void;
  onStateChange?: (state: VoiceEngineState) => void;
};

export type VoiceEngine = {
  readonly kind: VoiceEngineKind;
  start(): Promise<void>;
  stop(): Promise<void>;
  abort(): void;
  getState(): VoiceEngineState;
};

export type CreateVoiceEngineOptions = VoiceEngineHandlers & {
  kind: VoiceEngineKind;
};

export async function createVoiceEngine(
  options: CreateVoiceEngineOptions,
): Promise<VoiceEngine> {
  if (options.kind === "whisper") {
    const { createWhisperEngine } = await import("./whisper-engine");
    return createWhisperEngine(options);
  }
  const { createWebSpeechEngine } = await import("./web-speech-engine");
  return createWebSpeechEngine(options);
}

export function isEngineSupported(kind: VoiceEngineKind): boolean {
  if (typeof window === "undefined") return false;
  if (kind === "whisper") {
    return (
      typeof MediaRecorder !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia
    );
  }
  // Web Speech
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

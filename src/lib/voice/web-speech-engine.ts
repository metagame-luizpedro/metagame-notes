// Adapta o Web Speech recognizer pra interface VoiceEngine.
// Nunca entra em estado "transcribing" — o reconhecimento é streaming
// e o texto final já sai na hora do stop.

import { createRecognizer, type Recognizer } from "@/lib/speech/recognizer";
import type {
  CreateVoiceEngineOptions,
  VoiceEngine,
  VoiceEngineState,
} from "./engine";

export function createWebSpeechEngine(options: CreateVoiceEngineOptions): VoiceEngine {
  let state: VoiceEngineState = "idle";
  let recognizer: Recognizer | null = null;

  function setState(next: VoiceEngineState) {
    if (state === next) return;
    state = next;
    options.onStateChange?.(next);
  }

  return {
    kind: "web-speech",
    async start() {
      if (state !== "idle") return;
      try {
        recognizer = createRecognizer({
          onInterim: (interim, acc) => options.onInterim?.(interim, acc),
          onFinal: (chunk, acc) => options.onFinal?.(chunk, acc),
          onError: (err) => {
            if (err === "no-speech" || err === "aborted") return;
            options.onError?.(err);
            setState("idle");
          },
          onEnd: () => setState("idle"),
        });
        recognizer.start();
        setState("recording");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        options.onError?.(message);
        setState("idle");
      }
    },
    async stop() {
      if (!recognizer) return;
      recognizer.stop();
      // onEnd vai disparar setState("idle") em seguida.
    },
    abort() {
      recognizer?.abort();
      recognizer = null;
      setState("idle");
    },
    getState: () => state,
  };
}

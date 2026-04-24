// Adapta MediaRecorder + /api/transcribe pra interface VoiceEngine.
// Fluxo:
//   start()      -> pede mic, começa a gravar, state = "recording"
//   stop()       -> para gravação, state = "transcribing", chama API, emite
//                   onFinal(text, text), volta pra "idle"
// Sem interim — Whisper é one-shot.

import { createAudioRecorder, type AudioRecorder } from "./recorder";
import { transcribeBlob } from "./whisper";
import type {
  CreateVoiceEngineOptions,
  VoiceEngine,
  VoiceEngineState,
} from "./engine";

const MAX_RECORDING_SEC = 60;

export function createWhisperEngine(options: CreateVoiceEngineOptions): VoiceEngine {
  let state: VoiceEngineState = "idle";
  let recorder: AudioRecorder | null = null;
  let abortController: AbortController | null = null;

  function setState(next: VoiceEngineState) {
    if (state === next) return;
    state = next;
    options.onStateChange?.(next);
  }

  async function transcribeAndEmit(blob: Blob, durationSec: number) {
    setState("transcribing");
    abortController = new AbortController();
    try {
      const result = await transcribeBlob(blob, durationSec, abortController.signal);
      const text = result.text.trim();
      if (text) options.onFinal?.(text, text);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      options.onError?.(message);
    } finally {
      abortController = null;
      recorder = null;
      setState("idle");
    }
  }

  return {
    kind: "whisper",
    async start() {
      if (state !== "idle") return;
      try {
        recorder = await createAudioRecorder({
          maxDurationSec: MAX_RECORDING_SEC,
          onMaxReached: () => {
            // Dispara stop automático; o resultado vai pro onFinal normal.
            options.onError?.(
              `Gravação parou no limite de ${MAX_RECORDING_SEC}s. Transcrevendo o que foi capturado.`,
            );
          },
        });
        recorder.start();
        setState("recording");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        options.onError?.(
          /permission|denied|notallowed/i.test(message)
            ? "Permissão de microfone negada."
            : `Erro ao acessar o microfone: ${message}`,
        );
        setState("idle");
        recorder = null;
      }
    },
    async stop() {
      if (!recorder || state !== "recording") return;
      const current = recorder;
      try {
        const blob = await current.stop();
        const durationSec = current.getDurationSec();
        if (blob.size < 1024) {
          options.onError?.("Áudio muito curto.");
          setState("idle");
          recorder = null;
          return;
        }
        await transcribeAndEmit(blob, durationSec);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        options.onError?.(message);
        setState("idle");
        recorder = null;
      }
    },
    abort() {
      abortController?.abort();
      recorder?.abort();
      recorder = null;
      abortController = null;
      setState("idle");
    },
    getState: () => state,
  };
}

// Wrapper de MediaRecorder para gravar áudio do microfone até o user parar.
// Uso:
//   const rec = await createAudioRecorder({ onTick: (sec) => ... })
//   rec.start()
//   ...
//   const blob = await rec.stop()
//
// Lembra de fechar a stream do mic — sem isso o ícone de gravando fica
// piscando no browser mesmo depois de parar.

const PREFERRED_MIME = "audio/webm;codecs=opus";

function pickSupportedMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export type AudioRecorder = {
  start: () => void;
  stop: () => Promise<Blob>;
  abort: () => void;
  getDurationSec: () => number;
};

type CreateOptions = {
  onTick?: (durationSec: number) => void;
  maxDurationSec?: number;
  onMaxReached?: () => void;
};

export async function createAudioRecorder({
  onTick,
  maxDurationSec = 60,
  onMaxReached,
}: CreateOptions = {}): Promise<AudioRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickSupportedMime();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];

  let startedAt = 0;
  let stoppedAt = 0;
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let stopResolve: ((blob: Blob) => void) | null = null;
  let stopReject: ((err: Error) => void) | null = null;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    stoppedAt = performance.now();
    stream.getTracks().forEach((t) => t.stop());
    if (tickInterval) clearInterval(tickInterval);
    if (maxTimer) clearTimeout(maxTimer);
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    stopResolve?.(blob);
    stopResolve = null;
    stopReject = null;
  };

  recorder.onerror = (event) => {
    stream.getTracks().forEach((t) => t.stop());
    if (tickInterval) clearInterval(tickInterval);
    if (maxTimer) clearTimeout(maxTimer);
    const err = new Error(`MediaRecorder error: ${(event as ErrorEvent).message ?? "unknown"}`);
    stopReject?.(err);
    stopResolve = null;
    stopReject = null;
  };

  function getDurationSec(): number {
    if (!startedAt) return 0;
    const end = stoppedAt || performance.now();
    return (end - startedAt) / 1000;
  }

  return {
    start() {
      startedAt = performance.now();
      stoppedAt = 0;
      recorder.start();
      if (onTick) {
        tickInterval = setInterval(() => onTick(getDurationSec()), 100);
      }
      maxTimer = setTimeout(() => {
        if (recorder.state === "recording") {
          onMaxReached?.();
          recorder.stop();
        }
      }, maxDurationSec * 1000);
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (recorder.state === "inactive") {
          reject(new Error("Recorder is not active."));
          return;
        }
        stopResolve = resolve;
        stopReject = reject;
        recorder.stop();
      });
    },
    abort() {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      if (tickInterval) clearInterval(tickInterval);
      if (maxTimer) clearTimeout(maxTimer);
    },
    getDurationSec,
  };
}

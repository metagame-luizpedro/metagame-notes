// Cliente do endpoint /api/transcribe.
// Recebe um Blob de áudio + duração medida no client (gpt-4o-transcribe não
// retorna duração no response). Retorna o texto + metadados de custo.

export type TranscribeResult = {
  text: string;
  model: string;
  durationSec: number;
  costUsd: number;
  pricePerMinute: number;
  bytes: number;
  responseTimeMs: number;
  promptUsed: string;
  nicksInPrompt: number;
};

export async function transcribeBlob(
  blob: Blob,
  durationSec: number,
  signal?: AbortSignal,
): Promise<TranscribeResult> {
  const formData = new FormData();
  const filename = blob.type.includes("mp4") ? "audio.mp4" : "audio.webm";
  formData.append("file", blob, filename);
  formData.append("durationSec", String(durationSec));

  const startedAt = performance.now();
  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
    signal,
  });
  const responseTimeMs = performance.now() - startedAt;

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  const data = (await response.json()) as {
    text: string;
    model: string;
    durationSec: number;
    costUsd: number;
    pricePerMinute: number;
    bytes: number;
    promptUsed: string;
    nicksInPrompt: number;
  };

  return { ...data, responseTimeMs };
}

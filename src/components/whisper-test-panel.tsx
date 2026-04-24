"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createAudioRecorder, type AudioRecorder } from "@/lib/voice/recorder";
import { transcribeBlob, type TranscribeResult } from "@/lib/voice/whisper";

const SUGGESTED_PROMPTS = [
  '"o Matt dá 3bet demais do BTN, dá pra 4betar mais wide"',
  '"o 李小龙 é nit total, só joga top 8% no SB"',
  '"esse cara faz overbet em river polarizado, foldar tudo abaixo de top pair"',
];

export function WhisperTestPanel() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [history, setHistory] = useState<TranscribeResult[]>([]);
  const recorderRef = useRef<AudioRecorder | null>(null);

  async function handleStart() {
    try {
      const rec = await createAudioRecorder({
        onTick: setDuration,
        maxDurationSec: 60,
        onMaxReached: () => toast.warning("Limite de 60s atingido. Parando."),
      });
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setDuration(0);
      setResult(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Permita o microfone no navegador."
            : err.message
          : "Erro ao iniciar gravação.";
      toast.error(message);
    }
  }

  async function handleStop() {
    if (!recorderRef.current) return;
    setRecording(false);
    setTranscribing(true);
    try {
      const rec = recorderRef.current;
      const blob = await rec.stop();
      const measuredDuration = rec.getDurationSec();
      const out = await transcribeBlob(blob, measuredDuration);
      setResult(out);
      setHistory((h) => [out, ...h].slice(0, 5));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao transcrever.";
      toast.error(message);
    } finally {
      setTranscribing(false);
      recorderRef.current = null;
    }
  }

  const totalCost = history.reduce((acc, r) => acc + r.costUsd, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Sugestões de teste</h2>
        <ul className="text-muted-foreground space-y-1 text-sm">
          {SUGGESTED_PROMPTS.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      </div>

      <div className="border-border flex flex-col items-center gap-4 rounded-lg border p-8">
        <button
          type="button"
          onClick={recording ? handleStop : handleStart}
          disabled={transcribing}
          aria-pressed={recording}
          className={cn(
            "flex size-24 items-center justify-center rounded-full border-2 shadow-xl transition-all",
            recording
              ? "border-destructive/40 bg-destructive text-destructive-foreground animate-pulse"
              : "border-border bg-foreground text-background hover:opacity-90 active:scale-95",
            transcribing && "cursor-not-allowed opacity-40",
          )}
        >
          {recording ? <Square className="size-7 fill-current" /> : <Mic className="size-9" />}
        </button>

        <div className="text-center">
          {recording && (
            <p className="font-mono text-2xl">
              {duration.toFixed(1)}s <span className="text-muted-foreground text-sm">/ 60s</span>
            </p>
          )}
          {transcribing && (
            <p className="text-muted-foreground text-sm">Transcrevendo com Whisper…</p>
          )}
          {!recording && !transcribing && !result && (
            <p className="text-muted-foreground text-sm">Clica pra começar</p>
          )}
        </div>
      </div>

      {result && (
        <div className="border-border space-y-4 rounded-lg border p-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Texto transcrito</h3>
              <span className="text-muted-foreground font-mono text-xs">
                {result.model} · ${result.pricePerMinute.toFixed(3)}/min ·{" "}
                {result.nicksInPrompt} nicks no prompt
              </span>
            </div>
            <p className="text-base leading-relaxed">{result.text || "(vazio)"}</p>
          </div>

          <div className="border-border grid grid-cols-2 gap-3 border-t pt-4 text-sm sm:grid-cols-4">
            <Metric label="Tamanho" value={`${(result.bytes / 1024).toFixed(1)} KB`} />
            <Metric label="Áudio" value={`${result.durationSec.toFixed(1)}s`} />
            <Metric label="Resposta" value={`${(result.responseTimeMs / 1000).toFixed(2)}s`} />
            <Metric label="Custo" value={`$${result.costUsd.toFixed(4)}`} />
          </div>

          <details className="border-border border-t pt-3">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
              Ver prompt enviado pra OpenAI
            </summary>
            <pre className="bg-muted text-muted-foreground mt-2 max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
              {result.promptUsed}
            </pre>
          </details>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Histórico da sessão</h3>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">
                Custo total: <span className="font-mono">${totalCost.toFixed(4)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setHistory([])}>
                Limpar
              </Button>
            </div>
          </div>
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li
                key={i}
                className="border-border flex items-start justify-between gap-4 rounded border p-3 text-sm"
              >
                <span className="flex-1 truncate">{h.text || "(vazio)"}</span>
                <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  {h.durationSec.toFixed(1)}s · ${h.costUsd.toFixed(4)} ·{" "}
                  {(h.responseTimeMs / 1000).toFixed(2)}s
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono text-base">{value}</p>
    </div>
  );
}

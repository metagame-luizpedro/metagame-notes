"use client";

import { useEffect } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  recording: boolean;
  transcribing?: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function MicButton({ recording, transcribing, disabled, onToggle }: Props) {
  const effectiveDisabled = disabled || transcribing;

  // Atalho: barra de espaço — somente quando o foco NÃO está em campo editável.
  // Também bloqueado durante transcrição pra não iniciar outra gravação.
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      if (!effectiveDisabled) onToggle();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [effectiveDisabled, onToggle]);

  const title = transcribing
    ? "Transcrevendo…"
    : recording
      ? "Parar (Espaço)"
      : "Gravar (Espaço)";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={effectiveDisabled}
      aria-pressed={recording}
      aria-busy={transcribing}
      title={title}
      className={cn(
        "relative flex size-24 items-center justify-center rounded-full border-2 shadow-xl transition-all",
        recording && !transcribing
          ? "border-destructive/40 bg-destructive text-destructive-foreground animate-pulse"
          : "border-border bg-foreground text-background hover:opacity-90 active:scale-95",
        effectiveDisabled && "cursor-not-allowed",
        transcribing ? "opacity-80" : disabled && "opacity-40",
      )}
    >
      {transcribing ? (
        <Loader2 className="size-8 animate-spin" />
      ) : recording ? (
        <Square className="size-7 fill-current" />
      ) : (
        <Mic className="size-9" />
      )}
    </button>
  );
}

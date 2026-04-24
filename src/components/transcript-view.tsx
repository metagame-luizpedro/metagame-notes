"use client";

import { useMemo } from "react";
import { highlightText } from "@/lib/speech/nicks";
import { cn } from "@/lib/utils";

type Props = {
  finalText: string;
  interimText: string;
  knownNicks: readonly string[];
  placeholder?: string;
};

// Renderiza o transcript com highlight nos nicks detectados.
// Aplica a destacação tanto no texto FINAL (committed) quanto no INTERIM
// (ainda sendo falado), pra dar feedback imediato.
export function TranscriptView({
  finalText,
  interimText,
  knownNicks,
  placeholder = "Aperte Espaço ou clique no microfone…",
}: Props) {
  const finalParts = useMemo(() => highlightText(finalText, knownNicks), [finalText, knownNicks]);
  const interimParts = useMemo(
    () => highlightText(interimText, knownNicks),
    [interimText, knownNicks],
  );

  const isEmpty = !finalText && !interimText;

  return (
    <div
      className={cn(
        "border-border min-h-[160px] rounded-lg border p-4 text-base leading-relaxed",
        isEmpty && "text-muted-foreground italic",
      )}
      aria-live="polite"
    >
      {isEmpty ? (
        placeholder
      ) : (
        <>
          {finalParts.map((p, i) =>
            p.type === "nick" ? (
              <mark
                key={`f-${i}`}
                className="bg-foreground/15 text-foreground rounded px-1 font-medium"
              >
                {p.content}
              </mark>
            ) : (
              <span key={`f-${i}`}>{p.content}</span>
            ),
          )}
          {interimText && (
            <span className="text-muted-foreground">
              {finalText && " "}
              {interimParts.map((p, i) =>
                p.type === "nick" ? (
                  <mark
                    key={`i-${i}`}
                    className="bg-foreground/10 text-muted-foreground rounded px-1 font-medium"
                  >
                    {p.content}
                  </mark>
                ) : (
                  <span key={`i-${i}`}>{p.content}</span>
                ),
              )}
            </span>
          )}
        </>
      )}
    </div>
  );
}

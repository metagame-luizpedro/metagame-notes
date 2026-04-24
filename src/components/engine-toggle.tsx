"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVoiceEngineStore } from "@/lib/store/voice-engine";
import { isEngineSupported, type VoiceEngineKind } from "@/lib/voice/engine";
import { cn } from "@/lib/utils";

type Option = {
  value: VoiceEngineKind;
  label: string;
  hint: string;
};

const OPTIONS: Option[] = [
  { value: "whisper", label: "Whisper (recomendado)", hint: "Qualidade superior, envia áudio pra API." },
  { value: "web-speech", label: "Web Speech (grátis, offline)", hint: "Roda no browser, sem custo." },
];

export function EngineToggle({ className }: { className?: string }) {
  const kind = useVoiceEngineStore((s) => s.kind);
  const setKind = useVoiceEngineStore((s) => s.setKind);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Configurar engine de voz"
          className={cn("h-8 w-8", className)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Engine de voz</PopoverTitle>
          <PopoverDescription>Escolha como o áudio é transcrito.</PopoverDescription>
        </PopoverHeader>
        <div role="radiogroup" aria-label="Engine de voz" className="flex flex-col gap-1.5">
          {OPTIONS.map((opt) => {
            const supported = isEngineSupported(opt.value);
            const selected = kind === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!supported}
                onClick={() => setKind(opt.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                  selected
                    ? "border-foreground/30 bg-accent"
                    : "border-transparent hover:bg-accent/60",
                  !supported && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-muted-foreground text-xs">
                  {supported ? opt.hint : "Não suportado neste browser."}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

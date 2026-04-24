"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/mic-button";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { TranscriptView } from "@/components/transcript-view";
import { PlayerTagger, detectMentionedPlayerIds } from "@/components/player-tagger";
import { EngineToggle } from "@/components/engine-toggle";
import { detectVisibilityTrigger } from "@/lib/speech/triggers";
import { createClient } from "@/lib/supabase/client";
import { createNoteWithMentions } from "@/lib/db/notes";
import { useNicksStore } from "@/lib/store/nicks";
import { useUserStore } from "@/lib/store/user";
import { useVoiceEngineStore } from "@/lib/store/voice-engine";
import {
  createVoiceEngine,
  isEngineSupported,
  type VoiceEngine,
  type VoiceEngineState,
} from "@/lib/voice/engine";
import type { NoteVisibility } from "@/lib/types";

type Props = {
  onSaved?: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function NoteComposer({ onSaved }: Props) {
  const profile = useUserStore((s) => s.profile);
  const players = useNicksStore((s) => s.players);
  const knownNicks = useNicksStore((s) => s.nicks);
  const engineKind = useVoiceEngineStore((s) => s.kind);

  const [engineState, setEngineState] = useState<VoiceEngineState>("idle");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("personal");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [manualEdit, setManualEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const engineRef = useRef<VoiceEngine | null>(null);

  const recording = engineState === "recording";
  const transcribing = engineState === "transcribing";
  const busy = engineState !== "idle" || saving;

  const applyAutoDetections = useCallback(
    (source: string) => {
      const { visibility: detected } = detectVisibilityTrigger(source);
      if (detected) {
        setVisibility((prev) => (prev === detected ? prev : detected));
      }
      const mentioned = detectMentionedPlayerIds(source, players);
      if (mentioned.length) {
        setSelectedPlayerIds((prev) => {
          const merged = new Set([...prev, ...mentioned]);
          return merged.size === prev.length ? prev : [...merged];
        });
      }
    },
    [players],
  );

  const startRecording = useCallback(async () => {
    if (!isEngineSupported(engineKind)) {
      toast.error(
        engineKind === "web-speech"
          ? "Web Speech não suportada. Use Chrome/Edge ou troque pro Whisper."
          : "Whisper indisponível: MediaRecorder não suportado neste browser.",
      );
      return;
    }
    setManualEdit(false);
    try {
      const engine = await createVoiceEngine({
        kind: engineKind,
        onInterim: (interim, accumulated) => {
          setInterimText(interim);
          applyAutoDetections(accumulated + (interim ? " " + interim : ""));
        },
        onFinal: (_chunk, accumulated) => {
          setFinalText(accumulated);
          setInterimText("");
          applyAutoDetections(accumulated);
        },
        onError: (message) => {
          toast.error(message);
        },
        onStateChange: (state) => setEngineState(state),
      });
      engineRef.current = engine;
      await engine.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar voz.";
      toast.error(message);
      setEngineState("idle");
    }
  }, [engineKind, applyAutoDetections]);

  const stopRecording = useCallback(async () => {
    await engineRef.current?.stop();
  }, []);

  const toggleMic = useCallback(() => {
    if (transcribing) return;
    if (recording) void stopRecording();
    else void startRecording();
  }, [recording, transcribing, startRecording, stopRecording]);

  const reset = useCallback(() => {
    engineRef.current?.abort();
    engineRef.current = null;
    setEngineState("idle");
    setFinalText("");
    setInterimText("");
    setVisibility("personal");
    setSelectedPlayerIds([]);
    setManualEdit(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!profile) {
      toast.error("Perfil não carregado.");
      return;
    }
    if (busy) return;

    const fullText = (finalText + (interimText ? " " + interimText : "")).trim();
    const { cleanedText } = detectVisibilityTrigger(fullText);
    const content = cleanedText.trim();

    if (!content) {
      toast.error("Nota vazia.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      await createNoteWithMentions(supabase, {
        authorId: profile.id,
        visibility,
        content,
        playerIds: selectedPlayerIds,
      });
      toast.success("Nota salva.");
      reset();
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar nota.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [profile, busy, finalText, interimText, visibility, selectedPlayerIds, onSaved, reset]);

  const hasText = (finalText + interimText).trim().length > 0;

  // Atalho: Enter salva a nota. Regras:
  //   - ignora Shift+Enter (reservado pra quebra de linha / futuras features)
  //   - ignora se o foco está em input/textarea/contenteditable (default do browser)
  //   - só dispara quando há texto E o composer está idle (não gravando/transcrevendo/salvando)
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      if (!hasText || busy) return;
      e.preventDefault();
      void handleSave();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [hasText, busy, handleSave]);

  return (
    <div className="relative space-y-5">
      <div className="absolute top-0 right-0">
        <EngineToggle />
      </div>

      <div className="flex items-center gap-4 pr-10">
        <MicButton
          recording={recording}
          transcribing={transcribing}
          disabled={saving}
          onToggle={toggleMic}
        />
        <div className="flex flex-col gap-1">
          <VisibilityToggle value={visibility} onChange={setVisibility} />
          <p className="text-muted-foreground text-xs">
            Atalho: <kbd className="bg-muted rounded px-1.5 py-0.5">Espaço</kbd> liga/desliga o
            mic, <kbd className="bg-muted rounded px-1.5 py-0.5">Enter</kbd> salva a nota.
          </p>
          {transcribing && (
            <p className="text-muted-foreground text-xs">Transcrevendo áudio…</p>
          )}
        </div>
      </div>

      {manualEdit ? (
        <Textarea
          value={finalText}
          onChange={(e) => {
            setFinalText(e.target.value);
            applyAutoDetections(e.target.value);
          }}
          rows={5}
          autoFocus
          placeholder="Digite a nota…"
        />
      ) : (
        <button
          type="button"
          className="block w-full text-left"
          disabled={transcribing}
          onClick={() => {
            if (recording) void stopRecording();
            setFinalText((prev) => (prev + (interimText ? " " + interimText : "")).trim());
            setInterimText("");
            setManualEdit(true);
          }}
          title="Clique pra editar manualmente"
        >
          <TranscriptView finalText={finalText} interimText={interimText} knownNicks={knownNicks} />
        </button>
      )}

      <PlayerTagger selectedIds={selectedPlayerIds} onChange={setSelectedPlayerIds} />

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
          Limpar
        </Button>
        <Button type="button" onClick={handleSave} disabled={busy || !hasText}>
          {saving ? "Salvando…" : transcribing ? "Aguarde…" : "Salvar nota"}
        </Button>
      </div>
    </div>
  );
}

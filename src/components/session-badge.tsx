"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleDot, Play } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SessionStartDialog } from "@/components/session-start-dialog";
import { createClient } from "@/lib/supabase/client";
import { endSession } from "@/lib/db/sessions";
import { useSessionStore } from "@/lib/store/session";
import { cn } from "@/lib/utils";

const LONG_SESSION_MS = 12 * 60 * 60 * 1000; // 12h — aviso visual, sem auto-close

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function SessionBadge() {
  const active = useSessionStore((s) => s.active);
  const setActive = useSessionStore((s) => s.setActive);
  const [startOpen, setStartOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick só enquanto tem sessão ativa. setState local — não toca nos outros stores.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  async function handleEnd() {
    if (!active) return;
    setEnding(true);
    try {
      const supabase = createClient();
      await endSession(supabase, active.id);
      setActive(null);
      toast.success("Sessão encerrada.");
      setConfirmEnd(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao encerrar.";
      toast.error(message);
    } finally {
      setEnding(false);
    }
  }

  if (!active) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setStartOpen(true)}
        >
          <Play className="size-3.5" />
          Iniciar sessão
        </Button>
        <SessionStartDialog open={startOpen} onOpenChange={setStartOpen} />
      </>
    );
  }

  const elapsedMs = now - new Date(active.started_at).getTime();
  const tooLong = elapsedMs > LONG_SESSION_MS;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmEnd(true)}
        title={tooLong ? "Sessão aberta há mais de 12h" : "Encerrar sessão"}
        className={cn(
          "border-border flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
          tooLong
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            : "hover:bg-muted",
        )}
      >
        {tooLong ? (
          <AlertTriangle className="size-3.5" />
        ) : (
          <CircleDot className="size-3.5 animate-pulse text-red-500" />
        )}
        <span className="font-semibold">{active.stake}</span>
        <span className="text-muted-foreground tabular-nums">{formatElapsed(elapsedMs)}</span>
      </button>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              {active.stake} · {formatElapsed(elapsedMs)}
              {active.tables.length > 0 && <> · {active.tables.join(", ")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd} disabled={ending}>
              {ending ? "Encerrando…" : "Encerrar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

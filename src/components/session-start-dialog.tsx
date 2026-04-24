"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { startSession } from "@/lib/db/sessions";
import { useSessionStore } from "@/lib/store/session";
import { useUserStore } from "@/lib/store/user";
import { cn } from "@/lib/utils";

const STAKE_PRESETS = [
  "NL10",
  "NL20",
  "NL40",
  "NL50",
  "NL100",
  "NL200",
  "NL500",
  "NL1000",
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SessionStartDialog({ open, onOpenChange }: Props) {
  const profile = useUserStore((s) => s.profile);
  const setActive = useSessionStore((s) => s.setActive);
  const [stakePick, setStakePick] = useState<string>("NL20");
  const [customStake, setCustomStake] = useState("");
  const [tablesRaw, setTablesRaw] = useState("");
  const [saving, setSaving] = useState(false);

  const isCustom = stakePick === "__other__";
  const effectiveStake = isCustom ? customStake.trim() : stakePick;

  async function handleStart() {
    if (!profile) {
      toast.error("Perfil não carregado.");
      return;
    }
    if (!effectiveStake) {
      toast.error("Informe o stake.");
      return;
    }

    const tables = tablesRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const supabase = createClient();
      const session = await startSession(supabase, {
        userId: profile.id,
        stake: effectiveStake,
        tables,
      });
      setActive(session);
      toast.success("Sessão iniciada.");
      // Reseta pro próximo uso, mas só depois do setActive pra evitar flicker.
      setStakePick("NL20");
      setCustomStake("");
      setTablesRaw("");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao iniciar sessão.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar sessão</DialogTitle>
          <DialogDescription>
            As notas criadas enquanto a sessão estiver ativa ficam vinculadas a ela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Stake</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STAKE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStakePick(s)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-sm transition-colors",
                    stakePick === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStakePick("__other__")}
                className={cn(
                  "col-span-2 rounded-md border px-2 py-1.5 text-sm transition-colors",
                  isCustom
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Outro…
              </button>
            </div>
            {isCustom && (
              <Input
                placeholder="Ex: PLO50, NL25, Spin…"
                value={customStake}
                onChange={(e) => setCustomStake(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Mesas <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Mesa 1, Mesa 2, Mesa 3"
              value={tablesRaw}
              onChange={(e) => setTablesRaw(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Separe por vírgula.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleStart} disabled={saving || !effectiveStake}>
            {saving ? "Iniciando…" : "Começar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

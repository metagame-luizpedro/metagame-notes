"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createPlayer, updatePlayer } from "@/lib/db/players";
import { useNicksStore } from "@/lib/store/nicks";
import type { Player } from "@/lib/types";

type Props = {
  trigger: React.ReactNode;
  player?: Player;
  onSaved?: (player: Player) => void;
};

export function PlayerForm({ trigger, player, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState(player?.nick ?? "");
  const [pending, startTransition] = useTransition();
  const upsertPlayer = useNicksStore((s) => s.upsertPlayer);

  const isEditing = !!player;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = nick.trim();
    if (!trimmed) {
      toast.error("Nick é obrigatório.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const saved = isEditing
          ? await updatePlayer(supabase, player.id, trimmed)
          : await createPlayer(supabase, trimmed);
        upsertPlayer(saved);
        toast.success(isEditing ? "Jogador atualizado." : "Jogador criado.");
        setOpen(false);
        onSaved?.(saved);
        if (!isEditing) setNick("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar.";
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar jogador" : "Novo jogador"}</DialogTitle>
            <DialogDescription>
              Nick exato como aparece na mesa do WPT/Nexa. Pode incluir caracteres asiáticos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="nick" className="text-sm font-medium">
              Nick
            </label>
            <Input
              id="nick"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              required
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

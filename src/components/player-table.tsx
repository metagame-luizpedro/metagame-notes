"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { PlayerForm } from "@/components/player-form";
import { TagChip } from "@/components/player-tags-manager";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { deletePlayer } from "@/lib/db/players";
import { useNicksStore } from "@/lib/store/nicks";
import type { Player, PlayerTag } from "@/lib/types";

const MAX_VISIBLE_TAGS = 3;

type Props = {
  tagsByPlayer: Record<string, PlayerTag[]>;
};

export function PlayerTable({ tagsByPlayer }: Props) {
  const router = useRouter();
  const players = useNicksStore((s) => s.players);
  const removePlayer = useNicksStore((s) => s.removePlayer);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    startTransition(async () => {
      try {
        const supabase = createClient();
        await deletePlayer(supabase, target.id);
        removePlayer(target.id);
        toast.success(`Jogador "${target.nick}" deletado.`);
        setConfirmDelete(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao deletar.";
        toast.error(message);
      }
    });
  }

  if (!players.length) {
    return (
      <div className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
        Nenhum jogador cadastrado ainda.
      </div>
    );
  }

  return (
    <>
      <div className="border-border rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nick</TableHead>
              <TableHead className="w-[200px]">Criado em</TableHead>
              <TableHead className="w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((p) => {
              const tags = tagsByPlayer[p.id] ?? [];
              const visible = tags.slice(0, MAX_VISIBLE_TAGS);
              const hidden = tags.length - visible.length;
              return (
              <TableRow
                key={p.id}
                onClick={() => router.push(`/players/${p.id}`)}
                className="hover:bg-muted/50 cursor-pointer"
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{p.nick}</span>
                    {visible.map((t) => (
                      <TagChip key={t.id} tag={t} compact />
                    ))}
                    {hidden > 0 && (
                      <span className="text-muted-foreground text-[10px]">+{hidden}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <PlayerForm
                      player={p}
                      trigger={
                        <Button variant="ghost" size="sm" aria-label="Editar">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Deletar"
                      onClick={() => setConfirmDelete(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar jogador?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete &&
                `"${confirmDelete.nick}" será removido. Notas que mencionam esse jogador serão preservadas, mas perderão a associação.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              {pending ? "Deletando…" : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

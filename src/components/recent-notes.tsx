"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Trash2, Users } from "lucide-react";
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
import { NoteEditDialog } from "@/components/note-edit-dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteNote, listMyRecentNotes, type NoteWithMentions } from "@/lib/db/notes";
import { useUserStore } from "@/lib/store/user";
import { cn } from "@/lib/utils";

type Props = {
  refreshKey?: number;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min atrás`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RecentNotes({ refreshKey = 0 }: Props) {
  const profile = useUserStore((s) => s.profile);
  // null = ainda não carregou; array = última lista conhecida (stale-while-revalidate
  // durante refresh pra evitar flash de "Carregando" na UI).
  const [notes, setNotes] = useState<NoteWithMentions[] | null>(null);
  const [internalTick, setInternalTick] = useState(0);
  const [editing, setEditing] = useState<NoteWithMentions | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(() => setInternalTick((t) => t + 1), []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const supabase = createClient();
    listMyRecentNotes(supabase, profile.id, 10)
      .then((rows) => {
        if (!cancelled) setNotes(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Erro ao listar notas.";
          toast.error(message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profile, refreshKey, internalTick]);

  async function handleDelete() {
    if (!deletingId) return;
    try {
      const supabase = createClient();
      await deleteNote(supabase, deletingId);
      toast.success("Nota apagada.");
      setDeletingId(null);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao apagar.";
      toast.error(message);
    }
  }

  if (notes === null) {
    return (
      <section className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
        Carregando notas…
      </section>
    );
  }

  if (notes.length === 0) {
    return (
      <section className="text-muted-foreground border-border rounded-lg border border-dashed p-6 text-center text-sm">
        Nenhuma nota ainda. Grave a primeira acima.
      </section>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Minhas notas recentes</h2>
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="border-border group flex gap-3 rounded-lg border p-3"
            >
              <div
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  note.visibility === "personal"
                    ? "bg-muted text-muted-foreground"
                    : "bg-foreground/10 text-foreground",
                )}
                title={note.visibility === "personal" ? "Pessoal" : "Time"}
              >
                {note.visibility === "personal" ? (
                  <Lock className="size-3.5" />
                ) : (
                  <Users className="size-3.5" />
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {note.mentions.map((m) => (
                    <span
                      key={m.player_id}
                      className="bg-muted inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                    >
                      {m.nick}
                    </span>
                  ))}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatWhen(note.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Editar nota"
                  onClick={() => setEditing(note)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  aria-label="Apagar nota"
                  onClick={() => setDeletingId(note.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <NoteEditDialog
        note={editing}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={refresh}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

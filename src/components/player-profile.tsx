"use client";

import { useCallback, useState } from "react";
import { Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { listNotesForPlayer, type NoteWithMentionsAndAuthor } from "@/lib/db/notes";
import { useUserStore } from "@/lib/store/user";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 20;

type Tab = "all" | "team" | "personal";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "team", label: "Notas do time" },
  { key: "personal", label: "Minhas pessoais" },
];

type Props = {
  playerId: string;
  initialNotes: NoteWithMentionsAndAuthor[];
};

type TabState = {
  notes: NoteWithMentionsAndAuthor[];
  loaded: boolean;
  loading: boolean;
  // hasMore = true enquanto a última página veio com PAGE_SIZE itens.
  hasMore: boolean;
};

function emptyTab(): TabState {
  return { notes: [], loaded: false, loading: false, hasMore: true };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "agora";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min atrás`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h atrás`;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlayerProfile({ playerId, initialNotes }: Props) {
  const currentUser = useUserStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>("all");
  const [state, setState] = useState<Record<Tab, TabState>>(() => ({
    all: {
      notes: initialNotes,
      loaded: true,
      loading: false,
      hasMore: initialNotes.length >= PAGE_SIZE,
    },
    team: emptyTab(),
    personal: emptyTab(),
  }));

  const loadPage = useCallback(
    async (targetTab: Tab, reset: boolean) => {
      const current = state[targetTab];
      const offset = reset ? 0 : current.notes.length;

      setState((prev) => ({
        ...prev,
        [targetTab]: { ...prev[targetTab], loading: true },
      }));

      try {
        const supabase = createClient();
        const page = await listNotesForPlayer(supabase, playerId, {
          visibility: targetTab,
          limit: PAGE_SIZE,
          offset,
        });

        setState((prev) => {
          const base = reset ? [] : prev[targetTab].notes;
          return {
            ...prev,
            [targetTab]: {
              notes: [...base, ...page],
              loaded: true,
              loading: false,
              hasMore: page.length >= PAGE_SIZE,
            },
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao listar notas.";
        toast.error(message);
        setState((prev) => ({
          ...prev,
          [targetTab]: { ...prev[targetTab], loading: false },
        }));
      }
    },
    [playerId, state],
  );

  const handleTabChange = (next: Tab) => {
    setTab(next);
    // Lazy load: só busca a primeira página na primeira visita de cada aba.
    if (!state[next].loaded && !state[next].loading) {
      void loadPage(next, true);
    }
  };

  const active = state[tab];

  return (
    <section className="space-y-4">
      <div role="tablist" className="border-border flex gap-1 border-b">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-foreground text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active.notes.length === 0 && active.loaded && !active.loading ? (
        <div className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
          Nenhuma nota nesta aba ainda.
        </div>
      ) : (
        <ul className="space-y-2">
          {active.notes.map((note) => {
            const isOwnAuthor = note.author_id === currentUser?.id;
            const authorLabel = isOwnAuthor
              ? currentUser?.name ?? "Você"
              : note.author?.name ?? "Membro do time";

            return (
              <li key={note.id} className="border-border flex gap-3 rounded-lg border p-3">
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
                  {note.visibility === "team" && (
                    <p className="text-muted-foreground text-xs font-medium">{authorLabel}</p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {note.mentions
                      .filter((m) => m.player_id !== playerId)
                      .map((m) => (
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
              </li>
            );
          })}
        </ul>
      )}

      {active.hasMore && active.loaded && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadPage(tab, false)}
            disabled={active.loading}
          >
            {active.loading ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}

      {!active.loaded && active.loading && (
        <div className="text-muted-foreground py-8 text-center text-sm">Carregando notas…</div>
      )}
    </section>
  );
}

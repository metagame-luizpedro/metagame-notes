"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  fetchTeamFeedNoteById,
  listTeamFeedNotes,
  type FeedPeriod,
  type TeamFeedFilters,
  type TeamFeedNote,
} from "@/lib/db/feed";
import type { NoteAuthor } from "@/lib/db/notes";
import { useUserStore } from "@/lib/store/user";
import { cn } from "@/lib/utils";

type Props = {
  authors: NoteAuthor[];
  stakes: string[];
  initialNotes: TeamFeedNote[];
  pageSize: number;
};

const PERIODS: { key: FeedPeriod; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "all", label: "Tudo" },
];

const DEFAULT_PERIOD: FeedPeriod = "today";

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

function initialOf(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

// Avalia se uma nota ainda satisfaz os filtros ativos. Usado tanto pra
// inserts via realtime (decide se entra no topo) quanto pra updates (decide
// se a nota visível continua visível).
function matchesFilters(
  note: { author_id: string; session_stake: string | null; created_at: string },
  filters: TeamFeedFilters,
): boolean {
  if (filters.authorId && note.author_id !== filters.authorId) return false;
  if (filters.stake && note.session_stake !== filters.stake) return false;
  if (filters.period !== "all") {
    const start = filters.period === "today" ? startOfToday() : sevenDaysAgo();
    if (new Date(note.created_at) < start) return false;
  }
  return true;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export function TeamFeed({ authors, stakes, initialNotes, pageSize }: Props) {
  const currentUser = useUserStore((s) => s.profile);
  const supabase = useMemo(() => createClient(), []);

  const [filters, setFilters] = useState<TeamFeedFilters>({
    period: DEFAULT_PERIOD,
    authorId: null,
    stake: null,
  });
  const [notes, setNotes] = useState<TeamFeedNote[]>(initialNotes);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialNotes.length >= pageSize);

  // Mantém ref dos filtros e da lista pra usar dentro dos handlers do
  // realtime sem precisar recriar a subscription a cada toggle. Atualizar
  // refs em useEffect (e não no render) é o padrão recomendado.
  const filtersRef = useRef(filters);
  const notesRef = useRef(notes);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const refetch = useCallback(
    async (next: TeamFeedFilters) => {
      setLoading(true);
      try {
        const page = await listTeamFeedNotes(supabase, next, { limit: pageSize });
        setNotes(page);
        setHasMore(page.length >= pageSize);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar feed.";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [supabase, pageSize],
  );

  function applyFilters(patch: Partial<TeamFeedFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    void refetch(next);
  }

  function resetFilters() {
    const next: TeamFeedFilters = { period: DEFAULT_PERIOD, authorId: null, stake: null };
    setFilters(next);
    void refetch(next);
  }

  async function loadMore() {
    if (loadingMore || !hasMore || notes.length === 0) return;
    setLoadingMore(true);
    try {
      const before = notes[notes.length - 1].created_at;
      const next = await listTeamFeedNotes(supabase, filters, {
        limit: pageSize,
        before,
      });
      setNotes((prev) => [...prev, ...next]);
      setHasMore(next.length >= pageSize);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar mais.";
      toast.error(msg);
    } finally {
      setLoadingMore(false);
    }
  }

  // Realtime — uma subscription só, vive enquanto o componente está montado.
  // Decisão C: filter-out por author_id !== currentUser.id no INSERT pra
  // evitar duplicar nota recém-criada pelo próprio user (a UI dele já vai
  // refletir via outro caminho — quando ele criar, a página relinka).
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("team-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notes", filter: "visibility=eq.team" },
        async (payload) => {
          const newRow = payload.new as { id: string; author_id: string };
          if (newRow.author_id === currentUser.id) return; // self-echo

          try {
            const note = await fetchTeamFeedNoteById(supabase, newRow.id);
            if (!note) return;
            if (!matchesFilters(note, filtersRef.current)) return;
            setNotes((prev) =>
              prev.some((n) => n.id === note.id) ? prev : [note, ...prev],
            );
          } catch {
            // Ignora — nota chegará no próximo refetch manual.
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notes" },
        async (payload) => {
          const updated = payload.new as {
            id: string;
            visibility: "personal" | "team";
            author_id: string;
          };
          // Se virou personal, some.
          if (updated.visibility === "personal") {
            setNotes((prev) => prev.filter((n) => n.id !== updated.id));
            return;
          }
          // Se já estava na lista, re-hidrata pra refletir content/mentions novos.
          const wasVisible = notesRef.current.some((n) => n.id === updated.id);
          if (!wasVisible) return;
          try {
            const note = await fetchTeamFeedNoteById(supabase, updated.id);
            if (!note || !matchesFilters(note, filtersRef.current)) {
              setNotes((prev) => prev.filter((n) => n.id !== updated.id));
              return;
            }
            setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
          } catch {
            // ignore
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notes" },
        (payload) => {
          const old = payload.old as { id: string };
          setNotes((prev) => prev.filter((n) => n.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUser]);

  const hasActiveFilters =
    filters.period !== DEFAULT_PERIOD || filters.authorId || filters.stake;

  return (
    <div className="space-y-4">
      <div className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <div role="tablist" className="flex gap-1">
          {PERIODS.map((p) => {
            const active = filters.period === p.key;
            return (
              <button
                key={p.key}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => applyFilters({ period: p.key })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <select
          value={filters.authorId ?? ""}
          onChange={(e) =>
            applyFilters({ authorId: e.target.value || null })
          }
          className="border-border bg-background h-8 rounded-md border px-2 text-sm"
        >
          <option value="">Todos os autores</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={filters.stake ?? ""}
          onChange={(e) => applyFilters({ stake: e.target.value || null })}
          className="border-border bg-background h-8 rounded-md border px-2 text-sm"
        >
          <option value="">Todas as stakes</option>
          {stakes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Limpar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">
          Carregando feed…
        </div>
      ) : notes.length === 0 ? (
        <div className="text-muted-foreground border-border rounded-lg border border-dashed p-10 text-center text-sm">
          {hasActiveFilters
            ? "Nenhuma nota com esses filtros."
            : "Nenhuma nota do time ainda."}
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => {
            const isOwn = note.author_id === currentUser?.id;
            return (
              <li
                key={note.id}
                className="border-border flex gap-3 rounded-lg border p-3"
              >
                <div
                  className={cn(
                    "bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isOwn && "bg-foreground/10 text-foreground",
                  )}
                  aria-hidden
                >
                  {initialOf(note.author.name)}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-foreground font-medium">
                      {isOwn ? "Você" : note.author.name}
                    </span>
                    {note.session_stake && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {note.session_stake}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {formatWhen(note.created_at)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  {note.mentions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {note.mentions.map((m) => (
                        <Link
                          key={m.player_id}
                          href={`/players/${m.player_id}`}
                          className="bg-muted hover:bg-muted/80 inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        >
                          {m.nick}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && notes.length > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      )}
    </div>
  );
}

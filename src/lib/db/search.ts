// Busca federada: players, tags, notes — todas com RLS herdada.
// Notes aplica filtros em 2 passos: primeiro pega IDs que matcham (usando
// !inner joins em mentions/sessions quando necessário), depois hidrata
// com todos os mentions + autor via .in("id", ids). Isso preserva a lista
// completa de mentions (filtros inline em !inner cortam o embed).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/types";
import { fetchAuthorsByIds, type NoteWithMentionsAndAuthor } from "@/lib/db/notes";

export type SearchNoteFilters = {
  q?: string;
  authorId?: string | null;
  stake?: string | null;
  tag?: string | null;
  visibility?: "personal" | "team" | null;
};

export type SearchTagHit = { tag: string; count: number };

export async function searchTags(
  supabase: SupabaseClient,
  q: string,
  limit = 10,
): Promise<SearchTagHit[]> {
  if (!q.trim()) return [];
  const { data, error } = await supabase
    .from("player_tags")
    .select("tag")
    .ilike("tag", `%${q.trim()}%`);

  if (error) throw error;
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const t = r.tag as string;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"))
    .slice(0, limit);
}

// Fase 1: pega os IDs das notas que matcham os filtros. Monta a query
// dinamicamente — o select muda conforme quais joins !inner são necessários
// (não posso deixar joins "sobrando" porque !inner filtraria rows vazios).
async function matchingNoteIds(
  supabase: SupabaseClient,
  filters: SearchNoteFilters,
  pageLimit: number,
  offset: number,
): Promise<string[]> {
  const parts: string[] = ["id", "created_at"];
  if (filters.stake) parts.push("sessions!inner(stake)");
  if (filters.tag) parts.push("note_player_mentions!inner(player_tags!inner(tag))");

  let query = supabase
    .from("notes")
    .select(parts.join(", "))
    .order("created_at", { ascending: false })
    .range(offset, offset + pageLimit - 1);

  if (filters.q?.trim()) query = query.ilike("content", `%${filters.q.trim()}%`);
  if (filters.authorId) query = query.eq("author_id", filters.authorId);
  if (filters.visibility) query = query.eq("visibility", filters.visibility);
  if (filters.stake) query = query.eq("sessions.stake", filters.stake);
  if (filters.tag) query = query.eq("note_player_mentions.player_tags.tag", filters.tag);

  const { data, error } = await query;
  if (error) throw error;
  // Dedup (se tag matcher gerar múltiplos mentions pro mesmo note). O tipo
  // inferido com select string dinâmico é inseguro — cast explícito pro shape
  // mínimo que garantimos estar presente (sempre incluímos "id" em parts).
  const rows = (data ?? []) as unknown as Array<{ id: string }>;
  return Array.from(new Set(rows.map((r) => r.id)));
}

export async function searchNotes(
  supabase: SupabaseClient,
  filters: SearchNoteFilters,
  opts: { limit?: number; offset?: number } = {},
): Promise<NoteWithMentionsAndAuthor[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const ids = await matchingNoteIds(supabase, filters, limit, offset);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("notes")
    .select(
      `
      id, author_id, session_id, visibility, content, created_at, updated_at,
      note_player_mentions (
        player_id,
        players ( nick )
      )
    `,
    )
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const authors = await fetchAuthorsByIds(
    supabase,
    rows.map((r) => r.author_id as string),
  );

  return rows.map((row) => {
    const mentionsRaw = (row.note_player_mentions ?? []) as Array<{
      player_id: string;
      players: { nick: string } | { nick: string }[] | null;
    }>;
    const mentions = mentionsRaw.map((m) => {
      const player = Array.isArray(m.players) ? m.players[0] : m.players;
      return { player_id: m.player_id, nick: player?.nick ?? "" };
    });
    const author = authors.get(row.author_id as string) ?? {
      id: row.author_id as string,
      name: "",
      avatar_url: null,
    };

    return {
      id: row.id,
      author_id: row.author_id,
      session_id: row.session_id,
      visibility: row.visibility,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mentions,
      author,
    };
  });
}

export type GlobalSearchResult = {
  players: Player[];
  tags: SearchTagHit[];
  notes: NoteWithMentionsAndAuthor[];
};

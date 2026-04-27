// Helpers do team feed (M4 Fase 2). Lê notas team paginadas com filtros
// e enriquece com autor (via view public_user_profiles) e stake da session
// (via view public_session_stakes). RLS atual:
//   - notes_select_team_any_member libera visibility='team' pra qualquer auth
//   - public_user_profiles é open-read
//   - public_session_stakes é open-read
// → o feed funciona cross-user sem exposição extra.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAuthorsByIds,
  type NoteAuthor,
  type NoteWithMentionsAndAuthor,
} from "@/lib/db/notes";

export type FeedPeriod = "today" | "7d" | "all";

export type TeamFeedFilters = {
  authorId?: string | null;
  stake?: string | null;
  period: FeedPeriod;
};

export type TeamFeedNote = NoteWithMentionsAndAuthor & {
  session_stake: string | null;
};

export type FeedPagination = {
  limit: number;
  // Cursor: created_at do último item da página anterior. Próxima página
  // pega notas com created_at < before.
  before?: string | null;
};

// Início do período em ISO. Today = hoje 00:00 (timezone do server, suficiente
// pra MVP — refinar pro tz do user em iteração futura).
function periodStartIso(period: FeedPeriod): string | null {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (period === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return start.toISOString();
  }
  return null; // 'all' → sem corte
}

export async function listTeamFeedNotes(
  supabase: SupabaseClient,
  filters: TeamFeedFilters,
  pagination: FeedPagination,
): Promise<TeamFeedNote[]> {
  const startIso = periodStartIso(filters.period);

  // 1. IDs das sessions com a stake escolhida (se filtrando) — via view
  // public_session_stakes que bypassa RLS.
  let sessionIdsForStake: string[] | null = null;
  if (filters.stake) {
    const { data: sRows, error: sErr } = await supabase
      .from("public_session_stakes")
      .select("id")
      .eq("stake", filters.stake);
    if (sErr) throw sErr;
    sessionIdsForStake = (sRows ?? []).map((r) => r.id as string);
    if (sessionIdsForStake.length === 0) return [];
  }

  // 2. Notes com mentions.
  let q = supabase
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
    .eq("visibility", "team")
    .order("created_at", { ascending: false })
    .limit(pagination.limit);

  if (filters.authorId) q = q.eq("author_id", filters.authorId);
  if (sessionIdsForStake) q = q.in("session_id", sessionIdsForStake);
  if (startIso) q = q.gte("created_at", startIso);
  if (pagination.before) q = q.lt("created_at", pagination.before);

  const { data, error } = await q;
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // 3. Hidrata autores e stakes em batch.
  const authorIds = rows.map((r) => r.author_id as string);
  const sessionIds = Array.from(
    new Set(
      rows
        .map((r) => r.session_id as string | null)
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const [authorsMap, stakesMap] = await Promise.all([
    fetchAuthorsByIds(supabase, authorIds),
    fetchSessionStakes(supabase, sessionIds),
  ]);

  return rows.map((row) => {
    const mentionsRaw = (row.note_player_mentions ?? []) as Array<{
      player_id: string;
      players: { nick: string } | { nick: string }[] | null;
    }>;
    const mentions = mentionsRaw.map((m) => {
      const player = Array.isArray(m.players) ? m.players[0] : m.players;
      return { player_id: m.player_id, nick: player?.nick ?? "" };
    });
    const author = authorsMap.get(row.author_id as string) ?? {
      id: row.author_id as string,
      name: "",
      avatar_url: null,
    };
    const sessionStake = row.session_id
      ? (stakesMap.get(row.session_id as string) ?? null)
      : null;

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
      session_stake: sessionStake,
    };
  });
}

async function fetchSessionStakes(
  supabase: SupabaseClient,
  sessionIds: string[],
): Promise<Map<string, string>> {
  if (sessionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("public_session_stakes")
    .select("id, stake")
    .in("id", sessionIds);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id as string, row.stake as string);
  }
  return map;
}

// Lista autores que têm pelo menos uma nota team. Usado pra dropdown de
// filtro do feed. Faz 2 queries: distinct author_ids em notes team, depois
// hidrata via view.
export async function listFeedAuthors(supabase: SupabaseClient): Promise<NoteAuthor[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("author_id")
    .eq("visibility", "team");
  if (error) throw error;

  const ids = Array.from(new Set((data ?? []).map((r) => r.author_id as string)));
  if (ids.length === 0) return [];

  const map = await fetchAuthorsByIds(supabase, ids);
  return [...map.values()].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "pt-BR"),
  );
}

// Stakes globais do time. Usa a view public_session_stakes (open-read) e
// retorna distinct ordenado.
export async function listAllStakes(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("public_session_stakes")
    .select("stake");
  if (error) throw error;

  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.stake as string);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Hidrata uma única nota recém-chegada via realtime. Reusa as views de
// autor/stake. Volta null se a nota não estiver mais visível (ex: virou
// personal entre o evento e o fetch).
export async function fetchTeamFeedNoteById(
  supabase: SupabaseClient,
  noteId: string,
): Promise<TeamFeedNote | null> {
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
    .eq("id", noteId)
    .eq("visibility", "team")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [authorsMap, stakesMap] = await Promise.all([
    fetchAuthorsByIds(supabase, [data.author_id as string]),
    data.session_id
      ? fetchSessionStakes(supabase, [data.session_id as string])
      : Promise.resolve(new Map<string, string>()),
  ]);

  const mentionsRaw = (data.note_player_mentions ?? []) as Array<{
    player_id: string;
    players: { nick: string } | { nick: string }[] | null;
  }>;
  const mentions = mentionsRaw.map((m) => {
    const player = Array.isArray(m.players) ? m.players[0] : m.players;
    return { player_id: m.player_id, nick: player?.nick ?? "" };
  });
  const author = authorsMap.get(data.author_id as string) ?? {
    id: data.author_id as string,
    name: "",
    avatar_url: null,
  };
  const sessionStake = data.session_id
    ? (stakesMap.get(data.session_id as string) ?? null)
    : null;

  return {
    id: data.id,
    author_id: data.author_id,
    session_id: data.session_id,
    visibility: data.visibility,
    content: data.content,
    created_at: data.created_at,
    updated_at: data.updated_at,
    mentions,
    author,
    session_stake: sessionStake,
  };
}

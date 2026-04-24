// Helpers para CRUD de notas + mentions associadas.
//
// Postgres não dá transação cross-statement via PostgREST, então usamos um
// padrão "best-effort": insere a nota primeiro, depois insere as mentions.
// Se o segundo insert falhar, deletamos a nota órfã pra manter consistência.
// Para volume e criticidade do M2 isso é mais que suficiente.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note, NoteVisibility } from "@/lib/types";

export type CreateNoteInput = {
  authorId: string;
  visibility: NoteVisibility;
  content: string;
  playerIds: string[]; // pode estar vazio
  sessionId?: string | null;
};

export async function createNoteWithMentions(
  supabase: SupabaseClient,
  input: CreateNoteInput,
): Promise<Note> {
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .insert({
      author_id: input.authorId,
      session_id: input.sessionId ?? null,
      visibility: input.visibility,
      content: input.content,
    })
    .select("id, author_id, session_id, visibility, content, created_at, updated_at")
    .single();

  if (noteError) throw noteError;

  if (input.playerIds.length > 0) {
    const rows = input.playerIds.map((pid) => ({
      note_id: note.id,
      player_id: pid,
    }));
    const { error: mentionsError } = await supabase.from("note_player_mentions").insert(rows);

    if (mentionsError) {
      // Rollback manual da nota órfã.
      await supabase.from("notes").delete().eq("id", note.id);
      throw mentionsError;
    }
  }

  return note;
}

export type UpdateNoteInput = {
  content: string;
  visibility: NoteVisibility;
  playerIds: string[];
};

export async function updateNoteWithMentions(
  supabase: SupabaseClient,
  noteId: string,
  input: UpdateNoteInput,
): Promise<Note> {
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .update({
      content: input.content,
      visibility: input.visibility,
    })
    .eq("id", noteId)
    .select("id, author_id, session_id, visibility, content, created_at, updated_at")
    .single();

  if (noteError) throw noteError;

  // Replace strategy for mentions: delete existing then re-insert.
  const { error: deleteError } = await supabase
    .from("note_player_mentions")
    .delete()
    .eq("note_id", noteId);
  if (deleteError) throw deleteError;

  if (input.playerIds.length > 0) {
    const rows = input.playerIds.map((pid) => ({
      note_id: noteId,
      player_id: pid,
    }));
    const { error: mentionsError } = await supabase.from("note_player_mentions").insert(rows);
    if (mentionsError) throw mentionsError;
  }

  return note;
}

export async function deleteNote(supabase: SupabaseClient, noteId: string): Promise<void> {
  // ON DELETE CASCADE on note_player_mentions handles the mentions.
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}

export type NoteWithMentions = Note & {
  mentions: { player_id: string; nick: string }[];
};

export type NoteAuthor = { id: string; name: string };

export type NoteWithMentionsAndAuthor = NoteWithMentions & {
  author: NoteAuthor | null;
};

// Lista notas que mencionam um jogador, respeitando RLS (personal do próprio
// user + team de qualquer um). `visibility` filtra quando quisermos só uma aba.
//
// Nota sobre autor em notas team: o RLS em public.users só libera o próprio
// registro (users_select_self_or_admin). Em M3 single-user isso é suficiente —
// autor de notas team é sempre o próprio user. No M4 multi-user vamos abrir
// leitura básica (id, name) de outros users pra desbloquear isso.
type ListNotesForPlayerFilter = "all" | "team" | "personal";

export async function listNotesForPlayer(
  supabase: SupabaseClient,
  playerId: string,
  opts: { visibility?: ListNotesForPlayerFilter; limit?: number; offset?: number } = {},
): Promise<NoteWithMentionsAndAuthor[]> {
  const visibility = opts.visibility ?? "all";
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  // 1) IDs das notas que mencionam esse jogador.
  const { data: mentionRows, error: mErr } = await supabase
    .from("note_player_mentions")
    .select("note_id")
    .eq("player_id", playerId);

  if (mErr) throw mErr;
  const noteIds = Array.from(new Set((mentionRows ?? []).map((r) => r.note_id as string)));
  if (!noteIds.length) return [];

  // 2) Notas com TODOS os mentions + autor (embed falha gracioso se RLS bloquear).
  let query = supabase
    .from("notes")
    .select(
      `
      id, author_id, session_id, visibility, content, created_at, updated_at,
      note_player_mentions (
        player_id,
        players ( nick )
      ),
      author:author_id ( id, name )
    `,
    )
    .in("id", noteIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (visibility !== "all") {
    query = query.eq("visibility", visibility);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const mentionsRaw = (row.note_player_mentions ?? []) as Array<{
      player_id: string;
      players: { nick: string } | { nick: string }[] | null;
    }>;
    const mentions = mentionsRaw.map((m) => {
      const player = Array.isArray(m.players) ? m.players[0] : m.players;
      return { player_id: m.player_id, nick: player?.nick ?? "" };
    });

    const authorRaw = row.author as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const author = Array.isArray(authorRaw) ? (authorRaw[0] ?? null) : authorRaw;

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

export async function listMyRecentNotes(
  supabase: SupabaseClient,
  authorId: string,
  limit = 10,
): Promise<NoteWithMentions[]> {
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
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const mentionsRaw = (row.note_player_mentions ?? []) as Array<{
      player_id: string;
      players: { nick: string } | { nick: string }[] | null;
    }>;
    const mentions = mentionsRaw.map((m) => {
      const player = Array.isArray(m.players) ? m.players[0] : m.players;
      return {
        player_id: m.player_id,
        nick: player?.nick ?? "",
      };
    });
    return {
      id: row.id,
      author_id: row.author_id,
      session_id: row.session_id,
      visibility: row.visibility,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mentions,
    };
  });
}

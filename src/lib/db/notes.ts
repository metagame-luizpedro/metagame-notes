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

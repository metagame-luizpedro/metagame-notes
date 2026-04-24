// CRUD helpers para a tabela players.
// O cliente é injetado (browser ou server) — funciona em qualquer contexto.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/types";

export async function listPlayers(supabase: SupabaseClient): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, nick, created_by, created_at, updated_at")
    .order("nick", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Players que têm pelo menos uma row com a tag X em player_tags.
// `!inner` força o join a retornar só matches. Descartamos o campo auxiliar no map.
export async function listPlayersByTag(
  supabase: SupabaseClient,
  tag: string,
): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, nick, created_by, created_at, updated_at, player_tags!inner(tag)")
    .eq("player_tags.tag", tag)
    .order("nick", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    nick: p.nick as string,
    created_by: p.created_by as string | null,
    created_at: p.created_at as string,
    updated_at: p.updated_at as string,
  }));
}

// Busca rápida por nick (ILIKE), usada pelo command palette.
export async function searchPlayers(
  supabase: SupabaseClient,
  q: string,
  limit = 10,
): Promise<Player[]> {
  if (!q.trim()) return [];
  const { data, error } = await supabase
    .from("players")
    .select("id, nick, created_by, created_at, updated_at")
    .ilike("nick", `%${q.trim()}%`)
    .order("nick", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getPlayerById(
  supabase: SupabaseClient,
  id: string,
): Promise<Player | null> {
  const { data, error } = await supabase
    .from("players")
    .select("id, nick, created_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createPlayer(supabase: SupabaseClient, nick: string): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({ nick: nick.trim() })
    .select("id, nick, created_by, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updatePlayer(
  supabase: SupabaseClient,
  id: string,
  nick: string,
): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .update({ nick: nick.trim() })
    .eq("id", id)
    .select("id, nick, created_by, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

export async function deletePlayer(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

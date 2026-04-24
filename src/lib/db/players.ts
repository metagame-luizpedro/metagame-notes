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

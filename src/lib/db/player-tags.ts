// Helpers para player_tags. Tags oficiais (Bot/Nit/Recreativo/Reg/Whale)
// têm is_official=true. Qualquer string extra é tag custom (is_official=false).
// Unique constraint (player_id, tag) impede duplicatas no DB.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerTag } from "@/lib/types";

const COLS = "id, player_id, tag, is_official, created_by, created_at";

export async function listTagsForPlayer(
  supabase: SupabaseClient,
  playerId: string,
): Promise<PlayerTag[]> {
  const { data, error } = await supabase
    .from("player_tags")
    .select(COLS)
    .eq("player_id", playerId)
    // Oficiais primeiro (true > false em ordenação desc), depois ordem de criação.
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listTagsForPlayers(
  supabase: SupabaseClient,
  playerIds: string[],
): Promise<Record<string, PlayerTag[]>> {
  if (!playerIds.length) return {};

  const { data, error } = await supabase
    .from("player_tags")
    .select(COLS)
    .in("player_id", playerIds)
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const map: Record<string, PlayerTag[]> = {};
  for (const row of data ?? []) {
    const pid = row.player_id as string;
    if (!map[pid]) map[pid] = [];
    map[pid].push(row as PlayerTag);
  }
  return map;
}

// Todas as tags custom já usadas em qualquer player do sistema (distinct).
// Alimenta o autocomplete pra promover reuso de vocabulário.
export async function listGlobalCustomTags(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("player_tags")
    .select("tag")
    .eq("is_official", false);

  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.tag as string);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Todas as tags distinct (oficiais + custom), para picker de filtros.
export async function listAllDistinctTags(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("player_tags").select("tag");
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) set.add(r.tag as string);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type AddPlayerTagInput = {
  playerId: string;
  tag: string;
  isOfficial: boolean;
};

export async function addPlayerTag(
  supabase: SupabaseClient,
  input: AddPlayerTagInput,
): Promise<PlayerTag> {
  const { data, error } = await supabase
    .from("player_tags")
    .insert({
      player_id: input.playerId,
      tag: input.tag,
      is_official: input.isOfficial,
    })
    .select(COLS)
    .single();

  if (error) throw error;
  return data;
}

// Retorna número de rows deletadas — 0 significa "RLS negou" (tag criada por
// outro member, user atual não é admin) ou "tag já não existia".
export async function removePlayerTag(
  supabase: SupabaseClient,
  tagRowId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("player_tags")
    .delete()
    .eq("id", tagRowId)
    .select("id");

  if (error) throw error;
  return (data ?? []).length;
}

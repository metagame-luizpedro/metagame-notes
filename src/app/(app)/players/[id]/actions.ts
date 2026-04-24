"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addPlayerTag, removePlayerTag } from "@/lib/db/player-tags";
import { canonicalizeTag, isOfficialTag } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addPlayerTagAction(
  playerId: string,
  rawTag: string,
): Promise<ActionResult> {
  const trimmed = rawTag.trim();
  if (!trimmed) return { ok: false, error: "Tag vazia." };
  if (trimmed.length > 40) return { ok: false, error: "Tag muito longa (máx 40)." };
  const tag = canonicalizeTag(trimmed);

  const supabase = await createClient();
  try {
    await addPlayerTag(supabase, {
      playerId,
      tag,
      isOfficial: isOfficialTag(tag),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    // unique violation no (player_id, tag): já existe.
    if (/duplicate key|unique/i.test(raw)) {
      return { ok: false, error: "Esse jogador já tem essa tag." };
    }
    return { ok: false, error: raw };
  }

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/players");
  return { ok: true };
}

export async function removePlayerTagAction(
  playerId: string,
  tagRowId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  try {
    const deleted = await removePlayerTag(supabase, tagRowId);
    if (deleted === 0) {
      return {
        ok: false,
        error: "Sem permissão pra remover esta tag (criada por outro member).",
      };
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: raw };
  }

  revalidatePath(`/players/${playerId}`);
  revalidatePath("/players");
  return { ok: true };
}

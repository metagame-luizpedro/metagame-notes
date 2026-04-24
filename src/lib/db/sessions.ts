// CRUD helpers para sessions. RLS garante que o user só vê/escreve as próprias.
// Invariante: no máximo uma session com ended_at IS NULL por user (enforced no
// caller — não via constraint SQL pra não bloquear migrações futuras).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/types";

const SESSION_COLS = "id, user_id, stake, tables, started_at, ended_at, created_at";

export type StartSessionInput = {
  userId: string;
  stake: string;
  tables: string[];
};

export async function startSession(
  supabase: SupabaseClient,
  input: StartSessionInput,
): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: input.userId,
      stake: input.stake,
      tables: input.tables,
    })
    .select(SESSION_COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function endSession(supabase: SupabaseClient, sessionId: string): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select(SESSION_COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function getActiveSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<Session | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLS)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

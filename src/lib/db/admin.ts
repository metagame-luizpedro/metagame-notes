// Helpers da página /admin. Lê tudo via service-role client porque a UI
// precisa ver email/role de outros users — campos que public_user_profiles
// não expõe e que a RLS de public.users só liberaria pro próprio admin via
// policy. Como a página já tem guard is_admin antes de chamar, é seguro.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: "player" | "admin";
  avatar_url: string | null;
  notes_count: number;
  sessions_count: number;
};

export async function listAllUsersWithStats(
  admin: SupabaseClient,
): Promise<AdminUserRow[]> {
  const { data: users, error } = await admin
    .from("users")
    .select("id, email, name, role, avatar_url")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = (users ?? []).map((u) => u.id as string);
  if (ids.length === 0) return [];

  const [{ data: notesAgg, error: nErr }, { data: sessionsAgg, error: sErr }] =
    await Promise.all([
      admin.from("notes").select("author_id").in("author_id", ids),
      admin.from("sessions").select("user_id").in("user_id", ids),
    ]);
  if (nErr) throw nErr;
  if (sErr) throw sErr;

  const notesCount = new Map<string, number>();
  for (const r of notesAgg ?? []) {
    const k = r.author_id as string;
    notesCount.set(k, (notesCount.get(k) ?? 0) + 1);
  }
  const sessionsCount = new Map<string, number>();
  for (const r of sessionsAgg ?? []) {
    const k = r.user_id as string;
    sessionsCount.set(k, (sessionsCount.get(k) ?? 0) + 1);
  }

  return (users ?? []).map((u) => ({
    id: u.id as string,
    email: u.email as string,
    name: u.name as string,
    role: u.role as "player" | "admin",
    avatar_url: (u.avatar_url as string | null) ?? null,
    notes_count: notesCount.get(u.id as string) ?? 0,
    sessions_count: sessionsCount.get(u.id as string) ?? 0,
  }));
}

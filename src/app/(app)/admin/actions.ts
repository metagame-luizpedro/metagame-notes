"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Garante que o caller atual é admin via RPC is_admin(auth.uid()). Lança se
// não for. Usado como guard antes de qualquer ação que chama service-role.
async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (profile?.role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
  return { userId: user.id };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function inviteUser(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Email obrigatório." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email inválido." };
  }

  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function toggleUserRole(formData: FormData): Promise<ActionResult> {
  const targetUserId = String(formData.get("user_id") ?? "");
  if (!targetUserId) return { ok: false, error: "user_id obrigatório." };

  let callerId: string;
  try {
    const { userId } = await requireAdmin();
    callerId = userId;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem permissão." };
  }

  if (targetUserId === callerId) {
    return { ok: false, error: "Não dá pra mudar o próprio role." };
  }

  const admin = createAdminClient();
  const { data: target, error: fetchErr } = await admin
    .from("users")
    .select("role")
    .eq("id", targetUserId)
    .single();
  if (fetchErr) return { ok: false, error: fetchErr.message };

  const nextRole = target.role === "admin" ? "player" : "admin";
  const { error: updErr } = await admin
    .from("users")
    .update({ role: nextRole })
    .eq("id", targetUserId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin");
  return { ok: true };
}

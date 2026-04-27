// Service-role Supabase client. Bypassa RLS — usar APENAS em código
// server-side (server actions, route handlers). Nunca importar de client
// component. Necessário pra operações que a API anon/authenticated não
// permite (ex: auth.admin.inviteUserByEmail).

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

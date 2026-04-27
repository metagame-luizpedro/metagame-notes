-- =====================================================================
-- M4 Fase 1 — Schema opening for multi-user
--
-- Decisões registradas em M4_SAVE_POINT.md:
--   A) View public_user_profiles {id, name, avatar_url} acessível a
--      qualquer authenticated/anon. Bypassa a RLS apertada de public.users
--      sem expor email/role/wpt_nicks.
--   C) Realtime habilitado em public.notes para o team feed.
--
-- Pré-condição checada antes de gerar (M4_PROGRESS.md):
--   notes.author_id NULLs = 0 → seguro promover a NOT NULL.
--   sessions.user_id NULLs = 0 → seguro (já era NOT NULL).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. View pública de perfis (decisão A)
--    security_invoker = false (default no PG17): a view executa como owner
--    e ignora a RLS de public.users, retornando os campos seguros pra
--    qualquer membro autenticado.
-- ---------------------------------------------------------------------
create or replace view public.public_user_profiles
with (security_invoker = false) as
  select id, name, avatar_url
  from public.users;

revoke all on public.public_user_profiles from public;
grant select on public.public_user_profiles to authenticated, anon;

-- ---------------------------------------------------------------------
-- 2. notes.author_id NOT NULL
--    Health check confirmou 0 órfãs antes desta migration.
-- ---------------------------------------------------------------------
alter table public.notes
  alter column author_id set not null;

-- ---------------------------------------------------------------------
-- 3. Realtime na tabela notes (decisão C — team feed live)
--    Idempotente: só adiciona se ainda não estiver na publication.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    execute 'alter publication supabase_realtime add table public.notes';
  end if;
end$$;

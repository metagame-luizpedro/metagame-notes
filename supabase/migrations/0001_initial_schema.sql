-- =====================================================================
-- Metagame Notes — Initial Schema
-- Covers M1 foundations: tables, constraints, indexes, RLS policies,
-- auto-create-user trigger, and updated_at maintenance.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------
-- pgcrypto gives us gen_random_uuid() for UUID primary keys.
create extension if not exists "pgcrypto";
-- citext lets nick/email comparisons be case-insensitive without tricks.
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- 2. ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('player', 'admin');
create type note_visibility as enum ('personal', 'team');

-- ---------------------------------------------------------------------
-- 3. TABLES
-- ---------------------------------------------------------------------

-- 3.1 users — mirror of auth.users with app-specific fields
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext unique not null,
  name         text not null,
  role         user_role not null default 'player',
  wpt_nicks    text[] not null default '{}',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3.2 players — shared pool of villains the team annotates
create table public.players (
  id           uuid primary key default gen_random_uuid(),
  nick         citext not null,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Same nick on WPT/Nexa is the same villain. No duplicates.
  constraint players_nick_unique unique (nick)
);

-- 3.3 player_tags — typification (Bot / Nit / Recreativo / Reg / Whale + custom)
-- One row per (player, tag) pair. A player can have multiple tags.
create table public.player_tags (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  tag          text not null,
  is_official  boolean not null default false,
  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint player_tags_unique unique (player_id, tag)
);

-- 3.4 sessions — poker sessions owned by a user
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  stake        text not null,
  tables       text[] not null default '{}',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  created_at   timestamptz not null default now(),
  constraint sessions_time_valid check (ended_at is null or ended_at >= started_at)
);

-- 3.5 notes — the core artifact of the app
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.users(id) on delete set null,
  session_id   uuid references public.sessions(id) on delete set null,
  visibility   note_visibility not null,
  content      text not null check (length(content) > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3.6 note_player_mentions — N:N between notes and players
create table public.note_player_mentions (
  note_id      uuid not null references public.notes(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (note_id, player_id)
);

-- 3.7 table_screenshots — OCR'd table prints
create table public.table_screenshots (
  id                uuid primary key default gen_random_uuid(),
  uploader_id       uuid not null references public.users(id) on delete cascade,
  storage_path      text not null,
  source_url        text,
  extracted_nicks   text[] not null default '{}',
  ocr_provider      text,
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  -- Prints are deleted after 30 days (PRD 7.5). Metadata rows kept.
  expires_at        timestamptz not null default (now() + interval '30 days'),
  constraint table_screenshots_status_valid
    check (status in ('pending', 'processing', 'done', 'failed'))
);

-- ---------------------------------------------------------------------
-- 4. HELPER FUNCTION — is_admin(uid)
--     Used inside RLS policies. SECURITY DEFINER bypasses RLS, so
--     the policies that call this don't cause infinite recursion
--     on the users table.
-- ---------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = uid and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------------------
-- nick lookups (citext is already case-insensitive).
create index players_nick_idx on public.players (nick);
-- feed filters
create index notes_author_id_idx   on public.notes (author_id);
create index notes_session_id_idx  on public.notes (session_id);
create index notes_visibility_idx  on public.notes (visibility);
create index notes_created_at_idx  on public.notes (created_at desc);
-- mentions lookup from both directions
create index mentions_player_id_idx on public.note_player_mentions (player_id);
-- sessions list ordered by most recent
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
-- tags per player
create index player_tags_player_id_idx on public.player_tags (player_id);
-- screenshots per uploader
create index table_screenshots_uploader_idx on public.table_screenshots (uploader_id);

-- ---------------------------------------------------------------------
-- 6. updated_at AUTO-MAINTENANCE
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. AUTO-CREATE public.users ON SIGNUP
--     When Supabase Auth creates a row in auth.users (email/password
--     signup), mirror it into public.users. Name falls back to the
--     email's local part if metadata didn't include one.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY — enable on every table
-- ---------------------------------------------------------------------
alter table public.users                 enable row level security;
alter table public.players               enable row level security;
alter table public.player_tags           enable row level security;
alter table public.sessions              enable row level security;
alter table public.notes                 enable row level security;
alter table public.note_player_mentions  enable row level security;
alter table public.table_screenshots     enable row level security;

-- ---------------------------------------------------------------------
-- 9. RLS POLICIES (PRD §7.2)
-- ---------------------------------------------------------------------

-- 9.1 users
-- Each user reads their own record. Admins read everyone.
create policy users_select_self_or_admin on public.users
  for select using (
    id = auth.uid() or public.is_admin(auth.uid())
  );

-- Users can update their own profile. Admins can update anyone.
create policy users_update_self_or_admin on public.users
  for update using (
    id = auth.uid() or public.is_admin(auth.uid())
  );

-- No manual inserts from the API. handle_new_user() trigger runs with
-- SECURITY DEFINER and bypasses RLS.

-- 9.2 players — fully shared among authenticated members
create policy players_select_authenticated on public.players
  for select using (auth.uid() is not null);

create policy players_insert_authenticated on public.players
  for insert with check (auth.uid() is not null);

create policy players_update_authenticated on public.players
  for update using (auth.uid() is not null);

-- 9.3 player_tags — same as players (shared mapping)
create policy player_tags_select_authenticated on public.player_tags
  for select using (auth.uid() is not null);

create policy player_tags_insert_authenticated on public.player_tags
  for insert with check (auth.uid() is not null);

create policy player_tags_delete_author_or_admin on public.player_tags
  for delete using (
    created_by = auth.uid() or public.is_admin(auth.uid())
  );

-- 9.4 sessions — strictly per-user
create policy sessions_select_own on public.sessions
  for select using (user_id = auth.uid());

create policy sessions_insert_own on public.sessions
  for insert with check (user_id = auth.uid());

create policy sessions_update_own on public.sessions
  for update using (user_id = auth.uid());

create policy sessions_delete_own on public.sessions
  for delete using (user_id = auth.uid());

-- 9.5 notes — the delicate one
-- SELECT: personal only for author; team for any authenticated user.
-- Admins DO NOT see personal notes (PRD §7.3).
create policy notes_select_personal_author on public.notes
  for select using (
    visibility = 'personal' and author_id = auth.uid()
  );

create policy notes_select_team_any_member on public.notes
  for select using (
    visibility = 'team' and auth.uid() is not null
  );

-- INSERT: only as yourself.
create policy notes_insert_as_self on public.notes
  for insert with check (author_id = auth.uid());

-- UPDATE/DELETE for personal: only the author.
create policy notes_update_personal_author on public.notes
  for update using (
    visibility = 'personal' and author_id = auth.uid()
  );

create policy notes_delete_personal_author on public.notes
  for delete using (
    visibility = 'personal' and author_id = auth.uid()
  );

-- UPDATE/DELETE for team: author or admin (moderation).
create policy notes_update_team_author_or_admin on public.notes
  for update using (
    visibility = 'team' and (author_id = auth.uid() or public.is_admin(auth.uid()))
  );

create policy notes_delete_team_author_or_admin on public.notes
  for delete using (
    visibility = 'team' and (author_id = auth.uid() or public.is_admin(auth.uid()))
  );

-- 9.6 note_player_mentions — inherit permission from parent note
create policy mentions_select_via_note on public.note_player_mentions
  for select using (
    exists (
      select 1 from public.notes n
      where n.id = note_id
        and (
          (n.visibility = 'personal' and n.author_id = auth.uid())
          or (n.visibility = 'team' and auth.uid() is not null)
        )
    )
  );

create policy mentions_insert_via_note on public.note_player_mentions
  for insert with check (
    exists (
      select 1 from public.notes n
      where n.id = note_id and n.author_id = auth.uid()
    )
  );

create policy mentions_delete_via_note on public.note_player_mentions
  for delete using (
    exists (
      select 1 from public.notes n
      where n.id = note_id
        and (n.author_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- 9.7 table_screenshots — only uploader accesses
create policy screenshots_select_own on public.table_screenshots
  for select using (uploader_id = auth.uid());

create policy screenshots_insert_own on public.table_screenshots
  for insert with check (uploader_id = auth.uid());

create policy screenshots_update_own on public.table_screenshots
  for update using (uploader_id = auth.uid());

create policy screenshots_delete_own on public.table_screenshots
  for delete using (uploader_id = auth.uid());

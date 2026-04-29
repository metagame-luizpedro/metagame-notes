# M4 Progress — concluído ✅

Iniciado em 2026-04-27 (sessão autônoma). Concluído e validado em prod em 2026-04-29.

Branch `feat/m4-fase-1` foi mergeada fast-forward em `main`. Tag `v0.4.0` cortada. App em prod (`https://metagame-notes.vercel.app`) é genuinamente multi-user.

## O que foi feito

### Fase 1 — Schema opening + multi-user types ✅
- Commits: `da766a9` + `c7f0384`
- Migration `supabase/migrations/0002_m4_multi_user.sql` aplicada em prod:
  - `view public_user_profiles {id, name, avatar_url}` com `security_invoker = false` + grant a authenticated/anon (decisão A)
  - `view public_session_stakes {id, stake}` mesma estratégia — necessária pra Fase 2 mostrar/filtrar stake cross-user
  - `notes.author_id NOT NULL` (health check confirmou 0 órfãs)
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.notes` idempotente (decisão C)
- Tipos TS: `Note.author_id` agora `string` (sem null); `NoteAuthor` ganhou `avatar_url`; `NoteWithMentionsAndAuthor` com `author` obrigatório
- Helper `fetchAuthorsByIds(supabase, ids)` em `src/lib/db/notes.ts` — embed via view em batch, evita N+1
- `listNotesForPlayer` (notes.ts) e `searchNotes` (search.ts) refatorados pra 2-step fetch
- Removido fallback `"Membro do time"` em `src/components/player-profile.tsx`

### Fase 2 — Team Feed com Realtime ✅
- Commit: `fb4bf5c`
- `src/lib/db/feed.ts`: `listTeamFeedNotes`, `listFeedAuthors`, `listAllStakes`, `fetchTeamFeedNoteById`
- `src/app/(app)/feed/page.tsx`: server component, carrega autores + stakes globais + 1ª página com period default `today`
- `src/components/team-feed.tsx`: client component com filtros (Period / Author / Stake / botão Limpar), cards (avatar+autor+badge stake+content+mentions+timestamp pt-BR), pagination via cursor `created_at < before`, realtime canal `team-feed` com INSERT (filter-out self-echo), UPDATE (re-hidrata via `fetchTeamFeedNoteById`), DELETE
- Link "Feed" em `src/components/app-nav.tsx`

### Fase 3 — Admin + Invite ✅
- Commit: `b2c39a8`
- `src/lib/supabase/admin.ts`: `createAdminClient` (service-role, server-only)
- `src/lib/db/admin.ts`: `listAllUsersWithStats` com counts de notas/sessões agregados em JS
- `src/app/(app)/admin/actions.ts`: `inviteUser` (valida admin + `auth.admin.inviteUserByEmail`), `toggleUserRole` (valida admin + bloqueia self-toggle + UPDATE)
- `src/app/(app)/admin/page.tsx`: server component com guard redirect `/dashboard` se !admin
- `src/components/admin-user-table.tsx`: tabela com role badge, contagens, botão toggle
- `src/components/invite-dialog.tsx`: form email + toast
- `app-nav.tsx`: link "Admin" só renderiza se `useUserStore.profile.role === 'admin'`

### Fase 4 (não-planejada) — Magic-link fallback ✅
- Commit: `c9cb148`
- Bug descoberto durante validação do invite real: convidado clicou no magic link, autenticou uma vez, mas ao perder sessão não tinha caminho de volta (sem senha, signup retornava "email já existe")
- `src/app/(auth)/actions.ts`: nova action `sendMagicLink` chamando `signInWithOtp` com `shouldCreateUser: false` (mantém invite-only)
- `src/app/(auth)/login/page.tsx`: 2 forms — senha original + form secundário "Esqueci a senha / primeiro acesso" com botão outline; banner verde quando `?sent=1`
- Cobre tanto re-login de convidados quanto futuro "esqueci senha"

## Validação final em prod (2026-04-29)

Smoke test 2-browsers em `https://metagame-notes.vercel.app`, com `luizpedroandrade1@gmail.com` (admin) na janela normal e `metagame-test@teste.com` (player) na anônima:

| Teste | Resultado |
|---|---|
| `/admin` direto pela URL (admin) | ✅ acessa, tabela renderiza |
| `/admin` (player) → redirect `/dashboard` | ✅ |
| Anônima grava nota team → normal vê em `/feed` em <3s | ✅ |
| Self-echo: anônima grava team → não duplica nela mesma | ✅ |
| Personal grava → NÃO vaza pro feed cross-user | ✅ |
| Filtros (period / author / stake) funcionando | ✅ |
| UPDATE em tempo real (edita nota → outra janela atualiza) | ✅ |
| DELETE em tempo real | ✅ |
| Invite real via `/admin` (`greenwaybets2025@gmail.com`) | ✅ user criado em auth+public, magic link enviado |
| Magic-link fallback: novo link via form `/login` | ✅ email recebido + login direto em prod |

## Health check do schema (Fase 1 step 1)

| Check | Resultado |
|---|---|
| `notes.author_id` NULL count | 0 ✅ |
| `sessions.user_id` NULL count | 0 ✅ |
| `auth.users` sem row em `public.users` | 0 ✅ |
| `luizpedroandrade1@gmail.com` em `public.users` | EXISTE — id `56734803-4a2d-4f9e-a10d-49093dd19db9`, role `admin` ✅ |
| `metagame-test@teste.com` em `public.users` | EXISTE ✅ |
| `greenwaybets2025@gmail.com` em `public.users` | EXISTE — role `player`, criado via invite ✅ |

## Blockers — todos resolvidos

- **B1 — Sem credenciais pra aplicar migration** ✅ resolvido. Luiz logou na Supabase CLI e aplicou via `supabase db push`.
- **B2 — Conta de teste não criada** ✅ resolvida. `metagame-test@teste.com` criada via signup normal e validada nos testes 2-browsers.
- **B3 — Branch local sem push** ✅ resolvido. Pushada como `feat/m4-fase-1`, validada em preview (mas auth-protegido por Hobby), mergeada fast-forward em `main`, validada em prod.

## Tech debt acumulado
Ver `TECH_DEBT_M4.md` na raiz. Nada bloqueia M5.

## Commits do M4 (6)

```
c9cb148  feat(m4): magic-link login fallback for invited users
0931d97  docs(m4): progress report + tech debt notes
b2c39a8  feat(m4-fase-3-wip): admin page + invite UI (pending SQL promotion)
fb4bf5c  feat(m4-fase-2): team feed with realtime
c7f0384  feat(m4-fase-1): add public_session_stakes view to migration 0002
da766a9  feat(m4-fase-1): schema opening + multi-user types
```

Tag: `v0.4.0` — "M4: Multi-user, team feed with realtime, admin & invite"

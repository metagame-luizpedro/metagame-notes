# M4 Progress — sessão autônoma do Luiz fora

Sessão executada em 2026-04-27. Branch: `feat/m4-fase-1` (NÃO foi pushada — ver blockers abaixo).

## O que foi feito

### Fase 1 — Schema opening + multi-user types ✅ código
- Commits: `da766a9` + `c7f0384` (extensão do migration pra Fase 2)
- Migration `supabase/migrations/0002_m4_multi_user.sql` (gerada, **não aplicada**):
  - `view public_user_profiles {id, name, avatar_url}` com `security_invoker = false` + grant a authenticated/anon (decisão A)
  - `view public_session_stakes {id, stake}` mesma estratégia — necessária pra Fase 2 mostrar/filtrar stake cross-user
  - `notes.author_id NOT NULL` (health check confirmou 0 órfãs)
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.notes` idempotente (decisão C)
- Tipos TS: `Note.author_id` agora `string` (sem null); `NoteAuthor` ganhou `avatar_url`; `NoteWithMentionsAndAuthor` com `author` obrigatório
- Helper novo `fetchAuthorsByIds(supabase, ids)` em `src/lib/db/notes.ts` — embed via view em batch, evita N+1
- `listNotesForPlayer` (notes.ts) e `searchNotes` (search.ts) refatorados pra 2-step fetch (notes + autores via view)
- Removido fallback `"Membro do time"` em `src/components/player-profile.tsx`

### Fase 2 — Team Feed com Realtime ✅ código
- Commit: `fb4bf5c`
- `src/lib/db/feed.ts`: `listTeamFeedNotes`, `listFeedAuthors`, `listAllStakes`, `fetchTeamFeedNoteById` (pra hidratação realtime)
- `src/app/(app)/feed/page.tsx`: server component, carrega autores + stakes globais + 1ª página com period default `today`
- `src/components/team-feed.tsx`: client component
  - Filtros: Period (Hoje / 7 dias / Tudo), Author dropdown, Stake dropdown, botão Limpar quando algum != default
  - Cards: avatar (inicial), autor, badge stake, conteúdo, mentions clicáveis, timestamp relativo pt-BR
  - Pagination via cursor `created_at < before`
  - Realtime: canal `team-feed` com INSERT (filter-out self-echo por `author_id !== currentUser.id` — decisão C), UPDATE (re-hidrata se já visível, remove se virou personal/escapou do filtro), DELETE (remove)
- Link "Feed" adicionado em `src/components/app-nav.tsx` entre "Capturar" e "Jogadores"

### Fase 3 (parcial) — Admin + Invite ✅ código
- Commit: `b2c39a8`
- `src/lib/supabase/admin.ts`: `createAdminClient` (service-role, **server-only** — nunca import de client component)
- `src/lib/db/admin.ts`: `listAllUsersWithStats` com counts de notas/sessões agregados em JS
- `src/app/(app)/admin/actions.ts`: server actions
  - `inviteUser(formData)` → valida admin via tabela users + chama `auth.admin.inviteUserByEmail` (magic link, decisão B)
  - `toggleUserRole(formData)` → valida admin + bloqueia self-toggle + UPDATE
- `src/app/(app)/admin/page.tsx`: server component com guard redirect `/dashboard` se !admin
- `src/components/admin-user-table.tsx`: tabela com role badge, contagens, botão toggle
- `src/components/invite-dialog.tsx`: form email + toast
- `app-nav.tsx`: link "Admin" só renderiza se `useUserStore.profile.role === 'admin'`

## Health check do schema (Fase 1 step 1)

| Check | Resultado |
|---|---|
| `notes.author_id` NULL count | 0 ✅ |
| `sessions.user_id` NULL count | 0 ✅ |
| `auth.users` sem row em `public.users` | 0 ✅ |
| `luizpedroandrade1@gmail.com` em `public.users` | EXISTE — id `56734803-4a2d-4f9e-a10d-49093dd19db9`, role `player` ✅ |
| `metagame-test@teste.com` em `public.users` | **NÃO EXISTE** ⚠️ |

## Blockers da sessão autônoma

### B1 — Sem credenciais pra aplicar migration
- MCP Supabase conectado tem acesso à org `ukevksqggkrwbrwpeqqn` (nord-newsroom etc.), **não** ao project `pgbmxuswvknxitrifafa` do metagame
- Supabase CLI não está logada (`supabase projects list` pede `SUPABASE_ACCESS_TOKEN`)
- Resultado: rodei health check via Node + service role key (queries simples), mas DDL precisa de `supabase db push` ou execução manual no Dashboard

### B2 — Conta de teste não criada
- `metagame-test@teste.com` não está em `auth.users` nem em `public.users`
- Pode ter sido signup com email diferente, ou ainda não foi feito
- Bloqueia o smoke test multi-browser da Fase 2

### B3 — Branch local sem push
- Decidi commitar tudo em `feat/m4-fase-1` em vez de pushar pra main como o save point sugeria
- Razão: pushar mudanças TS sem migration aplicada quebra `/feed`, `/admin` e `player-profile` em prod (queries batem em views inexistentes)
- Trade-off: trabalho da sessão fica preservado em commits locais, sem expor prod a estado quebrado

## Pendente pro Luiz validar quando voltar

Ordem recomendada:

1. **Criar conta de teste**, se ainda não fez:
   - Ir em `/signup`, criar com `metagame-test@teste.com` e senha forte (a sua, não escrita aqui)
2. **Logar a Supabase CLI e linkar o project**:
   ```sh
   supabase login
   supabase link --project-ref pgbmxuswvknxitrifafa
   ```
3. **Aplicar migration 0002**:
   ```sh
   supabase db push
   ```
   Confirmar no Dashboard:
   - View `public_user_profiles` existe e retorna rows pra qualquer authenticated
   - View `public_session_stakes` existe
   - `notes.author_id` é NOT NULL
   - Tabela `public.notes` está no `pg_publication_tables` da publication `supabase_realtime`
4. **Promover você pra admin** no Supabase SQL Editor (decisão E):
   ```sql
   UPDATE public.users SET role='admin' WHERE email='luizpedroandrade1@gmail.com';
   ```
   Sair e logar de novo pra `useUserStore` reidratar com role atualizado.
5. **Smoke test local antes de pushar**:
   ```sh
   pnpm dev
   ```
   - `/feed` carrega, mostra suas notas team se houver
   - `/admin` abre (link aparece no nav agora que você é admin), tabela lista membros com counts
   - Conta normal: `/admin` redireciona pra `/dashboard`, link Admin não aparece
6. **Smoke test 2-browser (Fase 2)**:
   - Janela normal: logada como Luiz
   - Janela anônima: logada como `metagame-test@teste.com`
   - Anônima grava nota team → normal vê em `/feed` em ≲3s
   - Normal grava nota personal → anônima NÃO vê
   - Anônima grava nota team → na própria janela anônima a nota NÃO duplica (self-echo filter)
   - Filtros funcionam (period, author, stake)
7. **Push**:
   ```sh
   git push origin feat/m4-fase-1
   ```
   Abrir PR ou merge direto na main; monitorar deploy Vercel.
8. **Convidar membro real** (validação fim-a-fim do invite):
   - Em `/admin`, "Convidar membro" com um email descartável (10minutemail.com)
   - Confirmar email recebido com magic link funcional
9. **Fase 4 (próxima sessão)**: polish, avatares (upload?), badge admin de moderação em notas team, hardening do edit/delete cross-user (admin pode editar nota de outro autor — RLS já libera, falta UI)

## Tech debt acumulado
Ver `TECH_DEBT_M4.md` na raiz.

## Próximo prompt sugerido pro Luiz quando voltar

```
Vou retomar M4. Estado:
- Branch feat/m4-fase-1 com commits da766a9, c7f0384, fb4bf5c, b2c39a8 (não pushada)
- Migration 0002 NÃO aplicada
- Conta de teste metagame-test@teste.com não existe ainda
- Eu ainda sou role=player

Lê o M4_PROGRESS.md raiz, me confirma:
1. Branch feat/m4-fase-1 existe local com 4 commits acima do bab26f6
2. supabase/migrations/0002_m4_multi_user.sql tem as 2 views + NOT NULL + realtime
3. Build local da branch passa (tsc + lint + build)

Se ok, me guia passo-a-passo pelo "Pendente pro Luiz validar" do M4_PROGRESS.md, parando depois de cada passo pra eu confirmar antes do próximo.
```

# Tech debt M4

Itens identificados durante a sessão autônoma de 2026-04-27. Não são blockers — anotados pra Fase 4 ou backlog M5+.

## Pequenos / Fase 4

- **`formatWhen` duplicado** em `recent-notes.tsx`, `player-profile.tsx`, `team-feed.tsx`. Extrair pra `src/lib/format.ts` e reusar.
- **Avatar component**: agora cada componente tem um `<div>` redondo com inicial inline. Centralizar em `src/components/ui/avatar.tsx` (provavelmente vale instalar o shadcn `avatar` primitive — usa `@radix-ui/react-avatar`).
- **`<select>` HTML nativo** no team-feed pra Author/Stake. Funciona, mas sem styling consistente com o resto do app. Migrar pra shadcn `Select` quando o primitive for instalado.
- **`useUserStore` no `app-nav.tsx`**: o link "Admin" depende de hidratação do store, então no primeiro paint do server render ainda não aparece — flicker leve. Solução: passar `isAdmin` via prop pelo `layout.tsx` server-side em vez de ler do store.
- **Realtime UPDATE handler refaz fetch completo da nota** (`fetchTeamFeedNoteById`) mesmo quando só content/visibility mudou. OK pra MVP, mas otimizável aplicando o diff direto da payload.

## Médios / M5

- **Filtro "stake" no team feed** lê `public_session_stakes` que retorna TODAS as stakes do banco — sem distinção de "ainda em uso" vs "histórico". Em volume alto vira ruidoso. Considerar filtro `WHERE created_at > now() - interval '90 days'` ou `DISTINCT` na view.
- **Período do feed usa timezone do server** (Node TZ) pra `startOfToday()`. Funciona pra MVP, mas conta de Tokyo vê "hoje" diferente de conta em SP. Resolver com tz configurado no profile.
- **Admin moderation**: a RLS já permite `notes_update_team_author_or_admin` e `notes_delete_team_author_or_admin`, mas o UI atual (`player-profile.tsx`) só mostra Pencil/Trash quando `isOwnAuthor`. Admin não consegue editar/deletar notas team de outros pelo UI. Adicionar botões pro admin com modal de confirmação extra.
- **Invite flow não tem reenvio** nem listagem de "convites pendentes". Se um magic link expirar, o admin precisa clicar "Convidar" de novo no mesmo email.
- **Counts em `listAllUsersWithStats`** trazem TODOS os rows de `notes` e `sessions` pro JS pra contar. Funciona até ~10k notas. Acima disso, virar RPC SQL com `count(*) GROUP BY`.

## Grandes / Backlog

- **Rate limiting no inviteUser** — qualquer admin consegue spammar `auth.admin.inviteUserByEmail` infinito. Adicionar limit por hora.
- **Auditoria de admin actions** (toggleUserRole, inviteUser): nada loga quem fez o quê. Se time crescer, precisa.
- **`public_user_profiles` expõe `name` e `avatar_url` pra `anon`** também (não só authenticated). Decisão consciente pra simplificar, mas se quiser endurecer no futuro, dropar `anon` do grant — deixar só `authenticated`.

## Bugs herdados do M3 (do save point original)
- Warnings de `Missing DialogTitle/Description` no `GlobalSearchDialog` (a11y)
- `@` sintaxe de busca inline
- Tela `/sessions` com histórico
- Full-text search (tsvector/pg_trgm)

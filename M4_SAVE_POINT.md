# M4 Save Point — voltar aqui quando retomar

## Estado atual
- M3 fechado, v0.3.0 em prod (https://metagame-notes.vercel.app)
- Último commit: 928eb24 fix(m3-fase-4)
- Branch: main, sincronizada com origin

## Respostas pras 5 decisões do M4 (A-E)
- A (RLS users): view `public_user_profiles` com {id, name, avatar_url}. Policy `ALLOW SELECT TO authenticated` na view. Policy existente (users_select_self_or_admin) permanece na tabela users pra campos sensíveis.
- B (invite flow): magic link via supabase.auth.admin.inviteUserByEmail. Metagame é fechado, confiança entre members, zero atrito.
- C (realtime self-echo): filter-out por author_id !== currentUser.id no listener client. Confiar no fetch local pra próprias notas.
- D (filtro período do feed): "Hoje / Últimos 7 dias / Tudo". Sem date picker. Três botões discretos.
- E (admin default): Luiz é admin de largada. Promover via SQL direto no Supabase: UPDATE public.users SET role='admin' WHERE email='<email-da-conta-prod-do-Luiz>'. Rodar juntos no começo da Fase 3.

## Pré-requisito antes da Fase 1
- Criar 1 conta de teste extra no Supabase Auth via interface normal (signup). Email sugerido: metagame-test@teste.com. Senha: qualquer uma forte. Essa conta vai ser usada em Chrome anônimo pra testar multi-user.

## Primeira ação quando voltar
1. Ler este save point
2. Ler o PRD.md §9 M4 pra refrescar escopo
3. Começar Fase 1: migration 0002_m4_multi_user.sql — view + policies
4. Seguir o plano exato que ficou no final da sessão de fechamento do M3

## Plano M4 (referência)
Fase 1 (1h30): schema opening + multi-user basics
Fase 2 (3-4h): team feed com realtime
Fase 3 (2h30): admin + invite flow
Fase 4 (1h30): polish + teste com 2 browsers
Total: 8h30-9h30

## Bugs/tech debt pendentes do M3 (não-bloqueadores)
- Warnings de Missing DialogTitle/Description no GlobalSearchDialog (a11y) — corrigir no M6
- `@` sintaxe de busca inline — backlog M6 se virar hábito
- Tela /sessions com histórico — backlog M6 se volume justificar
- Full-text search (tsvector/pg_trgm) — backlog M6 se ILIKE virar gargalo

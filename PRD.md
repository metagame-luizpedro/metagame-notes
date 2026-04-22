# PROJECT ARCHITECTURE: WPT Notes Metagame

> **Status:** PRD v1.0 — pronto pra Claude Code
> **Owner:** Luiz Pedro Andrade
> **Target team:** Metagame

---

## 1. CONTEXT & PROBLEM

O WPT/Nexa, site onde parte dos players do Metagame jogam, não oferece sistema nativo de notas sobre jogadores — funcionalidade básica presente em todas as grandes salas. Isso cria três problemas em cascata:

1. **Perda de informação individual.** Cada jogador do time mantém notas em lugares diferentes (cadernos, Notes do celular, planilhas, Notion), e boa parte do read sobre um vilão se perde entre sessões. Quando você reencontra o mesmo regular ou o mesmo fish três dias depois, já esqueceu o padrão que tinha identificado.

2. **Baixa alavancagem coletiva.** O pool do WPT é relativamente pequeno e os mesmos jogadores circulam entre os membros do time. Mesmo assim, cada um está solvando e explorando o mesmo jogador do zero, porque não há canal estruturado pra compartilhar reads.

3. **Atrito de captura durante a sessão.** Digitar uma nota no meio de uma mão é complicado, principalmente tendo nicks em chinês/japonês frequentemente que não são copiáveis, e qualquer fricção acima de 5 segundos faz o jogador simplesmente não anotar. O resultado é que a maioria dos reads morre no momento em que é formada.

O efeito líquido: o time está jogando um jogo de informação incompleta que poderia ser mais completo, e cada membro perde EV marginal recorrente contra jogadores que outro membro já decifrou.

---

## 2. PROPOSED SOLUTION

Um web app colaborativo de notas de jogadores, desenhado pra ser usado durante a sessão, sem tirar a atenção das mesas. Cada membro do Metagame loga, inicia uma sessão, e fala suas observações em voz alta — o app transcreve em tempo real, identifica qual jogador está sendo mencionado, e salva a nota num banco compartilhado. Todas as notas ficam disponíveis pra todo o time, pesquisáveis por nick, com o autor de cada nota visível.

**Utilidade na prática:** Um player termina uma mão, percebe um padrão no vilão, fala em voz alta *"esse cara dá 3bet demais do BTN, dá pra 4betar mais wide"*, clica em salvar — e na próxima vez que qualquer membro do time sentar na mesa com esse vilão, o read aparece automático.

### Princípios do produto

1. **Fricção zero durante a sessão.** Se leva mais de 5 segundos ou mais de um clique, está errado. Voz é o input primário, texto é fallback.

2. **Mapeamento de players facilitado.** Tipificação rápida (Bot, Nit, Recreativo, Reg, Whale), notas longas quando precisar, tudo pesquisável por nick — incluindo nicks em caracteres asiáticos que não são copiáveis. As notas estruturadas por jogador viram input direto pra MDA individualizado: em vez de solvar exploits apenas por perfil abstrato, o time pode gerar exploits por vilão específico.

3. **Mapeamento de mesas em tempo real.** Ao reconhecer os nicks da mesa (via OCR de screenshot), o app mostra instantaneamente o que o time já sabe sobre cada vilão — virando ferramenta de table selection além de captura de nota.

---

## 3. FUNCTIONAL REQUIREMENTS

### Quick checklist (chips do framework)
- Login e Autenticação
- Multi usuário
- Upload de Arquivos
- Busca e Filtros
- Relatórios e Exportação
- Onboarding do Usuário

### 3.1 Captura de nota por voz (core do produto)

Durante a sessão, o jogador aciona o microfone (botão grande ou atalho de teclado) e fala suas observações. O app transcreve em PT-BR em tempo real, permite edição antes de salvar, e tem fallback pra digitação manual quando voz não for viável. É o input primário do app — a meta é nota capturada em menos de 5 segundos.

Web Speech API configurada em `pt-BR` com tolerância a termos em inglês comuns no jargão de poker (*calling station*, *check-raise*, *overbet*, etc.) — o reconhecedor é permissivo com esses termos e eles aparecem transcritos como foram falados.

### 3.2 Classificação de visibilidade (Pessoal vs Time)

Toda nota nasce com uma marcação: **Pessoal** (só o autor vê) ou **Time** (todo o Metagame vê). A escolha pode ser feita por toggle visual ou por speech trigger — começar a fala com *"nota pessoal"* ou *"nota time"* força a visibilidade e o app remove o trigger do texto salvo. Isso permite usar o mesmo app pra coisas táticas do time e coisas íntimas (estado mental, tilt, metas) sem misturar.

### 3.3 Tagging de jogadores com auto-detecção

Cada nota pode ser associada a um ou mais jogadores. O app detecta automaticamente nicks conhecidos mencionados no transcript (highlight visual no texto), o jogador confirma antes de salvar, e pode criar novos jogadores on-the-fly. Uma nota pode mencionar múltiplos jogadores (uma mão com 3 villains).

### 3.4 Tipificação de perfil do jogador

Além das notas, cada jogador tem tags de perfil pré-definidas: **Bot, Nit, Recreativo, Reg, Whale**. Essas são as tags oficiais do Metagame. Usuários podem criar tags customizadas adicionais se precisar, mas as 5 principais ficam em destaque visual. As tags evoluem com o tempo — são atributos do jogador, não da nota.

### 3.5 OCR de prints de mesa (resolve o problema de nicks em alfabetos não-latinos)

O jogador captura a mesa de duas formas:
- **Fluxo primário (Gyazo):** cola a URL do Gyazo (atalho Shift+Cmd+2 no Mac, Shift+Ctrl+C no Windows). O app baixa a imagem automaticamente.
- **Fallback (upload direto):** arrastar/soltar uma imagem ou clicar em "Upload" pra enviar do disco.

O app processa a imagem e extrai:
- **Nicks visíveis** (incluindo chinês, japonês, coreano, cirílico — qualquer alfabeto)
- **Posições** (BTN, SB, BB, etc.)
- **Stacks aproximados**

Pra cada nick detectado, o app mostra instantaneamente as notas existentes do time sobre esse jogador. Serve pra **table selection antes de sentar** e pra **contexto instantâneo durante a sessão**.

### 3.6 Perfil do jogador (página individual)

Cada jogador tem uma página com nick, tags, e todas as notas separadas em duas seções: **Time** (com autor de cada nota visível) e **Pessoais**. Feed cronológico, busca dentro das notas do jogador, stake e sessão em que cada nota foi criada.

### 3.7 Feed do time em tempo real

Timeline de todas as notas compartilhadas, com atualização ao vivo via Supabase Realtime — o jogador vê aparecer a nota que o colega acabou de criar na sessão dele. Filtros por autor, por stake e por dia.

### 3.8 Gestão de sessão

Antes de começar a jogar, o usuário inicia uma sessão escolhendo o limite (NL10, NL20, NL40...) e as mesas sendo jogadas. Timer automático de duração, encerramento manual. Cada nota fica vinculada à sessão em que foi criada, permitindo rastrear contexto depois.

### 3.9 Busca e filtros globais

- Por nick
- Por texto livre dentro das notas (ex: "BTN 3bet demais")
- Por tag (Bot, Nit, Recreativo, Reg, Whale)
- Por autor (ex: todas as notas que um player específico fez)
- Por stake, por dia, por sessão
- Filtros combináveis

### 3.10 Onboarding do usuário (primeiro login)

No primeiro login, o usuário passa por um fluxo de 3 telas:
1. **Perfil:** nome, nick(s) no WPT/Nexa (pode cadastrar múltiplos se jogar com mais de um), avatar opcional
2. **Tour rápido:** 4 dicas visuais curtas (botão do mic, speech trigger, OCR, feed do time) com skip disponível
3. **Primeira sessão:** CTA pra iniciar sessão imediatamente ou explorar o app antes

### 3.11 Export e backup

- **Export em JSON** — backup completo (todas as notas do usuário + banco de jogadores compartilhado)
- **Export em CSV** — notas filtradas (de um jogador, de uma sessão, de um período) pra análise externa em Excel/Sheets
- Botões acessíveis em Settings e também no Perfil do Jogador (exportar histórico daquele vilão)

### 3.12 Responsivo (desktop-first, mobile funcional)

Desktop é o fluxo principal (app lado a lado com o WPT pra captura ao vivo). Mobile funciona pra consulta rápida — ver notas de um jogador enquanto joga no PC, revisar feed do time fora da sessão.

---

## 4. USER PERSONAS

### Player do Metagame
Jogador de cash game no WPT/Nexa. Usa o app durante e entre sessões pra capturar notas por voz sobre vilões, consultar reads do time antes de sentar numa mesa, tipificar perfis dos jogadores que enfrenta, e fazer review dos próprios reads pra ajustar exploits ao longo do tempo.

**Ação principal:** criar e consultar notas. Opera 95% do app.

### Coach / Admin do time
Responsável por gerenciar quem tem acesso ao app, acompanhar volume de notas por player (engajamento), rodar análises agregadas (MDA individualizado) sobre o banco compartilhado do time, e garantir que o conteúdo compartilhado está dentro do padrão esperado.

**Diferenças práticas de permissão vs Player:**
- Pode convidar/remover membros do time
- Vê um dashboard agregado (notas por player, jogadores mais mapeados, etc.)
- Pode editar/remover qualquer nota do feed do time (moderação)
- Todas as outras funcionalidades são idênticas

---

## 5. TECHNICAL STACK

### Tecnologias principais
- React
- Next.js
- Tailwind CSS
- shadcn/ui
- Supabase
- Vercel
- Claude Code
- Node.js
- PostgreSQL
- TypeScript

### 5.1 Frontend

- **Next.js 16** (App Router) com **React 19** e **TypeScript** em todo o projeto
- **Tailwind CSS + shadcn/ui** pra componentes (Button, Dialog, Input, Command, Sheet, Sonner pra toasts)
- **Lucide React** pra ícones
- **Zustand** pra estado global leve (sessão ativa, usuário logado, feed real-time) — escolhido sobre React Context por escalabilidade
- Otimizado desktop-first (captura ao vivo lado a lado com o WPT), responsivo pra mobile (consulta rápida)

### 5.2 Backend e dados

**Supabase como backend completo:**
- **PostgreSQL** pra persistência (users, players, notes, sessions, mentions, tags)
- **Supabase Auth** pra login com email/senha (Row Level Security ativa em todas as tabelas)
- **Supabase Storage** pra armazenar os prints das mesas enviados via OCR
- **Supabase Realtime** pro feed do time em tempo real (novas notas aparecem ao vivo)

**Schema principal:**

```sql
users              -- membros do Metagame (id, email, name, role: player|admin, wpt_nicks[])
players            -- jogadores anotados, compartilhados entre o time
notes              -- visibility: 'personal' | 'team', author_id, session_id, created_at
note_player_mentions  -- N:N entre notas e jogadores (uma nota pode marcar vários)
sessions           -- stake, started_at, ended_at, user_id
player_tags        -- tipificação: Bot, Nit, Recreativo, Reg, Whale (+ custom)
table_screenshots  -- prints OCR'd com os nicks extraídos e cache
```

### 5.3 APIs externas

- **Web Speech API** (nativo do Chrome/Edge) pra transcrição de voz em PT-BR — zero custo, baixa fricção
- **Anthropic API (Claude Haiku 4.5)** com Vision pra OCR dos prints de mesa — extrai nicks mesmo em chinês/japonês/coreano/cirílico, identifica posições e stacks
- **Tesseract.js** (browser-side, grátis) como pré-filtro antes do Claude Vision — resolve ~60% dos casos com nicks latinos sem chamar API paga
- **Gyazo** como fluxo primário de captura de print (usuário cola a URL, o app baixa a imagem e manda pro pipeline de OCR)
- **Fallback futuro:** OpenAI Whisper API caso a qualidade da Web Speech seja insuficiente em sessões longas

### 5.4 Infraestrutura e deploy

- **Vercel** pra deploy do Next.js (integração nativa com GitHub — push na main = deploy automático)
- **Supabase Cloud** pro backend (plano Free aguenta o time inteiro: 500MB DB, 50k MAU, 1GB storage)
- **GitHub** pra versionamento
- Variáveis sensíveis (Anthropic API key) em **Vercel Environment Variables**, nunca expostas no frontend — chamadas à Anthropic passam por um endpoint interno no Next.js (API route em `/api/ocr`)

### 5.5 Desenvolvimento

- **Claude Code** como ferramenta principal de codificação, usando este PRD como contexto primário do projeto
- **ESLint + Prettier** pra padronização
- **Git flow simples:** `main` (produção) + feature branches (`feat/*`, `fix/*`)

### 5.6 Considerações de escala e custo (OCR)

O time opera com ~60 players ativos, cada um rodando 40-60 sessões/mês em 4 mesas simultâneas. Volume esperado de OCR: 4-40 prints por sessão (média ~20), totalizando aproximadamente **60.000 prints/mês** no time inteiro. A arquitetura resolve escala em três camadas:

1. **OCR sob demanda.** O player aciona manualmente ao sentar em mesa nova, fazer table selection, ou querer mapear um vilão específico. Sem processamento passivo.
2. **Pré-filtro gratuito com Tesseract.js.** Roda no browser do player antes de qualquer chamada paga. Resolve cerca de 60% dos casos (nicks com alfabeto latino). Claude Vision só é acionado quando Tesseract falha — exatamente nos nicks asiáticos, onde ele brilha.
3. **Cache agressivo.** Imagens já processadas e nicks já identificados ficam em cache no Supabase. Nenhuma chamada duplicada.

**Custo estimado com essas otimizações: $70–150/mês pro time inteiro**, ou $1–2,50 por player/mês.

**Escala futura (100+ players):** modelo de API key por player — cada player conecta sua própria chave da Anthropic no onboarding, custo centralizado vira zero.

---

## 6. DESIGN LANGUAGE

O app deve se integrar visualmente ao ecossistema Metagame já existente (Fundação + Members Area), respeitando a identidade do time e evitando gerar sensação de "ferramenta de fora". Os members usam essas plataformas todos os dias — o novo app precisa parecer irmão delas.

### Paleta de cores (extraída do Metagame)

- **Primária:** Vinho/bordô (`#6B1F3A`) — fundos principais, headers, botões de ação
- **Secundária:** Preto profundo (`#0A0A0A`) — fundos alternativos, contraste
- **Acento:** Dourado/âmbar (`#C5A547`) — highlights, elementos de destaque (nicks detectados, notas novas, estatísticas)
- **Texto:** Branco (`#FFFFFF`) e escalas de cinza
- **Estados:** vermelho sutil pra alerta, verde sutil pra sucesso (pouco uso)

### Tipografia

- **Títulos:** sans-serif bold/condensada no estilo do logo Metagame (opções: **Archivo**, **Barlow Condensed** ou **Oswald**)
- **Corpo:** **Inter** — legível em telas longas
- **Números e dados:** peso bold, destaque visual (padrão dashboard do Metagame, onde "1937 Total hands" vira protagonista visual)

### Princípios visuais

1. **Sobriedade profissional.** Sem gamification, sem confetti, sem linguagem casual de app de produtividade. O usuário é um profissional de poker — a UI deve comunicar seriedade, como uma ferramenta de trader/operador.

2. **Cards como unidade visual.** Inspirado no dashboard do Metagame, usar cards retangulares com bordas suaves, números grandes destacados e labels pequenas embaixo. Funciona bem pra: stats do player, cards de vilão, feed de notas do time.

3. **Navegação lateral fixa.** Sidebar em vinho no estilo do Members Area, com ícones monocromáticos e sections principais (Home, Sessions, Players, Team Feed, Table Reader, Settings).

4. **Dark-first.** O app é usado durante sessões longas, muitas vezes à noite, em monitores com o WPT aberto lado a lado. Vinho escuro + preto dominam. Claridade só nos cards de dados e no texto.

5. **Gradientes diagonais sutis.** Elemento recorrente da identidade Metagame (banner da home, listras). Usar com parcimônia em headers e backgrounds de login pra reforçar pertencimento visual.

### Referências externas complementares

- **Linear** (linear.app) — densidade de informação, teclado-first, UX de ferramenta pro
- **Notion (dark mode)** — hierarquia de conteúdo, sidebar, organização de dados livres
- **Arc Browser** — microinteractions refinadas, sensação de "ferramenta cuidada"
- **DriveHUD / Holdem Manager (painéis de stats)** — como exibir densamente dados de jogador sem poluir

### O que evitar

- Roxo/purple (comum em apps de IA, destoa do vinho Metagame)
- Gradientes saturados, neon, estética gamer/Discord
- Ícones infantis ou emoji-first
- Layouts soltos com muito espaço em branco (dilui a sensação de "ferramenta de alta densidade")

---

## 7. NON-FUNCTIONAL REQUIREMENTS & SECURITY

### 7.1 Performance

- Transcrição de voz deve aparecer em tela em tempo real (< 500ms de lag perceptível)
- Feed do time em real-time deve atualizar em < 2s após uma nota ser criada por outro usuário
- Busca por nick deve retornar em < 300ms mesmo com 10.000+ jogadores no banco
- OCR de um print deve completar em < 5s (Tesseract) ou < 8s (Claude Vision)

### 7.2 Segurança (Row Level Security no Supabase)

**Todas as tabelas têm RLS ativa.** Políticas principais:

- **`users`**: cada usuário lê só o próprio registro, admins leem todos
- **`notes` com `visibility='personal'`**: só o `author_id = auth.uid()` pode ler/editar/deletar
- **`notes` com `visibility='team'`**: qualquer user autenticado do time lê; só o `author_id` ou admin pode editar/deletar
- **`players`**: todos os usuários autenticados leem e escrevem (banco compartilhado)
- **`sessions`**: só o próprio autor lê/escreve as próprias sessões
- **`note_player_mentions`**: herda permissão da nota associada
- **`table_screenshots`**: só o uploader acessa (prints são privados, só a extração vira compartilhada)

**Nenhuma chave de API sensível no frontend.** Toda chamada à Anthropic passa pelo endpoint `/api/ocr` do Next.js, que injeta a chave do lado servidor.

### 7.3 Privacidade

- Notas pessoais **jamais** devem vazar pro feed do time, mesmo em caso de bug — RLS é a camada de defesa final
- Prints de mesa ficam em bucket privado do Supabase Storage (não públicos)
- Usuários podem deletar sua conta a qualquer momento — ao fazer isso, notas pessoais são apagadas; notas do time são mantidas mas com autor anonimizado (`ex-membro`)

### 7.4 Disponibilidade

- O app não é crítico (se cair por 1h, ninguém para de jogar), mas afeta captura durante sessões ativas
- SLA esperado: 99% (Vercel + Supabase já entregam isso nativamente no Free tier)
- Se o OCR (Anthropic API) falhar, o app continua funcionando — só o OCR fica indisponível, usuário é avisado e pode tentar de novo depois

### 7.5 Retenção de dados

- **Notas:** mantidas indefinidamente (são o valor central do app)
- **Sessões:** mantidas indefinidamente (contexto das notas)
- **Prints das mesas:** mantidos por 30 dias depois do processamento, depois são deletados automaticamente (só os nicks extraídos e metadados ficam)
- **Cache de OCR:** TTL de 90 dias por nick identificado

---

## 8. SUCCESS METRICS

O app será considerado um sucesso se, 60 dias após o lançamento:

- **80%+ dos players ativos do Metagame** criando ≥ 5 notas/semana
- **Tempo médio de captura de uma nota** < 10 segundos (do clique no mic até o salvar)
- **70%+ das mesas novas** passando por OCR antes do player sentar (adoção real como ferramenta de table selection)
- **Banco compartilhado** com ≥ 500 jogadores mapeados e ≥ 2.000 notas do time
- **NPS interno** ≥ 8/10 em pesquisa com os members após 30 dias de uso

---

## 9. DEVELOPMENT MILESTONES

O build é fatiado em **6 milestones entregáveis**. Cada milestone é testado e validado antes de avançar.

### M1 — Foundations (setup)
- Repo inicializado no GitHub com Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Supabase projeto criado com schema inicial (users, players, notes, sessions, mentions, tags)
- RLS policies aplicadas (conforme seção 7.2)
- Auth funcional (Supabase Auth com email/senha)
- Deploy em Vercel com domínio provisório
- **Critério de conclusão:** usuário consegue criar conta, logar, ver dashboard vazio

### M2 — Core capture (single-user)
- Botão de microfone + atalho de teclado (espaço)
- Transcrição em tempo real com Web Speech API (PT-BR)
- Toggle Pessoal/Time + speech triggers funcionando
- Criar/editar/listar jogadores
- Salvar nota associada a um ou mais jogadores
- Auto-detecção de nicks no transcript com highlight
- **Critério de conclusão:** Luiz consegue gravar 10 notas sobre 5 jogadores diferentes, editar e deletar, em < 10s cada

### M3 — Sessions & player profiles
- Iniciar/encerrar sessão com stake
- Timer automático da sessão
- Página de perfil do jogador com notas separadas (Time vs Pessoais)
- Tipificação com as 5 tags oficiais (Bot, Nit, Recreativo, Reg, Whale) + custom
- Busca global (por nick, texto, tag, autor, stake)
- **Critério de conclusão:** Luiz consegue rodar uma sessão completa de 2h e revisar as notas depois filtradas por vilão

### M4 — Multi-user & Team Feed
- Convite de novos usuários (admin) + gestão de roles
- Feed do time em tempo real (Supabase Realtime)
- Filtros do feed (autor, stake, dia)
- Permissões de moderação pra admins (editar/deletar qualquer nota de time)
- **Critério de conclusão:** 2 usuários logados em browsers diferentes veem as notas do outro aparecendo ao vivo

### M5 — OCR pipeline (Gyazo + Claude Vision)
- Upload via URL do Gyazo ou drag-and-drop direto
- Pipeline: Tesseract.js primeiro → fallback pro Claude Vision se Tesseract falhar
- API route `/api/ocr` no Next.js pra chamar Anthropic com key segura
- Cache de OCR no Supabase (imagem processada + nicks extraídos)
- Tela de resultado: nicks detectados com link pro perfil de cada um + notas existentes
- **Critério de conclusão:** Luiz cola URL de um Gyazo de mesa com 2 nicks asiáticos e vê, em < 10s, os nicks extraídos e as notas do time sobre eles

### M6 — Polish & Launch
- Fluxo de onboarding (3 telas do primeiro login)
- Export JSON e CSV
- Responsividade mobile validada
- Ajustes de performance (queries, caching, lazy loading)
- Design final alinhado à identidade Metagame (paleta vinho/preto/dourado)
- Tutoriais curtos gravados pra apresentar pro time
- **Critério de conclusão:** versão pronta pra onboarding dos primeiros 5 players do Metagame como beta testers

### Estratégia de iteração
- Cada milestone é testado **por Luiz sozinho** antes de avançar
- M6 é seguido de uma fase beta com 5-10 members do Metagame por 2 semanas
- Ajustes com base em feedback real antes do rollout pro time todo

---

## 10. OPEN QUESTIONS (pra decidir durante o build)

- Quais são os nicks exatos da fonte tipográfica usada pelo Metagame? (Archivo / Barlow Condensed / Oswald?) — confirmar com o coach
- O site do Metagame tem API ou integração possível pra importar a lista oficial de members? — investigar ou fazer manual
- Integração futura com o sistema de Members Area pra SSO? — avaliar após M6
- Caso Web Speech API fique ruim demais em sessões longas, quando migrar pra Whisper? — threshold: se mais de 20% das notas precisarem de edição pesada, migrar

---

> **Generated by NoCodeStartup Framework — optimized for Claude Code**
> **PRD v1.0 — 2026-04-22**

---

## 11. OWNERSHIP MODEL & HANDOVER

### 11.1 Contexto

Este projeto é uma **contribuição voluntária** de Luiz Pedro Andrade ao time Metagame. Após a conclusão do build (M6) e período de teste interno, a administração técnica e estratégica do app será **100% transferida para o time Metagame**. Luiz passa a ser apenas mais um player-usuário, sem papel de gestão, moderação ou manutenção.

### 11.2 Fase de desenvolvimento e teste (owner: Luiz)

Durante M1 a M6 e a fase beta, toda a infraestrutura roda nas contas pessoais de Luiz:
- **GitHub:** repositório privado na conta pessoal
- **Vercel:** deploy no plano Free, domínio provisório (`metagame-notes.vercel.app` ou similar)
- **Supabase:** projeto no plano Free, região São Paulo
- **Anthropic API:** chave pessoal, com limite de gasto configurado

**Regras durante essa fase:**
- Nenhum dado sensível ou personalizado que impeça a transferência depois (sem "luizpedro" hardcoded em nada além do `AUTHOR` do README)
- Todo segredo em environment variables (nunca commitado)
- Documentação (README) sempre atualizada com os passos de transferência
- `metagame.poker` e seus subdomínios **não são usados nessa fase** — a Metagame só aponta DNS depois do handover

### 11.3 Handover pro time Metagame

Quando o app estiver testado e aprovado, a transferência acontece em uma tarde, seguindo este checklist:

1. **Reunião inicial** com a liderança do Metagame pra apresentar o app funcionando e alinhar termos da entrega
2. **Criação das contas do time** (se ainda não existirem): GitHub org, Vercel team, Supabase org, Anthropic account
3. **Transferência do repositório GitHub** (Settings → Transfer ownership)
4. **Transferência do projeto Vercel** (Settings → Transfer to Team) ou fork, a critério deles
5. **Migração do Supabase**: exporta schema (`supabase db dump`) e dados relevantes; o time recria na conta deles e importa
6. **Chave Anthropic**: eles geram a própria e atualizam as environment variables no Vercel
7. **DNS**: a Metagame aponta o subdomínio escolhido (ex: `notes.metagame.poker`) pro Vercel deles
8. **Documentação final**: README atualizado com acesso, troubleshooting comum e roadmap sugerido
9. **Luiz sai de todos os acessos administrativos** — fica apenas como usuário do app

### 11.4 Pós-handover

- **Evolução do produto**: 100% a cargo do time Metagame. Podem adicionar features, remover funcionalidades, mudar stack, mudar visual — é deles
- **Suporte de Luiz**: nenhum compromisso formal. Disponível pra tirar dúvidas pontuais sobre o código durante os primeiros 30 dias, a título de boa vontade
- **Créditos**: o README mantém uma linha de "Contribuído por Luiz Pedro Andrade em [data]" como registro histórico, mas sem papel ativo de manutenção

### 11.5 Domínio

- **Durante teste:** URL provisória do Vercel (sem custo, funcional, compartilhável)
- **Após handover:** subdomínio sob `metagame.poker` (ex: `notes.metagame.poker`, `field.metagame.poker` ou o que a Metagame decidir)

---

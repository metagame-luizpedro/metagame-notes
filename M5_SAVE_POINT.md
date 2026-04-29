# M5 Save Point — OCR pipeline (Gyazo + Claude Vision)

Save point criado em 2026-04-29 ao final da sessão de fechamento do M4. Próxima sessão começa daqui.

## Estado atual

- **M4 fechado e validado em prod.** Branch `main` em `6cb0b6b`. Tag `v0.4.0` em `origin`. Release publicado em https://github.com/metagame-luizpedro/metagame-notes/releases/tag/v0.4.0
- **App em prod:** `https://metagame-notes.vercel.app` rodando build com:
  - Multi-user genuíno (admin + invite via magic link com fallback de re-login)
  - Team feed em tempo real (Supabase Realtime, INSERT/UPDATE/DELETE)
  - Filtros (period / author / stake)
  - RLS multi-tenant com schema opening via views públicas (`public_user_profiles`, `public_session_stakes`)
- **Users em prod:** `luizpedroandrade1@gmail.com` (admin), `metagame-test@teste.com` (player), `greenwaybets2025@gmail.com` (player), além das contas de teste antigas
- **Tech debt M4** registrado em `TECH_DEBT_M4.md`. Nada bloqueia M5. Itens que pode valer atacar antes ou em paralelo do M5: moderation UI (admin sem botões pra editar nota team de outro autor) e `formatWhen` duplicado em 3 componentes
- **Decisões M4** já tomadas e documentadas no `M4_PROGRESS.md`. Magic-link fallback foi bônus, não estava no PRD §9 M4

## 6 decisões críticas pra responder antes da execução do M5

### 1. Tesseract.js: client-side ou server-side?

| | Client | Server (Vercel Function) |
|---|---|---|
| Custo | Zero | Active CPU + invocations |
| First-load impact | ~10MB WASM + traineddata (lazy load mitiga) | Zero |
| Cold start | Lazy load do bundle no acesso à `/ocr` | Bruto (WASM em Function) |
| Privacidade | Imagem não sai do browser | Imagem trafega pro Vercel |

**Recomendação atual:** client com lazy load. Confirmar no POC.

### 2. Provider do Vision: Claude direto vs Vercel AI Gateway?

| | Direto (`@anthropic-ai/sdk`) | AI Gateway (`provider/model`) |
|---|---|---|
| Setup | Você já usa | Adiciona env var + 1 dep |
| Observability | Zero | Out-of-the-box |
| Trocar provider | Refactor | Mudar string |
| Custo | Igual | Igual |

**Recomendação atual:** AI Gateway com `anthropic/claude-haiku-4-5` (Haiku é barato e suficiente pra OCR de print). Sonnet só se Haiku errar nos POCs.

### 3. Storage de screenshots

| Opção | Custo | Reproc | RLS | Comentário |
|---|---|---|---|---|
| Não armazenar | $0 | Não | n/a | Mais simples; perde reprocessamento |
| Vercel Blob | ~$0.15/GB | Sim | Não nativo | Integrado |
| Supabase Storage | Plano Free generoso | Sim | Sim | Já no stack |

**Recomendação atual:** Supabase Storage com TTL 30 dias.

### 4. Threshold de fallback Tesseract → Vision

Critérios candidatos (não-óbvio até ver dados):
- Confidence score do Tesseract abaixo de X%
- Nº de tokens extraídos abaixo de Y
- Nenhum match com `players.nick` existente
- Imagem contém alfabeto não-latino (CJK) e Tesseract não detectou nenhum char CJK

**Risco:** threshold muito alto → queima Vision toda vez ($$); muito baixo → perde nick CJK (caso PRINCIPAL do PRD!).

**Recomendação atual (a refinar com POCs):** "Vision se Tesseract não extraiu CJK char numa imagem com aspect ratio típico de print de mesa". Decisão final depende dos 5 prints reais.

### 5. Matching de nick extraído → `players.nick`

Casos chatos:
- Símbolos especiais (`★`, `☆`, `♠`, `♥`)
- Maiúsculas vs minúsculas
- `_` vs espaço
- Variações de transliteração (CJK)

| Estratégia | Falsos pos | Falsos neg |
|---|---|---|
| Exact (case-insensitive) | Baixo | Alto |
| Normalizado (lower + strip símbolos) | Médio | Médio |
| Fuzzy Levenshtein ≤2 | Alto | Baixo |
| Substring | Alto | Baixo |

**Recomendação atual:** começar com normalizado (lower + strip símbolos) + UI "criar novo player com este nick" se não match. Fuzzy depois.

### 6. UX da tela

| | Rota `/ocr` standalone | Modal flutuante a partir do dashboard |
|---|---|---|
| Complexidade | Menor | Maior (state, layout) |
| Discoverability | Link no nav | Botão dedicado |
| Independência | Total | Acoplado |

**Recomendação atual:** rota `/ocr` standalone + drop zone grande + campo URL Gyazo. Modal só se sentir falta depois.

**Sub-decisão:** integrar OCR no fluxo de captura de nota (Hoje voz → transcript → nicks detectados; com OCR seria upload → nicks pré-selecionados como mentions). PRD §3.5 sugere o fluxo standalone primeiro. Concordo — integração fica pro M6.

## Pré-requisitos pra próxima sessão

**Você precisa providenciar 5 prints reais de mesa de poker antes de começar a execução**, pra rodar POCs:

- 3 prints com nicks em alfabeto latino (qualquer site/cliente)
- 2 prints com nicks em alfabeto não-latino (CJK = chinês/japonês/coreano — caso principal do PRD §3.5)

Pode ser:
- Screenshot direto via Cmd+Shift+4 → arquivo local
- Print existente já no Gyazo → URL
- Mix dos dois

**Por que 5 e não 1:** o threshold de fallback (decisão 4) e a estratégia de matching (decisão 5) só podem ser definidos com sample real. Com 1 print não dá pra calibrar.

## Plano da próxima sessão

1. **Você traz** os 5 prints + anotações de fricções de uso real (ver `FEEDBACK_USO_REAL.md`)
2. **POC Tesseract** (1 dia): script Node isolado, sem mexer no app, processa os 5 prints, produz output (texto extraído + confidence score). Decide se Tesseract serve.
3. **POC Vision** (meio dia): mesmo script, mesmas 5 imagens, Claude Haiku 4.5 via AI Gateway. Compara qualidade + custo/imagem.
4. **Você decide as 6 questões** com dados reais nas mãos.
5. **Migration + API + UI** começam só depois das decisões. Estimativa pós-decisão: 1.5-2 semanas focadas (ver `M4_PROGRESS.md` no resumo do M5 alto-nível, replicado também na seção "Plano alto-nível M5" do log dessa sessão).

## Próximo prompt sugerido pro Luiz quando voltar

```
Voltei pro M5. Tenho:
- 5 prints reais (3 latino, 2 CJK) em <localização>
- Anotações de fricção em FEEDBACK_USO_REAL.md

Lê o M5_SAVE_POINT.md e me confirma:
1. Estado de prod ainda em v0.4.0 (sem deploys após o save point)
2. As 6 decisões críticas continuam relevantes (nada mudou no PRD)
3. POC Tesseract pode começar — me sugere o script mínimo (Node + tesseract.js + 1 imagem) pra eu rodar localmente sem mexer no app

Não começa código antes de eu confirmar a leitura.
```

## Refs

- `M4_PROGRESS.md` — log do M4 fechado
- `TECH_DEBT_M4.md` — débito acumulado
- `PRD.md` §3.5, §9 M5 — escopo formal
- `FEEDBACK_USO_REAL.md` — fricções coletadas durante uso real (próxima sessão)

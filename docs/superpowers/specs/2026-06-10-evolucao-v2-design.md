# Spec — Evolução V2 do Report Executivo Qualidade

**Data:** 2026-06-10 · **Status:** aprovada em design review com Samuel (mockups inline validados)
**Branch:** `claude/recursing-meninsky-4b025b`

## Contexto

O app (Next.js 16 + Supabase Auth + Postgres/RLS) está funcional, mas com 6 gaps levantados pelo dono:

1. Gestão de usuários incompleta (sem criar direto, editar nome, excluir; reset por email não chega — SMTP default do Supabase).
2. Carteira/Board com UX de planilha (14 colunas inline, kanban de 9 lanes).
3. Risco calculado só por prazo+status.
4. Timeline mostra itens concluídos.
5. Capacidade usa `owner` texto livre (sem vínculo com pessoas reais nem capacidade individual).
6. Executivo sem métricas de aderência (acesso/atualização) nem tendência.

## Decisões aprovadas

| Tema | Decisão |
|---|---|
| Email/reset | **Sem SMTP custom.** Ciclo de senha gerenciado pelo admin (senha temporária). Convite por email e "esqueci minha senha" viram caminho secundário, documentadamente não-confiáveis. |
| Responsáveis | Tabela `people` separada (nem todo responsável tem login), capacidade semanal individual. |
| Risco | Score composto 0–100 explicável (5 fatores ponderados). |
| Tracking | Acesso (login diário) + atualização (derivada de `item_history`). |
| UX Carteira/Board | Direção A: tabela enxuta de 6 colunas + drawer lateral único; board consolidado em 5 lanes com WIP. |

---

## 1. Gestão de usuários (admin-first)

### Endpoints novos (route handlers, service role só no server)

| Rota | Método | Ação |
|---|---|---|
| `/api/admin/users` | POST | Cria usuário direto: `auth.admin.createUser({ email, password: temp, email_confirm: true })` + upsert `user_profiles` (nome, role) + `must_change_password = true`. Retorna senha temporária **uma única vez**. |
| `/api/admin/users/[id]` | PATCH | Edita `full_name`, `email` (via `updateUserById`), `role`. |
| `/api/admin/users/[id]` | DELETE | `auth.admin.deleteUser(id)`. Guard: admin não deleta a si próprio. Itens da carteira não são afetados (responsável vive em `people`). |
| `/api/admin/users/[id]/reset-password` | POST | Gera nova senha temporária (`crypto.randomBytes`, 14 chars), `updateUserById({ password })`, seta `must_change_password`. Exibida uma vez. |

**Autorização:** todo handler valida o caller via server client (sessão) + checagem `role = 'admin'` em `user_profiles` antes de tocar o admin client. Service role key jamais no bundle client. Senha temporária nunca logada nem persistida em claro.

### Troca forçada de senha

- Coluna `user_profiles.must_change_password boolean default false` (migration).
- `proxy.ts`: sessão autenticada com flag ativa → redirect para `/reset-password` (página existente, com aviso "defina sua nova senha").
- Após troca bem-sucedida, client chama RPC `clear_must_change_password()` (SECURITY DEFINER, `SET search_path = public`, age só sobre `auth.uid()`).

### UI `/admin/users`

- Form "Novo usuário" (nome, email, role) → modal exibindo a senha temporária com botão copiar + aviso "não será exibida novamente".
- Tabela: editar nome/email/role inline ou em modal; botões "Resetar senha" (gera nova temporária) e "Excluir" (confirmação dupla digitando o email).
- Convite por email permanece como ação secundária ("Convidar por email — sujeito a limites do Supabase").

## 2. Pessoas & Capacidade

### Migration `004_people.sql`

```sql
people (
  id uuid PK default gen_random_uuid(),
  name text not null,
  normalized_name text generated always as (lower(btrim(name))) stored unique,
  weekly_capacity_hours numeric not null default 30 check (> 0),
  active boolean not null default true,
  user_id uuid null references user_profiles(id) on delete set null,
  created_at timestamptz default now()
)
alter table items add column owner_id uuid null references people(id);
```

- **Backfill na própria migration:** insere `people` a partir de `select distinct btrim(owner)` (dedup por `lower`), depois `update items set owner_id` pelo match normalizado. Coluna `items.owner` permanece como denormalização (UI grava `people.name` nela ao selecionar — mantém export CSV/JSON e código legado funcionando).
- RLS: select para authenticated; insert/update/delete para admin/superintendente/lider (mesmo padrão de escrita de `items`).

### UI

- Campo "Responsável" em todos os formulários vira **select** de `people` ativos (com criação rápida "+ nova pessoa" para admin/líder).
- CapacityView: barra por pessoa usa `weekly_capacity_hours` individual (substitui o slider global). Edição da capacidade direto na view (admin/líder). Pessoas inativas saem do cálculo.
- Simulador de urgência: seleção de pessoa via tabela (sem digitação livre).

## 3. Score de risco composto (lib/domain)

`riskScore(item, ctx): { score: number, band, factors: Factor[] }` — puro, testável.

```
score = 0.40·f_prazo + 0.20·f_status + 0.15·f_progresso + 0.15·f_staleness + 0.10·f_dependencia
```

| Fator | Regra (0–100) |
|---|---|
| `f_prazo` | atrasado=100 · vence hoje=85 · 1–7d=60 · 8–14d=35 · >14d=10 · sem prazo=50 |
| `f_status` | Bloqueado=100 · Atrasado=90 · Pausado=60 · A iniciar=30 · Em validação=30 · Em andamento=20 |
| `f_progresso` | gap entre % do prazo decorrido (startDate→dueDate, clamp 0–100) e % progresso; sem datas computáveis → 0 |
| `f_staleness` | dias desde `last_update`: ≥14=100 · 7–13=60 · 3–6=25 · <3=0 |
| `f_dependencia` | predecessor Bloqueado/Atrasado=100 · predecessor aberto=60 · só `dependency_note`=40 · sem=0 |

- Concluído/Entregue/Cancelado/Arquivado: sem score (exibe estado, fora de ranking).
- Faixas: **Crítico ≥70 · Alto 50–69 · Médio 30–49 · Baixo <30**.
- `factors` retorna contribuição ponderada + label humano de cada fator → alimenta a decomposição no drawer e na view Riscos. Motivo principal = fator de maior contribuição (labels atuais "Vence hoje", "Bloqueado" etc. permanecem como rótulo do motivo).
- `riskOf()`/`riskSeverity()` atuais permanecem para compat até as views migrarem; fila de decisão e Riscos passam a ordenar por `score`.
- **Testes unitários (Vitest)** para `riskScore` com casos de borda (sem prazo, sem datas, predecessor cíclico/ausente, item concluído).

## 4. Timeline

- Default: somente `!isDone && !archived`. Toggle "Mostrar concluídos" (mesmo componente de toggle do Board).
- Itens vencidos e abertos destacados no topo do mês corrente.

## 5. Tracking de atividade + Visão Executivo

### Migration `005_activity.sql`

```sql
daily_access (
  user_id uuid references user_profiles(id) on delete cascade,
  day date not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, day)
)
portfolio_snapshots (
  day date primary key,
  total int, active int, critical int, high int,
  on_time_pct numeric, freshness_pct numeric, access_adherence_pct numeric,
  health numeric, effort_hours numeric,
  created_at timestamptz default now()
)
```

- **Registro de acesso:** no layout server de `(app)`, upsert em `daily_access` com throttle (só atualiza `last_seen` se >5 min). RLS: usuário insere/atualiza o próprio registro; leitura completa só admin/superintendente, demais leem o próprio.
- **Atualizações:** derivadas de `item_history` (já existe `changed_by`/`changed_at`) — nenhuma tabela nova.
- **Snapshot diário lazy:** no primeiro acesso do dia, se não existe linha para hoje em `portfolio_snapshots`, o server computa e insere. Sem cron/infra extra. Deltas dos KPIs = hoje vs snapshot de ~7 dias atrás (mais próximo disponível).

### ExecutiveView

- Faixa de 6 KPIs com tendência: Saúde da carteira (0–100) · Frentes críticas · Entregas no prazo % · Freshness (% itens ativos atualizados ≤7d) · Aderência de acesso (% usuários ativos em 7d) · Esforço restante (h).
- Painel "Aderência do time — 7 dias": linha por pessoa com 7 marcadores diários (acesso) + contagem de atualizações. Visível apenas para admin/superintendente.
- Fila de decisão ordenada pelo score composto (clique abre o drawer).
- Relatório textual (`executiveLines`) mantido e atualizado com os novos números (freshness, aderência).

## 6. UX Carteira/Board (direção A) + refactor estrutural

### Refactor (pré-requisito)

`app/(app)/page.tsx` (1.166 linhas) é decomposto preservando `globals.css` integralmente:

```
components/
  views/{Dashboard,Portfolio,Board,Risks,Timeline,Capacity,Executive}View.tsx
  ItemDrawer.tsx        ← drawer único de detalhe/edição
  ui/ (Badge, ProgressBar, ScoreChip, Toggle, Avatar)
```

`page.tsx` vira orquestrador (estado global, filtros, navegação) com ~200 linhas.

### Carteira

- 6 colunas: Demanda (título + projeto) · Responsável (avatar) · Prazo · Status · Progresso · Score. Clique na linha abre o `ItemDrawer`.
- Drawer contém todos os campos editáveis + decomposição do score ("por quê") + próxima ação + staleness + atalho para comentários/histórico.
- Filtros em chips: Todos / Críticos / Atrasados / Sem próxima ação / por responsável + busca.

### Board

- 5 lanes: A iniciar · Em andamento · Em validação · Bloqueado · Pausado. Concluído/Entregue atrás do toggle "Mostrar concluídos".
- Status `Atrasado` deixa de ser lane: **no banco nada muda**; no board, item com status `Atrasado` é exibido na lane **Em andamento**, e qualquer item aberto com prazo vencido recebe flag vermelha "venceu há Xd" (derivada do prazo, independente do status).
- Contador WIP por lane (alerta visual quando Em andamento > limite configurável, default 6).
- Drag-and-drop HTML5 entre lanes → muda status com update otimista. Cards: título, projeto, progresso, avatar, prazo, score chip; bloqueados mostram a dependência.
- `ItemDrawer` no clique (mesmo componente da Carteira).

### Riscos

- Fila ordenada por score desc com decomposição de fatores inline (expandível) — substitui a listagem atual por categoria.

## Segurança

- Novas tabelas com RLS desde a migration (padrão das 001–003: helpers SECURITY DEFINER com `SET search_path = public`).
- Endpoints admin: validação de sessão + role no server antes do admin client; respostas de erro sem vazamento de detalhe; senha temporária só no body da resposta do request que a criou.
- Nenhum segredo novo no client. `SUPABASE_SERVICE_ROLE_KEY` continua só em env do server/CI.

## Testes & gates

- Vitest para `lib/domain` (score composto, faixas, freshness, agregação de aderência).
- Gates de PR: `build` + `lint` + `typecheck` verdes; QA visual com screenshots 375/768/1440 das views alteradas.
- **Conserto de tooling (bug pré-existente):** `.husky/pre-commit` roda `npx lint-staged`, mas não há config de lint-staged nem eslint/prettier instalados — todo commit falha. Fase 1 instala eslint + lint-staged com config mínima (`*.{ts,tsx}` → eslint) e adiciona script `typecheck`.

## Fora de escopo (YAGNI)

- SMTP custom / Resend (decisão do dono: reset via admin).
- Notificações (Slack/email), relatórios agendados, mobile app, gráficos com lib externa (tendência = delta numérico via snapshots; sem charting library).
- Matriz manual impacto×probabilidade (descartada em favor do score automático).

## Ordem de implementação sugerida

1. Migrations 004/005 + `riskScore` no domain (com testes) — base de tudo.
2. Gestão de usuários (endpoints + UI + must_change_password + proxy).
3. Refactor `page.tsx` → componentes + `ItemDrawer`.
4. Carteira enxuta + Board consolidado (DnD) + Timeline (filtro abertos).
5. People/Capacidade (select de responsável + capacidade individual).
6. Tracking (daily_access + snapshots) + ExecutiveView nova.

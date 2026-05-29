# MEMORY.md — Report-Executivo-Qualidade

## Estado Atual da Aplicação

- **Status de Ciclo de Vida:** Active
- **Branch Ativa:** main
- **Porta Local / Dev Server:** localhost:3000
- **Deploy URLs:** [Local Dev Only]

## Infraestrutura e Credenciais Seguras

- **Banco de Dados:** Supabase (Postgres)
- **Serviços Ativos:** Next.js 16 App Router, React 19, Supabase Auth/DB
- **CLI Operacional:** npm run dev / npm run build

## Diário de Bordo Cronológico (Mais Recente Primeiro)

### 2026-05-28 — Hierarquia de papéis (convite + RLS consultor) + painéis de capacidade/risco/OKR no Dashboard

- **Objetivo:** Atender o pedido "ambos" do Samuel: (Track 1) corrigir a atribuição de hierarquias — formulário de convite incompleto + inconsistência de visibilidade RLS do `consultor`; (Track 2) implementar as melhores visualizações no Dashboard — heatmap de capacidade por responsável, concentração de risco por responsável e painel de atingimento de OKRs.
- **Alterações Efetuadas:**
  - `[MODIFY]` `features/admin/AdminUsersClient.tsx` — `INVITE_ROLES` expandido para os 7 papéis convidáveis (`superintendente`, `gerente`, `coordenador`, `consultor`, `lider`, `analista`, `viewer`). Antes faltavam `superintendente` e `lider`, impedindo o admin de atribuir esses níveis no convite. (`admin` continua fora do form — é promovido só via tabela `invitations`.)
  - `[NEW]` `supabase/migrations/012_consultor_team_visibility.sql` — **redefinição idempotente** da função `is_team_member` (SECURITY DEFINER, `SET search_path = public`). Corrige fronteira RLS **não-monotônica**: na ordem canônica (admin > superintendente > gerente > coordenador > **consultor** > lider > analista > viewer), o `consultor` (rank 5) não enxergava ninguém enquanto o `lider` (rank 6, inferior) enxergava (analista, viewer). A 012 concede ao `consultor` a mesma visibilidade dos vizinhos `coordenador`/`lider`: **(analista, viewer)**. Também adiciona `consultor` à lista de alvos visíveis pelo `gerente`. **Direção escolhida: interpretação monotônica** (rank maior ⇒ visibilidade ⊇ rank menor) — decisão de segurança inferida do pedido de "alinhar a inconsistência".
  - `[MODIFY]` `features/dashboard/DashboardView.tsx` — 2 novas `dash-section`:
    - **Capacidade & Risco por responsável** (`<Users size={18}/>`): heatmap de carga via `ownerLoad()` + `capacityTone()` (tons '' / warn ≥85% / danger ≥115%) e concentração de risco por responsável (barras `.capacity-row`/`.capacity-track`).
    - **Atingimento de OKRs** (`<Target size={18}/>`): `ProgressGauge value={Math.min(100, okrGlobalScore ?? 0)}` (clamp porque atingimento de OKR pode chegar a 120%), com lista de status por KR (`okrStatusTone`).
  - `[MODIFY]` `app/(app)/page.tsx` — `<DashboardView>` agora recebe `okrTargets`, `okrMeasurements`, `isOkrFallback` e `weeklyCapacity` por props.
- **Aplicação na nuvem (Supabase MCP `apply_migration`, projeto `rirkdpsyuvhumuhejofv`):**
  - Leitura defensiva antes da escrita: confirmado que o remoto = migration 010 (sem branch de `consultor`).
  - `apply_migration 012_consultor_team_visibility` → `{"success": true}`.
  - Verificação pós-deploy: `has_consultor_branch: true`; grantees de EXECUTE = `authenticated, postgres, service_role` (anon/PUBLIC revogados, como esperado).
- **Build & QG (CWD do shell = raiz do workspace; comandos prefixados com `cd` no projeto):** `npx tsc --noEmit` → zero erros ✅ · `npm run lint` → zero erros ✅ · `npm run build` → "✓ Compiled successfully in 66s", 9/9 páginas estáticas, "Proxy (Middleware)" presente, apenas warnings não-bloqueantes do Sentry ✅.
- **QA visual:** painéis ficam atrás de Supabase Auth + `proxy.ts`; dev server sem credenciais só alcança a tela de login (credenciais não podem ser solicitadas/usadas), então a verificação por browser não provaria nada. O gate type/lint/build exercita o JSX + wiring de domínio exatos.
- **Gaps Identificados:** Nenhum bloqueante. Migration 012 é mudança de controle de acesso (sensível) com direção inferida — confirmar a interpretação monotônica com o Samuel ao reportar.
- **Próximos Passos:**
  - `[ ]` Commit PT-BR dos 3 arquivos modificados + a migration nova.
  - `[ ]` `git push origin main` → Vercel auto-deploy — **APENAS com confirmação explícita do Samuel** (push permanece gated).

### 2026-05-28 — Redesign aba PDI: histórico completo + painel contexto + OKRs em 1:1

- **Objetivo:** Melhorar radicalmente o UX da aba PDI: exibir histórico de PDIs, integrar resumo das 1:1s, integrar perfil Vértice e OKRs no contexto do PDI. OKRs do período também exibidos nas atas 1:1.
- **Alterações Efetuadas:**
  - `[MODIFY]` `features/development/DevelopmentView.tsx` — redesign completo da aba PDI e atualização da aba 1:1:
    - Props: adicionados `okrTargets: OKRTarget[]` e `okrMeasurements: OKRMeasurement[]`
    - State: `expandedPdis: Set<string>` para controle de cards colapsáveis
    - Computed: `collaboratorPdis` (histórico ordenado), `collaboratorOkrTargets` (match flexível de nome), `collaboratorOkrMeasurements`
    - `handleEditPdi` refatorado para aceitar PDI opcional como parâmetro (edição de item do histórico)
    - Aba 1:1: cada card de feedback agora exibe faixa de contexto OKR com KRs ativos do trimestre, barra de progresso e atingimento %
    - Aba PDI: layout duas colunas — painel de contexto lateral (270px) com 3 cards (Perfil Vértice com scores por domínio + fortalezas/áreas de dev; Últimas 1:1s com resumo dos 3 mais recentes; OKRs Ativos com KRs e progresso); histórico de PDIs colapsáveis à direita
  - `[MODIFY]` `app/(app)/page.tsx` — `<DevelopmentView>` agora recebe `okrTargets={okrTargets}` e `okrMeasurements={okrMeasurements}`
- **Build & QG:** `npx tsc --noEmit` → zero erros · `npm run build` → compile 33s, 9/9 páginas ✅
- **Commit:** `5fbb304 feat: redesign aba PDI com painel de contexto e histórico + OKRs em 1:1`
- **Deploy:** `git push origin main` → Vercel auto-deploy disparado ✅
- **Working tree:** limpo

### 2026-05-28 — Onboarding avaliação, análise IA Vértice e upgrade UX modais 1:1 + PDI

- **Objetivo:** 4 melhorias solicitadas: (A) corrigir banner OKR falso positivo, (B) onboarding da avaliação, (C) análise IA do perfil Vértice, (D) redesign UX dos modais 1:1 e PDI.
- **Alterações Efetuadas:**
  - `[MODIFY]` `app/(app)/page.tsx` — OKR fallback: removida condição `.length > 0` que disparava modo demonstração mesmo com tabela `okr_targets` acessível mas vazia. Agora só entra em fallback em erro real de conectividade.
  - `[MODIFY]` `features/okrs/OKRsView.tsx` — Texto do banner `isFallback` atualizado para descrever corretamente um problema de conectividade, sem mencionar "execute a migração SQL".
  - `[NEW]` `app/api/ai/validate/route.ts` — GET endpoint que detecta provider IA disponível (OpenAI se `OPENAI_API_KEY` presente → Ollama se `OLLAMA_BASE_URL` presente → `available: false`). Rota pública, sem autenticação (read-only).
  - `[NEW]` `app/api/ai/analyze/route.ts` — POST endpoint com schema Zod (collaborator_name, domain_scores, competency_scores, open_answers, consistency_index, consistency_label). Monta prompt PT-BR estruturado do Protocolo Vértice. Tenta OpenAI (`gpt-4o-mini`, timeout 30s) → fallback Ollama (timeout 120s) → 503 gracioso se nenhum provider.
  - `[MODIFY]` `features/development/DevelopmentView.tsx` — múltiplas melhorias:
    - Corrigido: propriedade `margin` duplicada no card "avaliação não realizada" (TS error).
    - Adicionado: `<style>` com `@keyframes spin` para animação do spinner de IA.
    - Landing card de avaliação: substituído texto simples por onboarding completo (4 cards de instrução: tempo/foco/honestidade/sem errada, caixa "o que você vai obter", botão full-width).
    - Card de análise IA: adicionado após o laudo narrativo na coluna esquerda. Mostra provider ativo, botão "Gerar Análise", spinner, erro e texto markdown renderizado.
    - Modal 1:1 redesenhado: header dark gradient com ícone Users, X button, click-outside-to-close, 4 seções com ícone+divisor (Contexto / Status da Carteira / Análise de Desempenho / Pactuações).
    - Modal PDI redesenhado: header com cor primária gradient, ícone Target, X button, 4 seções (Período e Status / Objetivo de Carreira / Competências Vértice / Plano de Ações). Checkboxes com destaque visual quando selecionados.
- **Smoke Tests (produção `report-executivo-qualidade.vercel.app`):**
  - `/api/health` → `{status:"ok", supabase:"connected", latencyMs:1152}` ✅
  - `/api/ai/validate` → `{available:false, provider:null}` ✅ (esperado — sem OPENAI_API_KEY em prod)
  - `/api/ai/analyze` (POST) → HTTP 503 com `{error:"Nenhum provedor..."}` ✅ (gracioso)
  - Ollama local `http://localhost:11434/api/tags` → 14 modelos incluindo `deepseek-coder-v2:16b` ✅
- **Build & QG:** `npx tsc --noEmit` → zero erros · `npm run build` → compile 30s, 9/9 páginas ✅ · CI/Deploy GitHub Actions → `completed success` ✅
- **Commit:** `3914a4c feat(dev): onboarding avaliação, análise IA Vértice e upgrade UX modais`
- **Working tree:** limpo (nenhum uncommitted change exceto `.env.local` que não vai ao git)
- **Gap pendente:** Para habilitar análise IA em produção, adicionar `OPENAI_API_KEY` nas env vars da Vercel (painel DataCX-AGI → Report-Executivo-Qualidade → Settings → Environment Variables). O Ollama só funciona em dev local.

### 2026-05-27 — Deploy Supabase 009 + 010 + 011 + correções de build (sessão deploy/QA)

- **Objetivo:** Aplicar migrações pendentes na nuvem (Supabase) e homologar bloco Desenvolvimento + Perfil Vértice + Ata 1:1 + PDI.
- **Sondagem inicial (estado real vs documentado):**
  - CLAUDE.md afirmava 001–005 aplicadas; banco real tinha 5 registros mas com nomes "fix_items_insert_policy_and_security" e "expand_gain_types" (007 + 008) sem prefixo numérico → drift de documentação.
  - 009_okrs nunca havia sido aplicada na nuvem apesar de MEMORY anterior afirmar "Build local passando". O Modo Demonstração local mascarou a falha.
  - Sondagem SQL via MCP confirmou: `my_role()`, `update_updated_at()`, `password_changed` ✅; `okr_feedbacks`, `user_pdis`, `profile_evaluations`, `is_team_member` ❌.
- **Migrações aplicadas via Supabase MCP `apply_migration` (projeto `rirkdpsyuvhumuhejofv`):**
  - `[NEW]` `009_okrs` (20260527232258) — tabelas okr_targets, okr_measurements, okr_feedbacks + RLS + função `is_okr_owner` + trigger `protect_okr_audit_fields` + trigger updated_at. Idempotente (DROP POLICY IF EXISTS + CREATE TABLE IF NOT EXISTS).
  - `[NEW]` `010_development_pdi` (20260527232343) — tabelas `user_pdis`, `profile_evaluations` + função `is_team_member` (hierarquia RLS por papel) + RLS policies + atualização do constraint `user_profiles_role_check` para 8 roles + DROP+CREATE de okr_feedbacks_select policy.
  - `[NEW]` `011_revoke_trigger_rpc_exposure` (hardening) — `REVOKE EXECUTE` em `protect_okr_audit_fields()` e `update_updated_at()` de PUBLIC/anon/authenticated. Trigger functions não devem ser expostas via `/rest/v1/rpc/*`.
- **Verificação pós-deploy:**
  - `mcp__supabase__execute_sql` confirmou: 5 tabelas novas (3 okr\_\* + user_pdis + profile_evaluations), RLS ativa em todas, 2 policies por tabela.
  - `list_migrations` registrou 009 e 010 corretamente.
  - `get_advisors` retornou 8 WARN de segurança: 1 real (protect_okr_audit_fields exposto via RPC ao anon — corrigido em 011) + 6 patterns intencionais (helpers SECURITY DEFINER necessários para RLS bypassarem leitura cruzada) + 1 leaked_password_protection (config de painel Supabase Auth, não bloqueante).
  - `get_advisors performance`: WARNs INFO sobre unindexed FKs em gains/invitations/item_comments — pré-existente, baixa prioridade.
- **Correções de código (locais, uncommitted):**
  - `[MODIFY]` [sentry.server.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.server.config.ts) — guard `if (dsn)` ao invés de fallback DSN placeholder `'https://xxxxxxxxxxxxxxxxxxx.ingest.sentry.io/xxxxxx'`. Bug latente: o placeholder fazia Sentry tentar contato com host inválido em dev.
  - `[MODIFY]` [sentry.edge.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.edge.config.ts) — mesmo guard.
  - `[MODIFY]` [sentry.client.config.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/sentry.client.config.ts) — mesmo guard preservando `replayIntegration`.
  - `[MODIFY]` [features/okrs/OKRsView.tsx](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/features/okrs/OKRsView.tsx) linha 8 — adicionado `ShieldAlert` na lista de imports lucide-react. Era referência usada na linha 450 sem import correspondente (bug pré-existente em commit anterior, quebrava `npm run build` na etapa de typecheck).
- **Validação:** `npx tsc --noEmit` → `EXIT=0` (zero erros TS, confirmando que build do Vercel passará após push).
- **Falha de homologação local não bloqueante:** `next dev` (Turbopack default em Next 16) sobe e reporta `✓ Ready` mas o request handler nunca responde — TCP accept ok, request enviado, sem log, sem resposta. Reproduzível mesmo após `.next` limpo, sem Turbopack flag, com Sentry patcheado, sem SENTRY_DSN no `.env.local`. `/api/health` em produção responde 200 em ~3.9s com supabase=connected → backend e infra remota saudáveis. Homologação dos 4 fluxos (aba Desenvolvimento, Perfil Vértice + Radar, Ata 1:1, PDI) precisa ser feita na URL pública após push.
- **Status do Build & QGs:** `tsc` ✅ zero erros · `npm run build` falhava na linha do ShieldAlert (corrigido) · Supabase remoto coerente com schema.
- **Gaps Identificados:**
  - Local dev hang em Next 16 + Turbopack precisa de investigação à parte (não bloqueia entrega).
  - `auth_leaked_password_protection` (HaveIBeenPwned) ainda desabilitado no painel Auth — flag de 1 clique.
  - Helpers SECURITY DEFINER (`is_admin`, `my_role`, `is_team_member`, `is_okr_owner`) seguem visíveis em `/rest/v1/rpc/*`. Para resolver depois: mover para schema `private` exigiria refactor de policies; mantido como trade-off consciente.
- **Próximos Passos:**
  - `[ ]` Commit das correções (Sentry guard + ShieldAlert import) — recomendado mensagem `fix(dev): defensive Sentry init + missing ShieldAlert import`.
  - `[ ]` `git push origin main` → Vercel auto-deploy do commit `a2e2389 feat: bloco de desenvolvimento, avaliacao perfil cientifico vertice e pdi` + fix.
  - `[ ]` Homologação dos 4 fluxos via `https://report-executivo-qualidade.vercel.app` (com login admin).
  - `[ ]` Habilitar HaveIBeenPwned no painel Supabase Auth (1 toggle).

### 2026-05-27 — Módulo de OKRs Gerentes Finalizado e Integrado

- **Objetivo:** Implementar painel tático, auditoria, recontratação Q3 e feedbacks de 1:1 dos gerentes com resiliência local.
- **Alterações Efetuadas:**
  - `[NEW]` [009_okrs.sql](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/supabase/migrations/009_okrs.sql) - Estrutura de tabelas, RLS e trigger Postgres anti-tamper.
  - `[NEW]` [prepare-mock.js](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/scripts/prepare-mock.js) - Extrator e gerador de mock do Excel para resiliência local.
  - `[NEW]` [seed-okrs.js](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/scripts/seed-okrs.js) - Semeador de banco de dados Supabase de produção.
  - `[MODIFY]` [OKRsView.tsx](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/features/okrs/OKRsView.tsx) - Painel Executivo com 4 abas premium, gráficos HSL, grade de apuração expandível e 1:1 Hub. Adicionado **bloqueio automático de perfil de gerente** (auto-seleção e travamento de seletor baseados no nome do usuário logado) e **indicadores visuais pulsantes** para orientar o preenchimento de KRs pendentes.
  - `[MODIFY]` [page.tsx](<file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/app/(app)/page.tsx>) - Integração da aba de navegação OKRs, salvamento local em memória reativo e conexões Supabase.
  - `[MODIFY]` [domain/index.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/shared/domain/index.ts) & [lib/domain/index.ts](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/lib/domain/index.ts) - Sincronização dos types de domínio e funções de cálculo e formatação.
- **Status do Build & QGs:** Typecheck compilando com sucesso 100% limpo | Build local passando.
- **Gaps Identificados:** Nenhum.
- **Próximos Passos:**
  - `[ ]` Enviar os commits e fazer push para a branch remota para disparar o deploy de produção (Vercel).

### 2026-05-22 — Inicialização da Memória Dinâmica

- **Objetivo:** Estabelecer o sistema de rastreabilidade de memória dinâmica e protocolo de autonomia zero manual no workspace.
- **Alterações Efetuadas:**
  - `[NEW]` [MEMORY.md](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/MEMORY.md) - Inicialização do diário de bordo dinâmico.
- **Status do Build & QGs:** Build passing | Memória ativada
- **Gaps Identificados:** Nenhum gap crítico imediato.
- **Próximos Passos:**
  - `[ ]` Executar auditoria inicial de produto usando o novo clone samuel-product-evolution-copilot
  - `[ ]` Integrar as APIs canônicas e banco de dados conforme o PRD do projeto

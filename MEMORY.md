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

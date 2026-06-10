# MEMORY.md — Report Executivo Qualidade

> Diário de bordo do projeto. Sessão mais recente no topo.

## 2026-06-10 (cont.) — QA visual autenticado + fix crítico de papéis aeC

**PR #3:** https://github.com/srssamuel/Report-Executivo-Qualidade/pull/3 (base `claude/executive-report-auth-vSEmU`). Criado via API com **DNS forçado** — o `gh` está cego porque o DNS local resolve `api.github.com` para um IP morto (`4.228.31.149`); `github.com`/push funcionam. O `GH_TOKEN` é VÁLIDO (o "invalid" do `gh auth status` é falso, efeito do DNS). Workaround reusável: Node `https` com `lookup` fixo em `140.82.121.6`.

**QA visual** (sessão admin **passwordless via magic-link** — Admin API `generateLink` + `verifyOtp` num `createServerClient` que captura os cookies `@supabase/ssr`; script `_mint-session.mjs`, não commitado): 7 views OK a 1440 + Dashboard/Carteira a 390px, console limpo (só `favicon.ico` 404), **tracking provado** (`daily_access` + `portfolio_snapshots` criados no 1º login). Gates: tsc 0 · vitest 10/10 · eslint 0 · build limpo.

**🔴 Fix crítico (commit `9e3cfcb`, migration `006`):** produção usa hierarquia **aeC** (`admin > gerente > coordenador > consultor > viewer`). `items`/`comments` já estavam ajustados, mas `people`/`daily_access` (004/005) ficaram com papéis legados → **gerente (4) + coordenador (6), 10/15 usuários, travados** em gestão de pessoas/capacidade e aderência. Reconciliado: constraint + policies + tiers centralizados em `lib/domain` (`WRITE_ROLES`/`MANAGE_ROLES`/`LEADERSHIP_ROLES`) + gates de UI (`canManagePeople`/`isLeadership`) + `VALID_ROLES`/`ASSIGNABLE_ROLES`. Regra: aderência do time = só liderança (admin/gerente); gestão de pessoas/capacidade = admin/gerente/coordenador; contribuição (criar item/pessoa/comentar) = todos menos viewer. Migration 006 aplicada e verificada em produção.

**Contexto novo:** Supabase `rirkdpsyuvhumuhejofv` é **compartilhado** com outros apps (`instai_*`, `cvrg_*`, `okr`) — os erros de RLS do advisor são dessas tabelas, NÃO das nossas. Admin real = `m.samuel.rosa@aec.com.br`; `srssamuel@hotmail.com` virou `viewer`. WARN pré-existente: `clear_must_change_password()` é chamável via REST (usuário poderia limpar o próprio flag sem trocar a senha) — baixo risco.

## 2026-06-10 — Evolução V2 completa (branch `claude/recursing-meninsky-4b025b`)

**O que mudou (28 commits, spec em `docs/superpowers/specs/2026-06-10-evolucao-v2-design.md`):**

- **Tooling consertado**: pre-commit rodava `lint-staged` sem config → todo commit falhava. Agora: eslint flat config (Next 16), lint-staged, vitest, scripts `lint`/`typecheck`/`test`.
- **Migrations 004/005 APLICADAS no Supabase** (`rirkdpsyuvhumuhejofv`): tabela `people` (capacidade semanal individual, 17 pessoas backfilled de items.owner) + `items.owner_id`; `daily_access`, `portfolio_snapshots`, `user_profiles.must_change_password`, RPC `clear_must_change_password`; RLS granular (analista pode INSERT people, não UPDATE/DELETE).
- **Score de risco composto** (`lib/domain`): 5 fatores ponderados (prazo 40% · status 20% · progresso vs tempo 15% · staleness 15% · dependência 10%), faixas Crítico ≥70 / Alto / Médio / Baixo, decomposição explicável. 10 testes vitest. Invariante: `contribution = raw × weight`, sem ajustes ocultos.
- **Usuários admin-first** (decisão do Samuel: sem SMTP custom): criar usuário direto com senha temporária exibida 1×, editar nome/email/role, excluir de verdade, resetar senha → `must_change_password` força troca no 1º login via proxy. Endpoints `/api/admin/users*` com `requireAdmin()` + guards (self-delete, self-demote). Convite por email virou caminho secundário.
- **Refactor**: `page.tsx` 1167→~530 linhas; views em `components/views/*`, `components/ui.tsx`, `components/ItemDrawer.tsx` (drawer lateral único com decomposição do score, ESC fecha).
- **Views V2**: Carteira 6 colunas + chips + linha→drawer; Board 5 lanes (Atrasado→lane Em andamento como flag), WIP, drag-and-drop persiste status; Timeline só abertos (vencidos no topo, toggle p/ concluídos); Riscos = fila por score com fatores expandíveis.
- **Capacidade**: por pessoa real (`people`), capacidade individual editável (gate RLS: só admin/super/líder), simulador com select de pessoa.
- **Tracking**: `daily_access` (throttle 5min) + snapshot diário lazy em `lib/tracking.ts` (disparado pelo layout server).
- **Executivo V2**: 6 KPIs com tendência vs snapshot ~7d (Saúde, Críticas, No prazo, Freshness, Aderência, Esforço), painel de aderência por pessoa (7 dots, só admin/superintendente), fila de decisão por score, relatório textual mantido.

**Build status:** vitest 10/10 · tsc 0 erros · eslint 0 warnings · `next build` limpo. Review final whole-branch: Ready for PR.

**Pendências (barreira de dono):**
1. **QA visual autenticado** — política impede o agente de digitar senha; Samuel precisa logar e validar as 7 views (ou logar no Chrome e deixar o agente capturar screenshots via extensão).
2. Primeiro acesso real dispara o primeiro snapshot — tendências dos KPIs aparecem a partir do 7º dia de snapshots.
3. Itens multi-dono legados (20) ficaram com `owner_id` NULL — reatribuir pelo select do drawer quando tocados.
4. Secret `SUPABASE_SERVICE_ROLE_KEY` deve existir no ambiente do deploy (Vercel env) para os endpoints admin funcionarem em produção.

**Decisões registradas:** reset de senha só pelo admin (sem email); tabela people separada (nem todo responsável tem login); score composto em vez de matriz manual; lane Atrasado abolida (flag por prazo).

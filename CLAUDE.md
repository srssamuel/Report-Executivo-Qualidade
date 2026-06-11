# Report Executivo Qualidade — Contexto para Claude Code

## Identidade do projeto

- **Repo:** `srssamuel/Report-Executivo-Qualidade`
- **Branch ativa:** `main`
- **Stack:** Next.js 16 (App Router) · React 19 · Supabase Auth · Postgres + RLS · TypeScript strict · Zod · Vitest
- **Deploy:** Vercel (auto via GitHub Actions em `main` e `claude/**`)
- **URL produção:** `report-executivo-qualidade.vercel.app`
- **Diário de bordo:** `MEMORY.md` — histórico cronológico de decisões e entregas. Consultar antes de mudanças estruturais.

## Recursos já provisionados — NÃO RECRIAR

### Supabase

- **Projeto:** `report-executivo-qualidade`
- **ID:** `rirkdpsyuvhumuhejofv`
- **Region:** sa-east-1
- **URL:** `https://rirkdpsyuvhumuhejofv.supabase.co`
- **Anon key (publishable):** `sb_publishable_PPUFHkZ2rbLk5Id0N93DsQ_kHWGQWeC`
- **Migrations:** `supabase/migrations/001 → 022` — espelho do remoto, todas aplicadas. Sequência reproduzível em deploy limpo (idempotentes). Destaques: 009 OKRs · 010 Desenvolvimento/PDI · 013 `manager_id` · 017 tenancy de OKR por dono · 019 re-pendência de homologação · 021 hierarquia por `manager_id` no RLS · 022 people/tracking.
- **Admin pré-cadastrado:** `srssamuel@hotmail.com` (via tabela `invitations` — trigger promove no signup). `m.samuel.rosa@aec.com.br` também é admin.
- **14 usuários** cadastrados com roles e `manager_id` definidos
- **31 itens** importados (G6-001 a G6-031) + 50 OKRs Jan–Jun

### Vercel

- **Team:** `DataCX-AGI` (slug `srssamueldatacx-agi`, id `team_8fyhRYXjuzjs3ByUQTtPJNbL`)
- **Projeto:** `report-executivo-qualidade` (id `prj_KgJ92OeoCACarNQzzfLrR5U65zRk`)
- **Env vars do Supabase:** gerenciadas pela **integração Supabase↔Vercel** (painel Supabase → Integrações → Vercel) em todos os ambientes. O pipeline NÃO cria/recria variáveis.
- **OPENAI_API_KEY:** manual no painel Vercel (Production + Preview).

## CI/CD

### Quality gate (`.github/workflows/ci.yml`)

- Lint → Typecheck → **Test (vitest)** → Build
- Roda em push (`main`, `claude/**`, `integ/**`) + PRs para main

### E2E (`.github/workflows/e2e.yml`)

- Playwright contra build local + Supabase real: login, navegação nas 10 views (screenshots como artefatos), varredura a11y (axe-core, falha em violação crítica), /admin/users
- **Usuário QA efêmero**: criado pelo global-setup via `SUPABASE_SERVICE_ROLE_KEY` (secret) e apagado no teardown — sem credencial fixa
- Roda em PRs para main + push (`claude/**`, `integ/**`) + manual

### Deploy (`.github/workflows/deploy.yml`)

- Push em `main` → produção · Push em `claude/**` → preview · `workflow_dispatch` → manual
- Smoke test automático no `/api/health`

### Secrets necessários (GitHub Settings → Secrets)

| Secret              | Obrigatório         | Para que serve   |
| ------------------- | ------------------- | ---------------- |
| `VERCEL_TOKEN`      | Sim                 | Deploy na Vercel |
| `VERCEL_ORG_ID`     | Auto após 1º deploy | ID da org        |
| `VERCEL_PROJECT_ID` | Auto após 1º deploy | ID do projeto    |

> `SUPABASE_SERVICE_ROLE_KEY` não é mais secret do GitHub — chega ao runtime via integração Supabase↔Vercel.

## Estrutura do código (mapa real)

```
app/
  (auth)/login                 # Login + forgot password
  (auth)/reset-password        # Nova senha (+ first-login, checagem HIBP k-anonymity)
  (app)/page.tsx               # Orquestrador da SPA — estado, dados Supabase, 10 views
  admin/users/page.tsx         # Rota de gestão de usuários (UI vive em features/admin)
  api/admin/invite             # Convite em lote (Zod + rate limit)
  api/admin/users + [id]       # Criar/editar usuário direto (service role)
  api/admin/reset-password     # Reset de senha pelo admin
  api/ai/analyze               # Laudo IA do Perfil Vértice (OpenAI → fallback Ollama)
  api/ai/ata-summary           # Resumo inteligente das atas de 1:1
  api/ai/validate              # Detecção de provider de IA disponível
  api/health                   # Health check + conectividade Supabase
  error.tsx · layout.tsx · globals.css   # Error boundary, root layout, design system
features/                      # Uma pasta por view — TODO componente de view mora aqui
  dashboard/ portfolio/ board/ risks/ timeline/ capacity/
  executive/ okrs/ development/ archived/ admin/
shared/
  domain/index.ts              # ⭐ FONTE ÚNICA da lógica de negócio (tipos, cálculos,
                               #   filtros, trimestres OKR, canonicalização de nomes)
  domain/*.test.ts             # Testes de domínio (vitest) — manter ao mudar a lógica
  components/                  # Badge, ConfirmDialog, charts (recharts)
  tracking.ts                  # Telemetria de uso (daily_access + snapshots)
lib/
  supabase/{client,server,admin}.ts   # ⭐ FONTE ÚNICA dos clientes Supabase
  assessment/                  # Instrumento Perfil Vértice (108 questões + scoring)
  design-tokens.json           # Design tokens exportáveis
proxy.ts                       # Auth middleware (renomeado de middleware.ts no Next 16)
supabase/migrations/           # 001 → 022, espelho do remoto
scripts/                       # seed-okrs, prepare-mock, test-db (utilitários de dado)
```

> História: `lib/domain/` (espelho morto) e `shared/supabase/` (cópia idêntica) foram
> **removidos em 2026-06-11**. Se encontrar referência a eles em docs antigos, o caminho
> certo é `shared/domain` para domínio e `lib/supabase` para clientes.

## Comandos de dev

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Build produção
npm run lint         # ESLint
npm test             # Vitest (testes de domínio)
npm run e2e          # Playwright (precisa de SUPABASE_SERVICE_ROLE_KEY no env)
npx tsc --noEmit     # Typecheck
```

## Padrões de código

### Geral

- **CSS:** preservar `app/globals.css` — design system custom. NÃO substituir por Tailwind.
- **Lógica de domínio:** funções puras em `shared/domain/index.ts`. Reusar sempre; nova lógica de cálculo entra lá COM teste em `shared/domain/*.test.ts`.
- **Nomes de responsáveis:** sempre via chokepoint `ownersOf()` (canonicaliza contra o cadastro via `setCanonicalOwners`). Nunca casar nome por substring ad-hoc.
- **Tipos:** definidos em `shared/domain`. Usar `z.infer` de Zod quando possível.
- **Commits:** Conventional commits em PT-BR (`feat:`, `fix:`, `chore:`, etc.)
- **Idioma:** PT-BR em UI e commits

### RLS & Segurança

- Todas as tabelas têm RLS ativa; hierarquia de visibilidade por `manager_id` transitivo (`is_subordinate_or_self`, migration 021)
- Tenancy de OKR pelo vínculo `responsavel_user_id` (FK), não por nome
- Funções helper são SECURITY DEFINER com `SET search_path = public`; funções usadas em expressão de policy precisam de `GRANT EXECUTE TO authenticated` (lição da migration 018)
- Validação de input via Zod em todos os endpoints de API + rate limiting in-memory
- Security headers em `next.config.ts`; CSP estrito

### Roles

`admin` / `superintendente` / `gerente` / `coordenador` / `consultor` / `lider` / `analista` / `viewer`

### Views da SPA (10)

Dashboard · Carteira · Board · Riscos · Timeline · Capacidade · Executivo · OKRs Gerentes · Desenvolvimento · Arquivados

## Não fazer

- ❌ Recriar projeto Supabase
- ❌ Tocar nas tabelas de outros projetos no mesmo Supabase (`cvrg_*` do Workshop Convergência, `recanto-maanain`)
- ❌ Commitar `.env.local`
- ❌ Substituir o design system por outro framework de UI
- ❌ Reverter o rename `middleware.ts` → `proxy.ts` (necessário no Next 16)
- ❌ Adicionar `any` em TypeScript
- ❌ Usar imports relativos profundos (`../../..`) — usar `@/*`
- ❌ Recriar módulos duplicados (já houve `lib/domain` + `shared/domain` em paralelo — uma cópia só)
- ❌ Casar responsável por substring/apelido fora do `ownersOf()`

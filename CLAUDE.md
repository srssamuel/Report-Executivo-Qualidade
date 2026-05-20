# Report Executivo Qualidade — Contexto para Claude Code

## Identidade do projeto

- **Repo:** `srssamuel/Report-Executivo-Qualidade`
- **Branch ativa:** `main`
- **Stack:** Next.js 16 (App Router) · React 19 · Supabase Auth · Postgres + RLS · TypeScript strict · Zod
- **Deploy:** Vercel (auto via GitHub Actions em `main` e `claude/**`)
- **URL produção:** `report-executivo-qualidade.vercel.app`

## Recursos já provisionados — NÃO RECRIAR

### Supabase
- **Projeto:** `report-executivo-qualidade`
- **ID:** `rirkdpsyuvhumuhejofv`
- **Region:** sa-east-1
- **URL:** `https://rirkdpsyuvhumuhejofv.supabase.co`
- **Anon key (publishable):** `sb_publishable_PPUFHkZ2rbLk5Id0N93DsQ_kHWGQWeC`
- **Migrations aplicadas:** 001_schema, 002_rls, 003_security_hardening, 004_gains_products, 005_password_changed
- **Admin pré-cadastrado:** `srssamuel@hotmail.com` (via tabela `invitations` — trigger promove no signup)
- **14 usuários** cadastrados com roles definidos
- **31 itens** importados (G6-001 a G6-031)

### Vercel
- **Team:** `DataCX-AGI` (slug `srssamueldatacx-agi`, id `team_8fyhRYXjuzjs3ByUQTtPJNbL`)
- **Projeto:** `report-executivo-qualidade` (id `prj_KgJ92OeoCACarNQzzfLrR5U65zRk`)
- **Env vars:** 3 configuradas (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY)

## CI/CD

### Deploy (`.github/workflows/deploy.yml`)
- Push em `main` → produção
- Push em `claude/**` → preview
- `workflow_dispatch` → manual para production ou preview
- Smoke test automático no login

### Quality gate (`.github/workflows/ci.yml`)
- Lint → Typecheck → Build
- Roda em push + PRs para main

### Secrets necessários (GitHub Settings → Secrets)

| Secret | Obrigatório | Para que serve |
|--------|-------------|----------------|
| `VERCEL_TOKEN` | Sim | Deploy na Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Para invite flow | `/api/admin/invite` |
| `VERCEL_ORG_ID` | Auto após 1º deploy | ID da org |
| `VERCEL_PROJECT_ID` | Auto após 1º deploy | ID do projeto |

## Estrutura do código

```
app/
  (auth)/login                 # Login + forgot password
  (auth)/reset-password        # Definir nova senha (+ first-login)
  (app)/page.tsx               # SPA principal — 8 views
  admin/users/                 # Gestão de usuários (admin only)
  api/admin/invite/route.ts    # Convite em lote (Zod + rate limit)
  api/health/route.ts          # Health check + conectividade Supabase
  globals.css                  # Design system completo (~550 linhas)
lib/
  domain/index.ts              # Lógica de negócio em TS puro (tipos, cálculos, filtros)
  supabase/{client,server}.ts  # Clientes browser/SSR
proxy.ts                       # Auth middleware (renomeado de middleware.ts em Next 16)
supabase/migrations/
  001_schema.sql               # 7 tabelas + triggers
  002_rls.sql                  # Políticas RLS por role
  003_security_hardening.sql   # REVOKE EXECUTE + search_path
  004_gains_products.sql       # Products + Gains
  005_password_changed.sql     # Flag first-login
```

## Comandos de dev

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Build produção
npm run lint         # ESLint
npx tsc --noEmit     # Typecheck
```

## Padrões de código

### Geral
- **CSS:** preservar `app/globals.css` — design system custom. NÃO substituir por Tailwind.
- **Lógica de domínio:** funções puras em `lib/domain/index.ts`. Reusar sempre.
- **Tipos:** Definidos no domain/index.ts. Usar `z.infer` de Zod quando possível.
- **Commits:** Conventional commits em PT-BR (`feat:`, `fix:`, `chore:`, etc.)
- **Idioma:** PT-BR em UI e commits

### RLS & Segurança
- Todas as tabelas têm RLS ativa
- Funções helper são SECURITY DEFINER com `SET search_path = public`
- Validação de input via Zod em todos os endpoints de API
- Security headers configurados em `next.config.ts`
- Rate limiting in-memory nos endpoints sensíveis

### Roles
`admin` / `superintendente` / `gerente` / `coordenador` / `consultor` / `lider` / `analista` / `viewer`

### Views da SPA
Dashboard · Carteira · Board · Riscos · Timeline · Capacidade · Executivo · Arquivados

## Não fazer

- ❌ Recriar projeto Supabase
- ❌ Tocar nas tabelas do `recanto-maanain` (outro projeto Supabase do usuário)
- ❌ Commitar `.env.local`
- ❌ Substituir o design system por outro framework de UI
- ❌ Reverter o rename `middleware.ts` → `proxy.ts` (necessário no Next 16)
- ❌ Adicionar `any` em TypeScript
- ❌ Usar imports relativos profundos (`../../..`) — usar `@/*`

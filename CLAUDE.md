# Report Executivo Qualidade — Contexto para Claude Code

## Identidade do projeto

- **Repo:** `srssamuel/Report-Executivo-Qualidade`
- **Branch ativa:** `claude/executive-report-auth-vSEmU` (PR #1)
- **Stack:** Next.js 16 (App Router) · Supabase Auth · Postgres + RLS · TypeScript

## Recursos já provisionados — NÃO RECRIAR

### Supabase
- **Projeto:** `report-executivo-qualidade`
- **ID:** `rirkdpsyuvhumuhejofv`
- **Region:** sa-east-1
- **URL:** `https://rirkdpsyuvhumuhejofv.supabase.co`
- **Anon key (publishable):** `sb_publishable_PPUFHkZ2rbLk5Id0N93DsQ_kHWGQWeC`
- **Migrations aplicadas:** 001_schema, 002_rls, 003_security_hardening
- **Admin pré-cadastrado:** `srssamuel@hotmail.com` (via tabela `invitations` — vira admin no primeiro signup)

### Vercel
- **Team:** `DataCX-AGI` (slug `srssamueldatacx-agi`, id `team_8fyhRYXjuzjs3ByUQTtPJNbL`)
- **Projeto:** a criar via GitHub Action no primeiro push em main
- **Deploy:** automatizado via `.github/workflows/deploy.yml`

## CI/CD

Deploy automático configurado em `.github/workflows/deploy.yml`:
- Push em `main` → produção
- Push em `claude/**` → preview
- `workflow_dispatch` → manual para production ou preview

### Secrets necessários (GitHub Settings → Secrets and variables → Actions)

| Secret | Obrigatório | Para que serve |
|--------|-------------|----------------|
| `VERCEL_TOKEN` | ✅ Sim | Deploy na Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Para invite flow | Endpoint `/api/admin/invite` enviar convites |
| `VERCEL_ORG_ID` | Auto após 1º deploy | Cache (sai do `.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Auto após 1º deploy | Cache (sai do `.vercel/project.json`) |

## Estrutura do código

```
app/
  (auth)/login                # Login + forgot password
  (auth)/reset-password       # Definir nova senha
  (app)/page.tsx              # SPA principal — 7 views (Dashboard, Carteira, Board, Riscos, Timeline, Capacidade, Executivo)
  admin/users                 # Gestão de usuários (admin only)
  api/admin/invite            # Endpoint de convite (service role)
  globals.css                 # Design system completo (v9)
lib/
  domain/index.ts             # Lógica de negócio em TS puro
  supabase/{client,server}.ts # Clientes browser/SSR
proxy.ts                      # Auth middleware (renomeado de middleware.ts em Next 16)
supabase/migrations/
  001_schema.sql              # 5 tabelas + triggers
  002_rls.sql                 # Políticas RLS por role
  003_security_hardening.sql  # REVOKE EXECUTE + search_path
```

## Convenções

- **CSS:** preservar `app/globals.css` — design system de 500+ linhas portado do HTML original. Não substituir por Tailwind.
- **Lógica de domínio:** funções puras em `lib/domain/index.ts`. Reusar sempre.
- **RLS:** todas as tabelas precisam ter RLS ativa. Funções helper SECURITY DEFINER com `SET search_path = public`.
- **Roles (hierarquia aeC):** `admin` / `gerente` / `coordenador` / `consultor` / `viewer` — legados `superintendente`/`lider`/`analista` aceitos p/ compat. Tiers em `lib/domain` (`WRITE_ROLES`/`MANAGE_ROLES`/`LEADERSHIP_ROLES`) espelham as policies RLS (migration `006`). Aderência do time = só liderança (admin/gerente).
- **Idioma:** PT-BR em UI e commits.

## Não fazer

- ❌ Recriar projeto Supabase
- ❌ Tocar nas tabelas do `recanto-maanain` (outro projeto Supabase do usuário, em produção)
- ❌ Commitar `.env.local`
- ❌ Substituir o design system por outro framework de UI
- ❌ Reverter o rename `middleware.ts` → `proxy.ts` (necessário no Next 16)

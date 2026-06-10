# Report Executivo Qualidade

Painel executivo de gestão de carteira e capacidade — Superintendência Vivo e Nubank.

**Stack:** Next.js 16 · Supabase Auth · Postgres + RLS · TypeScript

---

## Deploy em 1 clique

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsrssamuel%2FReport-Executivo-Qualidade&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&envDescription=Credenciais%20do%20projeto%20Supabase&envLink=https%3A%2F%2Fsupabase.com%2Fdashboard%2Fproject%2Frirkdpsyuvhumuhejofv%2Fsettings%2Fapi-keys&project-name=report-executivo-qualidade&repository-name=Report-Executivo-Qualidade)

O botão acima já leva o repositório, pede as 3 envs e faz o deploy. Valores prontos:

| Env | Valor |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rirkdpsyuvhumuhejofv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_PPUFHkZ2rbLk5Id0N93DsQ_kHWGQWeC` |
| `SUPABASE_SERVICE_ROLE_KEY` | [pegar aqui](https://supabase.com/dashboard/project/rirkdpsyuvhumuhejofv/settings/api-keys) |

Depois do deploy: em **Supabase → Authentication → URL Configuration** defina **Site URL** = URL do Vercel.

---

## Rodar localmente

```bash
git clone https://github.com/srssamuel/Report-Executivo-Qualidade.git
cd Report-Executivo-Qualidade
npm install
cp .env.local.example .env.local      # preencher as 3 vars acima
npm run dev
# http://localhost:3000
```

**Primeiro admin:** signup com `srssamuel@hotmail.com` — já está pré-cadastrado como admin via tabela `invitations` (trigger promove no signup).

---

## Arquitetura

```
app/
  (auth)/login                # Login / forgot password
  (auth)/reset-password       # Definir nova senha
  (app)/page.tsx              # SPA principal — 7 views
  admin/users                 # Gestão de usuários (admin only)
  api/admin/invite            # Endpoint de convite (service role)
  globals.css                 # Design system (500 linhas)
lib/
  domain/index.ts             # Lógica de negócio em TS puro
  supabase/{client,server}.ts # Clientes browser/SSR
proxy.ts                      # Auth middleware
supabase/migrations/
  001_schema.sql              # 5 tabelas + triggers
  002_rls.sql                 # Políticas por role
  003_security_hardening.sql  # REVOKE EXECUTE + search_path
  004_people.sql              # Tabela people + items.owner_id + backfill
  005_activity.sql            # daily_access + snapshots + must_change_password
  006_role_model_aec.sql      # Reconciliação do modelo de papéis (hierarquia aeC)
```

### Roles

Hierarquia real (aeC):

| Role | Pode |
|------|------|
| `admin` | Tudo + gerenciar usuários |
| `gerente` | Escrever itens + arquivar + gerir pessoas/capacidade + **ver aderência do time** |
| `coordenador` | Escrever itens + arquivar + gerir pessoas/capacidade |
| `consultor` | Escrever itens + comentar + criar pessoa |
| `viewer` | Apenas ler |

> Papéis legados (`superintendente`, `lider`, `analista`) seguem aceitos para compatibilidade e mapeiam, respectivamente, para liderança / gestão / contribuição. Os tiers de permissão vivem em `lib/domain/index.ts` (`WRITE_ROLES` / `MANAGE_ROLES` / `LEADERSHIP_ROLES`) e espelham as policies RLS da migration `006`.

### Views

`Dashboard` · `Carteira` · `Board Kanban` · `Riscos` · `Timeline` · `Capacidade` (Gantt + simulador) · `Executivo` (relatório textual)

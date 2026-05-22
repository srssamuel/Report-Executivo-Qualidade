# Report Executivo Qualidade

Painel executivo de gestão de carteira e capacidade — Superintendência Vivo e Nubank.

## 📚 Documentação Técnica

Para compreender os detalhes operacionais e arquiteturais, acesse:

- [Especificação de APIs e Endpoints](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/docs/api.md)
- [Arquitetura de Software e Fluxos de Dados](file:///D:/Projetos%20IA/02_PROJETOS_ATIVOS/Report-Executivo-Qualidade/docs/architecture.md)

| Item         | Detalhe                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| **Stack**    | Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase Auth + Postgres + RLS |
| **Deploy**   | Vercel (auto via GitHub Actions em `main`)                                              |
| **Supabase** | Projeto `rirkdpsyuvhumuhejofv` · sa-east-1                                              |
| **Repo**     | `srssamuel/Report-Executivo-Qualidade`                                                  |

---

## Setup local

```bash
git clone https://github.com/srssamuel/Report-Executivo-Qualidade.git
cd Report-Executivo-Qualidade
npm install
cp .env.local.example .env.local   # preencher as variáveis abaixo
npm run dev                        # http://localhost:3000
```

### Variáveis de ambiente

| Variável                        | Obrigatória       | Descrição                                                            |
| ------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Sim               | URL do projeto Supabase (`https://rirkdpsyuvhumuhejofv.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim               | Chave pública (anon) do Supabase                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Sim (invite flow) | Chave service role — usada apenas no endpoint `/api/admin/invite`    |

> **Primeiro admin:** faça signup com `srssamuel@hotmail.com` — já está pré-cadastrado via tabela `invitations` e o trigger promove para admin automaticamente.

### Scripts disponíveis

| Comando         | O que faz                |
| --------------- | ------------------------ |
| `npm run dev`   | Dev server com Turbopack |
| `npm run build` | Build de produção        |
| `npm start`     | Serve build de produção  |
| `npm run lint`  | ESLint via Next.js       |

---

## Arquitetura

```
app/
├── (app)/page.tsx              # SPA principal — 8 views (Dashboard, Carteira, Board,
│                                 Riscos, Timeline, Capacidade, Executivo, Arquivados)
├── (auth)/login/               # Login + forgot password
├── (auth)/reset-password/      # Definir nova senha (+ first-login flow)
├── admin/users/                # Gestão de usuários (admin only)
├── api/admin/invite/route.ts   # Endpoint de convite (service role)
├── api/health/route.ts         # Health check
├── globals.css                 # Design system completo (~550 linhas)
├── layout.tsx                  # Root layout (metadata, lang pt-BR)
lib/
├── domain/index.ts             # Lógica de negócio pura (tipos, cálculos, filtros)
├── supabase/client.ts          # Cliente browser (createBrowserClient)
├── supabase/server.ts          # Cliente SSR (createServerClient)
proxy.ts                        # Auth middleware (renomeado de middleware.ts — Next.js 16)
supabase/migrations/
├── 001_schema.sql              # 7 tabelas + triggers
├── 002_rls.sql                 # Políticas RLS por role
├── 003_security_hardening.sql  # REVOKE EXECUTE + search_path
├── 004_gains_products.sql      # Tabelas products + gains
├── 005_password_changed.sql    # Flag first-login
```

### Fluxo de dados

```
Browser (React SPA)
  ↓ Supabase JS Client (anon key)
Supabase Auth (JWT)
  ↓
Postgres + RLS (role-based access)
  ↓
proxy.ts (Next.js middleware — redirect se não autenticado)
```

### Roles

| Role              | Permissões                             |
| ----------------- | -------------------------------------- |
| `admin`           | Tudo + gerenciar usuários + convidar   |
| `superintendente` | Ler/escrever todos os itens + arquivar |
| `lider`           | Ler/escrever + arquivar                |
| `analista`        | Ler/escrever                           |
| `viewer`          | Apenas leitura                         |

### Views da SPA

| View       | Descrição                                                  |
| ---------- | ---------------------------------------------------------- |
| Dashboard  | KPIs, donut de saúde, fila de decisão, narrativa executiva |
| Carteira   | Tabela completa com edição inline em todas as colunas      |
| Board      | Kanban por status                                          |
| Riscos     | Matriz de riscos com severidade                            |
| Timeline   | Gantt visual                                               |
| Capacidade | Simulador de carga + distribuição por owner                |
| Executivo  | Relatório textual gerado automaticamente                   |
| Arquivados | Itens arquivados com restauração                           |

---

## API

### `POST /api/admin/invite`

Convida usuários em lote via Supabase Auth. Requer autenticação como `admin`.

**Request body:**

```json
{
  "invites": [
    { "email": "user@domain.com", "role": "analista", "name": "Nome Completo" }
  ]
}
```

**Response:**

```json
{
  "ok": true,
  "sent": 1,
  "failed": 0,
  "results": [
    { "email": "user@domain.com", "ok": true, "note": "Convite enviado." }
  ]
}
```

### `GET /api/health`

Health check. Retorna status do app e conectividade com Supabase.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-05-20T12:00:00.000Z",
  "version": "0.1.0",
  "supabase": "connected"
}
```

---

## Deploy

Deploy automático via GitHub Actions (`.github/workflows/deploy.yml`):

- Push em `main` → produção
- Push em `claude/**` → preview
- `workflow_dispatch` → manual (production ou preview)

### Secrets necessários no GitHub

| Secret                      | Obrigatório         | Para que serve       |
| --------------------------- | ------------------- | -------------------- |
| `VERCEL_TOKEN`              | Sim                 | Deploy na Vercel     |
| `SUPABASE_SERVICE_ROLE_KEY` | Para invite flow    | `/api/admin/invite`  |
| `VERCEL_ORG_ID`             | Auto após 1º deploy | ID da org Vercel     |
| `VERCEL_PROJECT_ID`         | Auto após 1º deploy | ID do projeto Vercel |

### Deploy em 1 clique

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsrssamuel%2FReport-Executivo-Qualidade&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&project-name=report-executivo-qualidade)

---

## Banco de dados

### Tabelas

| Tabela          | Descrição                           | RLS                           |
| --------------- | ----------------------------------- | ----------------------------- |
| `user_profiles` | Perfis vinculados 1:1 a auth.users  | Admin full, own read          |
| `items`         | Frentes de trabalho (31 itens base) | Auth read, role-gated write   |
| `item_comments` | Comentários por item                | Auth read, role-gated insert  |
| `item_history`  | Histórico field-level (audit trail) | Auth read/insert              |
| `invitations`   | Convites pendentes                  | Admin only                    |
| `products`      | Produtos/clientes (dinâmico)        | Public read, admin write      |
| `gains`         | Ganhos registrados por item         | Public read, role-gated write |

### Migrations

As migrations estão em `supabase/migrations/` e foram aplicadas diretamente ao projeto Supabase em produção. Para recriar em outro ambiente, execute na ordem: 001 → 002 → 003 → 004 → 005.

---

## Convenções

- **CSS:** Design system custom em `globals.css` — NÃO substituir por Tailwind
- **Lógica de domínio:** Funções puras em `lib/domain/index.ts` — reusar sempre
- **Idioma:** PT-BR em UI e commits
- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- **Middleware:** `proxy.ts` (Next.js 16 renomeia middleware.ts)

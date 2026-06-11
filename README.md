# Report Executivo Qualidade

Painel executivo de gestão de carteira, capacidade, OKRs e desenvolvimento de pessoas — Superintendência Vivo e Nubank.

## 📚 Documentação Técnica

- [Especificação de APIs e Endpoints](./docs/api.md)
- [Arquitetura de Software e Fluxos de Dados](./docs/architecture.md)
- [Governança](./docs/governance.md) · [Métricas de Negócio](./docs/business_metrics.md)
- [CLAUDE.md](./CLAUDE.md) — mapa do projeto para sessões de IA · [MEMORY.md](./MEMORY.md) — diário de bordo

| Item         | Detalhe                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| **Stack**    | Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase Auth + Postgres + RLS · Vitest |
| **Deploy**   | Vercel (auto via GitHub Actions em `main`)                                                       |
| **Supabase** | Projeto `rirkdpsyuvhumuhejofv` · sa-east-1                                                       |
| **Repo**     | `srssamuel/Report-Executivo-Qualidade`                                                           |

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

| Variável                        | Obrigatória         | Descrição                                                            |
| ------------------------------- | ------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Sim                 | URL do projeto Supabase (`https://rirkdpsyuvhumuhejofv.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim                 | Chave pública (anon) do Supabase                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Para `/api/admin/*` | Chave service role — usada apenas nos endpoints administrativos      |
| `OPENAI_API_KEY`                | Para laudo IA       | Laudo do Perfil Vértice e resumo de 1:1 (`/api/ai/*`)                |

> **Primeiro admin:** faça signup com `srssamuel@hotmail.com` — já está pré-cadastrado via tabela `invitations` e o trigger promove para admin automaticamente.

### Scripts disponíveis

| Comando         | O que faz                  |
| --------------- | -------------------------- |
| `npm run dev`   | Dev server com Turbopack   |
| `npm run build` | Build de produção          |
| `npm start`     | Serve build de produção    |
| `npm run lint`  | ESLint                     |
| `npm test`      | Vitest (testes de domínio) |

---

## Arquitetura

```
app/
├── (app)/page.tsx              # Orquestrador da SPA — estado, dados Supabase, 10 views
├── (auth)/login/               # Login + forgot password
├── (auth)/reset-password/      # Nova senha (+ first-login, checagem HIBP)
├── admin/users/                # Gestão de usuários (admin only)
├── api/admin/                  # invite · users · reset-password (service role + Zod)
├── api/ai/                     # analyze · ata-summary · validate (laudo IA Vértice)
├── api/health/                 # Health check
├── globals.css                 # Design system custom
features/                       # Uma pasta por view da SPA
├── dashboard/ portfolio/ board/ risks/ timeline/ capacity/
├── executive/ okrs/ development/ archived/ admin/
shared/
├── domain/index.ts             # Fonte única da lógica de negócio (+ testes *.test.ts)
├── components/                 # Badge, ConfirmDialog, charts
├── tracking.ts                 # Telemetria de uso
lib/
├── supabase/{client,server,admin}.ts  # Clientes Supabase (browser / SSR / service role)
├── assessment/                 # Instrumento Perfil Vértice (108 questões + scoring)
proxy.ts                        # Auth middleware (renomeado de middleware.ts — Next.js 16)
supabase/migrations/            # 001 → 022 — espelho do banco remoto, reproduzível
```

### Fluxo de dados

```
Browser (React SPA)
  ↓ Supabase JS Client (anon key)
Supabase Auth (JWT)
  ↓
Postgres + RLS (acesso por papel + hierarquia manager_id)
  ↓
proxy.ts (Next.js middleware — redirect se não autenticado)
```

### Roles

| Role              | Permissões                                                  |
| ----------------- | ----------------------------------------------------------- |
| `admin`           | Tudo + gerenciar usuários + convidar                        |
| `superintendente` | Ler/escrever todos os itens + arquivar + homologar OKRs     |
| `gerente`         | Ler/escrever + lançar os próprios OKRs + ver o próprio time |
| `coordenador`     | Ler/escrever + ver o próprio time                           |
| `consultor`       | Ler/escrever + visibilidade de analista/viewer              |
| `lider`           | Ler/escrever + arquivar                                     |
| `analista`        | Ler/escrever                                                |
| `viewer`          | Apenas leitura                                              |

> A visibilidade de equipe (Desenvolvimento, PDI, avaliações) é resolvida no banco por
> `manager_id` transitivo — cada gestor enxerga apenas a própria árvore (migration 021).

### Views da SPA

| View            | Descrição                                                           |
| --------------- | ------------------------------------------------------------------- |
| Dashboard       | KPIs, saúde da carteira, capacidade/risco por responsável, OKRs     |
| Carteira        | Tabela completa com edição inline em todas as colunas               |
| Board           | Kanban por status                                                   |
| Riscos          | Matriz de riscos com score composto de 5 fatores                    |
| Timeline        | Gantt visual                                                        |
| Capacidade      | Simulador de carga + capacidade individual por pessoa               |
| Executivo       | Relatório imprimível + painel de aderência de uso com faróis        |
| OKRs Gerentes   | Apuração trimestral, fila de homologação, recontratação, 1:1 Hub    |
| Desenvolvimento | Perfil Vértice (laudo IA), atas de 1:1, PDI, Mapa de Perfil do Time |
| Arquivados      | Itens arquivados com restauração                                    |

---

## API (resumo)

| Endpoint                           | Método     | Descrição                                            |
| ---------------------------------- | ---------- | ---------------------------------------------------- |
| `/api/health`                      | GET        | Health check + conectividade Supabase                |
| `/api/admin/invite`                | POST       | Convite em lote (admin, Zod, rate limit)             |
| `/api/admin/users` · `/users/[id]` | POST/PATCH | Criar/editar usuário direto (admin)                  |
| `/api/admin/reset-password`        | POST       | Link de recuperação gerado pelo admin                |
| `/api/ai/analyze`                  | POST       | Laudo IA do Perfil Vértice (autenticado, rate limit) |
| `/api/ai/ata-summary`              | POST       | Resumo inteligente das atas de 1:1                   |
| `/api/ai/validate`                 | GET        | Detecta provider de IA disponível                    |

Detalhes de payload em [docs/api.md](./docs/api.md).

---

## Deploy

Deploy automático via GitHub Actions (`.github/workflows/deploy.yml`):

- Push em `main` → produção
- Push em `claude/**` → preview
- `workflow_dispatch` → manual (production ou preview)

CI (`.github/workflows/ci.yml`): Lint → Typecheck → Test → Build em todo push/PR.

### Secrets necessários no GitHub

| Secret                      | Obrigatório         | Para que serve       |
| --------------------------- | ------------------- | -------------------- |
| `VERCEL_TOKEN`              | Sim                 | Deploy na Vercel     |
| `SUPABASE_SERVICE_ROLE_KEY` | Para `/api/admin/*` | Endpoints admin      |
| `VERCEL_ORG_ID`             | Auto após 1º deploy | ID da org Vercel     |
| `VERCEL_PROJECT_ID`         | Auto após 1º deploy | ID do projeto Vercel |

---

## Banco de dados

### Tabelas principais

| Tabela                     | Descrição                                  | RLS                                 |
| -------------------------- | ------------------------------------------ | ----------------------------------- |
| `user_profiles`            | Perfis 1:1 com auth.users (+ `manager_id`) | Admin full, own read                |
| `items`                    | Frentes de trabalho (G6-001…)              | Auth read, role-gated write         |
| `item_comments`            | Comentários por item                       | Auth read, role-gated insert        |
| `item_history`             | Histórico field-level (audit trail)        | Auth read/insert                    |
| `invitations`              | Convites pendentes                         | Admin only                          |
| `products`                 | Produtos/clientes (dinâmico)               | Read auth, admin write              |
| `gains`                    | Ganhos registrados por item                | Read auth, role-gated write         |
| `okr_targets`              | OKRs contratados (dono via FK)             | Dono escreve, super/admin homologam |
| `okr_measurements`         | Apuração mensal (trimestre)                | Dono escreve, auditoria protegida   |
| `okr_feedbacks`            | Feedbacks de 1:1 por gerente               | Hierarquia por `manager_id`         |
| `user_pdis`                | PDIs por colaborador                       | Self + hierarquia                   |
| `profile_evaluations`      | Avaliações Perfil Vértice (laudo IA)       | Self-write + hierarquia read        |
| `people`                   | Pessoas com capacidade semanal individual  | Read auth, gestor write             |
| `daily_access` / snapshots | Telemetria de uso                          | Próprio usuário                     |

### Migrations

`supabase/migrations/001 → 022`, todas aplicadas no projeto remoto e idempotentes —
a sequência recria o banco em um ambiente limpo.

---

## Convenções

- **CSS:** Design system custom em `globals.css` — NÃO substituir por Tailwind
- **Lógica de domínio:** funções puras em `shared/domain/index.ts` — reusar sempre, com testes
- **Idioma:** PT-BR em UI e commits
- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- **Middleware:** `proxy.ts` (Next.js 16 renomeia middleware.ts)

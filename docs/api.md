# Documentação das APIs — Report Executivo Qualidade

Especificação dos endpoints de API do **Report Executivo Qualidade**: autenticação, validação de entrada, rate limiting e esquemas de resposta.

---

## 1. Diretrizes Gerais

- **Formato:** JSON em requisições e respostas (`Content-Type: application/json`).
- **Autenticação:** cookies de sessão Supabase (JWT) gerenciados pelo browser. O middleware (`proxy.ts`) exclui `/api/*` do redirect — cada endpoint valida a própria sessão.
- **Validação:** todo input passa por schema Zod; payload inválido retorna `422` com `details`.
- **Rate limiting:** in-memory por instância, por usuário autenticado. Estouro retorna `429` com header `Retry-After: 60`.
- **Erros:** códigos HTTP padrão + objeto explicativo:
  ```json
  { "error": "Mensagem detalhada do erro." }
  ```

| Endpoint                    | Método         | Auth        | Rate limit |
| --------------------------- | -------------- | ----------- | ---------- |
| `/api/health`               | GET            | Pública     | —          |
| `/api/admin/invite`         | POST           | `admin`     | 20/min     |
| `/api/admin/users`          | POST           | `admin`     | —          |
| `/api/admin/users/[id]`     | PATCH · DELETE | `admin`     | —          |
| `/api/admin/reset-password` | POST           | `admin`     | 20/min     |
| `/api/ai/analyze`           | POST           | Autenticado | 8/min      |
| `/api/ai/ata-summary`       | POST           | Autenticado | 10/min     |
| `/api/ai/validate`          | GET            | Pública     | —          |

---

## 2. Monitoramento

### 2.1. `GET /api/health`

Saúde operacional + conectividade com o Supabase. Usado pelo smoke test do pipeline de deploy.

```json
{
  "status": "ok",
  "timestamp": "2026-06-11T12:00:00.000Z",
  "version": "0.4.0",
  "supabase": "connected",
  "latencyMs": 85,
  "environment": "production"
}
```

Em degradação, `status: "degraded"` e `supabase` descreve o erro.

---

## 3. Administração de usuários (papel `admin`)

Todos usam a service role **somente no servidor** (`lib/supabase/admin.ts` — helper `requireAdmin`).

### 3.1. `POST /api/admin/invite`

Convite por e-mail, individual ou em lote (até 50). Cria/atualiza a linha em `invitations`; o trigger de signup aplica o papel.

```json
{
  "invites": [
    { "email": "user@dominio.com", "role": "analista", "name": "Nome Completo" }
  ]
}
```

Resposta: `{ "ok": true, "sent": 1, "failed": 0, "results": [...] }`.
Erros: `401` não autenticado · `403` não-admin · `422` payload inválido · `429` rate limit.

### 3.2. `POST /api/admin/users`

Criação direta (sem e-mail de convite): gera **senha temporária exibida uma única vez** e marca troca obrigatória no primeiro login.

```json
{ "email": "user@dominio.com", "fullName": "Nome Completo", "role": "analista" }
```

Resposta inclui `tempPassword` — exibida só nessa resposta, nunca persistida em claro.

### 3.3. `PATCH /api/admin/users/[id]`

Edita `fullName`, `email` e/ou `role` (ao menos um). **Guard:** admin não pode rebaixar o próprio papel (`400`).

### 3.4. `DELETE /api/admin/users/[id]`

Exclui o usuário do Auth (cascata no perfil). **Guard:** admin não pode excluir a própria conta (`400`).

### 3.5. `POST /api/admin/reset-password`

Gera senha temporária para outro usuário (`{ "userId": "<uuid>" }`) e força a troca no próximo login (`password_changed = false`).

Resposta: `{ "ok": true, "email": "...", "fullName": "...", "tempPassword": "..." }`.

---

## 4. Inteligência Artificial

Provedores: **OpenAI** (`gpt-4o-mini`, requer `OPENAI_API_KEY`) com fallback **Ollama** local (`OLLAMA_BASE_URL`). Sem provedor disponível → `503` gracioso; a UI usa fallback determinístico.

### 4.1. `GET /api/ai/validate`

Detecta o provedor ativo. Pública (read-only, sem custo de token).

```json
{ "available": true, "provider": "openai", "model": "gpt-4o-mini" }
```

### 4.2. `POST /api/ai/analyze`

Laudo narrativo do **Perfil Vértice** a partir dos scores do instrumento (5 domínios → 18 competências) + 5 respostas dissertativas + índice de consistência. O prompt deriva nomes do modelo em `lib/assessment/perfilCientificoQuestions.ts` (fonte única — sem hardcode).

Body (Zod): `collaborator_name`, `domain_scores`, `competency_scores`, `open_answers?`, `consistency_index` (0–100), `consistency_label`.

### 4.3. `POST /api/ai/ata-summary`

Resumo inteligente das atas de 1:1 de um colaborador (até 20 registros) + aderência de OKRs. O cliente mantém cache por colaborador/data — recargas não consomem token.

Body (Zod): `collaborator_name`, `status_summary`, `okr_adherence?` (`total`, `avg_attainment`, `on_track`, `at_risk`), `recent_oneonones[]` (`date?`, `type?`, `trimestre?`, `strengths?`, `improvements?`, `action_plan?`).

---

## 5. Acesso a dados (sem REST próprio)

O CRUD da carteira, OKRs, Desenvolvimento e people **não passa por endpoints próprios**: o SPA usa o cliente Supabase (anon key) e o **RLS do Postgres** decide o que cada papel lê/escreve (ver [architecture.md](./architecture.md)). Os endpoints acima existem apenas onde a service role ou a chave de IA são necessárias.

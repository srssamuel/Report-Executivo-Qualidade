# Documentação das APIs — Report Executivo Qualidade

Este documento especifica os endpoints de API disponíveis no **Report Executivo Qualidade**, incluindo autenticação, validação de entradas, controle de taxas e esquemas de resposta.

---

## 1. Diretrizes Gerais

- **Formato de Dados:** Todas as requisições e respostas utilizam JSON (`Content-Type: application/json`).
- **Autenticação:** Cookies de sessão Supabase JWT gerenciados no navegador ou cabeçalhos de autenticação válidos.
- **Tratamento de Erros:** Respostas de erro utilizam códigos de status HTTP padrão e retornam um objeto JSON explicativo:
  ```json
  { "error": "Mensagem detalhada do erro." }
  ```

---

## 2. Endpoints

### 2.1. `POST /api/admin/invite`

Convida um ou mais novos colaboradores por e-mail para participar da superintendência com um papel (`role`) definido.

- **Requisitos de Autorização:** Requer usuário logado com papel `admin`.
- **Limitação de Taxa (Rate Limit):** Limite de **20 requisições por minuto** por ID de administrador (bloqueio in-memory).
- **Validação de Entrada:** Validado estritamente via Zod. Suporta envio de único convite direto ou lote de até 50 convites.

#### Payload de Requisição (Lote):

```json
{
  "invites": [
    {
      "email": "colaborador.nubank@datacx.com.br",
      "role": "analista",
      "name": "Nome Completo"
    },
    {
      "email": "gerente.vivo@datacx.com.br",
      "role": "gerente"
    }
  ]
}
```

#### Payload de Requisição (Individual):

```json
{
  "email": "lider.cx@datacx.com.br",
  "role": "lider",
  "name": "Líder Experiência"
}
```

#### Payload de Resposta (Sucesso):

Retorna a contagem de e-mails enviados, falhas e o resultado individual de cada e-mail cadastrado ou atualizado no banco.

```json
{
  "ok": true,
  "sent": 2,
  "failed": 0,
  "results": [
    {
      "email": "colaborador.nubank@datacx.com.br",
      "ok": true,
      "note": "Convite enviado."
    },
    {
      "email": "gerente.vivo@datacx.com.br",
      "ok": true,
      "note": "Já cadastrado — papel atualizado."
    }
  ]
}
```

#### Respostas de Erro Comuns:

- **HTTP 401 Unauthorized:** Usuário não autenticado.
- **HTTP 403 Forbidden:** Usuário autenticado, mas não possui papel de `admin`.
- **HTTP 422 Unprocessable Entity:** Payload malformado ou e-mail inválido. Retorna detalhes dos campos incorretos (`details`).
- **HTTP 429 Too Many Requests:** Limite de 20 convites por minuto estourado. Retorna o cabeçalho `Retry-After: 60`.

---

### 2.2. `GET /api/health`

Endpoint público para monitoramento de saúde operacional e integridade com a infraestrutura do Supabase Postgres.

- **Requisitos de Autorização:** Nível de acesso público (sem necessidade de login).

#### Payload de Resposta (Saudável):

```json
{
  "status": "ok",
  "timestamp": "2026-05-22T20:10:00.000Z",
  "version": "0.3.0",
  "supabase": "connected",
  "latencyMs": 85,
  "environment": "production"
}
```

#### Payload de Resposta (Instável / Degradado):

Se houver perda de conexão com o banco de dados Supabase:

```json
{
  "status": "degraded",
  "timestamp": "2026-05-22T20:11:00.000Z",
  "version": "0.3.0",
  "supabase": "error: Connection timeout",
  "latencyMs": 5000,
  "environment": "production"
}
```

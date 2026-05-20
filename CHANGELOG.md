# Changelog

Todas as mudanças relevantes do Report Executivo Qualidade são documentadas aqui.
Formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
versionamento segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2026-05-20

### Adicionado

- Vercel Analytics (`@vercel/analytics`) para tracking de uso
- Vercel Speed Insights (`@vercel/speed-insights`) para métricas de performance
- Error boundary global (`app/error.tsx`) com UI em PT-BR
- Design tokens exportáveis (`lib/design-tokens.json`)
- ESLint flat config com `typescript-eslint` e `no-explicit-any: error`
- Husky + lint-staged (pre-commit hook: eslint --fix + prettier)
- CI workflow (`lint` → `typecheck` → `build`)
- PR template com checklist de qualidade
- Health check endpoint (`GET /api/health`)
- Security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy)
- Validação de input com Zod 4 no endpoint de invite
- Rate limiting no endpoint de invite (20 req/min)
- Documentação completa (README, CLAUDE.md, CHANGELOG, .env.local.example)

## [0.2.0] - 2026-05-20

### Adicionado

- Tabela de carteira (PortfolioView) completa com todas as colunas do HTML original
  - Produto: input inline com datalist (era badge)
  - Início: coluna com date input
  - Capacidade: esforço(h) + equipe + restante calculado
  - Predecessor: select + nota de dependência textarea
  - Prioridade: select inline (era badge)
  - Progresso: input numérico + barra visual
  - Comentário executivo: textarea inline
- Botão "Marcar produto" para aplicação em lote
- Botão "Coment." para abrir modal focado em comentários
- Toggle "Expandir/Compactar textos" na carteira
- Health check endpoint (`GET /api/health`)
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Validação de input com Zod no endpoint de invite
- Rate limiting no endpoint de invite (20 req/min)
- CI workflow (lint + typecheck + build)
- PR template
- Documentação completa (README, API docs, CHANGELOG)

### Alterado

- Botão "Editar" renomeado para "Abrir" na carteira (match HTML original)
- Demanda alterada de input para textarea (suporta texto longo)

## [0.1.0] - 2026-05-19

### Adicionado

- SPA principal com 8 views: Dashboard, Carteira, Board, Riscos, Timeline, Capacidade, Executivo, Arquivados
- Sistema de ganhos (Financeiro, Processo, Relacionamento, Resultado)
- Produtos dinâmicos (tabela `products`)
- Histórico de alterações field-level
- Itens arquivados com restauração
- Flow de first-login (troca de senha obrigatória)
- Sistema de convite em lote (admin → batch invite)
- 14 usuários pré-cadastrados com roles definidos
- 31 itens de carteira importados do HTML original
- Deploy automático via GitHub Actions → Vercel

### Segurança

- Supabase Auth com JWT
- RLS em todas as 7 tabelas
- SECURITY DEFINER com search_path fixo
- REVOKE EXECUTE em funções helper
- Middleware de autenticação (proxy.ts)

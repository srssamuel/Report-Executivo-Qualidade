#!/bin/bash
# SessionStart hook — Claude Code on the web
# Instala as dependências npm para que lint (eslint), typecheck (tsc),
# testes (vitest) e build (next) funcionem desde o início da sessão.
#
# Notas:
# - Roda APENAS no ambiente remoto (Claude Code on the web).
# - `npm install` (não `npm ci`): aproveita o cache do container entre sessões.
# - NÃO instala browsers do Playwright: a política de rede do sandbox bloqueia
#   o CDN (cdn.playwright.dev) — o E2E roda no GitHub Actions (e2e.yml).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] instalando dependências npm…"
npm install --no-audit --no-fund

echo "[session-start] pronto: $(node --version) · npm $(npm --version)"

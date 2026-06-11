-- ============================================================
--  011 — Hardening: trigger functions fora da superfície RPC
-- ============================================================
-- JÁ APLICADA no remoto (rirkdpsyuvhumuhejofv) em 2026-05-27 via MCP;
-- o arquivo havia se perdido do repositório. Restaurado para manter a
-- sequência 001→022 reproduzível em deploy limpo. Idempotente — em
-- produção é no-op.
--
-- Trigger functions são invocadas pelos triggers (como owner), nunca
-- pelo cliente — não devem ser executáveis via /rest/v1/rpc/*.

REVOKE EXECUTE ON FUNCTION public.protect_okr_audit_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_okr_audit_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_okr_audit_fields() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM authenticated;

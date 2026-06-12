-- ============================================================
--  024 — Trilha de auditoria de ações administrativas
--  (Roadmap Onda 1, item 1.3) — APLICADA no remoto em 2026-06-12
-- ============================================================
-- Escrita APENAS via service role (rotas /api/admin/*): não há policy de
-- INSERT/UPDATE/DELETE — o log é imutável para qualquer papel autenticado.
-- Leitura restrita a admin (is_admin(), GRANT da migration 003/018).
-- actor_email é snapshot denormalizado: sobrevive à exclusão do ator.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_id uuid,
  target_email text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin read" ON admin_audit_log;
CREATE POLICY "audit admin read" ON admin_audit_log FOR SELECT USING (is_admin());

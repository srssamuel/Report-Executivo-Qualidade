-- ============================================================
--  025 — Notificações in-app (@menções) — Sprint D do redesign
--  APLICADA no remoto em 2026-06-12. Idempotente.
-- ============================================================
-- Dono lê e marca como lida; qualquer autenticado pode inserir
-- (mencionar um colega). Cascade limpa ao excluir o usuário.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'mention',
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at) WHERE read_at IS NULL;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif own read" ON notifications;
CREATE POLICY "notif own read" ON notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif own update" ON notifications;
CREATE POLICY "notif own update" ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "notif authenticated insert" ON notifications;
CREATE POLICY "notif authenticated insert" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

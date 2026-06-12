-- 026: preferências de UI por usuário (Onda 1.4 — dashboard personalizável)
-- Chave/valor genérico para preferências futuras; RLS estrita por dono.

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT        NOT NULL,
  value      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_select ON user_preferences;
CREATE POLICY user_preferences_select ON user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_insert ON user_preferences;
CREATE POLICY user_preferences_insert ON user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_update ON user_preferences;
CREATE POLICY user_preferences_update ON user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_preferences_delete ON user_preferences;
CREATE POLICY user_preferences_delete ON user_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- updated_at automático (reusa a trigger function global)
DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

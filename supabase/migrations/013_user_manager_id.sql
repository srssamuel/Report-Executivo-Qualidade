-- Migration 013: gestor imediato (manager_id) por colaborador
-- Adiciona a relação de reporte real (quem é gestor de quem), complementar aos
-- papéis/níveis. Auto-FK em user_profiles; ON DELETE SET NULL para que remover
-- um gestor não quebre os liderados (apenas zera o vínculo). Idempotente.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.manager_id IS 'Gestor imediato (auto-FK para user_profiles.id). NULL = sem gestor definido.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON user_profiles(manager_id);

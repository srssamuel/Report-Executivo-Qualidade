-- Migration 010: Executive Development block (PDIs, Scientific Profiles & Feedbacks access control)
-- Adds user_pdis and profile_evaluations tables, updates check constraint for user_profiles and security rules

-- ----------------------------------------------------------
-- 1. Update user_profiles role check constraint to include all roles
-- ----------------------------------------------------------
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista','viewer'));

-- ----------------------------------------------------------
-- 2. Access control helper: is_team_member
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION is_team_member(collaborator_name TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_role TEXT;
  target_role TEXT;
BEGIN
  -- 1. Obter o papel do usuário logado
  SELECT role INTO user_role FROM user_profiles WHERE id = auth.uid();
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 2. Superintendência e Admin possuem acesso irrestrito
  IF user_role IN ('admin', 'superintendente') THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Obter o papel do colaborador a ser acessado
  SELECT role INTO target_role FROM user_profiles 
  WHERE lower(full_name) = lower(collaborator_name) 
     OR position(lower(collaborator_name) in lower(full_name)) > 0 
     OR position(lower(full_name) in lower(collaborator_name)) > 0
  LIMIT 1;
  
  IF target_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 4. Gerente visualiza coordenadores, líderes, analistas e viewers (exclui admin e superintendente)
  IF user_role = 'gerente' AND target_role IN ('coordenador', 'lider', 'analista', 'viewer') THEN
    RETURN TRUE;
  END IF;
  
  -- 5. Coordenador e Líder visualizam analistas e viewers
  IF user_role IN ('coordenador', 'lider') AND target_role IN ('analista', 'viewer') THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Grant execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.is_team_member(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(TEXT) TO authenticated;

-- ----------------------------------------------------------
-- 3. User PDIs Table (Individual Development Plan)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_pdis (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_name   TEXT        NOT NULL, -- Nome do colaborador
  trimestre           TEXT        NOT NULL, -- ex: 'Q3'
  objetivo_carreira   TEXT        NOT NULL,
  competencias_foco   TEXT[]      NOT NULL, -- Competências sob foco
  plano_acao          TEXT        NOT NULL, -- Ações acordadas
  status              TEXT        NOT NULL DEFAULT 'Ativo', -- 'Ativo', 'Concluído', 'Suspenso'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 4. Profile Evaluations Table (Scientific profile results)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_evaluations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborator_name    TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'completed', -- 'completed', 'in_progress'
  answers              JSONB       NOT NULL, -- Respostas fechadas { "PA-01": "e", ... }
  open_answers         JSONB,                 -- Respostas abertas { "OPEN-CONTEXT": "...", ... }
  domain_scores        JSONB       NOT NULL, -- Scores por domínio { "cognicao": 85.5, ... }
  competency_scores    JSONB       NOT NULL, -- Scores por competência (18 entradas)
  subcompetency_scores JSONB,                -- Scores por subcompetência
  consistency_index    NUMERIC,               -- Índice de consistência (0-100)
  consistency_label    TEXT,                  -- Rótulo ('alta', 'moderada', 'baixa')
  laudo_narrativo      TEXT,                  -- Diagnóstico gerado ou fallback
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 5. Enable Row Level Security (RLS)
-- ----------------------------------------------------------
ALTER TABLE user_pdis ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_evaluations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- 6. RLS Policies
-- ----------------------------------------------------------

-- user_pdis policies
DROP POLICY IF EXISTS "pdis_select_policy" ON user_pdis;
CREATE POLICY "pdis_select_policy" ON user_pdis 
  FOR SELECT 
  USING (user_id = auth.uid() OR is_team_member(collaborator_name));

DROP POLICY IF EXISTS "pdis_all_write" ON user_pdis;
CREATE POLICY "pdis_all_write" ON user_pdis 
  FOR ALL
  USING (user_id = auth.uid() OR my_role() IN ('admin','superintendente'));

-- profile_evaluations policies
DROP POLICY IF EXISTS "profile_evaluations_select_policy" ON profile_evaluations;
CREATE POLICY "profile_evaluations_select_policy" ON profile_evaluations 
  FOR SELECT 
  USING (user_id = auth.uid() OR is_team_member(collaborator_name));

DROP POLICY IF EXISTS "profile_evaluations_write" ON profile_evaluations;
CREATE POLICY "profile_evaluations_write" ON profile_evaluations 
  FOR ALL
  USING (user_id = auth.uid() OR my_role() IN ('admin','superintendente'));

-- ----------------------------------------------------------
-- 7. Update okr_feedbacks SELECT policy to restrict visibility
-- ----------------------------------------------------------
-- Old policy allowed any authenticated user to view all feedbacks.
-- New policy: Users can see their own feedbacks, and managers can see their team's.
DROP POLICY IF EXISTS "okr_feedbacks_select" ON okr_feedbacks;
CREATE POLICY "okr_feedbacks_select" ON okr_feedbacks 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
        AND (
          lower(full_name) = lower(responsavel)
          OR position(lower(responsavel) in lower(full_name)) > 0
          OR position(lower(full_name) in lower(responsavel)) > 0
        )
    )
    OR is_team_member(responsavel)
  );

-- ----------------------------------------------------------
-- 8. Auto update updated_at triggers
-- ----------------------------------------------------------
DROP TRIGGER IF EXISTS user_pdis_updated_at ON user_pdis;
CREATE TRIGGER user_pdis_updated_at
  BEFORE UPDATE ON user_pdis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profile_evaluations_updated_at ON profile_evaluations;
CREATE TRIGGER profile_evaluations_updated_at
  BEFORE UPDATE ON profile_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

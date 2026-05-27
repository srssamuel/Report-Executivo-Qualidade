-- Migration 009: OKRs tracking and feedback system
-- Adds tables, RLS policies, audit protection trigger and seeding structure

-- ----------------------------------------------------------
-- 1. OKR Targets Table (Core definitions)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS okr_targets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  id_okr              TEXT        NOT NULL UNIQUE, -- e.g., 'OKR-001'
  responsavel         TEXT        NOT NULL,        -- e.g., 'Pedro Almeida'
  conta_diretoria     TEXT,                        -- e.g., 'Vivo | Diretoria Dutra'
  papel               TEXT,                        -- e.g., 'Gerente/Qualidade Vivo'
  periodo             TEXT        NOT NULL,        -- e.g., 'Jan-Jun' or 'Q3'
  perspectiva         TEXT        NOT NULL,        -- 'Performance', 'Governança', 'Valor', 'Projetos'
  objetivo            TEXT        NOT NULL,
  key_result          TEXT        NOT NULL,
  periodicidade       TEXT        NOT NULL DEFAULT 'Mensal',
  unidade             TEXT        NOT NULL,        -- e.g., '%', 'R$', 'Qtd', '0/1'
  tipo_apuracao       TEXT        NOT NULL,
  direcao             TEXT        NOT NULL DEFAULT 'Maior é melhor',
  meta_numerica       NUMERIC     NOT NULL,
  meta_exibida        TEXT        NOT NULL,
  peso                NUMERIC     NOT NULL DEFAULT 1.0,
  baseline_referencia TEXT,
  como_apurar         TEXT,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_perspectiva CHECK (perspectiva IN ('Performance', 'Governança', 'Valor', 'Projetos')),
  CONSTRAINT check_direcao CHECK (direcao IN ('Maior é melhor', 'Menor é melhor', 'Igual/meta exata'))
);

-- ----------------------------------------------------------
-- 2. OKR Measurements Table (Monthly/periodic follow-up)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS okr_measurements (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id               UUID        NOT NULL REFERENCES okr_targets(id) ON DELETE CASCADE,
  mes                  TEXT        NOT NULL, -- 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  trimestre            TEXT        NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4'
  resultado_apurado    NUMERIC,              -- Lançamento real do gerente
  atingimento          NUMERIC,              -- % calculado
  status               TEXT        NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Atingido', 'Parcial', 'Crítico'
  evidencia_comentario TEXT,                 -- Texto ou link de comprovação
  acao_sugerida        TEXT,                 -- Plano de recuperação se crítico
  audited              BOOLEAN     NOT NULL DEFAULT FALSE,
  audited_by           UUID        REFERENCES auth.users(id),
  audit_feedback       TEXT,                 -- Feedback da superintendência
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(okr_id, mes),
  CONSTRAINT check_status CHECK (status IN ('Pendente', 'Atingido', 'Parcial', 'Crítico'))
);

-- ----------------------------------------------------------
-- 3. OKR Feedbacks Table (1:1s and reviews)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS okr_feedbacks (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel    TEXT        NOT NULL,        -- Nome do gerente avaliado
  trimestre      TEXT        NOT NULL,        -- e.g., 'Q3'
  date           DATE        NOT NULL DEFAULT CURRENT_DATE,
  feedback_type  TEXT        NOT NULL DEFAULT '1:1 de OKRs',
  author_id      UUID        REFERENCES auth.users(id),
  author_name    TEXT        NOT NULL,
  strengths      TEXT,                        -- Pontos fortes
  improvements   TEXT,                        -- Oportunidades
  action_plan    TEXT,                        -- Plano de ação
  general_notes  TEXT,                        -- Notas gerais
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ----------------------------------------------------------
ALTER TABLE okr_targets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE okr_feedbacks    ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- 5. Helper Function: Check OKR Ownership
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION is_okr_owner(target_okr_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  okr_resp TEXT;
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Get OKR manager name
  SELECT responsavel INTO okr_resp FROM okr_targets WHERE id = target_okr_id;
  IF okr_resp IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user full name and email
  SELECT full_name, email INTO user_name, user_email FROM user_profiles WHERE id = auth.uid();
  
  -- Match by full string or substring ( Pedro Almeida <=> Pedro )
  RETURN (
    user_email IS NOT NULL AND lower(okr_resp) = lower(user_email)
  ) OR (
    user_name IS NOT NULL AND (
      lower(okr_resp) = lower(user_name) OR 
      position(lower(okr_resp) in lower(user_name)) > 0 OR 
      position(lower(user_name) in lower(okr_resp)) > 0
    )
  );
END;
$$;

-- ----------------------------------------------------------
-- 6. RLS Policies
-- ----------------------------------------------------------

-- SELECT Policies (Read access to authenticated users)
CREATE POLICY "okr_targets_select" ON okr_targets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "okr_measurements_select" ON okr_measurements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "okr_feedbacks_select" ON okr_feedbacks FOR SELECT USING (auth.uid() IS NOT NULL);

-- okr_targets (Only admin/superintendente can insert/update/delete targets)
CREATE POLICY "okr_targets_admin_write" ON okr_targets 
  FOR ALL 
  USING (my_role() IN ('admin','superintendente'));

-- okr_measurements (Admin/Super can do anything; Owner can update their measurements)
CREATE POLICY "okr_measurements_admin_write" ON okr_measurements 
  FOR ALL 
  USING (my_role() IN ('admin','superintendente'));

CREATE POLICY "okr_measurements_owner_update" ON okr_measurements 
  FOR UPDATE 
  USING (is_okr_owner(okr_id))
  WITH CHECK (is_okr_owner(okr_id));

-- okr_feedbacks (Only admin/superintendente can write feedbacks)
CREATE POLICY "okr_feedbacks_admin_write" ON okr_feedbacks 
  FOR ALL 
  USING (my_role() IN ('admin','superintendente'));

-- ----------------------------------------------------------
-- 7. Trigger: Protect Audit Fields from unauthorized updates
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_okr_audit_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.audited IS DISTINCT FROM OLD.audited OR 
      NEW.audited_by IS DISTINCT FROM OLD.audited_by OR 
      NEW.audit_feedback IS DISTINCT FROM OLD.audit_feedback) THEN
    -- If the user role is not admin or superintendente, block audit modifications by resetting them
    IF my_role() NOT IN ('admin','superintendente') THEN
      NEW.audited := OLD.audited;
      NEW.audited_by := OLD.audited_by;
      NEW.audit_feedback := OLD.audit_feedback;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_okr_audit_trigger ON okr_measurements;
CREATE TRIGGER protect_okr_audit_trigger
  BEFORE UPDATE ON okr_measurements
  FOR EACH ROW EXECUTE FUNCTION protect_okr_audit_fields();

-- ----------------------------------------------------------
-- 8. Auto update updated_at triggers
-- ----------------------------------------------------------
DROP TRIGGER IF EXISTS okr_targets_updated_at ON okr_targets;
CREATE TRIGGER okr_targets_updated_at
  BEFORE UPDATE ON okr_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS okr_measurements_updated_at ON okr_measurements;
CREATE TRIGGER okr_measurements_updated_at
  BEFORE UPDATE ON okr_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration 015: Fix okr_measurements write authorization (gerentes não conseguiam lançar apurações)
--
-- CAUSA-RAIZ: a tabela só tinha policy de INSERT derivada de okr_measurements_admin_write
-- (my_role() in admin/superintendente). A policy do dono (okr_measurements_owner_update) era
-- FOR UPDATE apenas. O app salva a apuração via supabase.upsert(), e no PostgREST upsert é
-- INSERT ... ON CONFLICT — exige privilégio de INSERT mesmo quando atualiza. Logo, todo
-- gerente/coordenador era bloqueado: "new row violates row-level security policy".
--
-- AGRAVANTE: a policy do dono usava is_okr_owner(), que casa okr_targets.responsavel (apelido,
-- ex.: 'Kathellen', 'Luiz Bertoldo') contra user_profiles.full_name (nome completo) por substring.
-- 3 de 5 gerentes não casavam — mesmo com policy de INSERT por dono, continuariam travados.
--
-- DECISÃO: escrita por papel (mesmo modelo já usado em `items`), com os campos de auditoria
-- blindados por trigger TAMBÉM no INSERT. A homologação (audited/audited_by/audit_feedback)
-- continua exclusiva de admin/superintendente e à prova de adulteração. O escopo "gerente edita
-- só o próprio OKR" é garantido na UI (seletor travado no gerente logado).

-- ------------------------------------------------------------------
-- 1. Limpa as policies de escrita de okr_measurements
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS okr_measurements_admin_write   ON okr_measurements;
DROP POLICY IF EXISTS okr_measurements_owner_update   ON okr_measurements;
DROP POLICY IF EXISTS okr_measurements_admin_all      ON okr_measurements;
DROP POLICY IF EXISTS okr_measurements_staff_insert   ON okr_measurements;
DROP POLICY IF EXISTS okr_measurements_staff_update   ON okr_measurements;

-- ------------------------------------------------------------------
-- 2. Admin / superintendente: controle total (com WITH CHECK explícito)
-- ------------------------------------------------------------------
CREATE POLICY okr_measurements_admin_all ON okr_measurements
  FOR ALL
  USING      (my_role() IN ('admin','superintendente'))
  WITH CHECK (my_role() IN ('admin','superintendente'));

-- ------------------------------------------------------------------
-- 3. Staff de edição (gerentes etc.): pode INSERIR a apuração do mês
-- ------------------------------------------------------------------
CREATE POLICY okr_measurements_staff_insert ON okr_measurements
  FOR INSERT
  WITH CHECK (my_role() IN ('gerente','coordenador','consultor','lider','analista'));

-- ------------------------------------------------------------------
-- 4. Staff de edição: pode ATUALIZAR a apuração (campos de auditoria protegidos pelo trigger)
-- ------------------------------------------------------------------
CREATE POLICY okr_measurements_staff_update ON okr_measurements
  FOR UPDATE
  USING      (my_role() IN ('gerente','coordenador','consultor','lider','analista'))
  WITH CHECK (my_role() IN ('gerente','coordenador','consultor','lider','analista'));

-- ------------------------------------------------------------------
-- 5. Estende a proteção dos campos de auditoria ao INSERT
--    (usuário sem privilégio não cria linha já marcada como auditada)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_okr_audit_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF my_role() NOT IN ('admin','superintendente') THEN
      NEW.audited       := FALSE;
      NEW.audited_by    := NULL;
      NEW.audit_feedback := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: bloqueia alteração dos campos de auditoria por não-privilegiados
  IF (NEW.audited        IS DISTINCT FROM OLD.audited OR
      NEW.audited_by     IS DISTINCT FROM OLD.audited_by OR
      NEW.audit_feedback IS DISTINCT FROM OLD.audit_feedback) THEN
    IF my_role() NOT IN ('admin','superintendente') THEN
      NEW.audited       := OLD.audited;
      NEW.audited_by    := OLD.audited_by;
      NEW.audit_feedback := OLD.audit_feedback;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_okr_audit_trigger ON okr_measurements;
CREATE TRIGGER protect_okr_audit_trigger
  BEFORE INSERT OR UPDATE ON okr_measurements
  FOR EACH ROW EXECUTE FUNCTION protect_okr_audit_fields();

-- ------------------------------------------------------------------
-- 6. Re-afirma o hardening da migration 011 (REVOKE EXECUTE) após o CREATE OR REPLACE
-- ------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION protect_okr_audit_fields() FROM authenticated;

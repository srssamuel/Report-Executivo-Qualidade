-- Migration 021: Hierarquia de visibilidade no Desenvolvimento por manager_id (não por papel)
--
-- CONTEXTO (Samuel): "Desenvolvimento deve respeitar a hierarquia — superintendente vê tudo, mas
-- cada um só vê o seu e dos seus liderados." As policies de profile_evaluations/user_pdis/okr_feedbacks
-- já tentavam hierarquia, mas via is_team_member() que era POR PAPEL (um gerente via TODOS os
-- coordenadores/analistas da empresa, não só o time dele). Aqui passamos a hierarquia para o
-- vínculo real de time (manager_id), de forma transitiva. admin/superintendente seguem vendo tudo.

-- 1. Função autoritativa: target é o próprio usuário OU subordinado transitivo (via manager_id)?
--    admin/superintendente -> sempre true.
CREATE OR REPLACE FUNCTION is_subordinate_or_self(target_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  my_r text;
BEGIN
  IF me IS NULL THEN RETURN FALSE; END IF;
  IF target_user_id = me THEN RETURN TRUE; END IF;
  SELECT role INTO my_r FROM user_profiles WHERE id = me;
  IF my_r IS NULL THEN RETURN FALSE; END IF;
  IF my_r IN ('admin', 'superintendente') THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    WITH RECURSIVE team AS (
      SELECT id FROM user_profiles WHERE manager_id = me
      UNION
      SELECT up.id FROM user_profiles up JOIN team t ON up.manager_id = t.id
    )
    SELECT 1 FROM team WHERE id = target_user_id
  );
END;
$$;
-- Função usada em expressão de policy -> precisa ser executável pelo papel que consulta.
GRANT EXECUTE ON FUNCTION is_subordinate_or_self(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION is_subordinate_or_self(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_subordinate_or_self(uuid) FROM anon;

-- 2. is_team_member(nome) passa a ser por manager_id também (resolve nome -> id -> is_subordinate_or_self).
--    Mantém a assinatura para não tocar a policy de okr_feedbacks (que casa por nome).
CREATE OR REPLACE FUNCTION is_team_member(collaborator_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_r text;
  target_id uuid;
BEGIN
  SELECT role INTO my_r FROM user_profiles WHERE id = auth.uid();
  IF my_r IS NULL THEN RETURN FALSE; END IF;
  IF my_r IN ('admin', 'superintendente') THEN RETURN TRUE; END IF;
  SELECT id INTO target_id FROM user_profiles
  WHERE lower(full_name) = lower(collaborator_name)
     OR position(lower(collaborator_name) in lower(full_name)) > 0
     OR position(lower(full_name) in lower(collaborator_name)) > 0
  LIMIT 1;
  IF target_id IS NULL THEN RETURN FALSE; END IF;
  RETURN is_subordinate_or_self(target_id);
END;
$$;
GRANT EXECUTE ON FUNCTION is_team_member(text) TO authenticated;

-- 3. SELECT por user_id (robusto) nas tabelas que têm user_id.
DROP POLICY IF EXISTS profile_evaluations_select_policy ON profile_evaluations;
CREATE POLICY profile_evaluations_select_policy ON profile_evaluations
  FOR SELECT USING (is_subordinate_or_self(user_id));

DROP POLICY IF EXISTS pdis_select_policy ON user_pdis;
CREATE POLICY pdis_select_policy ON user_pdis
  FOR SELECT USING (is_subordinate_or_self(user_id));

-- okr_feedbacks mantém a policy de SELECT atual (usa is_team_member, agora por manager_id).
-- Policies de ESCRITA não são alteradas aqui: avaliação científica é auto-administrada
-- (user_id = auth.uid()) e admin/super têm controle total. Extensão de escrita do gestor para o
-- time (PDI/ata) fica como decisão à parte.

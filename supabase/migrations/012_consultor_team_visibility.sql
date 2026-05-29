-- Migration 012: Align consultor team visibility (fix non-monotonic RLS boundary)
-- Contexto: na ordem canônica de papéis (admin > superintendente > gerente >
--   coordenador > consultor > lider > analista > viewer), o papel `consultor`
--   está ACIMA de `lider`. Porém, na migration 010, `lider` enxergava
--   (analista, viewer) enquanto `consultor` não enxergava ninguém — um papel de
--   rank superior com MENOS visibilidade que um inferior. Esta migration corrige
--   essa inconsistência, concedendo a `consultor` a mesma visibilidade dos seus
--   vizinhos imediatos `coordenador` e `lider`: (analista, viewer).
-- Natureza: redefinição idempotente de função SECURITY DEFINER. Não altera nem
--   destrói dados. Reversível reaplicando a definição da migration 010.

-- ----------------------------------------------------------
-- Access control helper: is_team_member (com branch de consultor)
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
  IF user_role = 'gerente' AND target_role IN ('coordenador', 'consultor', 'lider', 'analista', 'viewer') THEN
    RETURN TRUE;
  END IF;

  -- 5. Coordenador, Consultor e Líder visualizam analistas e viewers
  --    (consultor incluído nesta migration 012 para manter monotonicidade com o rank)
  IF user_role IN ('coordenador', 'consultor', 'lider') AND target_role IN ('analista', 'viewer') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Hardening: manter execução restrita a usuários autenticados
REVOKE EXECUTE ON FUNCTION public.is_team_member(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(TEXT) TO authenticated;

-- Migration 018: Corrige grant de is_okr_owner_by_id (regressão da 017)
--
-- A 017 revogou EXECUTE de authenticated em is_okr_owner_by_id. Mas funções referenciadas em
-- EXPRESSÃO DE POLICY são executadas com os privilégios do papel que consulta (authenticated),
-- ao contrário de funções de trigger (rodam como dono — por isso a 011 pôde revogá-las).
-- Sem o EXECUTE, qualquer INSERT/UPDATE de staff em okr_measurements falhava com
-- "permission denied for function is_okr_owner_by_id" — bloquearia todos os gerentes de novo.
--
-- FIX: conceder EXECUTE a authenticated (mesmo padrão das demais funções de policy:
-- my_role, is_admin, is_okr_owner). PUBLIC/anon seguem revogados pela 017.

GRANT EXECUTE ON FUNCTION is_okr_owner_by_id(uuid) TO authenticated;

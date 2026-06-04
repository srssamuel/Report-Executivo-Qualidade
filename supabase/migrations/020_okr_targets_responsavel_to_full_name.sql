-- Migration 020: Padroniza okr_targets.responsavel com o nome REAL do cadastro (full_name)
--
-- CONTEXTO (Samuel): "padronizar os nomes de acordo com os nomes reais do cadastro". O seletor de
-- gerente dos OKRs usava apelidos hardcoded ('Kathellen', 'Luiz Bertoldo', 'Thyyellisson'...) e o
-- de colaborador do módulo de Desenvolvimento montava a lista de owners de texto livre — ambos
-- desconectados de user_profiles. Resultado: nomes poluídos/duplicados e risco de um gerente
-- recém-cadastrado não aparecer.
--
-- A 017 já vinculou cada OKR ao dono real via responsavel_user_id. Aqui alinhamos o LABEL
-- (responsavel) ao full_name cadastrado, para que os seletores possam ser dirigidos pelo cadastro
-- e o matching seja exato. responsavel_user_id permanece a fonte autoritativa do vínculo (RLS).

UPDATE okr_targets t
SET responsavel = up.full_name
FROM user_profiles up
WHERE t.responsavel_user_id = up.id
  AND t.responsavel_user_id IS NOT NULL
  AND COALESCE(up.full_name, '') <> ''
  AND t.responsavel IS DISTINCT FROM up.full_name;

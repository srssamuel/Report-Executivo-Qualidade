-- Migration 016: Corrige a policy de INSERT de item_comments (mesmo bug da 015, outra tabela)
--
-- CAUSA-RAIZ: a UI renderiza o botão "Registrar" comentário sob canEdit() =
-- ['admin','superintendente','gerente','coordenador','consultor','lider','analista'],
-- mas a policy 'comments insert' só permitia ['admin','superintendente','lider','analista'].
-- 12 dos 14 usuários (gerentes, coordenadores, consultores) tomavam
-- "new row violates row-level security policy" ao comentar. Pior: addComment() não capturava
-- o erro e exibia "Comentário registrado." (falha silenciosa). A migration 007 já havia corrigido
-- items/gains para o conjunto completo; item_comments ficou para trás.
--
-- FIX: alinhar a policy ao mesmo conjunto de items/gains (paridade). A captura do erro em
-- addComment() é tratada no código (app/(app)/page.tsx).

DROP POLICY IF EXISTS "comments insert" ON item_comments;
CREATE POLICY "comments insert" ON item_comments
  FOR INSERT
  WITH CHECK (
    my_role() = ANY (ARRAY['admin','superintendente','gerente','coordenador','consultor','lider','analista'])
  );

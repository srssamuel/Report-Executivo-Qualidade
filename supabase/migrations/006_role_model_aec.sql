-- ============================================================
--  006 — Reconciliação do modelo de papéis (hierarquia aeC)
-- ============================================================
-- Contexto: a produção foi migrada à mão para a hierarquia real aeC
-- (admin > gerente > coordenador > consultor > viewer), expandindo o
-- constraint e as policies de items/item_comments. Mas as policies de
-- people e daily_access (migrations 004/005) ficaram só com os papéis
-- legados (superintendente/lider/analista) — travando gerente (4) e
-- coordenador (6) na gestão de pessoas/capacidade e na leitura de
-- aderência. Esta migration torna o estado reproduzível em deploy limpo
-- e ALINHA todas as policies aos mesmos tiers.
--
-- Tiers (espelhados em lib/domain/index.ts):
--   WRITE      = todos menos viewer  (criar/editar itens, comentar, criar pessoa)
--   MANAGE     = admin, gerente, coordenador, lider (+ superintendente)  (delete/arquivar, gerir pessoa/capacidade)
--   LEADERSHIP = admin, gerente (+ superintendente)  (leitura completa de aderência)
-- Papéis legados mantidos por compatibilidade.

-- 1) Constraint do papel — superset (legados + aeC), idempotente
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista','viewer'));

-- 2) items — WRITE para insert/update, MANAGE para delete
DROP POLICY IF EXISTS "items insert" ON items;
CREATE POLICY "items insert" ON items FOR INSERT
  WITH CHECK (my_role() IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista'));

DROP POLICY IF EXISTS "items update" ON items;
CREATE POLICY "items update" ON items FOR UPDATE
  USING (my_role() IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista'));

DROP POLICY IF EXISTS "items delete" ON items;
CREATE POLICY "items delete" ON items FOR DELETE
  USING (my_role() IN ('admin','superintendente','gerente','coordenador','lider'));

-- 3) item_comments — WRITE para insert
DROP POLICY IF EXISTS "comments insert" ON item_comments;
CREATE POLICY "comments insert" ON item_comments FOR INSERT
  WITH CHECK (my_role() IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista'));

-- 4) people — WRITE para insert (contribuidor cria), MANAGE para update/delete
DROP POLICY IF EXISTS "people insert" ON people;
CREATE POLICY "people insert" ON people FOR INSERT
  WITH CHECK (my_role() IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista'));

DROP POLICY IF EXISTS "people update" ON people;
CREATE POLICY "people update" ON people FOR UPDATE
  USING (my_role() IN ('admin','superintendente','gerente','coordenador','lider'))
  WITH CHECK (my_role() IN ('admin','superintendente','gerente','coordenador','lider'));

DROP POLICY IF EXISTS "people delete" ON people;
CREATE POLICY "people delete" ON people FOR DELETE
  USING (my_role() IN ('admin','superintendente','gerente','coordenador','lider'));

-- 5) daily_access — leitura completa só LEADERSHIP; demais leem o próprio
DROP POLICY IF EXISTS "daily_access read" ON daily_access;
CREATE POLICY "daily_access read" ON daily_access FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('admin','superintendente','gerente'));

-- Migration 017: Tenancy real de OKR por user_id (corrige match frágil por nome + RLS sem dono)
--
-- CAUSA-RAIZ (B2 da auditoria): okr_targets.responsavel é texto livre (apelido). A UI casava o
-- usuário logado ao apelido por substring contra full_name — falhava para Kathelleen, Luiz e
-- Thyellison (3 de 5), jogando-os no OKR do "Pedro". E as policies de okr_measurements (migration
-- 015) liberavam escrita por papel, sem amarrar o OKR ao dono — qualquer staff podia gravar em
-- qualquer KR. Resultado: 3 gerentes lançariam medições no KR alheio.
--
-- FIX: vincular okr_targets a user_profiles por id (responsavel_user_id), backfill determinístico
-- do mapeamento conhecido, e reamarrar as policies de escrita de okr_measurements ao dono.
-- NULL-safe: target sem dono não bloqueia staff (evita lockout); com 100% de backfill a regra é
-- estrita. admin/superintendente mantêm override total.

-- 1. Coluna de dono
ALTER TABLE okr_targets ADD COLUMN IF NOT EXISTS responsavel_user_id uuid REFERENCES user_profiles(id);

-- 2. Backfill determinístico (apelido -> user_id), mapeamento verificado contra user_profiles
UPDATE okr_targets SET responsavel_user_id = '7213d37f-0050-48ff-af75-0528597ae834' WHERE responsavel = 'Pedro Almeida' AND responsavel_user_id IS NULL; -- Pedro Almeida Santos (gerente)
UPDATE okr_targets SET responsavel_user_id = 'fa7fb789-2c39-46c5-a5bf-f810124e8557' WHERE responsavel = 'Kathellen'     AND responsavel_user_id IS NULL; -- Kathelleen Heloisa De Oliveira Silva (gerente)
UPDATE okr_targets SET responsavel_user_id = 'b6dd7bae-27bf-470d-a126-7565c55c0431' WHERE responsavel = 'Luiz Bertoldo' AND responsavel_user_id IS NULL; -- Luiz Fernando Bertoldo dos Santos (gerente)
UPDATE okr_targets SET responsavel_user_id = 'a80cd846-679e-4a1d-96a2-064cf1e2cd9f' WHERE responsavel = 'Aleff'         AND responsavel_user_id IS NULL; -- Aleff Azevedo Dias (gerente)
UPDATE okr_targets SET responsavel_user_id = 'def78820-37af-411a-93ea-6462eaac3eb1' WHERE responsavel = 'Thyyellisson'  AND responsavel_user_id IS NULL; -- Thyellison Aslan Ferreira Da Silva Santos (consultor)

-- 3. Helper de propriedade por id (NULL-safe). SECURITY DEFINER + search_path fixo.
CREATE OR REPLACE FUNCTION is_okr_owner_by_id(target_okr_id uuid)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM okr_targets t
    WHERE t.id = target_okr_id
      AND (t.responsavel_user_id = auth.uid() OR t.responsavel_user_id IS NULL)
  );
$$;
REVOKE EXECUTE ON FUNCTION is_okr_owner_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_okr_owner_by_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION is_okr_owner_by_id(uuid) FROM authenticated;

-- 4. Reamarra as policies de escrita de okr_measurements ao dono (staff só no próprio OKR)
DROP POLICY IF EXISTS okr_measurements_staff_insert ON okr_measurements;
DROP POLICY IF EXISTS okr_measurements_staff_update ON okr_measurements;

CREATE POLICY okr_measurements_staff_insert ON okr_measurements
  FOR INSERT
  WITH CHECK (
    my_role() IN ('gerente','coordenador','consultor','lider','analista')
    AND is_okr_owner_by_id(okr_id)
  );

CREATE POLICY okr_measurements_staff_update ON okr_measurements
  FOR UPDATE
  USING (
    my_role() IN ('gerente','coordenador','consultor','lider','analista')
    AND is_okr_owner_by_id(okr_id)
  )
  WITH CHECK (
    my_role() IN ('gerente','coordenador','consultor','lider','analista')
    AND is_okr_owner_by_id(okr_id)
  );
-- okr_measurements_admin_all (migration 015) permanece: admin/superintendente override total.

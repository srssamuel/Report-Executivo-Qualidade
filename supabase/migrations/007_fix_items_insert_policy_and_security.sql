-- ============================================================
--  Migration 007: Fix items INSERT RLS + Security advisories
--  Applied: 2026-05-22
-- ============================================================

-- 1. Fix items INSERT policy — add missing roles (gerente, coordenador, consultor)
--    Bug: 12 of 14 users could not create new items
DROP POLICY IF EXISTS "items insert" ON items;
CREATE POLICY "items insert"
  ON items FOR INSERT
  WITH CHECK (
    my_role() IN ('admin','superintendente','gerente','coordenador','consultor','lider','analista')
  );

-- 2. Fix security advisory: mark_password_changed accessible to anon
REVOKE EXECUTE ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;

-- 3. Recreate helper functions with explicit search_path (idempotent)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Re-grant after recreation
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role() TO authenticated;

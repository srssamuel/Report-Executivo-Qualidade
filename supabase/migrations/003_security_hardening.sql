-- ============================================================
--  Security hardening — addresses Supabase advisors
-- ============================================================

-- Fix mutable search_path
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- Revoke REST API access from helper functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_role()           FROM PUBLIC, anon;

-- Keep is_admin and my_role for authenticated (needed by RLS policies)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role()  TO authenticated;

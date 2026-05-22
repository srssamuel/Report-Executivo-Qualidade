-- Migration 006: Fix first-login infinite loop
-- Problem: Users cannot UPDATE their own user_profiles (RLS only allows admin writes)
-- So password_changed never becomes TRUE → infinite redirect loop
-- Solution: SECURITY DEFINER function that only sets password_changed = true for the caller

CREATE OR REPLACE FUNCTION mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_profiles
    SET password_changed = TRUE
    WHERE id = auth.uid();
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION mark_password_changed() TO authenticated;

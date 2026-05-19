-- ============================================================
--  Row-Level Security Policies
-- ============================================================

-- Enable RLS
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations    ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
--  Helper: is current user admin?
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: role of current user
CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------
--  user_profiles
-- ----------------------------------------------------------
CREATE POLICY "own profile read"
  ON user_profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "admin full write"
  ON user_profiles FOR ALL
  USING (is_admin());

-- ----------------------------------------------------------
--  items  — all authenticated users read; role-gated writes
-- ----------------------------------------------------------
CREATE POLICY "items read"
  ON items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "items insert"
  ON items FOR INSERT
  WITH CHECK (
    my_role() IN ('admin','superintendente','lider','analista')
  );

CREATE POLICY "items update"
  ON items FOR UPDATE
  USING (
    my_role() IN ('admin','superintendente','lider','analista')
  );

CREATE POLICY "items delete"
  ON items FOR DELETE
  USING (
    my_role() IN ('admin','superintendente','lider')
  );

-- ----------------------------------------------------------
--  item_comments
-- ----------------------------------------------------------
CREATE POLICY "comments read"
  ON item_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "comments insert"
  ON item_comments FOR INSERT
  WITH CHECK (
    my_role() IN ('admin','superintendente','lider','analista')
  );

CREATE POLICY "comments delete own"
  ON item_comments FOR DELETE
  USING (author_id = auth.uid() OR is_admin());

-- ----------------------------------------------------------
--  item_history
-- ----------------------------------------------------------
CREATE POLICY "history read"
  ON item_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "history insert"
  ON item_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------
--  invitations  — admin only
-- ----------------------------------------------------------
CREATE POLICY "invitations admin"
  ON invitations FOR ALL
  USING (is_admin());

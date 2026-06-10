-- ============================================================
--  Activity tracking + troca forçada de senha + fixes da 004
-- ============================================================

-- ── Fix 004a: normalized_name deve colapsar espaços internos ──
ALTER TABLE people DROP COLUMN normalized_name;
ALTER TABLE people ADD COLUMN normalized_name TEXT
  GENERATED ALWAYS AS (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) STORED;

-- Merge do registro fantasma com espaço duplo no canônico, antes do unique index
UPDATE items SET owner_id = (
  SELECT id FROM people WHERE lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = 'andre pedro da silva'
    AND name !~ '\s{2,}' LIMIT 1
) WHERE owner_id IN (SELECT id FROM people WHERE name ~ '\s{2,}');
DELETE FROM people WHERE name ~ '\s{2,}';

CREATE UNIQUE INDEX IF NOT EXISTS people_normalized_name_key ON people (normalized_name);

-- ── Fix 004b: políticas granulares (analista pode criar pessoa) ──
DROP POLICY "people write" ON people;

CREATE POLICY "people insert"
  ON people FOR INSERT
  WITH CHECK (my_role() IN ('admin','superintendente','lider','analista'));

CREATE POLICY "people update"
  ON people FOR UPDATE
  USING (my_role() IN ('admin','superintendente','lider'))
  WITH CHECK (my_role() IN ('admin','superintendente','lider'));

CREATE POLICY "people delete"
  ON people FOR DELETE
  USING (my_role() IN ('admin','superintendente','lider'));

-- ── Troca forçada de senha ──
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION clear_must_change_password()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE user_profiles SET must_change_password = FALSE WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;

-- ── Acesso diário (1 linha por usuário×dia) ──
CREATE TABLE IF NOT EXISTS daily_access (
  user_id    UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  day        DATE        NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE daily_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_access own write"
  ON daily_access FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_access own update"
  ON daily_access FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "daily_access read"
  ON daily_access FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('admin','superintendente'));

-- ── Snapshot diário da carteira (tendência dos KPIs) ──
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  day                  DATE PRIMARY KEY,
  total                INTEGER NOT NULL,
  active               INTEGER NOT NULL,
  critical             INTEGER NOT NULL,
  high                 INTEGER NOT NULL,
  on_time_pct          NUMERIC NOT NULL,
  freshness_pct        NUMERIC NOT NULL,
  access_adherence_pct NUMERIC NOT NULL,
  health               NUMERIC NOT NULL,
  effort_hours         NUMERIC NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots read"
  ON portfolio_snapshots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "snapshots insert"
  ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

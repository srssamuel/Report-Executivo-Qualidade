-- ============================================================
--  022 — People + tracking (portado da Evolução V2)
-- ============================================================
-- IMPORTANTE: estas estruturas JÁ EXISTEM no banco de produção
-- (aplicadas via MCP como 004_people/005_activity/006_role_model_aec
-- na linha V2). Esta migration torna o repositório reproduzível em
-- deploy limpo. 100% idempotente — em produção é no-op.

-- ── People: responsáveis com capacidade semanal individual ──
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) STORED,
  weekly_capacity_hours numeric NOT NULL DEFAULT 30 CHECK (weekly_capacity_hours > 0),
  active boolean NOT NULL DEFAULT true,
  user_id uuid NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS people_normalized_name_key ON people (normalized_name);

ALTER TABLE items ADD COLUMN IF NOT EXISTS owner_id uuid NULL REFERENCES people(id);

-- Backfill: cria pessoas a partir de items.owner (single-owner) e liga owner_id
INSERT INTO people (name)
SELECT DISTINCT btrim(owner)
FROM items
WHERE owner IS NOT NULL AND btrim(owner) <> '' AND owner NOT LIKE '%,%' AND owner NOT LIKE '%/%'
ON CONFLICT (normalized_name) DO NOTHING;

UPDATE items i SET owner_id = p.id
FROM people p
WHERE i.owner_id IS NULL
  AND i.owner IS NOT NULL
  AND lower(regexp_replace(btrim(i.owner), '\s+', ' ', 'g')) = p.normalized_name;

-- ── Tracking: acesso diário + snapshots da carteira ──
CREATE TABLE IF NOT EXISTS daily_access (
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  day date PRIMARY KEY,
  total int, active int, critical int, high int,
  on_time_pct numeric, freshness_pct numeric, access_adherence_pct numeric,
  health numeric, effort_hours numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- ── Policies (tiers WRITE/MANAGE/LEADERSHIP — espelham shared/domain) ──
DROP POLICY IF EXISTS "people read" ON people;
CREATE POLICY "people read" ON people FOR SELECT USING (auth.uid() IS NOT NULL);

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

DROP POLICY IF EXISTS "daily_access own write" ON daily_access;
CREATE POLICY "daily_access own write" ON daily_access FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_access own update" ON daily_access;
CREATE POLICY "daily_access own update" ON daily_access FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_access read" ON daily_access;
CREATE POLICY "daily_access read" ON daily_access FOR SELECT
  USING (user_id = auth.uid() OR my_role() IN ('admin','superintendente','gerente'));

DROP POLICY IF EXISTS "snapshots read" ON portfolio_snapshots;
CREATE POLICY "snapshots read" ON portfolio_snapshots FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "snapshots insert" ON portfolio_snapshots;
CREATE POLICY "snapshots insert" ON portfolio_snapshots FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

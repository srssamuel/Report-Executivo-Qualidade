-- ============================================================
--  People — responsáveis com capacidade individual
-- ============================================================

CREATE TABLE IF NOT EXISTS people (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL,
  normalized_name        TEXT        GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  weekly_capacity_hours  NUMERIC     NOT NULL DEFAULT 30 CHECK (weekly_capacity_hours > 0),
  active                 BOOLEAN     NOT NULL DEFAULT TRUE,
  user_id                UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS people_normalized_name_key ON people (normalized_name);

ALTER TABLE items ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- Backfill: um registro por nome distinto já digitado em items.owner.
-- ownersOf() no front separa por vírgula/e/&//; aqui fazemos o split equivalente.
INSERT INTO people (name)
SELECT DISTINCT ON (lower(btrim(part))) btrim(part)
FROM items,
LATERAL regexp_split_to_table(
  regexp_replace(regexp_replace(coalesce(owner, ''), '\s+e\s+', ',', 'gi'), '\s*[&/]\s*', ',', 'g'),
  ','
) AS part
WHERE btrim(part) <> ''
ON CONFLICT DO NOTHING;

-- Vincula owner_id quando o campo owner tem exatamente UMA pessoa.
UPDATE items i
SET owner_id = p.id
FROM people p
WHERE i.owner_id IS NULL
  AND lower(btrim(i.owner)) = p.normalized_name;

-- RLS
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people read"
  ON people FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "people write"
  ON people FOR ALL
  USING (my_role() IN ('admin','superintendente','lider'))
  WITH CHECK (my_role() IN ('admin','superintendente','lider'));

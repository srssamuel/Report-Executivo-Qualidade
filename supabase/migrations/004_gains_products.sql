-- Migration 004: Products + Gains tables
-- Already applied to production via direct SQL on 2026-05-19
-- This file documents the schema for reproducibility

-- Products (dynamic, replacing hardcoded PRODUCT_SUGGESTIONS)
CREATE TABLE IF NOT EXISTS products (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  color      TEXT        NOT NULL DEFAULT '#6366f1',
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT USING (TRUE);
CREATE POLICY "products_admin_insert" ON products FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','superintendente','gerente'))
);
CREATE POLICY "products_admin_update" ON products FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','superintendente','gerente'))
);

-- Seed data
INSERT INTO products (name, color) VALUES
  ('Vivo', '#660099'),
  ('Nubank', '#820ad1'),
  ('Enel', '#00a651'),
  ('Athena', '#2563eb'),
  ('Madeira Madeira', '#f59e0b'),
  ('Interno', '#6b7280'),
  ('Data CX', '#0ea5e9')
ON CONFLICT (name) DO NOTHING;

-- Gains (track value delivered per item)
CREATE TABLE IF NOT EXISTS gains (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    TEXT        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  gain_type  TEXT        NOT NULL CHECK (gain_type IN ('Financeiro','Processo','Relacionamento','Resultado')),
  kpi        TEXT,
  gain_value TEXT,
  detail     TEXT,
  created_by UUID        REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gains_select" ON gains FOR SELECT USING (TRUE);
CREATE POLICY "gains_insert" ON gains FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role NOT IN ('viewer'))
);
CREATE POLICY "gains_delete" ON gains FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','superintendente','gerente'))
);

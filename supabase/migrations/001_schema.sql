-- ============================================================
--  Report Executivo Qualidade — Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
--  User profiles (linked 1:1 to auth.users)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  role        TEXT        NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','superintendente','lider','analista','viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
--  Main items
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id                TEXT        PRIMARY KEY,
  source_row        INTEGER,
  due_date          DATE,
  original_date     DATE,
  project           TEXT,
  demand            TEXT,
  definition        TEXT,
  owner             TEXT,
  status            TEXT        NOT NULL DEFAULT 'Sem status',
  priority          TEXT        NOT NULL DEFAULT 'Média',
  progress          INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  next_action       TEXT,
  executive_comment TEXT,
  last_update       TIMESTAMPTZ          DEFAULT NOW(),
  tags              TEXT[]               DEFAULT '{}',
  archived          BOOLEAN     NOT NULL DEFAULT FALSE,
  source_status     TEXT,
  product           TEXT,
  effort_hours      NUMERIC,
  team_size         INTEGER              DEFAULT 1,
  predecessor_id    TEXT,
  dependency_note   TEXT,
  start_date        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID                 REFERENCES auth.users(id)
);

-- ----------------------------------------------------------
--  Comments
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_comments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      TEXT        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  author_id    UUID                 REFERENCES auth.users(id),
  author_name  TEXT        NOT NULL DEFAULT 'Usuário',
  comment_type TEXT                 DEFAULT 'Comentário',
  text         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
--  Field-level audit history
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     TEXT        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  changed_by  UUID                 REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field       TEXT        NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

-- ----------------------------------------------------------
--  Invitations (admin-only invite flow)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'viewer',
  invited_by  UUID                 REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
--  Triggers
-- ----------------------------------------------------------

-- Auto-create user_profiles row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (SELECT role FROM invitations WHERE email = NEW.email LIMIT 1),
      'viewer'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- mark invitation as accepted
  UPDATE invitations SET accepted_at = NOW() WHERE email = NEW.email AND accepted_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at on user_profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

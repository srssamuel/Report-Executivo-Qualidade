-- Migration 005: Add password_changed flag for first-login flow
-- Users created via admin.createUser start with password_changed = false
-- After changing password on first login, flag is set to true

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing admin (srssamuel@hotmail.com) already changed password — mark as true
UPDATE user_profiles SET password_changed = TRUE WHERE email = 'srssamuel@hotmail.com';

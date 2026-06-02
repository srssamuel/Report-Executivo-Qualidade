-- Migration 014: Expand okr_targets.perspectiva CHECK to the 7 contracted perspectivas.
-- The contracted Jan-Jun OKR plan uses 7 perspectivas, but migration 009 only allowed 4,
-- which forced the old seed to lossily clamp Adoção/IA-Mensageria/Pleitos into Performance.
-- Idempotent: drop + recreate the constraint.

ALTER TABLE okr_targets DROP CONSTRAINT IF EXISTS check_perspectiva;

ALTER TABLE okr_targets ADD CONSTRAINT check_perspectiva
  CHECK (perspectiva IN (
    'Performance',
    'Governança',
    'Valor',
    'Projetos',
    'Adoção',
    'IA/Mensageria',
    'Pleitos'
  ));

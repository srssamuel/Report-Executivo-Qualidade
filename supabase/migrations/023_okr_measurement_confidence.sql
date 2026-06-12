-- ============================================================
--  023 — Nível de confiança na apuração de OKR (Roadmap Onda 1, item 1.2)
-- ============================================================
-- O dono declara, junto do lançamento mensal, a confiança de fechar o
-- trimestre ('alta' | 'media' | 'baixa'). Coluna no okr_measurements:
-- herda a RLS do dono (015/017) e NÃO participa da re-pendência (019) —
-- mudar a confiança não reabre homologação. Aditiva e idempotente.

ALTER TABLE okr_measurements
  ADD COLUMN IF NOT EXISTS confidence text
  CHECK (confidence IN ('alta', 'media', 'baixa'));

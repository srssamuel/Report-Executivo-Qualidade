-- Migration 008: Expand gain types per user request
-- Old types: Financeiro, Processo, Relacionamento, Resultado
-- New types: + KPI, Consultividade, Experiência
-- User asked: "KPI, relacionamento, consultividade, processo ou grana e qual o valor"

ALTER TABLE gains DROP CONSTRAINT IF EXISTS gains_gain_type_check;
ALTER TABLE gains ADD CONSTRAINT gains_gain_type_check
  CHECK (gain_type IN (
    'Financeiro',
    'Processo',
    'Relacionamento',
    'Resultado',
    'KPI',
    'Consultividade',
    'Experiência'
  ));

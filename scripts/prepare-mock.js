const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\srssa\\.gemini\\antigravity\\scratch\\okr_data.json';
const destDir = path.join(__dirname, '../public');
const destPath = path.join(destDir, 'okr_mock_data.json');

if (!fs.existsSync(srcPath)) {
  console.error("Source data.json not found.");
  process.exit(1);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const baseOKRs = data.Base_OKRs;
const apuracaoOKRs = data.Apuracao_OKRs;

console.log("Preparing quarterly mock data...");

const targets = [];
const measurements = [];
const targetIdMapQ1 = {}; // Maps 'OKR-001' -> Q1 client UUID
const targetIdMapQ2 = {}; // Maps 'OKR-001' -> Q2 client UUID

// Create Q1 and Q2 targets from baseOKRs
baseOKRs.forEach((t, i) => {
  const uuidQ1 = `mock-okr-uuid-q1-${i + 1}`;
  const uuidQ2 = `mock-okr-uuid-q2-${i + 1}`;
  
  targetIdMapQ1[t.ID_OKR] = uuidQ1;
  targetIdMapQ2[t.ID_OKR] = uuidQ2;

  const peso = typeof t.Peso === 'number' ? t.Peso : 1.0;
  const metaNumerica = typeof t['Meta numerica'] === 'number' ? t['Meta numerica'] : 0.0;
  let perspectiva = t.Perspectiva || 'Performance';
  if (!['Performance', 'Governança', 'Valor', 'Projetos'].includes(perspectiva)) {
    perspectiva = 'Performance';
  }

  // Add Q1 Target
  targets.push({
    id: uuidQ1,
    id_okr: `${t.ID_OKR}-Q1`,
    responsavel: t.Responsavel,
    conta_diretoria: t['Conta/Diretoria'] || null,
    papel: t.Papel || null,
    periodo: 'Q1',
    perspectiva: perspectiva,
    objetivo: t.Objetivo || 'Objetivo Geral',
    key_result: t['Key Result'] || 'Resultado Chave',
    periodicidade: t.Periodicidade || 'Mensal',
    unidade: t.Unidade || '%',
    tipo_apuracao: t['Tipo de apuracao'] || 'Contagem',
    direcao: t.Direcao === 'Menor é melhor' ? 'Menor é melhor' : (t.Direcao === 'Igual/meta exata' ? 'Igual/meta exata' : 'Maior é melhor'),
    meta_numerica: metaNumerica,
    meta_exibida: t['Meta exibida'] || String(metaNumerica),
    peso: peso,
    baseline_referencia: t['Baseline referencia'] || null,
    como_apurar: t['Como apurar'] || null,
    observacoes: t.Observacoes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Add Q2 Target (identical structure to Q1)
  targets.push({
    id: uuidQ2,
    id_okr: `${t.ID_OKR}-Q2`,
    responsavel: t.Responsavel,
    conta_diretoria: t['Conta/Diretoria'] || null,
    papel: t.Papel || null,
    periodo: 'Q2',
    perspectiva: perspectiva,
    objetivo: t.Objetivo || 'Objetivo Geral',
    key_result: t['Key Result'] || 'Resultado Chave',
    periodicidade: t.Periodicidade || 'Mensal',
    unidade: t.Unidade || '%',
    tipo_apuracao: t['Tipo de apuracao'] || 'Contagem',
    direcao: t.Direcao === 'Menor é melhor' ? 'Menor é melhor' : (t.Direcao === 'Igual/meta exata' ? 'Igual/meta exata' : 'Maior é melhor'),
    meta_numerica: metaNumerica,
    meta_exibida: t['Meta exibida'] || String(metaNumerica),
    peso: peso,
    baseline_referencia: t['Baseline referencia'] || null,
    como_apurar: t['Como apurar'] || null,
    observacoes: t.Observacoes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

// Map measurements to their respective Q1 or Q2 target
apuracaoOKRs.forEach((m, i) => {
  const isQ1Month = ['Jan', 'Fev', 'Mar'].includes(m.Mes);
  const targetUuid = isQ1Month ? targetIdMapQ1[m.ID_OKR] : targetIdMapQ2[m.ID_OKR];
  
  if (!targetUuid) return;

  const uuid = `mock-measure-uuid-${i + 1}`;
  const resultadoApurado = typeof m['Resultado apurado'] === 'number' ? m['Resultado apurado'] : null;
  const atingimento = typeof m['% Atingimento'] === 'number' ? m['% Atingimento'] : null;
  
  let status = m.Status || 'Pendente';
  if (!['Pendente', 'Atingido', 'Parcial', 'Crítico'].includes(status)) {
    status = 'Pendente';
  }

  measurements.push({
    id: uuid,
    okr_id: targetUuid,
    mes: m.Mes,
    trimestre: isQ1Month ? 'Q1' : 'Q2',
    resultado_apurado: resultadoApurado,
    atingimento: atingimento,
    status: status,
    evidencia_comentario: m['Evidencia/Comentario'] || null,
    acao_sugerida: m['Acao sugerida'] || null,
    audited: true, // Default loaded measurements to audited for completeness
    audited_by: 'mock-admin-uuid',
    audit_feedback: 'Homologado na apuração trimestral.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

// Add sample feedbacks mapped to Q1 or Q2
const feedbacks = [
  {
    id: 'mock-feedback-1',
    responsavel: 'Pedro Almeida',
    trimestre: 'Q1',
    date: '2026-03-25',
    feedback_type: '1:1 de OKRs',
    author_name: 'Samuel Rosa',
    strengths: 'Excelente liderança no pilar de Performance. Superou as expectativas de recuperação financeira de Vivo Diretoria Dutra no trimestre.',
    improvements: 'Evoluir o refinamento na descrição de baselines para o próximo ciclo.',
    action_plan: 'Dedicar 1 hora semanal para revisão tática de OKRs com a equipe.',
    general_notes: 'Pedro continua demonstrando alta maturidade técnica e gerencial.',
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-feedback-2',
    responsavel: 'Kathellen',
    trimestre: 'Q1',
    date: '2026-03-28',
    feedback_type: '1:1 de OKRs',
    author_name: 'Samuel Rosa',
    strengths: 'Alta qualidade operacional e entregas de governança sem drift de prazos no Q1.',
    improvements: 'Fortalecer a aproximação de resultados do pilar de Projetos.',
    action_plan: 'Alinhar com a consultoria os KPIs de projetos para Q2.',
    general_notes: 'Kathellen manteve a consistência de entregas mesmo com alta carga tática.',
    created_at: new Date().toISOString()
  }
];

fs.writeFileSync(destPath, JSON.stringify({ targets, measurements, feedbacks }, null, 2));
console.log(`Successfully generated public quarterly mock data at ${destPath} with ${targets.length} targets, ${measurements.length} measurements, and ${feedbacks.length} feedbacks.`);

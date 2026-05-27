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

console.log("Preparing mock data...");

const targets = [];
const measurements = [];
const targetIdMap = {}; // Maps 'OKR-001' -> client-side UUID

// Create targets with client-side UUIDs
baseOKRs.forEach((t, i) => {
  // Generate a predictable client UUID based on index for stability
  const uuid = `mock-okr-uuid-${i + 1}`;
  targetIdMap[t.ID_OKR] = uuid;

  const peso = typeof t.Peso === 'number' ? t.Peso : 1.0;
  const metaNumerica = typeof t['Meta numerica'] === 'number' ? t['Meta numerica'] : 0.0;
  let perspectiva = t.Perspectiva || 'Performance';
  if (!['Performance', 'Governança', 'Valor', 'Projetos'].includes(perspectiva)) {
    perspectiva = 'Performance';
  }

  targets.push({
    id: uuid,
    id_okr: t.ID_OKR,
    responsavel: t.Responsavel,
    conta_diretoria: t['Conta/Diretoria'] || null,
    papel: t.Papel || null,
    periodo: t.Periodo || 'Jan-Jun',
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

// Map measurements
apuracaoOKRs.forEach((m, i) => {
  const targetUuid = targetIdMap[m.ID_OKR];
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
    trimestre: m.Trimestre,
    resultado_apurado: resultadoApurado,
    atingimento: atingimento,
    status: status,
    evidencia_comentario: m['Evidencia/Comentario'] || null,
    acao_sugerida: m['Acao sugerida'] || null,
    audited: true, // Default loaded measurements to audited for completeness
    audited_by: 'mock-admin-uuid',
    audit_feedback: 'Homologado na apuração final de semestre.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

// Add some sample feedbacks
const feedbacks = [
  {
    id: 'mock-feedback-1',
    responsavel: 'Pedro Almeida',
    trimestre: 'Jan-Jun',
    date: '2026-05-15',
    feedback_type: '1:1 de OKRs',
    author_name: 'Samuel Rosa',
    strengths: 'Excelente liderança no pilar de Performance. Superou as expectativas de recuperação financeira de Vivo Diretoria Dutra.',
    improvements: 'Evoluir o refinamento na descrição de baselines das novas metas de Q3.',
    action_plan: 'Dedicar 1 hora na primeira semana de Junho para revisão tática de OKRs com a equipe.',
    general_notes: 'Pedro continua demonstrando alta maturidade técnica e gerencial.',
    created_at: new Date().toISOString()
  },
  {
    id: 'mock-feedback-2',
    responsavel: 'Kathellen',
    trimestre: 'Jan-Jun',
    date: '2026-05-18',
    feedback_type: '1:1 de OKRs',
    author_name: 'Samuel Rosa',
    strengths: 'Alta qualidade operacional e entregas de governança sem drift de prazos.',
    improvements: 'Fortalecer a aproximação de resultados do pilar de Projetos.',
    action_plan: 'Alinhar com a consultoria os KPIs de projetos para Q3.',
    general_notes: 'Kathellen manteve a consistência de entregas mesmo com alta carga tática.',
    created_at: new Date().toISOString()
  }
];

fs.writeFileSync(destPath, JSON.stringify({ targets, measurements, feedbacks }, null, 2));
console.log(`Successfully generated public mock data at ${destPath} with ${targets.length} targets, ${measurements.length} measurements, and ${feedbacks.length} feedbacks.`);

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Manually parse env vars from .env.local to avoid extra dependencies
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env.local file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// 2. Load JSON data from scratch directory
const dataPath = "C:\\Users\\srssa\\.gemini\\antigravity\\scratch\\okr_data.json";
if (!fs.existsSync(dataPath)) {
  console.error("Error: okr_data.json file not found at " + dataPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const baseOKRs = data.Base_OKRs;
const apuracaoOKRs = data.Apuracao_OKRs;

async function seed() {
  console.log(`Starting quarterly OKR database seeding...`);
  console.log(`Loaded ${baseOKRs.length} targets and ${apuracaoOKRs.length} measurements from Excel JSON.`);

  // Clear existing OKR data to avoid duplicates and ensure a clean seed
  console.log("Cleaning existing OKR targets...");
  const { error: deleteError } = await supabase.from('okr_targets').delete().neq('id_okr', '');
  if (deleteError) {
    console.error("Warning or Error during cleanup:", deleteError.message);
  }

  // Insert Q1 and Q2 Targets
  console.log("Inserting OKR Targets (Q1 & Q2)...");
  const targetMapQ1 = {}; // Maps 'OKR-001' -> Q1 DB UUID
  const targetMapQ2 = {}; // Maps 'OKR-001' -> Q2 DB UUID
  
  for (const t of baseOKRs) {
    const peso = typeof t.Peso === 'number' ? t.Peso : 1.0;
    const metaNumerica = typeof t['Meta numerica'] === 'number' ? t['Meta numerica'] : 0.0;
    
    let perspectiva = t.Perspectiva || 'Performance';
    if (!['Performance', 'Governança', 'Valor', 'Projetos'].includes(perspectiva)) {
      perspectiva = 'Performance';
    }

    // Insert Q1 Target
    const payloadQ1 = {
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
      observacoes: t.Observacoes || null
    };

    const { data: insertedQ1, error: errQ1 } = await supabase
      .from('okr_targets')
      .insert(payloadQ1)
      .select('id, id_okr')
      .single();

    if (errQ1) {
      console.error(`Error inserting Q1 target ${t.ID_OKR}:`, errQ1.message);
      continue;
    }
    targetMapQ1[t.ID_OKR] = insertedQ1.id;

    // Insert Q2 Target (identical structure to Q1)
    const payloadQ2 = {
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
      observacoes: t.Observacoes || null
    };

    const { data: insertedQ2, error: errQ2 } = await supabase
      .from('okr_targets')
      .insert(payloadQ2)
      .select('id, id_okr')
      .single();

    if (errQ2) {
      console.error(`Error inserting Q2 target ${t.ID_OKR}:`, errQ2.message);
      continue;
    }
    targetMapQ2[t.ID_OKR] = insertedQ2.id;
  }

  console.log(`Successfully seeded OKR Targets (Q1 & Q2).`);

  // Insert OKR Measurements
  console.log("Inserting OKR Measurements...");
  let countMeasurements = 0;
  const measurementPayloads = [];

  for (const m of apuracaoOKRs) {
    const isQ1Month = ['Jan', 'Fev', 'Mar'].includes(m.Mes);
    const okrUuid = isQ1Month ? targetMapQ1[m.ID_OKR] : targetMapQ2[m.ID_OKR];
    
    if (!okrUuid) {
      console.warn(`Warning: OKR ${m.ID_OKR} not found in database. Skipping measurement row.`);
      continue;
    }

    const resultadoApurado = typeof m['Resultado apurado'] === 'number' ? m['Resultado apurado'] : null;
    const atingimento = typeof m['% Atingimento'] === 'number' ? m['% Atingimento'] : null;
    
    let status = m.Status || 'Pendente';
    if (!['Pendente', 'Atingido', 'Parcial', 'Crítico'].includes(status)) {
      status = 'Pendente';
    }

    measurementPayloads.push({
      okr_id: okrUuid,
      mes: m.Mes,
      trimestre: isQ1Month ? 'Q1' : 'Q2',
      resultado_apurado: resultadoApurado,
      atingimento: atingimento,
      status: status,
      evidencia_comentario: m['Evidencia/Comentario'] || null,
      acao_sugerida: m['Acao sugerida'] || null,
      audited: false
    });
  }

  // Bulk insert in chunks of 100 for safety and performance
  const chunkSize = 100;
  for (let i = 0; i < measurementPayloads.length; i += chunkSize) {
    const chunk = measurementPayloads.slice(i, i + chunkSize);
    const { error: chunkError } = await supabase
      .from('okr_measurements')
      .insert(chunk);

    if (chunkError) {
      console.error(`Error inserting chunk starting at index ${i}:`, chunkError.message);
    } else {
      countMeasurements += chunk.length;
    }
  }

  console.log(`Successfully seeded ${countMeasurements} OKR Measurements.`);
  console.log(`Seeding complete!`);
}

seed().catch(err => {
  console.error("Seeding crashed:", err);
});

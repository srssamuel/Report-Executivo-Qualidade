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
  console.log(`Starting OKR database seeding...`);
  console.log(`Loaded ${baseOKRs.length} targets and ${apuracaoOKRs.length} measurements from Excel JSON.`);

  // Clear existing OKR data to avoid duplicates and ensure a clean seed
  console.log("Cleaning existing OKR targets...");
  const { error: deleteError } = await supabase.from('okr_targets').delete().neq('id_okr', '');
  if (deleteError) {
    console.error("Warning or Error during cleanup:", deleteError.message);
  }

  // Insert OKR Targets
  console.log("Inserting OKR Targets...");
  const targetMap = {}; // Maps 'OKR-001' -> UUID
  
  for (const t of baseOKRs) {
    // Basic validation / clean values
    const peso = typeof t.Peso === 'number' ? t.Peso : 1.0;
    const metaNumerica = typeof t['Meta numerica'] === 'number' ? t['Meta numerica'] : 0.0;
    
    // Ensure perspective is valid, fallback to Performance if not
    let perspectiva = t.Perspectiva || 'Performance';
    if (!['Performance', 'Governança', 'Valor', 'Projetos'].includes(perspectiva)) {
      perspectiva = 'Performance';
    }

    const payload = {
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
      observacoes: t.Observacoes || null
    };

    const { data: inserted, error: insertError } = await supabase
      .from('okr_targets')
      .insert(payload)
      .select('id, id_okr')
      .single();

    if (insertError) {
      console.error(`Error inserting OKR target ${t.ID_OKR}:`, insertError.message);
      continue;
    }

    targetMap[inserted.id_okr] = inserted.id;
  }

  console.log(`Successfully seeded ${Object.keys(targetMap).length} OKR Targets.`);

  // Insert OKR Measurements
  console.log("Inserting OKR Measurements...");
  let countMeasurements = 0;
  const measurementPayloads = [];

  for (const m of apuracaoOKRs) {
    const okrUuid = targetMap[m.ID_OKR];
    if (!okrUuid) {
      console.warn(`Warning: OKR ${m.ID_OKR} not found in database. Skipping measurement row.`);
      continue;
    }

    const resultadoApurado = typeof m['Resultado apurado'] === 'number' ? m['Resultado apurado'] : null;
    const atingimento = typeof m['% Atingimento'] === 'number' ? m['% Atingimento'] : null;
    
    // Status fallback
    let status = m.Status || 'Pendente';
    if (!['Pendente', 'Atingido', 'Parcial', 'Crítico'].includes(status)) {
      status = 'Pendente';
    }

    measurementPayloads.push({
      okr_id: okrUuid,
      mes: m.Mes,
      trimestre: m.Trimestre,
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

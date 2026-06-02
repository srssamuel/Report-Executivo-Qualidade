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

const ALLOWED_PERSPECTIVAS = [
  'Performance', 'Governança', 'Valor', 'Projetos',
  'Adoção', 'IA/Mensageria', 'Pleitos'
];
const ALLOWED_DIRECOES = ['Maior é melhor', 'Menor é melhor', 'Igual/meta exata'];
const ALLOWED_STATUS = ['Pendente', 'Atingido', 'Parcial', 'Crítico'];

// Idempotent seeding:
//  - okr_targets  -> upsert by id_okr (DO UPDATE): keeps contracted definitions in sync.
//  - okr_measurements -> upsert by (okr_id, mes) with ignoreDuplicates (DO NOTHING):
//    inserts missing month rows but NEVER overwrites a result already filled by the team.
async function seed() {
  console.log(`Starting idempotent Jan-Jun OKR seeding...`);
  console.log(`Loaded ${baseOKRs.length} targets and ${apuracaoOKRs.length} measurements from Excel JSON.`);

  // --- TARGETS (single Jan-Jun target per OKR, no Q1/Q2 duplication) ---
  console.log("Upserting OKR Targets (Jan-Jun)...");
  const targetPayloads = baseOKRs.map(t => {
    const peso = typeof t.Peso === 'number' ? t.Peso : 1.0;
    const metaNumerica = typeof t['Meta numerica'] === 'number' ? t['Meta numerica'] : 0.0;

    const perspectiva = ALLOWED_PERSPECTIVAS.includes(t.Perspectiva) ? t.Perspectiva : 'Performance';
    const direcao = ALLOWED_DIRECOES.includes(t.Direcao) ? t.Direcao : 'Maior é melhor';

    return {
      id_okr: t.ID_OKR,
      responsavel: t.Responsavel,
      conta_diretoria: t['Conta/Diretoria'] || null,
      papel: t.Papel || null,
      periodo: t.Periodo || 'Jan-Jun',
      perspectiva,
      objetivo: t.Objetivo || 'Objetivo Geral',
      key_result: t['Key Result'] || 'Resultado Chave',
      periodicidade: t.Periodicidade || 'Mensal',
      unidade: t.Unidade || '%',
      tipo_apuracao: t['Tipo de apuracao'] || 'Contagem',
      direcao,
      meta_numerica: metaNumerica,
      meta_exibida: t['Meta exibida'] || String(metaNumerica),
      peso,
      baseline_referencia: t['Baseline referencia'] || null,
      como_apurar: t['Como apurar'] || null,
      observacoes: t.Observacoes || null
    };
  });

  const { data: upsertedTargets, error: targetError } = await supabase
    .from('okr_targets')
    .upsert(targetPayloads, { onConflict: 'id_okr' })
    .select('id, id_okr');

  if (targetError) {
    console.error("Fatal: error upserting targets:", targetError.message);
    process.exit(1);
  }

  const targetMap = {}; // id_okr (e.g. 'OKR-001') -> DB UUID
  for (const row of upsertedTargets) targetMap[row.id_okr] = row.id;
  console.log(`Upserted ${upsertedTargets.length} OKR Targets.`);

  // --- MEASUREMENTS (one row per OKR per month; preserve existing results) ---
  console.log("Upserting OKR Measurements (preserving existing results)...");
  const measurementPayloads = [];
  for (const m of apuracaoOKRs) {
    const okrUuid = targetMap[m.ID_OKR];
    if (!okrUuid) {
      console.warn(`Warning: target ${m.ID_OKR} not found. Skipping measurement ${m.Mes}.`);
      continue;
    }
    const resultadoApurado = typeof m['Resultado apurado'] === 'number' ? m['Resultado apurado'] : null;
    const atingimento = typeof m['% Atingimento'] === 'number' ? m['% Atingimento'] : null;
    const status = ALLOWED_STATUS.includes(m.Status) ? m.Status : 'Pendente';

    measurementPayloads.push({
      okr_id: okrUuid,
      mes: m.Mes,
      trimestre: m.Trimestre || (['Jan', 'Fev', 'Mar'].includes(m.Mes) ? 'Q1' : 'Q2'),
      resultado_apurado: resultadoApurado,
      atingimento,
      status,
      evidencia_comentario: m['Evidencia/Comentario'] || null,
      acao_sugerida: m['Acao sugerida'] || null,
      audited: false
    });
  }

  let inserted = 0;
  const chunkSize = 100;
  for (let i = 0; i < measurementPayloads.length; i += chunkSize) {
    const chunk = measurementPayloads.slice(i, i + chunkSize);
    const { data: rows, error: chunkError } = await supabase
      .from('okr_measurements')
      .upsert(chunk, { onConflict: 'okr_id,mes', ignoreDuplicates: true })
      .select('id');
    if (chunkError) {
      console.error(`Error upserting measurement chunk at index ${i}:`, chunkError.message);
    } else {
      inserted += rows ? rows.length : 0;
    }
  }

  console.log(`Inserted ${inserted} new measurement rows (existing rows left untouched).`);
  console.log(`Seeding complete!`);
}

seed().catch(err => {
  console.error("Seeding crashed:", err);
  process.exit(1);
});

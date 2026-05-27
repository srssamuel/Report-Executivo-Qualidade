/**
 * Avaliação de Perfil Científico — motor de scoring determinístico (PRD §3.3).
 *
 * Funções puras e testáveis: dado um conjunto de respostas (itens fechados),
 * computa scores 0-100 em três níveis — sub-competência, competência e
 * domínio — e o índice de consistência a partir dos 14 pares espelhados.
 *
 * Sem LLM, sem I/O. A persistência (tabelas `perfil_cientifico_*`) e a
 * geração do laudo IA vivem fora deste módulo. Independente do Radar Vértice
 * e do `scoringEngine.ts` genérico (IRT).
 *
 * Convenção de pontuação:
 * - Todo item fechado é situacional: o respondente escolhe uma das 5
 *   alternativas, cada uma com um `score` 1-5 embutido. O valor do item é o
 *   `score` da alternativa escolhida — a direção da competência já está na
 *   alternativa, sem inversão de polaridade.
 * - Normalização 1-5 → 0-100: ((media - 1) / 4) * 100.
 */

import {
  CLOSED_QUESTIONS,
  COMPETENCIES,
  DOMAINS,
  MIRROR_PAIRS,
  type ClosedQuestion,
  type DomainSlug,
} from "./perfilCientificoQuestions";

// ============ TIPOS ============

/** Resposta crua a um item fechado, identificada pelo código estável do item. */
export interface ScoringResponse {
  /** Código do item — ex.: "PA-01". */
  readonly code: string;
  /** Valor declarado: o `value` da alternativa escolhida (ex.: "c"). */
  readonly answer: string | number;
}

/** Rótulo de confiança derivado do índice de consistência. */
export type ConsistencyLabel = "alta" | "moderada" | "baixa";

/** Resultado completo do scoring de uma sessão. */
export interface PerfilCientificoScores {
  /** Score 0-100 por domínio — chave = slug do domínio (5 entradas). */
  readonly domainScores: Record<string, number>;
  /** Score 0-100 por competência — chave = slug da competência (18 entradas). */
  readonly competencyScores: Record<string, number>;
  /** Score 0-100 por sub-competência — chave = slug da sub-competência. */
  readonly subCompetencyScores: Record<string, number>;
  /** Índice de consistência 0-100 (PRD §3.3). `null` quando sem pares avaliáveis. */
  readonly consistencyIndex: number | null;
  /** Rótulo de confiança derivado do índice. `null` quando índice indisponível. */
  readonly consistencyLabel: ConsistencyLabel | null;
  /** Itens efetivamente pontuados (encontrados no banco + respondidos). */
  readonly scoredItemCount: number;
}

// ============ ÍNDICE INTERNO DO BANCO ============

const QUESTION_BY_CODE: ReadonlyMap<string, ClosedQuestion> = new Map(
  CLOSED_QUESTIONS.map((q) => [q.code, q]),
);

// ============ HELPERS DE VALOR ============

/**
 * Resolve o valor 1-5 de uma resposta a um item: o `score` da alternativa
 * escolhida. Retorna `null` quando a resposta é inválida — alternativa
 * inexistente ou score fora da escala 1-5.
 */
function resolveItemValue(
  item: ClosedQuestion,
  response: ScoringResponse,
): number | null {
  const chosen = String(response.answer);
  const option = item.options.find((o) => o.value === chosen);
  if (!option) return null;
  if (!Number.isFinite(option.score) || option.score < 1 || option.score > 5) {
    return null;
  }
  return option.score;
}

/** Normaliza uma média na escala 1-5 para 0-100. */
function normalize1to5(mean: number): number {
  return Math.round(((mean - 1) / 4) * 100 * 100) / 100;
}

/** Média ponderada simples; retorna `null` quando não há contribuições. */
function weightedMean(
  entries: ReadonlyArray<{ value: number; weight: number }>,
): number | null {
  if (entries.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const { value, weight } of entries) {
    const w = weight > 0 ? weight : 1;
    weightedSum += value * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

// ============ SCORING PRINCIPAL ============

/**
 * Computa os scores 0-100 nos três níveis + índice de consistência.
 *
 * Itens sem resposta correspondente são ignorados (não penalizam). Uma
 * sub-competência / competência / domínio sem nenhum item respondido fica
 * fora do mapa de scores — o consumidor decide como tratar a lacuna.
 *
 * Função pura: mesma entrada → mesma saída, sem efeitos colaterais.
 */
export function computePerfilCientificoScores(
  responses: ReadonlyArray<ScoringResponse>,
): PerfilCientificoScores {
  // 1. Resolver cada resposta para um valor 1-5 na polaridade direta.
  interface ResolvedItem {
    readonly item: ClosedQuestion;
    readonly value: number;
  }
  const resolved: ResolvedItem[] = [];
  for (const response of responses) {
    const item = QUESTION_BY_CODE.get(response.code);
    if (!item) continue; // código desconhecido — ignora
    const value = resolveItemValue(item, response);
    if (value === null) continue; // resposta inválida — ignora
    resolved.push({ item, value });
  }

  // 2. Score por sub-competência (média ponderada dos itens da sub-comp).
  const bySubCompetency: Record<string, ResolvedItem[]> = {};
  for (const ri of resolved) {
    (bySubCompetency[ri.item.subCompetency] ??= []).push(ri);
  }

  const subCompetencyScores: Record<string, number> = {};
  for (const [sub, items] of Object.entries(bySubCompetency)) {
    const mean = weightedMean(
      items.map((ri) => ({ value: ri.value, weight: ri.item.weight })),
    );
    if (mean !== null) subCompetencyScores[sub] = normalize1to5(mean);
  }

  // 3. Score por competência (média ponderada dos itens da competência).
  //    Calculada a partir dos itens, não das sub-comp, para que o peso de
  //    cada item conte uma vez só independentemente da distribuição.
  const byCompetency: Record<string, ResolvedItem[]> = {};
  for (const ri of resolved) {
    (byCompetency[ri.item.competency] ??= []).push(ri);
  }

  const competencyScores: Record<string, number> = {};
  for (const [comp, items] of Object.entries(byCompetency)) {
    const mean = weightedMean(
      items.map((ri) => ({ value: ri.value, weight: ri.item.weight })),
    );
    if (mean !== null) competencyScores[comp] = normalize1to5(mean);
  }

  // 4. Score por domínio (média das competências respondidas do domínio).
  const competenciesByDomain: Record<DomainSlug, string[]> = {
    cognicao: [],
    negocio: [],
    energia: [],
    relacao: [],
    crescimento: [],
  };
  for (const c of COMPETENCIES) {
    competenciesByDomain[c.domain].push(c.slug);
  }

  const domainScores: Record<string, number> = {};
  for (const domain of DOMAINS) {
    const compSlugs = competenciesByDomain[domain.slug];
    const present = compSlugs
      .map((slug) => competencyScores[slug])
      .filter((s): s is number => typeof s === "number");
    if (present.length > 0) {
      const avg = present.reduce((a, b) => a + b, 0) / present.length;
      domainScores[domain.slug] = Math.round(avg * 100) / 100;
    }
  }

  // 5. Índice de consistência a partir dos pares espelhados.
  const consistency = computeConsistencyIndex(responses);

  return {
    domainScores,
    competencyScores,
    subCompetencyScores,
    consistencyIndex: consistency.index,
    consistencyLabel: consistency.label,
    scoredItemCount: resolved.length,
  };
}

// ============ ÍNDICE DE CONSISTÊNCIA ============

/** Resultado do cálculo do índice de consistência. */
export interface ConsistencyResult {
  /** Índice 0-100 — 100 = total concordância entre item e gêmeo. */
  readonly index: number | null;
  /** Rótulo derivado do índice. */
  readonly label: ConsistencyLabel | null;
  /** Quantidade de pares efetivamente avaliados (ambos os lados respondidos). */
  readonly evaluatedPairs: number;
}

/**
 * Índice de consistência (PRD §3.3).
 *
 * Cada par espelhado liga dois itens da MESMA competência que medem o mesmo
 * construto por situações distintas. Cada alternativa carrega o próprio score,
 * então um respondente coerente escolhe alternativas de nível semelhante nos
 * dois itens — valores próximos. A divergência mede inconsistência /
 * desejabilidade social.
 *
 * Fórmula:
 *   Para cada par p com ambos os lados respondidos:
 *     diff(p)         = | valor(itemA) - valor(itemB) |   (0-4)
 *     concordancia(p) = 1 - diff(p) / 4                    (0-1)
 *   índice = média( concordancia(p) ) * 100               (0-100)
 *
 * Pares com um lado faltando são ignorados (não penalizam). Sem nenhum par
 * avaliável o índice é `null`.
 *
 * Rótulo: índice ≥ 80 → "alta"; 60-79 → "moderada"; < 60 → "baixa".
 */
export function computeConsistencyIndex(
  responses: ReadonlyArray<ScoringResponse>,
): ConsistencyResult {
  const valueByCode = new Map<string, number>();
  for (const response of responses) {
    const item = QUESTION_BY_CODE.get(response.code);
    if (!item) continue;
    const value = resolveItemValue(item, response);
    if (value === null) continue;
    valueByCode.set(item.code, value);
  }

  const agreements: number[] = [];
  for (const pair of MIRROR_PAIRS) {
    const a = valueByCode.get(pair.codeA);
    const b = valueByCode.get(pair.codeB);
    if (a === undefined || b === undefined) continue;
    // Diferença máxima possível na escala 1-5 = 4.
    const diff = Math.abs(a - b);
    agreements.push(1 - diff / 4);
  }

  if (agreements.length === 0) {
    return { index: null, label: null, evaluatedPairs: 0 };
  }

  const meanAgreement =
    agreements.reduce((a, b) => a + b, 0) / agreements.length;
  const index = Math.round(meanAgreement * 100 * 100) / 100;

  return {
    index,
    label: consistencyLabelFor(index),
    evaluatedPairs: agreements.length,
  };
}

/** Mapeia o índice 0-100 para o rótulo de confiança do laudo. */
export function consistencyLabelFor(index: number): ConsistencyLabel {
  if (index >= 80) return "alta";
  if (index >= 60) return "moderada";
  return "baixa";
}

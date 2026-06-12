'use client'

import React from 'react'
import { TrendingUp, Users, Target } from 'lucide-react'
import {
  Item,
  Gain,
  Filters,
  isDone,
  riskSeverity,
  riskOf,
  scoreOf,
  dataGaps,
  daysToDue,
  ownersOf,
  countsBy,
  productTone,
  riskTone,
  statusTone,
  dateFmt,
  gainTypeTone,
  GAIN_TYPES,
  ownerLoad,
  capacityTone,
  calculateOkrAtingimento,
  resolveOkrStatus,
  okrStatusTone,
  OKRTarget,
  OKRMeasurement,
  OKRStatus,
  Quarter,
  quarterFromMonthIndex,
  periodoCoversQuarter,
  QUARTER_MONTHS,
  QUARTER_LABELS
} from '@/shared/domain'
import { Badge, ProgressGauge, HBarChart } from '@/shared/components'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

/** Snapshot diário da carteira (portfolio_snapshots, migration 022). */
interface PortfolioSnapshot {
  day: string
  total: number | null
  active: number | null
}

interface DashboardViewProps {
  filtered: Item[]
  avgScore: number
  late: number
  soon: number
  gaps: number
  active: number
  total: number
  effort: number
  onEdit: (id: string) => void
  gains: Gain[]
  items: Item[]
  okrTargets: OKRTarget[]
  okrMeasurements: OKRMeasurement[]
  isOkrFallback: boolean
  weeklyCapacity: number
  /** Drill-down: aplica filtros e navega para a view de detalhe. */
  onDrill: (filters: Partial<Filters>, view?: 'portfolio' | 'capacity') => void
}

export function DashboardView({
  filtered,
  avgScore,
  late,
  soon,
  gaps,
  active,
  total,
  effort,
  onEdit,
  gains,
  items,
  okrTargets,
  okrMeasurements,
  isOkrFallback,
  weeklyCapacity,
  onDrill,
}: DashboardViewProps) {
  /* Evolução da carteira: snapshots diários (telemetria já existente). */
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('portfolio_snapshots')
      .select('day, total, active')
      .order('day', { ascending: true })
      .limit(120)
      .then(({ data }) => { if (data) setSnapshots(data as PortfolioSnapshot[]) })
  }, [])
  const evolution = snapshots.map(sn => ({
    day: new Date(`${sn.day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Total: sn.total ?? 0,
    Concluídas: (sn.total ?? 0) - (sn.active ?? 0),
  }))

  const decisionQueue = [...filtered]
    .filter(i => !isDone(i))
    .sort((a, b) => riskSeverity(riskOf(a)) - riskSeverity(riskOf(b)) || scoreOf(a) - scoreOf(b))
    .slice(0, 8)

  const govGaps = [...filtered]
    .filter(i => dataGaps(i).length > 0 && !isDone(i))
    .sort((a, b) => dataGaps(b).length - dataGaps(a).length)
    .slice(0, 8)

  /* ── Heatmap Produto × Status (substitui os 3 gráficos de distribuição) ── */
  const HEAT_STATUSES = ['A iniciar', 'Em andamento', 'Em validação', 'Bloqueado', 'Atrasado', 'Pausado', 'Concluído']
  const heatProducts = Object.entries(countsBy(filtered, i => i.product ?? 'Sem produto'))
    .sort((a, b) => b[1] - a[1])
    .map(([prod]) => prod)
  const heatCell: Record<string, number> = {}
  let heatMax = 1
  filtered.forEach(it => {
    const key = `${it.product ?? 'Sem produto'}|${it.status}`
    heatCell[key] = (heatCell[key] ?? 0) + 1
    if (HEAT_STATUSES.includes(it.status) && heatCell[key] > heatMax) heatMax = heatCell[key]
  })
  const heatBg = (status: string, count: number): string => {
    if (count === 0) return 'transparent'
    const alpha = 0.15 + 0.6 * (count / heatMax)
    if (['Bloqueado', 'Atrasado'].includes(status)) return `rgba(189, 47, 61, ${alpha})`
    if (status === 'Concluído') return `rgba(10, 110, 73, ${alpha})`
    return `rgba(30, 96, 213, ${alpha})`
  }

  /* ── Aging dos críticos: crítico que envelhece é o que explode ── */
  const agingCriticos = filtered
    .filter(i => ['Bloqueado', 'Atrasado'].includes(riskOf(i)))
    .map(it => {
      const overdue = Math.max(0, -(daysToDue(it.dueDate) ?? 0))
      const stale = it.lastUpdate ? Math.max(0, Math.floor((Date.now() - new Date(it.lastUpdate).getTime()) / 86400000)) : 0
      return { it, age: Math.max(overdue, stale) }
    })
    .sort((a, b) => b.age - a.age)
    .slice(0, 5)
  const agingMax = Math.max(1, ...agingCriticos.map(a => a.age))

  /* ── Capacity heatmap (reuse ownerLoad + capacityTone) ── */
  const load = ownerLoad(filtered) // ownerLoad já filtra !isDone internamente
  const loadEntries = Object.entries(load).sort((a, b) => b[1] - a[1]).slice(0, 8)
  // Guard contra divisão por zero: weeklyCapacity é prop e vira 0 se o campo de
  // capacidade for esvaziado (Number('') === 0), o que renderizaria "Infinity%".
  const safeCapacity = weeklyCapacity > 0 ? weeklyCapacity : 30

  /* ── Risk concentration by owner ── */
  const ownerRisk: Record<string, { crit: number; att: number }> = {}
  filtered.filter(i => !isDone(i)).forEach(it => {
    const r = riskOf(it)
    const isCrit = ['Atrasado', 'Bloqueado'].includes(r)
    const isAtt = ['Vence hoje', 'Atenção 7 dias'].includes(r)
    if (!isCrit && !isAtt) return
    ownersOf(it.owner).forEach(o => {
      if (!ownerRisk[o]) ownerRisk[o] = { crit: 0, att: 0 }
      if (isCrit) ownerRisk[o].crit++
      else ownerRisk[o].att++
    })
  })
  const riskEntries = Object.entries(ownerRisk)
    .sort((a, b) => b[1].crit - a[1].crit || b[1].att - a[1].att)
    .slice(0, 8)

  /* ── OKR snapshot (espelha agregação ponderada de OKRsView, período ativo) ── */
  const okrMeasuresByTarget: Record<string, OKRMeasurement[]> = {}
  okrMeasurements.forEach(m => {
    if (!okrMeasuresByTarget[m.okr_id]) okrMeasuresByTarget[m.okr_id] = []
    okrMeasuresByTarget[m.okr_id].push(m)
  })
  /* Apuração trimestral: usa o trimestre corrente (espelha OKRsView) */
  const activeQuarter: Quarter = quarterFromMonthIndex(new Date().getMonth())
  const periodTargets = okrTargets.filter(t => periodoCoversQuarter(t.periodo, activeQuarter))
  let okrTotalWeight = 0
  let okrTotalScore = 0
  const okrStatusCounts: Record<OKRStatus, number> = { Atingido: 0, Parcial: 0, Crítico: 0, Pendente: 0 }
  const perspScore: Record<string, { score: number; weight: number }> = {}
  periodTargets.forEach(t => {
    const ms = (okrMeasuresByTarget[t.id] || []).filter(m => QUARTER_MONTHS[activeQuarter].includes(m.mes))
    let sum = 0
    let count = 0
    ms.forEach(m => {
      if (m.resultado_apurado !== null && m.resultado_apurado !== undefined) {
        const at = calculateOkrAtingimento(m.resultado_apurado, t.meta_numerica, t.direcao)
        if (at !== null) {
          sum += at
          count++
          okrStatusCounts[resolveOkrStatus(at)]++
        }
      } else {
        okrStatusCounts.Pendente++
      }
    })
    const avg = count > 0 ? sum / count : null
    if (avg !== null) {
      okrTotalScore += avg * t.peso
      okrTotalWeight += t.peso
      if (!perspScore[t.perspectiva]) perspScore[t.perspectiva] = { score: 0, weight: 0 }
      perspScore[t.perspectiva].score += avg * t.peso
      perspScore[t.perspectiva].weight += t.peso
    }
  })
  const okrGlobalScore = okrTotalWeight > 0 ? Math.round((okrTotalScore / okrTotalWeight) * 100) : null
  const okrPerspectiveRows = Object.entries(perspScore)
    .map(([p, v]) => [p, v.weight > 0 ? Math.round((v.score / v.weight) * 100) : 0] as [string, number])
    .sort((a, b) => b[1] - a[1])
  const hasOkr = okrTargets.length > 0

  const narrative: string[] = []
  const byProduct = Object.entries(countsBy(filtered, i => i.product ?? 'Sem produto')).sort((a, b) => b[1] - a[1])
  if (byProduct.length) narrative.push(`Recorte atual: ${byProduct.map(([p, n]) => `${p} (${n})`).join(' • ')}.`)
  if (late) narrative.push(`${late} frente(s) em condição crítica e devem entrar na pauta de destrave.`)
  if (soon) narrative.push(`${soon} frente(s) exigem acompanhamento próximo para evitar atraso.`)
  const missingNext = filtered.filter(i => !isDone(i) && !i.nextAction).length
  if (missingNext) narrative.push(`${missingNext} item(ns) ativos ainda não têm próxima ação explícita.`)
  if (gaps) narrative.push(`${gaps} item(ns) ativos sem prazo definido, reduzindo previsibilidade.`)
  if (!narrative.length) narrative.push('A carteira filtrada está com governança adequada e sem riscos relevantes de prazo.')

  /* Health tone for KPI hero */
  const healthTone = avgScore >= 80 ? 'green' : avgScore >= 60 ? 'amber' : 'red'

  return (
    <>
      {/* ── KPI Grid ────────────────────────────────────────── */}
      <div className="kpi-grid">
        {[
          { label: 'Score executivo', value: `${avgScore}%`, sub: `Média ponderada · ${total} frentes`, cls: healthTone, hero: true, hint: 'Ver carteira ordenada por risco', drill: () => onDrill({ sort: 'risk' }) },
          { label: 'Ativas', value: active, sub: 'em execução ou planejadas', cls: 'blue', hero: false, hint: 'Ver carteira completa', drill: () => onDrill({}) },
          { label: 'Concluídas', value: total - active, sub: 'entregues ou canceladas', cls: 'green', hero: false, hint: 'Ver concluídas na carteira', drill: () => onDrill({ status: 'Concluído', sort: 'updated' }) },
          { label: 'Críticas', value: late, sub: 'atrasadas ou bloqueadas', cls: late > 0 ? 'red' : 'green', hero: false, hint: 'Ver apenas as críticas', drill: () => onDrill({ criticalOnly: true, sort: 'risk' }) },
          { label: 'Lacunas', value: gaps, sub: 'governança incompleta', cls: gaps > 0 ? 'amber' : 'green', hero: false, hint: 'Ver itens com lacunas de governança', drill: () => onDrill({ gapsOnly: true }) },
          { label: 'Esforço restante', value: `${effort}h`, sub: `${soon} vencem em breve`, cls: 'blue', hero: false, hint: 'Ver capacidade da equipe', drill: () => onDrill({}, 'capacity') },
        ].map((k, idx) => (
          <button
            type="button"
            className={`kpi ${k.cls}${k.hero ? ' kpi-hero' : ''} animate-fade-up stagger-${idx + 1}`}
            key={k.label}
            title={k.hint}
            onClick={k.drill}
          >
            <span>{k.label}</span>
            <strong>{k.value}</strong>
            <small>{k.sub}</small>
          </button>
        ))}
      </div>

      {/* ── Health + Decision Queue ──────────────────────────── */}
      <div className="dash-section">
        <div className="grid two">
          <div className="card panel-health">
            <div className="card-head">
              <h3 className="card-title">Saúde da carteira</h3>
              <Badge label={`${filtered.length} frentes`} tone="tone-blue" />
            </div>
            <div className="card-body">
              <div className="health-wrap">
                <div className="health-gauge">
                  <ProgressGauge value={avgScore} size={154} />
                </div>
                <div className="insight-list">
                  {narrative.map((n, i) => <div key={i} className="insight"><strong>{n}</strong></div>)}
                </div>
              </div>
            </div>
          </div>
          <div className="card panel-decision">
            <div className="card-head">
              <h3 className="card-title">Fila de decisão</h3>
              <span className="badge tone-amber">{decisionQueue.length} itens</span>
            </div>
            <div className="card-body">
              <div className="insight-list">
                {decisionQueue.length === 0 ? (
                  <div className="empty">Sem itens pendentes no filtro atual.</div>
                ) : (
                  decisionQueue.map(it => (
                    <div key={it.id} className="decision-card">
                      <div>
                        <div className="task-meta" style={{ marginBottom: 6 }}>
                          <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                          <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                          <Badge label={it.status} tone={statusTone(it.status)} />
                          <Badge label={dateFmt(it.dueDate)} />
                        </div>
                        <strong style={{ fontSize: 13, display: 'block', lineHeight: 1.4 }}>
                          {it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}
                        </strong>
                        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
                          {it.nextAction || it.executiveComment || it.definition || 'Sem próxima ação registrada.'}
                        </p>
                      </div>
                      <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onde dói: mapa de calor Produto × Status (clicável → drill) ── */}
      <div className="dash-section">
        <div className="section-head">
          <h2 className="section-title"><TrendingUp size={18} /> Onde dói — Produto × Status</h2>
        </div>
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Produto</th>
                  {HEAT_STATUSES.map(st => <th key={st} style={{ textAlign: 'center', fontSize: 11 }}>{st}</th>)}
                </tr>
              </thead>
              <tbody>
                {heatProducts.map(prod => (
                  <tr key={prod}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{prod}</td>
                    {HEAT_STATUSES.map(st => {
                      const count = heatCell[`${prod}|${st}`] ?? 0
                      return (
                        <td key={st} style={{ textAlign: 'center', padding: 4 }}>
                          {count > 0 ? (
                            <button
                              type="button"
                              onClick={() => onDrill({ product: prod, status: st })}
                              title={`${count} frente(s) de ${prod} em ${st} — clique para abrir o recorte`}
                              style={{
                                width: '100%', minHeight: 34, border: 'none', borderRadius: 6,
                                background: heatBg(st, count), cursor: 'pointer',
                                fontWeight: 800, fontSize: 13,
                                color: count / heatMax > 0.55 ? '#fff' : 'var(--text-title, #0b1f3a)',
                              }}
                            >
                              {count}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--line)', fontSize: 12 }}>·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Intensidade = volume · vermelho = travado/atrasado · clique na célula abre a Carteira filtrada.
            </p>
          </div>
        </div>
      </div>

      {/* ── Owners + Governance Gaps ────────────────────────── */}
      <div className="dash-section">
        <div className="grid two">
          <div className="card panel-owner">
            <div className="card-head">
              <h3 className="card-title">Aging dos críticos</h3>
              <Badge label={`${agingCriticos.length} no radar`} tone={agingCriticos.length ? 'tone-red' : 'tone-green'} />
            </div>
            <div className="card-body">
              {agingCriticos.length === 0 ? (
                <div className="empty">Nenhum item crítico envelhecendo no recorte atual.</div>
              ) : (
                <div className="capacity-bars">
                  {agingCriticos.map(({ it, age }) => (
                    <div key={it.id} className="capacity-row" style={{ cursor: 'pointer' }} onClick={() => onEdit(it.id)} title="Abrir o item">
                      <b title={`${it.project ?? it.id} — ${it.demand ?? ''}`}>{it.project ?? it.id}</b>
                      <div className="capacity-track danger"><i style={{ width: `${Math.round((age / agingMax) * 100)}%` }} /></div>
                      <small>{age}d · {riskOf(it)}</small>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                Dias vencido ou sem atualização (o maior) — crítico que envelhece é o que explode.
              </p>
            </div>
          </div>
          <div className="card panel-gaps">
            <div className="card-head">
              <h3 className="card-title">Lacunas de governança</h3>
              <Badge label={`${govGaps.length} itens`} tone="tone-amber" />
            </div>
            <div className="card-body">
              <div className="insight-list">
                {govGaps.length === 0 ? (
                  <div className="empty">Sem lacunas críticas de governança.</div>
                ) : (
                  govGaps.map(it => (
                    <div key={it.id} className="insight" style={{ cursor: 'pointer' }} onClick={() => onEdit(it.id)}>
                      <div className="task-meta" style={{ marginBottom: 6 }}>
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                        <Badge label={dataGaps(it).join(', ')} tone="tone-amber" />
                        <Badge label={it.owner || 'Sem responsável'} />
                      </div>
                      <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                      <span>Recom.: definir {dataGaps(it).slice(0, 2).join(' e ')} para cobrança objetiva.</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capacidade + Concentração de risco ───────────────── */}
      <div className="dash-section">
        <div className="section-head">
          <h2 className="section-title"><Users size={18} /> Capacidade e concentração de risco</h2>
        </div>
        <div className="grid two">
          <div className="card panel-owner">
            <div className="card-head">
              <h3 className="card-title">Carga por responsável</h3>
              <Badge label={`${weeklyCapacity}h/sem`} tone="tone-gray" />
            </div>
            <div className="card-body">
              {loadEntries.length === 0 ? (
                <div className="empty">Sem esforço alocado no recorte atual.</div>
              ) : (
                <div className="capacity-bars">
                  {loadEntries.map(([owner, h]) => {
                    const pct = Math.round((h / safeCapacity) * 100)
                    const tone = capacityTone(pct)
                    return (
                      <div key={owner} className="capacity-row">
                        <b title={owner}>{owner}</b>
                        <div className={`capacity-track ${tone}`}><i style={{ width: `${Math.min(160, pct)}%` }} /></div>
                        <small>{Math.round(h)}h / {pct}%</small>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="card panel-gaps">
            <div className="card-head">
              <h3 className="card-title">Concentração de risco</h3>
              <Badge label={`${riskEntries.length} responsáveis`} tone="tone-red" />
            </div>
            <div className="card-body">
              <div className="insight-list">
                {riskEntries.length === 0 ? (
                  <div className="empty">Nenhum responsável com itens em risco no recorte atual.</div>
                ) : (
                  riskEntries.map(([owner, r]) => (
                    <div key={owner} className="insight">
                      <div className="task-meta" style={{ marginBottom: 6 }}>
                        <Badge label={owner} />
                        {r.crit > 0 && <Badge label={`${r.crit} crítico(s)`} tone="tone-red" />}
                        {r.att > 0 && <Badge label={`${r.att} em atenção`} tone="tone-amber" />}
                      </div>
                      <span>{r.crit > 0 ? 'Priorizar destrave imediato das frentes críticas.' : 'Acompanhar de perto para evitar escalada de prazo.'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tendência: evolução da carteira (snapshots diários) ── */}
      <div className="dash-section">
        <div className="section-head">
          <h2 className="section-title"><TrendingUp size={18} /> Evolução da carteira</h2>
        </div>
        <div className="card">
          <div className="card-body">
            {evolution.length < 3 ? (
              <div className="empty">
                Histórico em construção — o snapshot diário já está ativo; a curva aparece após alguns dias de uso ({evolution.length} registrado(s)).
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolution} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Total" stroke="#1e60d5" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Concluídas" stroke="#0a6e49" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Atingimento de OKRs ──────────────────────────────── */}
      {hasOkr && (
        <div className="dash-section">
          <div className="section-head">
            <h2 className="section-title"><Target size={18} /> Atingimento de OKRs</h2>
            <Badge label={QUARTER_LABELS[activeQuarter]} tone="tone-blue" />
          </div>
          {isOkrFallback && (
            <p className="dep-note" style={{ marginBottom: 12 }}>
              Exibindo dados de demonstração — conecte os OKRs reais para refletir o período corrente.
            </p>
          )}
          <div className="grid two">
            <div className="card panel-health">
              <div className="card-head"><h3 className="card-title">Score global ponderado</h3></div>
              <div className="card-body">
                <div className="health-wrap">
                  <ProgressGauge value={Math.min(100, okrGlobalScore ?? 0)} />
                </div>
                {okrPerspectiveRows.length > 0 && (
                  <div className="capacity-bars" style={{ marginTop: 16 }}>
                    {okrPerspectiveRows.map(([persp, score]) => (
                      <div key={persp} className="capacity-row">
                        <b title={persp}>{persp}</b>
                        <div className="capacity-track"><i style={{ width: `${Math.min(100, score)}%` }} /></div>
                        <small>{score}%</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3 className="card-title">Distribuição por status</h3></div>
              <div className="card-body">
                <div className="insight-list">
                  {(['Atingido', 'Parcial', 'Crítico', 'Pendente'] as OKRStatus[]).map(st => (
                    <div key={st} className="insight">
                      <div className="task-meta">
                        <Badge label={st} tone={okrStatusTone(st)} />
                        <strong style={{ marginLeft: 'auto', fontSize: 18 }}>{okrStatusCounts[st]}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Gains Summary ───────────────────────────────────── */}
      {gains.length > 0 && (
        <div className="dash-section">
          <div className="section-head">
            <h2 className="section-title">Ganhos registrados</h2>
            <Badge label={`${gains.length} registros`} tone="tone-green" />
          </div>
          <div className="grid two">
            <div className="card">
              <div className="card-head"><h3 className="card-title">Ganhos por tipo</h3></div>
              <div className="card-body">
                <div className="chart-container">
                  <HBarChart data={countsBy(gains, g => g.gain_type)} total={gains.length} />
                </div>
                <div className="gain-type-grid">
                  {(GAIN_TYPES as readonly string[]).map(t => {
                    const count = gains.filter(g => g.gain_type === t).length
                    return (
                      <div key={t} className="gain-type-card">
                        <Badge label={t} tone={gainTypeTone(t)} />
                        <div className="gain-type-value">{count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3 className="card-title">Ganhos recentes</h3></div>
              <div className="card-body">
                <div className="insight-list">
                  {gains.slice(0, 8).map(g => {
                    const it = items.find(x => x.id === g.item_id)
                    return (
                      <div
                        key={g.id}
                        className="insight"
                        style={{ cursor: it ? 'pointer' : 'default' }}
                        onClick={() => it && onEdit(it.id)}
                      >
                        <div className="task-meta" style={{ marginBottom: 6 }}>
                          <Badge label={g.gain_type} tone={gainTypeTone(g.gain_type)} />
                          {g.kpi && <Badge label={g.kpi} tone="tone-blue" />}
                          {g.gain_value && <Badge label={g.gain_value} tone="tone-green" />}
                        </div>
                        <strong>{it ? `${it.product ?? ''} — ${it.project ?? it.demand ?? 'Sem projeto'}` : g.item_id}</strong>
                        {g.detail && <span style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.4 }}>{g.detail}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

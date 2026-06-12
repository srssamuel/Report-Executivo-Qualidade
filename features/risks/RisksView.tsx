'use client'

import React, { useState } from 'react'
import {
  Item,
  riskOf,
  scoreOf,
  productTone,
  riskTone,
  statusTone,
  dateFmt,
  daysToDue,
  dataGaps,
  isDone,
  riskScore,
  riskBandTone,
  riskRecommendedAction,
  itemRemainingEffort,
  type RiskScoreResult,
  type RiskBand,
} from '@/shared/domain'
import { Badge } from '@/shared/components'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'

/* Cores das bandas alinhadas aos tokens do design system (SVG não lê var()). */
const BAND_COLOR: Record<RiskBand, string> = {
  'Crítico': '#bd2f3d',
  'Alto': '#8f5200',
  'Médio': '#56657a',
  'Baixo': '#0a6e49',
}

interface MatrixPoint {
  id: string
  label: string
  days: number
  score: number
  effort: number
  band: RiskBand
  reason: string
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: { payload: MatrixPoint }[] }) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12, boxShadow: '0 8px 20px rgba(11,31,58,0.10)', maxWidth: 260 }}>
      <strong style={{ display: 'block', marginBottom: 2 }}>{pt.label}</strong>
      <span style={{ color: 'var(--muted)' }}>
        Score {pt.score} · {pt.band} — {pt.reason}<br />
        {pt.days < 0 ? `Vencido há ${Math.abs(pt.days)} dia(s)` : `Vence em ${pt.days} dia(s)`} · {pt.effort}h restantes
      </span>
    </div>
  )
}

interface RisksViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
  onFieldChange: (id: string, field: keyof Item, value: unknown) => void
  canEdit: boolean
}

export function RisksView({ filtered, onEdit, onFieldChange, canEdit }: RisksViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [appliedAction, setAppliedAction] = useState<string | null>(null)

  // Fila por score de risco composto (5 fatores ponderados) — itens abertos, desc.
  const ranked = filtered
    .map(it => ({ it, rs: riskScore(it, filtered) }))
    .filter((x): x is { it: Item; rs: RiskScoreResult } => x.rs !== null)
    .sort((a, b) => b.rs.score - a.rs.score)

  // Matriz Urgência × Exposição: só itens abertos COM prazo (sem prazo fica na fila).
  const matrixPoints: MatrixPoint[] = ranked
    .map(({ it, rs }) => {
      const days = daysToDue(it.dueDate)
      if (days === null) return null
      return {
        id: it.id,
        label: `${it.project ?? 'Sem projeto'} — ${it.demand ?? it.id}`,
        days,
        score: rs.score,
        effort: itemRemainingEffort(it),
        band: rs.band,
        reason: rs.mainReason,
      }
    })
    .filter((x): x is MatrixPoint => x !== null)

  const critical = [...filtered]
    .filter(i => ['Bloqueado', 'Atrasado'].includes(riskOf(i)))
    .sort((a, b) => scoreOf(a) - scoreOf(b))

  const attention = [...filtered]
    .filter(i => ['Vence hoje', 'Atenção 7 dias'].includes(riskOf(i)))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))

  const gapItems = [...filtered]
    .filter(i => dataGaps(i).length && !isDone(i))
    .sort((a, b) => dataGaps(b).length - dataGaps(a).length)

  function RiskList({ list, empty, showGaps = false }: { list: Item[]; empty: string; showGaps?: boolean }) {
    return list.length === 0 ? (
      <div className="empty">{empty}</div>
    ) : (
      <>
        {list.map(it => (
          <div key={it.id} className="risk-item">
            <div className="task-meta">
              <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
              <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
              <Badge label={dateFmt(it.dueDate)} />
              <Badge label={it.status} tone={statusTone(it.status)} />
            </div>
            <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              {showGaps ? `Lacunas: ${dataGaps(it).join(', ')}` : it.nextAction || it.executiveComment || it.definition || 'Sem detalhe.'}
            </span>
            <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      {/* ── Matriz Urgência × Exposição ─────────────────────────
          X = dias até o prazo (urgência cresce para a esquerda do 0)
          Y = score composto · bolha = esforço restante · cor = banda */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="card-title">Matriz de decisão — Urgência × Exposição</h3>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            zona vermelha (alto + ≤7 dias) = agir esta semana · bolha = esforço restante
          </span>
        </div>
        <div className="card-body">
          {matrixPoints.length === 0 ? (
            <div className="empty">Sem itens abertos com prazo para plotar.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis
                  type="number"
                  dataKey="days"
                  name="Dias até o prazo"
                  reversed
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickFormatter={(v: number) => (v < 0 ? `${v}d` : `${v}d`)}
                />
                <YAxis
                  type="number"
                  dataKey="score"
                  name="Score de risco"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                />
                <ZAxis type="number" dataKey="effort" range={[60, 420]} />
                <Tooltip content={<MatrixTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <ReferenceLine x={7} stroke="#8f5200" strokeDasharray="4 4" label={{ value: '7 dias', position: 'top', fontSize: 10, fill: '#8f5200' }} />
                <ReferenceLine y={50} stroke="#bd2f3d" strokeDasharray="4 4" label={{ value: 'Alto', position: 'right', fontSize: 10, fill: '#bd2f3d' }} />
                <Scatter data={matrixPoints} onClick={(data: { payload?: MatrixPoint }) => { if (data.payload) onEdit(data.payload.id) }} cursor="pointer">
                  {matrixPoints.map(pt => (
                    <Cell key={pt.id} fill={BAND_COLOR[pt.band]} fillOpacity={0.75} stroke={BAND_COLOR[pt.band]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Fila por score de risco composto — clique no card expande o "por quê" (5 fatores) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3 className="card-title">Fila por score de risco</h3>
          <Badge label={String(ranked.length)} tone="tone-red" />
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 8 }}>
          {ranked.length === 0 ? (
            <div className="empty">Sem itens abertos para pontuar.</div>
          ) : (
            ranked.map(({ it, rs }) => {
              const open = expanded === it.id
              return (
                <div
                  key={it.id}
                  className="risk-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(open ? null : it.id)}
                >
                  <div className="task-meta">
                    <Badge label={`${rs.score} · ${rs.band}`} tone={riskBandTone(rs.band)} />
                    <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                    <Badge label={rs.mainReason} tone={riskTone(rs.mainReason)} />
                    <Badge label={dateFmt(it.dueDate)} />
                    <Badge label={it.status} tone={statusTone(it.status)} />
                  </div>
                  <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {open ? 'Fatores do score (peso × intensidade):' : `Toque para ver o porquê · responsável: ${it.owner || '—'}`}
                  </span>
                  {open && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, padding: '6px 8px', background: 'var(--amber-soft, #fff4df)', borderRadius: 6 }}>
                        <strong style={{ color: '#8f5200' }}>Ação sugerida:</strong>
                        <span style={{ flex: 1, minWidth: 180 }}>{riskRecommendedAction(it, rs)}</span>
                        {canEdit && (
                          <button
                            className="btn small"
                            onClick={e => {
                              e.stopPropagation()
                              onFieldChange(it.id, 'nextAction', riskRecommendedAction(it, rs))
                              setAppliedAction(it.id)
                            }}
                          >
                            {appliedAction === it.id ? 'Aplicada ✓' : 'Definir como próxima ação'}
                          </button>
                        )}
                      </div>
                      {rs.factors.map(f => (
                        <div
                          key={f.key}
                          style={{ display: 'grid', gridTemplateColumns: '128px 1fr auto', gap: 10, alignItems: 'center', fontSize: 12 }}
                        >
                          <span style={{ color: 'var(--muted)' }}>{f.label} · {Math.round(f.weight * 100)}%</span>
                          <span style={{ position: 'relative', height: 6, background: 'var(--line, #e5e9f0)', borderRadius: 4, overflow: 'hidden' }}>
                            <span style={{ position: 'absolute', inset: 0, width: `${f.raw}%`, background: 'var(--ink, #0b1f3a)', borderRadius: 4 }} />
                          </span>
                          <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{f.detail} · +{Math.round(f.contribution)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn small" onClick={e => { e.stopPropagation(); onEdit(it.id) }}>Atualizar</button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="traffic-legend" style={{ marginBottom: 16 }}>
        <div className="legend-chip critical">
          <span />
          <div>
            <strong>Crítico / Bloqueado</strong>
            <small>Ação imediata necessária — destravar na próxima reunião</small>
          </div>
        </div>
        <div className="legend-chip attention">
          <span />
          <div>
            <strong>Atenção / Vence em breve</strong>
            <small>Monitorar diariamente — risco de atraso em até 7 dias</small>
          </div>
        </div>
        <div className="legend-chip control">
          <span />
          <div>
            <strong>Em controle</strong>
            <small>No prazo — manter cadência de acompanhamento</small>
          </div>
        </div>
      </div>
      <div className="matrix">
        <div className="matrix-col card">
          <div className="card-head">
            <h3 className="card-title">Críticos / Atrasados</h3>
            <Badge label={String(critical.length)} tone="tone-red" />
          </div>
          <div className="card-body">
            <RiskList list={critical} empty="Nenhum item crítico no filtro atual." />
          </div>
        </div>
        <div className="matrix-col card">
          <div className="card-head">
            <h3 className="card-title">Vencimento próximo</h3>
            <Badge label={String(attention.length)} tone="tone-amber" />
          </div>
          <div className="card-body">
            <RiskList list={attention} empty="Nenhum vencimento crítico próximo." />
          </div>
        </div>
        <div className="matrix-col card">
          <div className="card-head">
            <h3 className="card-title">Lacunas de dados</h3>
            <Badge label={String(gapItems.length)} tone="tone-amber" />
          </div>
          <div className="card-body">
            <RiskList list={gapItems} empty="Nenhuma lacuna relevante identificada." showGaps />
          </div>
        </div>
      </div>
    </>
  )
}

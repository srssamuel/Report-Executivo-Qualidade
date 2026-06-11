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
  dataGaps,
  isDone,
  riskScore,
  riskBandTone,
  type RiskScoreResult,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface RisksViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
}

export function RisksView({ filtered, onEdit }: RisksViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  // Fila por score de risco composto (5 fatores ponderados) — itens abertos, desc.
  const ranked = filtered
    .map(it => ({ it, rs: riskScore(it, filtered) }))
    .filter((x): x is { it: Item; rs: RiskScoreResult } => x.rs !== null)
    .sort((a, b) => b.rs.score - a.rs.score)

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

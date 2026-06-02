'use client'

import React from 'react'
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
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface RisksViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
}

export function RisksView({ filtered, onEdit }: RisksViewProps) {
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

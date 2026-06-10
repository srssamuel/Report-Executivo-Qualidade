'use client'

import { useState } from 'react'
import type { Item } from '@/lib/domain'
import {
  isDone, dateFmt, daysToDue, priorityTone, productTone, riskScore, riskBandTone, clamp,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

const LANES = ['A iniciar', 'Em andamento', 'Em validação', 'Bloqueado', 'Pausado'] as const
const DONE_LANES = ['Concluído', 'Entregue'] as const
const WIP_LIMIT = 6

/** Status 'Atrasado' e 'Sem status'/'Cancelado' são exibidos em lanes do fluxo (banco não muda). */
function laneOf(status: string): string {
  if (status === 'Atrasado') return 'Em andamento'
  if (status === 'Sem status' || status === 'Cancelado') return 'A iniciar'
  return status
}

export default function BoardView({ filtered, allItems, onEdit, canEdit, onFieldChange }: {
  filtered: Item[]; allItems: Item[]; onEdit: (id: string) => void
  canEdit: boolean; onFieldChange: (id: string, field: keyof Item, value: unknown) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<string | null>(null)

  const lanes: string[] = showDone ? [...LANES, ...DONE_LANES] : [...LANES]

  function drop(lane: string) {
    if (dragId && canEdit) onFieldChange(dragId, 'status', lane)
    setDragId(null); setOverLane(null)
  }

  return (
    <>
      <div className="section-head">
        <h2>Board</h2>
        <label className="board-toggle">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
          Mostrar concluídos
        </label>
      </div>
      <div className="board">
        {lanes.map(lane => {
          const rows = filtered.filter(it => (showDone || !isDone(it)) && laneOf(it.status) === lane)
          const isWipAlert = lane === 'Em andamento' && rows.length > WIP_LIMIT
          return (
            <div
              key={lane}
              className={`lane ${overLane === lane ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setOverLane(lane) }}
              onDragLeave={() => setOverLane(l => (l === lane ? null : l))}
              onDrop={() => drop(lane)}
            >
              <div className="lane-head">
                <h3>{lane}</h3>
                {isWipAlert
                  ? <span className="wip-alert">{rows.length}/{WIP_LIMIT} WIP</span>
                  : <Badge label={String(rows.length)} tone={lane === 'Bloqueado' && rows.length > 0 ? 'tone-red' : 'tone-gray'} />}
              </div>
              {rows.length === 0 ? <div className="empty" style={{ padding: 18 }}>Sem itens</div> : rows.map(it => {
                const rs = riskScore(it, allItems)
                const overdueDays = daysToDue(it.dueDate)
                const overdue = overdueDays !== null && overdueDays < 0 && !isDone(it)
                return (
                  <article
                    key={it.id}
                    className={`task-card ${dragId === it.id ? 'dragging' : ''}`}
                    draggable={canEdit}
                    onDragStart={() => setDragId(it.id)}
                    onDragEnd={() => { setDragId(null); setOverLane(null) }}
                    onClick={() => onEdit(it.id)}
                  >
                    <div className="task-meta" style={{ justifyContent: 'space-between' }}>
                      <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                      {overdue && <span className="overdue-flag">venceu há {Math.abs(overdueDays!)}d</span>}
                    </div>
                    <h4>{it.demand || it.project || 'Sem demanda'}</h4>
                    <p>{it.project ?? 'Sem projeto'}</p>
                    {it.status === 'Bloqueado' && (it.dependencyNote || it.predecessorId) && (
                      <p style={{ color: 'var(--red)', fontSize: 11 }}>⛓ {it.dependencyNote || `aguarda ${it.predecessorId}`}</p>
                    )}
                    <div className="progress-line"><i style={{ width: `${clamp(Number(it.progress ?? 0), 0, 100)}%` }} /></div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                      <small>{dateFmt(it.dueDate)} · {it.owner || 'Sem responsável'}</small>
                      {rs
                        ? <span className={`score-chip ${riskBandTone(rs.band)}`}>{rs.score}</span>
                        : <Badge label={it.priority ?? 'Média'} tone={priorityTone(it.priority ?? 'Média')} />}
                    </div>
                  </article>
                )
              })}
            </div>
          )
        })}
      </div>
    </>
  )
}

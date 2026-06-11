'use client'

import React, { useState } from 'react'
import {
  Item,
  riskOf,
  productTone,
  riskTone,
  statusTone,
  dateFmt,
  relativeDateText,
  monthLabel,
  daysToDue,
  isDone,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface TimelineViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
}

function Row({ it, onEdit }: { it: Item; onEdit: (id: string) => void }) {
  return (
    <div className="timeline-item">
      <div>
        <strong>{dateFmt(it.dueDate)}</strong>
        <br /><small>{relativeDateText(it.dueDate)}</small>
      </div>
      <div>
        <div className="task-meta">
          <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
          <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
          <Badge label={it.status} tone={statusTone(it.status)} />
        </div>
        <strong style={{ display: 'block', marginTop: 4 }}>{it.project ?? 'Sem projeto'}</strong>
        <span style={{ color: 'var(--muted)' }}>{it.demand ?? 'Sem demanda'}</span>
      </div>
      <button className="btn small" onClick={() => onEdit(it.id)}>Editar</button>
    </div>
  )
}

export function TimelineView({ filtered, onEdit }: TimelineViewProps) {
  const [showDone, setShowDone] = useState(false)

  // Default: só itens abertos (concluído sai do radar). Toggle mostra o histórico.
  const visible = filtered.filter(it => showDone || !isDone(it))
  const overdue = visible
    .filter(it => !isDone(it) && (daysToDue(it.dueDate) ?? 1) < 0)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const upcoming = visible
    .filter(it => !overdue.includes(it))
    .sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))

  const groups = upcoming.reduce<Record<string, Item[]>>((acc, it) => {
    const k = monthLabel(it.dueDate); (acc[k] ??= []).push(it); return acc
  }, {})

  return (
    <>
      <div className="section-head">
        <h2>Timeline</h2>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
          Mostrar concluídos
        </label>
      </div>
      <div className="timeline">
        {overdue.length > 0 && (
          <article className="card timeline-month" style={{ borderColor: '#f0c5cb', background: 'var(--surface-red)' }}>
            <h3>Vencidos e abertos <Badge label={String(overdue.length)} tone="tone-red" /></h3>
            {overdue.map(it => <Row key={it.id} it={it} onEdit={onEdit} />)}
          </article>
        )}
        {Object.entries(groups).map(([month, rows]) => (
          <article key={month} className="card timeline-month">
            <h3>{month} <Badge label={String(rows.length)} /></h3>
            {rows.map(it => <Row key={it.id} it={it} onEdit={onEdit} />)}
          </article>
        ))}
        {overdue.length === 0 && Object.keys(groups).length === 0 && (
          <div className="empty">Sem itens abertos na timeline. {`Ative "Mostrar concluídos" para ver o histórico.`}</div>
        )}
      </div>
    </>
  )
}

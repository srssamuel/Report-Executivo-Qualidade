'use client'

import React from 'react'
import {
  Item,
  riskOf,
  productTone,
  riskTone,
  statusTone,
  dateFmt,
  relativeDateText,
  monthLabel,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface TimelineViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
}

export function TimelineView({ filtered, onEdit }: TimelineViewProps) {
  const sorted = [...filtered].sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))
  const groups = sorted.reduce<Record<string, Item[]>>((acc, it) => {
    const k = monthLabel(it.dueDate);
    (acc[k] ??= []).push(it)
    return acc
  }, {})

  if (Object.keys(groups).length === 0) return <div className="empty">Sem itens na timeline.</div>

  return (
    <div className="timeline">
      {Object.entries(groups).map(([month, rows]) => (
        <article key={month} className="card timeline-month">
          <h3>{month} <Badge label={String(rows.length)} /></h3>
          {rows.map(it => (
            <div key={it.id} className="timeline-item">
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
          ))}
        </article>
      ))}
    </div>
  )
}

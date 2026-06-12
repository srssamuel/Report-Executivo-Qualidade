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
  ownersOf,
  itemStart,
  parseDate,
  isoDate,
  addDays,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

/* Cores das barras por risco (SVG/inline não lê var()). */
const LANE_COLOR = (it: Item): string => {
  const r = riskOf(it)
  if (['Bloqueado', 'Atrasado'].includes(r)) return '#bd2f3d'
  if (['Vence hoje', 'Atenção 7 dias'].includes(r)) return '#8f5200'
  return '#1e60d5'
}

const ZOOMS = [
  { key: '30', label: 'Mês', days: 30 },
  { key: '90', label: 'Trimestre', days: 90 },
  { key: '180', label: 'Semestre', days: 180 },
] as const

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
  const [mode, setMode] = useState<'pessoa' | 'mes'>('pessoa')
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]['days']>(90)

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

  /* ── Raias por pessoa (redesign §5): o que cada um tem pela frente ── */
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const windowStart = addDays(today, -7)
  const windowEnd = addDays(today, zoom)
  const windowMs = windowEnd.getTime() - windowStart.getTime()
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - windowStart.getTime()) / windowMs) * 100))
  const todayPos = pos(today)

  const lanes: Record<string, { it: Item; start: Date; end: Date; collides: boolean }[]> = {}
  visible.filter(it => !isDone(it)).forEach(it => {
    const start = parseDate(itemStart(it)) ?? today
    const end = parseDate(it.dueDate) ?? addDays(start, 7)
    if (end.getTime() < windowStart.getTime() || start.getTime() > windowEnd.getTime()) return
    const owners = ownersOf(it.owner)
    const targets = owners.length ? owners : ['Sem responsável']
    targets.forEach(o => { (lanes[o] ??= []).push({ it, start, end, collides: false }) })
  })
  Object.values(lanes).forEach(rows => {
    rows.sort((a, b) => a.start.getTime() - b.start.getTime())
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].start.getTime() < rows[i - 1].end.getTime()) {
        rows[i].collides = true
        rows[i - 1].collides = true
      }
    }
  })
  const laneEntries = Object.entries(lanes).sort((a, b) => b[1].length - a[1].length)

  return (
    <>
      <div className="section-head">
        <h2>Timeline</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`btn small ${mode === 'pessoa' ? 'dark' : 'ghost'}`} onClick={() => setMode('pessoa')}>Por pessoa</button>
          <button className={`btn small ${mode === 'mes' ? 'dark' : 'ghost'}`} onClick={() => setMode('mes')}>Por mês</button>
          {mode === 'pessoa' && ZOOMS.map(z => (
            <button key={z.key} className={`btn small ${zoom === z.days ? '' : 'ghost'}`} onClick={() => setZoom(z.days)}>{z.label}</button>
          ))}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} />
            Mostrar concluídos
          </label>
        </div>
      </div>

      {mode === 'pessoa' && (
        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <div className="card">
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', padding: '8px 14px' }}>
              <span>{dateFmt(isoDate(windowStart))}</span>
              <span style={{ fontWeight: 700, color: '#bd2f3d' }}>hoje</span>
              <span>{dateFmt(isoDate(windowEnd))}</span>
            </div>
          </div>
          {laneEntries.length === 0 ? (
            <div className="empty">Nenhum item aberto com datas dentro da janela — amplie o zoom.</div>
          ) : (
            laneEntries.map(([owner, rows]) => (
              <div key={owner} className="card">
                <div className="card-head">
                  <h3 className="card-title">{owner}</h3>
                  <Badge label={`${rows.length} frente(s)`} tone={rows.some(r => r.collides) ? 'tone-amber' : undefined} />
                </div>
                <div className="card-body" style={{ display: 'grid', gap: 6 }}>
                  {rows.map(({ it, start, end, collides }) => {
                    const left = pos(start)
                    const width = Math.max(2, pos(end) - left)
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => onEdit(it.id)}
                        title={`${it.project ?? it.id} — ${dateFmt(isoDate(start))} → ${dateFmt(it.dueDate)}${collides ? ' · COLIDE com outra frente desta pessoa' : ''}${it.predecessorId ? ` · aguarda ${it.predecessorId}` : ''}`}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 10, alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                      >
                        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {it.predecessorId && <span title={`Aguarda ${it.predecessorId}`} aria-hidden="true">⛓ </span>}
                          <strong>{it.project ?? it.id}</strong>
                          <span style={{ color: 'var(--muted)' }}> · {dateFmt(it.dueDate)}</span>
                        </span>
                        <span style={{ position: 'relative', height: 14, background: 'var(--line, #e5e9f0)', borderRadius: 7, overflow: 'hidden', display: 'block' }}>
                          <span style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: `${left}%`, width: `${width}%`,
                            background: LANE_COLOR(it), opacity: 0.85, borderRadius: 7,
                            outline: collides ? '2px solid #8f5200' : 'none',
                          }} />
                          <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPos}%`, width: 2, background: '#bd2f3d' }} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mode === 'mes' && (<>
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
      </>)}
    </>
  )
}

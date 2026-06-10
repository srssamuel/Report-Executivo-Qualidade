'use client'

import { useState } from 'react'
import type { Item } from '@/lib/domain'
import {
  isDone, dateFmt, relativeDateText, daysToDue, statusTone, riskScore, riskBandTone,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

type QuickFilter = 'todos' | 'criticos' | 'atrasados' | 'semAcao'

function initials(owner?: string): string {
  const parts = String(owner ?? '').trim().split(/\s+/)
  if (!parts[0]) return '—'
  return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function PortfolioView({ filtered, allItems, onEdit }: {
  filtered: Item[]; allItems: Item[]; onEdit: (id: string) => void
}) {
  const [quick, setQuick] = useState<QuickFilter>('todos')

  const scored = filtered.map(it => ({ it, rs: riskScore(it, allItems) }))
  const criticos = scored.filter(x => x.rs?.band === 'Crítico').length
  const atrasados = scored.filter(x => (daysToDue(x.it.dueDate) ?? 1) < 0 && !isDone(x.it)).length
  const semAcao = scored.filter(x => !isDone(x.it) && !x.it.nextAction).length

  const rows = scored.filter(x => {
    if (quick === 'criticos') return x.rs?.band === 'Crítico'
    if (quick === 'atrasados') return (daysToDue(x.it.dueDate) ?? 1) < 0 && !isDone(x.it)
    if (quick === 'semAcao') return !isDone(x.it) && !x.it.nextAction
    return true
  })

  return (
    <>
      <div className="section-head">
        <h2>Carteira de projetos</h2>
        <Badge label={`${rows.length} frentes`} />
      </div>
      <div className="chip-row">
        <button className={`chip ${quick === 'todos' ? 'active' : ''}`} onClick={() => setQuick('todos')}>Todos</button>
        <button className={`chip red ${quick === 'criticos' ? 'active' : ''}`} onClick={() => setQuick('criticos')}>Críticos {criticos}</button>
        <button className={`chip amber ${quick === 'atrasados' ? 'active' : ''}`} onClick={() => setQuick('atrasados')}>Atrasados {atrasados}</button>
        <button className={`chip ${quick === 'semAcao' ? 'active' : ''}`} onClick={() => setQuick('semAcao')}>Sem próx. ação {semAcao}</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Demanda</th><th>Resp.</th><th>Prazo</th><th>Status</th><th>Progresso</th><th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><div className="empty">Nenhum item no filtro atual.</div></td></tr>
            ) : rows.map(({ it, rs }) => {
              const overdue = (daysToDue(it.dueDate) ?? 1) < 0 && !isDone(it)
              return (
                <tr key={it.id} className="portfolio-row" onClick={() => onEdit(it.id)}>
                  <td className="cell-demand">
                    <strong>{it.demand || 'Sem demanda'}</strong>
                    <small>{[it.product, it.project].filter(Boolean).join(' · ') || 'Sem projeto'}</small>
                  </td>
                  <td><span className="owner-avatar" title={it.owner || 'Sem responsável'}>{initials(it.owner)}</span></td>
                  <td style={{ whiteSpace: 'nowrap', color: overdue ? 'var(--red)' : undefined, fontWeight: overdue ? 700 : undefined }}>
                    {dateFmt(it.dueDate)}
                    <div style={{ fontSize: 11, color: '#5f7188', fontWeight: 400 }}>{relativeDateText(it.dueDate)}</div>
                  </td>
                  <td><Badge label={it.status} tone={statusTone(it.status)} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="progress-line" style={{ width: 64 }}><i style={{ width: `${it.progress ?? 0}%` }} /></div>
                      <span style={{ fontSize: 11 }}>{it.progress ?? 0}%</span>
                    </div>
                  </td>
                  <td>
                    {rs
                      ? <span className={`score-chip ${riskBandTone(rs.band)}`}>{rs.score} {rs.band}</span>
                      : <span className="score-chip tone-green">Concluído</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

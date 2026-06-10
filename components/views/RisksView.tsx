'use client'

import { useState } from 'react'
import type { Item, RiskScoreResult } from '@/lib/domain'
import {
  isDone, dateFmt, statusTone, productTone, riskScore, riskBandTone, dataGaps,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

export default function RisksView({ filtered, allItems, onEdit }: {
  filtered: Item[]; allItems: Item[]; onEdit: (id: string) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const queue = filtered
    .filter(it => !isDone(it) && !it.archived)
    .map(it => ({ it, rs: riskScore(it, allItems) }))
    .filter((x): x is { it: Item; rs: RiskScoreResult } => x.rs !== null)
    .sort((a, b) => b.rs.score - a.rs.score)

  const bands = {
    Crítico: queue.filter(x => x.rs.band === 'Crítico').length,
    Alto: queue.filter(x => x.rs.band === 'Alto').length,
    Médio: queue.filter(x => x.rs.band === 'Médio').length,
    Baixo: queue.filter(x => x.rs.band === 'Baixo').length,
  }

  return (
    <>
      <div className="section-head">
        <h2>Fila de riscos</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <Badge label={`Crítico ${bands['Crítico']}`} tone="tone-red" />
          <Badge label={`Alto ${bands['Alto']}`} tone="tone-amber" />
          <Badge label={`Médio ${bands['Médio']}`} tone="tone-gray" />
          <Badge label={`Baixo ${bands['Baixo']}`} tone="tone-green" />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {queue.length === 0 && <div className="empty">Nenhum item aberto no filtro atual.</div>}
        {queue.map(({ it, rs }) => (
          <div key={it.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(e => (e === it.id ? null : it.id))}>
              <span className={`score-chip ${riskBandTone(rs.band)}`}>{rs.score} {rs.band}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: 'block' }}>{it.demand || it.project || it.id}</strong>
                <small style={{ color: '#5f7188' }}>{rs.mainReason} · {it.owner || 'Sem responsável'} · prazo {dateFmt(it.dueDate)}</small>
              </div>
              <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
              <Badge label={it.status} tone={statusTone(it.status)} />
              <button className="btn small" onClick={e => { e.stopPropagation(); onEdit(it.id) }}>Abrir</button>
            </div>
            {expanded === it.id && (
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {rs.factors.map(f => (
                  <div key={f.key} className={`score-factor ${f.raw >= 70 ? 'alto' : f.raw >= 35 ? 'medio' : ''}`}>
                    <span>{f.label} — {f.detail} <em style={{ float: 'right' }}>{Math.round(f.contribution)} pts</em></span>
                    <div className="factor-track"><i style={{ width: `${f.raw}%` }} /></div>
                  </div>
                ))}
                {dataGaps(it).length > 0 && (
                  <small style={{ color: 'var(--amber)' }}>Lacunas: {dataGaps(it).join(', ')}</small>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

'use client'

import type { Item } from '@/lib/domain'
import {
  riskOf, dateFmt, clamp, scoreOf,
  productTone, riskTone, priorityTone,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

export default function BoardView({ filtered, onEdit }: { filtered: Item[]; onEdit: (id: string) => void }) {
  const LANES = ['A iniciar','Em andamento','Em validação','Bloqueado','Atrasado','Pausado','Concluído','Entregue','Sem status']
  return (
    <div className="board">
      {LANES.map(status => {
        const rows = filtered.filter(it => it.status === status)
        if (!rows.length && !['A iniciar','Em andamento','Em validação','Bloqueado','Atrasado','Concluído','Entregue'].includes(status)) return null
        return (
          <div key={status} className="lane">
            <div className="lane-head">
              <h3>{status}</h3>
              <Badge label={String(rows.length)} />
            </div>
            {rows.length === 0 ? <div className="empty" style={{ padding: 18 }}>Sem itens</div> : rows.map(it => (
              <article key={it.id} className="task-card">
                <div className="task-meta">
                  <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                  <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                  <Badge label={it.priority ?? 'Média'} tone={priorityTone(it.priority ?? 'Média')} />
                </div>
                <h4>{it.project ?? 'Sem projeto'}</h4>
                <p>{it.demand ?? it.definition ?? 'Sem demanda'}</p>
                <div><small>{dateFmt(it.dueDate)} · {it.owner ?? 'Sem responsável'}</small></div>
                <div className="progress-line"><i style={{ width: `${clamp(Number(it.progress ?? 0), 0, 100)}%` }} /></div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                  <small>Score {scoreOf(it)}%</small>
                  <button className="btn small" onClick={() => onEdit(it.id)}>Editar</button>
                </div>
              </article>
            ))}
          </div>
        )
      })}
    </div>
  )
}

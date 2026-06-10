'use client'

import type { Item } from '@/lib/domain'
import {
  dateFmt, relativeDateText, riskOf, scoreOf,
  productTone, riskTone, statusTone, priorityTone, STATUSES,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

export default function PortfolioView({ filtered, onEdit, canEdit, onFieldChange }: {
  filtered: Item[]; onEdit: (id: string) => void; canEdit: boolean; onFieldChange: (id: string, field: keyof Item, value: unknown) => void
}) {
  return (
    <>
      <div className="section-head">
        <h2>Carteira de projetos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge label={`${filtered.length} frentes`} />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Produto</th><th>Projeto</th><th>Demanda</th>
              <th>Prazo</th><th>Responsável</th><th>Status</th><th>Prioridade</th>
              <th>Progresso</th><th>Risco</th><th>Score</th><th>Próxima ação</th>
              <th>Definição</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={14}><div className="empty">Nenhum item no filtro atual.</div></td></tr>
            ) : filtered.map(it => (
              <tr key={it.id}>
                <td style={{ fontWeight: 700 }}>{it.id}</td>
                <td><Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} /></td>
                <td className="row-title">{canEdit
                  ? <input className="mini-input row-title" defaultValue={it.project ?? ''} onBlur={e => onFieldChange(it.id, 'project', e.target.value)} />
                  : it.project}
                </td>
                <td style={{ minWidth: 200 }}>{canEdit
                  ? <input className="mini-input" defaultValue={it.demand ?? ''} onBlur={e => onFieldChange(it.id, 'demand', e.target.value)} style={{ minWidth: 200 }} />
                  : it.demand}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canEdit
                    ? <input type="date" className="mini-input" defaultValue={it.dueDate ?? ''} onBlur={e => onFieldChange(it.id, 'dueDate', e.target.value)} style={{ minWidth: 130 }} />
                    : dateFmt(it.dueDate)
                  }
                  <div style={{ fontSize: 11, color: '#5f7188', marginTop: 2 }}>{relativeDateText(it.dueDate)}</div>
                </td>
                <td>{canEdit
                  ? <input className="mini-input" defaultValue={it.owner ?? ''} onBlur={e => onFieldChange(it.id, 'owner', e.target.value)} />
                  : it.owner}
                </td>
                <td>
                  {canEdit
                    ? <select className="mini-select" value={it.status} onChange={e => onFieldChange(it.id, 'status', e.target.value)}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    : <Badge label={it.status} tone={statusTone(it.status)} />
                  }
                </td>
                <td><Badge label={it.priority ?? 'Média'} tone={priorityTone(it.priority ?? 'Média')} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="progress-line" style={{ width: 64 }}><i style={{ width: `${it.progress ?? 0}%` }} /></div>
                    <span style={{ fontSize: 11 }}>{it.progress ?? 0}%</span>
                  </div>
                </td>
                <td><Badge label={riskOf(it)} tone={riskTone(riskOf(it))} /></td>
                <td style={{ textAlign: 'center', fontWeight: 800, color: '#123e7c' }}>{scoreOf(it)}%</td>
                <td style={{ minWidth: 180 }}>{canEdit
                  ? <textarea className="mini-textarea" defaultValue={it.nextAction ?? ''} onBlur={e => onFieldChange(it.id, 'nextAction', e.target.value)} style={{ minWidth: 180 }} />
                  : it.nextAction}
                </td>
                <td style={{ minWidth: 200 }}>{canEdit
                  ? <textarea className="mini-textarea" defaultValue={it.definition ?? ''} onBlur={e => onFieldChange(it.id, 'definition', e.target.value)} style={{ minWidth: 200 }} />
                  : it.definition}
                </td>
                <td className="row-actions">
                  <button className="btn small" onClick={() => onEdit(it.id)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

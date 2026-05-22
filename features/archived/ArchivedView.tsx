'use client'

import React from 'react'
import { Item, productTone, statusTone } from '@/shared/domain'
import { Badge } from '@/shared/components'

interface ArchivedViewProps {
  items: Item[]
  onEdit: (id: string) => void
  onRestore: (id: string) => void
  canEdit: boolean
}

export function ArchivedView({ items, onEdit, onRestore, canEdit }: ArchivedViewProps) {
  const archived = items.filter(i => i.archived)
  return (
    <>
      <div className="section-head">
        <h2>Itens arquivados</h2>
        <Badge label={`${archived.length} itens`} tone="tone-gray" />
      </div>
      {archived.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty">
              Nenhum item arquivado. Itens arquivados podem ser restaurados aqui.
            </div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Produto</th>
                <th>Projeto</th>
                <th>Demanda</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Última atualização</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {archived.map(it => (
                <tr key={it.id} className="archived-row">
                  <td className="row-title">{it.id}</td>
                  <td><Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} /></td>
                  <td>{it.project ?? '—'}</td>
                  <td>{it.demand ?? '—'}</td>
                  <td><Badge label={it.status} tone={statusTone(it.status)} /></td>
                  <td>{it.owner ?? '—'}</td>
                  <td className="gain-timestamp">
                    {it.lastUpdate ? new Date(it.lastUpdate).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="row-actions">
                    <button className="btn small" onClick={() => onEdit(it.id)}>Ver</button>
                    {canEdit && <button className="btn small primary" onClick={() => onRestore(it.id)}>Restaurar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

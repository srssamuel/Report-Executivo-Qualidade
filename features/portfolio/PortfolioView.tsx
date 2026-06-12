'use client'

import React, { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import {
  Item,
  productTone,
  statusTone,
  priorityTone,
  riskTone,
  riskOf,
  scoreOf,
  dateFmt,
  relativeDateText,
  itemEffort,
  itemRemainingEffort,
  itemTeamSize,
  clamp,
  STATUSES,
  PRIORITIES
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface PortfolioViewProps {
  filtered: Item[]
  onEdit: (id: string) => void
  onQuickComment: (id: string) => void
  canEdit: boolean
  onFieldChange: (id: string, field: keyof Item, value: unknown) => void
  allItems: Item[]
  productOptions: string[]
}

export function PortfolioView({
  filtered,
  onEdit,
  onQuickComment,
  canEdit,
  onFieldChange,
  allItems,
  productOptions,
}: PortfolioViewProps) {
  const [textExpanded, setTextExpanded] = useState(false)
  const textareaStyle: React.CSSProperties = textExpanded
    ? { minHeight: 128, minWidth: 180 }
    : { minHeight: 56, minWidth: 180 }

  /* ── Click-to-edit: a célula mostra TEXTO limpo; vira input só ao clicar.
        (era um formulário permanente de ~600 campos — a causa da poluição) ── */
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const closeCell = () => setEditingCell(null)
  function CellDisplay({ k, label, children, empty = '—' }: {
    k: string
    label: string
    children: React.ReactNode
    empty?: string
  }) {
    const hasContent = children !== null && children !== undefined && children !== ''
    return (
      <button
        type="button"
        className="cell-display"
        aria-label={label}
        title="Clique para editar"
        onClick={() => setEditingCell(k)}
      >
        {hasContent ? children : <span style={{ color: 'var(--muted-2)' }}>{empty}</span>}
      </button>
    )
  }

  /* Borda esquerda da linha na cor do risco — leitura periférica. */
  const rowAccent = (it: Item): string => {
    const r = riskOf(it)
    if (['Bloqueado', 'Atrasado'].includes(r)) return 'inset 3px 0 0 #bd2f3d'
    if (['Vence hoje', 'Atenção 7 dias'].includes(r)) return 'inset 3px 0 0 #8f5200'
    return 'none'
  }

  return (
    <>
      <div className="section-head">
        <h2>Carteira de projetos</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge label={`${filtered.length} frentes`} />
          <button className="btn small ghost" onClick={() => setTextExpanded(e => !e)}>
            {textExpanded ? '▾ Compactar textos' : '▸ Expandir textos'}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Produto</th>
              <th>Projeto</th>
              <th>Demanda</th>
              <th>Início</th>
              <th>Prazo</th>
              <th>Capacidade</th>
              <th>Predecessor</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Progresso</th>
              <th>Risco</th>
              <th>Score</th>
              <th>Próxima ação</th>
              <th>Coment. executivo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={17}>
                  <div className="empty">Nenhum item no filtro atual.</div>
                </td>
              </tr>
            ) : (
              filtered.map(it => (
                <tr key={it.id} style={{ boxShadow: rowAccent(it) }}>
                  {/* ID */}
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{it.id}</td>

                  {/* Produto */}
                  <td style={{ minWidth: 110 }}>
                    {canEdit && editingCell === `${it.id}:product` ? (
                      <>
                        <input
                          autoFocus
                          className="mini-input"
                          list="portfolioProductOpts"
                          aria-label={`Produto de ${it.id}`}
                          defaultValue={it.product ?? ''}
                          onBlur={e => { onFieldChange(it.id, 'product', e.target.value.trim()); closeCell() }}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') closeCell() }}
                          style={{ minWidth: 100 }}
                        />
                        <datalist id="portfolioProductOpts">
                          {productOptions.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </>
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:product`} label={`Editar produto de ${it.id}`}>
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                      </CellDisplay>
                    ) : (
                      <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                    )}
                  </td>

                  {/* Projeto */}
                  <td className="row-title" style={{ minWidth: 140 }}>
                    {canEdit && editingCell === `${it.id}:project` ? (
                      <input
                        autoFocus
                        className="mini-input"
                        aria-label={`Projeto de ${it.id}`}
                        defaultValue={it.project ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'project', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') closeCell() }}
                        style={{ minWidth: 130 }}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:project`} label={`Editar projeto de ${it.id}`}>
                        <strong>{it.project}</strong>
                      </CellDisplay>
                    ) : (
                      it.project
                    )}
                  </td>

                  {/* Demanda */}
                  <td style={{ minWidth: 200 }}>
                    {canEdit && editingCell === `${it.id}:demand` ? (
                      <textarea
                        autoFocus
                        className="mini-textarea"
                        aria-label={`Demanda de ${it.id}`}
                        defaultValue={it.demand ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'demand', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Escape') closeCell() }}
                        style={textareaStyle}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:demand`} label={`Editar demanda de ${it.id}`}>
                        <span className={textExpanded ? '' : 'cell-clamp'}>{it.demand}</span>
                      </CellDisplay>
                    ) : (
                      it.demand
                    )}
                  </td>

                  {/* Início */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canEdit && editingCell === `${it.id}:startDate` ? (
                      <input
                        autoFocus
                        type="date"
                        className="mini-input"
                        aria-label={`Início de ${it.id}`}
                        defaultValue={it.startDate ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'startDate', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') closeCell() }}
                        style={{ minWidth: 130 }}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:startDate`} label={`Editar início de ${it.id}`}>
                        {it.startDate ? dateFmt(it.startDate) : ''}
                      </CellDisplay>
                    ) : (
                      it.startDate ? dateFmt(it.startDate) : '—'
                    )}
                  </td>

                  {/* Prazo */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {canEdit && editingCell === `${it.id}:dueDate` ? (
                      <input
                        autoFocus
                        type="date"
                        className="mini-input"
                        aria-label={`Prazo de ${it.id}`}
                        defaultValue={it.dueDate ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'dueDate', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') closeCell() }}
                        style={{ minWidth: 130 }}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:dueDate`} label={`Editar prazo de ${it.id}`}>
                        {it.dueDate ? dateFmt(it.dueDate) : ''}
                      </CellDisplay>
                    ) : (
                      dateFmt(it.dueDate)
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {relativeDateText(it.dueDate)}
                    </div>
                  </td>

                  {/* Capacidade */}
                  <td style={{ minWidth: 120 }}>
                    {canEdit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="number"
                            className="mini-input"
                            min={0}
                            aria-label={`Esforço em horas de ${it.id}`}
                            defaultValue={it.effortHours ?? ''}
                            placeholder="h"
                            onBlur={e => onFieldChange(it.id, 'effortHours', Number(e.target.value) || 0)}
                            style={{ width: 50 }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>h</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="number"
                            className="mini-input"
                            min={1}
                            aria-label={`Tamanho da equipe de ${it.id}`}
                            defaultValue={it.teamSize ?? 1}
                            placeholder="eq"
                            onBlur={e => onFieldChange(it.id, 'teamSize', Number(e.target.value) || 1)}
                            style={{ width: 50 }}
                          />
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>eq</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                          Restante: {itemRemainingEffort(it)}h
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12 }}>
                        {itemEffort(it)}h · {itemTeamSize(it)} eq<br />
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                          Restante: {itemRemainingEffort(it)}h
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Predecessor */}
                  <td style={{ minWidth: 140 }}>
                    {canEdit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <select
                          className="mini-select"
                          aria-label={`Predecessor de ${it.id}`}
                          value={it.predecessorId ?? ''}
                          onChange={e => onFieldChange(it.id, 'predecessorId', e.target.value)}
                        >
                          <option value="">Sem predecessor</option>
                          {allItems
                            .filter(x => x.id !== it.id && !x.archived)
                            .map(x => (
                              <option key={x.id} value={x.id}>
                                {x.id} · {x.project ?? ''}
                              </option>
                            ))}
                        </select>
                        {editingCell === `${it.id}:depnote` ? (
                          <textarea
                            autoFocus
                            className="mini-textarea"
                            aria-label={`Nota de dependência de ${it.id}`}
                            defaultValue={it.dependencyNote ?? ''}
                            placeholder="Nota de dependência…"
                            onBlur={e => { onFieldChange(it.id, 'dependencyNote', e.target.value); closeCell() }}
                            onKeyDown={e => { if (e.key === 'Escape') closeCell() }}
                            style={{ minHeight: 36, minWidth: 130 }}
                          />
                        ) : (
                          <CellDisplay k={`${it.id}:depnote`} label={`Editar nota de dependência de ${it.id}`} empty="+ nota">
                            <span className="cell-clamp" style={{ fontSize: 11 }}>{it.dependencyNote}</span>
                          </CellDisplay>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12 }}>
                        {it.predecessorId ? <span style={{ fontWeight: 600 }}>{it.predecessorId}</span> : '—'}
                        {it.dependencyNote && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {it.dependencyNote}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Responsável */}
                  <td style={{ minWidth: 120 }}>
                    {canEdit && editingCell === `${it.id}:owner` ? (
                      <input
                        autoFocus
                        className="mini-input"
                        aria-label={`Responsável de ${it.id}`}
                        defaultValue={it.owner ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'owner', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') closeCell() }}
                        style={{ minWidth: 110 }}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:owner`} label={`Editar responsável de ${it.id}`}>
                        {it.owner}
                      </CellDisplay>
                    ) : (
                      it.owner
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    {canEdit ? (
                      <select
                        className="mini-select"
                        aria-label={`Status de ${it.id}`}
                        value={it.status}
                        onChange={e => onFieldChange(it.id, 'status', e.target.value)}
                      >
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : (
                      <Badge label={it.status} tone={statusTone(it.status)} />
                    )}
                  </td>

                  {/* Prioridade */}
                  <td>
                    {canEdit ? (
                      <select
                        className="mini-select"
                        aria-label={`Prioridade de ${it.id}`}
                        value={it.priority ?? 'Média'}
                        onChange={e => onFieldChange(it.id, 'priority', e.target.value)}
                      >
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    ) : (
                      <Badge label={it.priority ?? 'Média'} tone={priorityTone(it.priority ?? 'Média')} />
                    )}
                  </td>

                  {/* Progresso */}
                  <td style={{ minWidth: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {canEdit ? (
                        <input
                          type="number"
                          className="mini-input"
                          min={0}
                          max={100}
                          aria-label={`Progresso de ${it.id}`}
                          defaultValue={it.progress ?? 0}
                          onBlur={e => onFieldChange(it.id, 'progress', clamp(Number(e.target.value), 0, 100))}
                          style={{ width: 48 }}
                        />
                      ) : (
                        <span style={{ fontSize: 11 }}>{it.progress ?? 0}%</span>
                      )}
                      <div className="progress-line" style={{ width: 50 }}>
                        <i style={{ width: `${it.progress ?? 0}%` }} />
                      </div>
                    </div>
                  </td>

                  {/* Risco */}
                  <td>
                    <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                  </td>

                  {/* Score */}
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#123e7c' }}>
                    {scoreOf(it)}%
                  </td>

                  {/* Próxima ação */}
                  <td>
                    {canEdit && editingCell === `${it.id}:nextAction` ? (
                      <textarea
                        autoFocus
                        className="mini-textarea"
                        aria-label={`Próxima ação de ${it.id}`}
                        defaultValue={it.nextAction ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'nextAction', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Escape') closeCell() }}
                        style={textareaStyle}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:nextAction`} label={`Editar próxima ação de ${it.id}`} empty="+ ação">
                        <span className={textExpanded ? '' : 'cell-clamp'}>{it.nextAction}</span>
                      </CellDisplay>
                    ) : (
                      it.nextAction
                    )}
                  </td>

                  {/* Comentário executivo */}
                  <td>
                    {canEdit && editingCell === `${it.id}:execComment` ? (
                      <textarea
                        autoFocus
                        className="mini-textarea"
                        aria-label={`Comentário executivo de ${it.id}`}
                        defaultValue={it.executiveComment ?? ''}
                        onBlur={e => { onFieldChange(it.id, 'executiveComment', e.target.value); closeCell() }}
                        onKeyDown={e => { if (e.key === 'Escape') closeCell() }}
                        style={textareaStyle}
                      />
                    ) : canEdit ? (
                      <CellDisplay k={`${it.id}:execComment`} label={`Editar comentário executivo de ${it.id}`} empty="+ comentário">
                        <span className={textExpanded ? '' : 'cell-clamp'}>{it.executiveComment}</span>
                      </CellDisplay>
                    ) : (
                      it.executiveComment
                    )}
                  </td>

                  {/* Ações */}
                  <td className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small" onClick={() => onEdit(it.id)}>Abrir</button>
                    <button
                      className="btn small"
                      aria-label={`Comentários de ${it.id}`}
                      title="Comentários"
                      onClick={() => onQuickComment(it.id)}
                      style={{ marginLeft: 4 }}
                    >
                      <MessageSquare size={12} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

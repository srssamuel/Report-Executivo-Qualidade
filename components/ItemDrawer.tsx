'use client'

import { useEffect } from 'react'
import type { Item, Person } from '@/lib/domain'
import {
  STATUSES, PRIORITIES, PRODUCT_SUGGESTIONS,
  riskScore, riskBandTone, statusTone, priorityTone, productTone, clamp, scoreOf,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

export type DrawerForm = Partial<Item> & {
  tagsRaw?: string
  commentText?: string
  commentAuthor?: string
  commentType?: string
}

interface ItemDrawerProps {
  openId: string | null | 'new'
  items: Item[]
  form: DrawerForm
  setForm: React.Dispatch<React.SetStateAction<DrawerForm>>
  canEdit: boolean
  canDelete: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onArchive: () => void
  onDuplicate: () => void
  onAddComment: () => void
  people: Person[]
  onCreatePerson: (name: string) => Promise<Person | null>
}

export default function ItemDrawer({
  openId, items, form, setForm, canEdit, canDelete,
  onSubmit, onClose, onArchive, onDuplicate, onAddComment,
  people, onCreatePerson,
}: ItemDrawerProps) {
  const isOpen = openId !== null
  const isNew = openId === 'new'
  const item = !isNew && openId ? items.find(x => x.id === openId) ?? null : null
  const score = item ? riskScore(item, items) : null

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  return (
    <div
      className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
      onClick={e => {
        if ((e.target as HTMLElement).classList.contains('drawer-backdrop')) onClose()
      }}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nova frente' : `Detalhe ${openId ?? ''}`}
      >
        {isOpen && (
          <>
            <div className="drawer-head">
              <div style={{ flex: 1 }}>
                {!isNew && <span className="drawer-id">{openId}</span>}
                <h2>{isNew ? 'Nova frente' : (item?.demand || item?.project || 'Editar frente')}</h2>
                {item && (
                  <div className="task-meta" style={{ marginTop: 6 }}>
                    <Badge label={item.product ?? 'Sem produto'} tone={productTone(item.product)} />
                    <Badge label={item.status} tone={statusTone(item.status)} />
                    <Badge label={item.priority ?? 'Média'} tone={priorityTone(item.priority ?? 'Média')} />
                    <Badge label={`Governança ${scoreOf(item)}%`} />
                  </div>
                )}
              </div>
              <button className="btn square" onClick={onClose} aria-label="Fechar">✕</button>
            </div>

            <div className="drawer-body">
              {score && (
                <div className={`score-panel banda-${score.band.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}`}>
                  <div className="score-headline">
                    <strong>{score.score}</strong>
                    <Badge label={score.band} tone={riskBandTone(score.band)} />
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{score.mainReason}</span>
                  </div>
                  {score.factors.map(f => (
                    <div key={f.key} className={`score-factor ${f.raw >= 70 ? 'alto' : f.raw >= 35 ? 'medio' : ''}`}>
                      <span>{f.label} — {f.detail}</span>
                      <div className="factor-track"><i style={{ width: `${f.raw}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={onSubmit} id="drawer-form">
                <div className="form-grid">
                  <label>Produto/cliente
                    <input list="productOptions" value={form.product ?? ''} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
                    <datalist id="productOptions">{PRODUCT_SUGGESTIONS.map(p => <option key={p} value={p} />)}</datalist>
                  </label>
                  <label>Projeto
                    <input value={form.project ?? ''} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
                  </label>
                  <label>Responsável
                    <select
                      value={form.ownerId ?? ''}
                      onChange={async e => {
                        if (e.target.value === '__new__') {
                          const name = prompt('Nome da nova pessoa:')
                          if (name) {
                            const p = await onCreatePerson(name)
                            if (p) setForm(f => ({ ...f, ownerId: p.id, owner: p.name }))
                            else setForm(f => ({ ...f }))
                          } else {
                            setForm(f => ({ ...f }))
                          }
                          return
                        }
                        const p = people.find(x => x.id === e.target.value)
                        setForm(f => ({ ...f, ownerId: p?.id ?? '', owner: p?.name ?? '' }))
                      }}
                    >
                      <option value="">Sem responsável</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="__new__">+ Nova pessoa…</option>
                    </select>
                    {!form.ownerId && form.owner ? <small style={{ color: 'var(--muted)' }}>Texto legado: {form.owner}</small> : null}
                  </label>
                  <label>Demanda
                    <input value={form.demand ?? ''} onChange={e => setForm(f => ({ ...f, demand: e.target.value }))} />
                  </label>
                  <label>Status
                    <select value={form.status ?? 'A iniciar'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>Prioridade
                    <select value={form.priority ?? 'Média'} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </label>
                  <label>Prazo
                    <input type="date" value={form.dueDate ?? ''} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </label>
                  <label>Início
                    <input type="date" value={form.startDate ?? ''} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </label>
                  <label>Progresso (%)
                    <input type="number" min={0} max={100} value={form.progress ?? 0} onChange={e => setForm(f => ({ ...f, progress: clamp(Number(e.target.value), 0, 100) }))} />
                  </label>
                  <label>Esforço (h)
                    <input type="number" min={0} value={form.effortHours ?? ''} onChange={e => setForm(f => ({ ...f, effortHours: Number(e.target.value) }))} />
                  </label>
                  <label>Equipe (pessoas)
                    <input type="number" min={1} value={form.teamSize ?? 1} onChange={e => setForm(f => ({ ...f, teamSize: Number(e.target.value) }))} />
                  </label>
                  <label>Tags (vírgula)
                    <input value={form.tagsRaw ?? ''} onChange={e => setForm(f => ({ ...f, tagsRaw: e.target.value }))} placeholder="IA/Dados, Consultoria…" />
                  </label>
                  <label className="full">Definição / escopo
                    <textarea rows={3} value={form.definition ?? ''} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} />
                  </label>
                  <label className="full">Próxima ação
                    <textarea rows={2} value={form.nextAction ?? ''} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} />
                  </label>
                  <label className="full">Comentário executivo
                    <textarea rows={2} value={form.executiveComment ?? ''} onChange={e => setForm(f => ({ ...f, executiveComment: e.target.value }))} />
                  </label>
                  <label>ID predecessora
                    <select value={form.predecessorId ?? ''} onChange={e => setForm(f => ({ ...f, predecessorId: e.target.value }))}>
                      <option value="">Sem predecessora</option>
                      {items.filter(x => x.id !== openId && !x.archived).map(x => (
                        <option key={x.id} value={x.id}>{x.id} · {x.project ?? ''} — {x.demand ?? ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="full">Nota de dependência
                    <input value={form.dependencyNote ?? ''} onChange={e => setForm(f => ({ ...f, dependencyNote: e.target.value }))} />
                  </label>
                </div>
              </form>

              {/* Comentários */}
              {!isNew && (
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Comentários</h3>
                  {canEdit && (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input placeholder="Autor" value={form.commentAuthor ?? ''} onChange={e => setForm(f => ({ ...f, commentAuthor: e.target.value }))} />
                        <select value={form.commentType ?? 'Comentário'} onChange={e => setForm(f => ({ ...f, commentType: e.target.value }))}>
                          {['Comentário', 'Decisão', 'Risco', 'Atualização', 'Bloqueio'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <textarea rows={2} placeholder="Adicionar comentário…" value={form.commentText ?? ''} onChange={e => setForm(f => ({ ...f, commentText: e.target.value }))} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn small primary" type="button" onClick={onAddComment}>Registrar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="drawer-foot">
              {!isNew && canEdit && <button type="button" className="btn" onClick={onDuplicate}>Duplicar</button>}
              {!isNew && canDelete && <button type="button" className="btn danger" onClick={onArchive}>Arquivar</button>}
              <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
              {canEdit && <button type="submit" form="drawer-form" className="btn primary">Salvar</button>}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

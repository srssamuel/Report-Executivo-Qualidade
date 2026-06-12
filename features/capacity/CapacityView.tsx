'use client'

import React from 'react'
import {
  Item,
  isDone,
  itemRemainingEffort,
  itemStart,
  ownerLoad,
  ownersOf,
  capacityTone,
  productTone,
  riskOf,
  dateFmt,
  clamp,
  nextId,
  isoDate,
  parseDate,
  addDays,
  type Person,
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface CapacityViewProps {
  filtered: Item[]
  weeklyCapacity: number
  setWeeklyCapacity: (n: number) => void
  people: Person[]
  onUpdatePerson: (id: string, patch: { weeklyCapacityHours?: number; active?: boolean }) => void
  onCreatePerson: (name: string) => Promise<Person | null>
  canManage: boolean
  urgentForm: { product: string; title: string; owner: string; effort: number; dueDate: string; reason: string }
  setUrgentForm: React.Dispatch<React.SetStateAction<{ product: string; title: string; owner: string; effort: number; dueDate: string; reason: string }>>
  simulate: () => { it: Item; score: number; free: number; type: string }[]
  simulated: boolean
  setSimulated: (b: boolean) => void
  items: Item[]
  onEdit: (id: string) => void
  canEdit: boolean
  saveItem: (item: Item) => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<Item[]>>
  showToast: (msg: string) => void
}

export function CapacityView({
  filtered,
  weeklyCapacity,
  setWeeklyCapacity,
  people,
  onUpdatePerson,
  onCreatePerson,
  canManage,
  urgentForm,
  setUrgentForm,
  simulate,
  simulated,
  setSimulated,
  items,
  onEdit,
  canEdit,
  saveItem,
  setItems,
  showToast,
}: CapacityViewProps) {
  const activItems = filtered.filter(i => !isDone(i))
  const load = ownerLoad(activItems)
  const loadEntries = Object.entries(load).sort((a, b) => b[1] - a[1])
  const totalEffort = activItems.reduce((s, i) => s + itemRemainingEffort(i), 0)
  const deps = filtered.filter(i => i.predecessorId || i.dependencyNote)

  /* ── A foto do time (redesign §6) ────────────────────────────────── */
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim()
  const capOf = (owner: string) =>
    people.find(pp => norm(pp.name) === norm(owner))?.weeklyCapacityHours ?? (weeklyCapacity > 0 ? weeklyCapacity : 30)

  // Matriz Pessoa × Demandante: o esforço de cada pessoa quebrado por produto/cliente
  const demandMatrix: Record<string, Record<string, number>> = {}
  const demandTotals: Record<string, number> = {}
  activItems.forEach(it => {
    const owners = ownersOf(it.owner)
    const targets = owners.length ? owners : ['Sem responsável']
    const share = itemRemainingEffort(it) / targets.length
    const prod = it.product ?? 'Sem produto'
    demandTotals[prod] = (demandTotals[prod] ?? 0) + itemRemainingEffort(it)
    targets.forEach(o => {
      if (!demandMatrix[o]) demandMatrix[o] = {}
      demandMatrix[o][prod] = (demandMatrix[o][prod] ?? 0) + share
    })
  })
  const demandCols = Object.entries(demandTotals).sort((a, b) => b[1] - a[1]).map(([prd]) => prd)
  const demandMax = Math.max(1, ...Object.values(demandMatrix).flatMap(row => Object.values(row)))

  // Composição por tipo de rotina: as tags do item como taxonomia de atividade
  const typeLoad: Record<string, number> = {}
  activItems.forEach(it => {
    const tipo = it.tags.length ? it.tags[0] : 'Sem tipo'
    typeLoad[tipo] = (typeLoad[tipo] ?? 0) + itemRemainingEffort(it)
  })
  const typeEntries = Object.entries(typeLoad).sort((a, b) => b[1] - a[1])
  const typeMax = Math.max(1, ...typeEntries.map(([, h]) => h))

  // Semáforo de disponibilidade: quem pode receber demanda nova
  const availability = loadEntries
    .filter(([owner]) => owner !== 'Sem responsável')
    .map(([owner, h]) => {
      const cap = capOf(owner)
      const pct = Math.round((h / cap) * 100)
      const free = Math.max(0, Math.round(cap - h))
      return { owner, h, cap, pct, free }
    })
    .sort((a, b) => a.pct - b.pct)

  // Gantt
  const ganttRows = filtered.filter(i => i.dueDate || itemStart(i)).filter(i => !isDone(i)).slice(0, 60)
  const allDates = ganttRows.flatMap(i => [parseDate(itemStart(i)), parseDate(i.dueDate)]).filter(Boolean) as Date[]
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : null
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : null
  const totalDays = minDate && maxDate ? Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000) + 1) : 1

  const simResults = simulated ? simulate() : []
  const needed = urgentForm.effort
  const totalFree = simResults.reduce((s, x) => s + x.free, 0)
  const coverage = Math.min(100, Math.round((totalFree / needed) * 100))

  async function saveUrgent() {
    if (!urgentForm.title.trim()) {
      showToast('Informe a demanda urgente antes de salvar.')
      return
    }
    const payload = normalizeItemMock({
      id: nextId(items),
      product: urgentForm.product || 'Vivo',
      project: 'Demanda urgente',
      demand: urgentForm.title.trim(),
      definition: urgentForm.reason || 'Incluída pelo simulador de capacidade.',
      owner: urgentForm.owner,
      dueDate: urgentForm.dueDate,
      startDate: isoDate(new Date()),
      status: 'A iniciar',
      priority: 'Crítica',
      progress: 0,
      effortHours: urgentForm.effort,
      tags: ['Urgente', 'Capacidade'],
      archived: false,
    })
    setItems(prev => [payload, ...prev])
    await saveItem(payload)
    showToast('Demanda urgente salva na carteira.')
  }

  // Helper inside feature view to avoid circular import issues
  function normalizeItemMock(raw: Partial<Item>): Item {
    return {
      id: raw.id ?? '',
      dueDate: raw.dueDate ?? '',
      originalDate: raw.originalDate ?? '',
      project: raw.project ?? '',
      demand: raw.demand ?? '',
      definition: raw.definition ?? '',
      owner: raw.owner ?? '',
      status: raw.status ?? 'A iniciar',
      priority: raw.priority ?? 'Crítica',
      progress: raw.progress ?? 0,
      nextAction: raw.nextAction ?? '',
      executiveComment: raw.executiveComment ?? '',
      lastUpdate: raw.lastUpdate ?? new Date().toISOString(),
      tags: raw.tags ?? [],
      archived: raw.archived ?? false,
      sourceStatus: raw.sourceStatus ?? raw.status ?? 'A iniciar',
      product: raw.product ?? 'Vivo',
      effortHours: raw.effortHours,
      teamSize: raw.teamSize,
      predecessorId: raw.predecessorId ?? '',
      dependencyNote: raw.dependencyNote ?? '',
      startDate: raw.startDate ?? '',
      comments: raw.comments ?? [],
      history: raw.history ?? [],
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="grid three">
        <div className="impact-box"><span>Esforço restante</span><strong>{Math.round(totalEffort)}h</strong></div>
        <div className="impact-box"><span>Recursos envolvidos</span><strong>{Object.keys(load).length}</strong></div>
        <div className="impact-box"><span>Com dependência</span><strong>{deps.length}</strong></div>
      </div>

      {/* Allocation */}
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Alocação por responsável</h3>
          <label className="capacity-inline">
            Capacidade semanal (h):
            <input
              type="number"
              min={1}
              max={999}
              value={weeklyCapacity}
              onChange={e => setWeeklyCapacity(Math.max(1, Math.min(999, Math.floor(Number(e.target.value)) || 1)))}
            />
          </label>
        </div>
        <div className="card-body">
          {loadEntries.length === 0 ? (
            <div className="empty">Sem esforço alocado no recorte atual.</div>
          ) : (
            <div className="capacity-bars">
              {loadEntries.map(([owner, h]) => {
                // Capacidade individual (tabela people) com fallback no valor global
                const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
                const person = people.find(p => norm(p.name) === norm(owner))
                const cap = person?.weeklyCapacityHours ?? weeklyCapacity
                const pct = Math.round((h / cap) * 100)
                const tone = capacityTone(pct)
                return (
                  <div key={owner} className="capacity-row">
                    <b title={owner}>{owner}</b>
                    <div className={`capacity-track ${tone}`}><i style={{ width: `${Math.min(160, pct)}%` }} /></div>
                    <small>{Math.round(h)}h / {cap}h · {pct}%</small>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* A foto do time: quem é consumido por quem + tipos + disponibilidade */}
      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Pessoa × Demandante</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>horas restantes por produto/cliente</span>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            {availability.length === 0 ? (
              <div className="empty">Sem esforço alocado no recorte atual.</div>
            ) : (
              <table className="table" style={{ minWidth: 360 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Pessoa</th>
                    {demandCols.map(prd => <th key={prd} style={{ textAlign: 'center', fontSize: 11 }}>{prd}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {availability.map(({ owner }) => (
                    <tr key={owner}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{owner}</td>
                      {demandCols.map(prd => {
                        const h = Math.round(demandMatrix[owner]?.[prd] ?? 0)
                        return (
                          <td key={prd} style={{ textAlign: 'center', padding: 4 }}>
                            {h > 0 ? (
                              <span style={{
                                display: 'inline-block', minWidth: 38, padding: '4px 6px', borderRadius: 6,
                                fontWeight: 700, fontSize: 12, color: 'var(--text-title, #0b1f3a)',
                                background: `rgba(30, 96, 213, ${Math.min(0.5, 0.1 + 0.4 * (h / demandMax))})`,
                              }}>{h}h</span>
                            ) : (
                              <span style={{ color: 'var(--line)', fontSize: 12 }}>·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Revela os principais demandantes de cada pessoa — intensidade = horas.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Disponibilidade e tipos de atividade</h3>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>Quem pode receber demanda nova</h4>
              {availability.length === 0 ? (
                <div className="empty">Sem alocações no recorte.</div>
              ) : (
                <div style={{ display: 'grid', gap: 4 }}>
                  {availability.map(({ owner, pct, free }) => (
                    <div key={owner} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                      <span aria-hidden="true">{pct >= 115 ? '🔴' : pct >= 85 ? '🟡' : '🟢'}</span>
                      <b style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner}</b>
                      <span style={{ color: 'var(--muted)' }}>
                        {pct >= 115 ? `${pct}% — acima do limite` : pct >= 85 ? `${pct}% — no limite` : `${free}h livres na semana`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>Composição por tipo de atividade <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(tags dos itens)</span></h4>
              <div className="capacity-bars">
                {typeEntries.map(([tipo, h]) => (
                  <div key={tipo} className="capacity-row">
                    <b title={tipo}>{tipo}</b>
                    <div className="capacity-track"><i style={{ width: `${Math.round((h / typeMax) * 100)}%` }} /></div>
                    <small>{Math.round(h)}h</small>
                  </div>
                ))}
              </div>
              {typeEntries.length === 1 && typeEntries[0][0] === 'Sem tipo' && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>
                  Dica: marque os itens com tags como Projeto, Rotina ou Incidente para quebrar a carga por tipo.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* People management — capacidade semanal individual */}
      {canEdit && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Pessoas e capacidades</h3>
            {canManage && (
              <button className="btn small" onClick={async () => { const n = prompt('Nome da nova pessoa:'); if (n) await onCreatePerson(n) }}>+ Pessoa</button>
            )}
          </div>
          <div className="card-body">
            {people.length === 0 ? (
              <div className="empty">Nenhuma pessoa cadastrada — a alocação usa a capacidade global de {weeklyCapacity}h.</div>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Nome</th><th>Capacidade semanal (h)</th><th>Carga atual</th>{canManage && <th>Ações</th>}</tr></thead>
                  <tbody>
                    {people.map(p => {
                      const h = load[p.name] ?? 0
                      const pct = Math.round((h / p.weeklyCapacityHours) * 100)
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td>
                            {canManage
                              ? <input type="number" min={1} max={168} aria-label={`Capacidade semanal de ${p.name} (horas)`} defaultValue={p.weeklyCapacityHours} style={{ width: 80 }}
                                  onBlur={e => { const v = Number(e.target.value); if (v > 0 && v !== p.weeklyCapacityHours) onUpdatePerson(p.id, { weeklyCapacityHours: v }) }} />
                              : <>{p.weeklyCapacityHours} h</>}
                          </td>
                          <td><span className={`badge ${pct >= 115 ? 'tone-red' : pct >= 85 ? 'tone-amber' : 'tone-green'}`}>{Math.round(h)}h · {pct}%</span></td>
                          {canManage && (
                            <td>
                              <button className="btn small danger" onClick={() => { if (confirm(`Desativar ${p.name}? Sai dos selects e do cálculo de capacidade.`)) onUpdatePerson(p.id, { active: false }) }}>Desativar</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Urgent Simulator */}
      {canEdit && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Simulador de demanda urgente</h3></div>
          <div className="card-body">
            <div className="sim-grid">
              <label>Produto/cliente <input value={urgentForm.product} onChange={e => setUrgentForm({ ...urgentForm, product: e.target.value })} /></label>
              <label>Responsável crítico
                {people.length > 0 ? (
                  <select value={urgentForm.owner} onChange={e => setUrgentForm({ ...urgentForm, owner: e.target.value })}>
                    <option value="">Selecione…</option>
                    {urgentForm.owner && !people.some(p => p.name === urgentForm.owner) && <option value={urgentForm.owner}>{urgentForm.owner}</option>}
                    {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                ) : (
                  <input value={urgentForm.owner} onChange={e => setUrgentForm({ ...urgentForm, owner: e.target.value })} placeholder="Ex.: Pedro, Kath" />
                )}
              </label>
              <label className="full">Demanda urgente <input value={urgentForm.title} onChange={e => setUrgentForm({ ...urgentForm, title: e.target.value })} placeholder="Ex.: Material emergencial para VP" /></label>
              <label>Esforço estimado (h) <input type="number" min={1} value={urgentForm.effort} onChange={e => setUrgentForm({ ...urgentForm, effort: Number(e.target.value) })} /></label>
              <label>Prazo desejado <input type="date" value={urgentForm.dueDate} onChange={e => setUrgentForm({ ...urgentForm, dueDate: e.target.value })} /></label>
              <label className="full">Motivo / observação <textarea value={urgentForm.reason} onChange={e => setUrgentForm({ ...urgentForm, reason: e.target.value })} placeholder="Ex.: demanda da diretoria…" /></label>
              <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn dark" type="button" onClick={() => setSimulated(true)}>Simular impacto</button>
                <button className="btn" type="button" onClick={() => setSimulated(false)}>Limpar</button>
                <button className="btn primary" type="button" onClick={saveUrgent}>Salvar na carteira</button>
              </div>
            </div>

            {simulated && (
              <div style={{ marginTop: 16 }}>
                <div className="impact-summary">
                  <div className="impact-box"><span>Demanda urgente</span><strong>{needed}h</strong></div>
                  <div className="impact-box"><span>Capacidade coberta</span><strong>{coverage}%</strong></div>
                  <div className="impact-box"><span>Frentes impactáveis</span><strong>{simResults.length}</strong></div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {simResults.map(({ it, score, free, type }, idx) => (
                    <div key={it.id} className="recommendation">
                      <div className="task-meta">
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                        <Badge label={type} tone={idx < 3 ? 'tone-amber' : 'tone-gray'} />
                        <Badge label={`${Math.round(free)}h livres`} tone="tone-blue" />
                        <Badge label={`Score ${score}`} />
                      </div>
                      <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                      <span className="dep-note">{it.owner ?? 'Sem responsável'} · prazo {dateFmt(it.dueDate)} · {it.priority ?? 'Média'} · {it.status}</span>
                      <div className="rec-score"><i style={{ width: `${clamp(score, 0, 100)}%` }} /></div>
                      <button className="btn small" onClick={() => onEdit(it.id)}>Abrir frente</button>
                    </div>
                  ))}
                  {simResults.length === 0 && <div className="empty">Preencha responsável e esforço para melhorar a recomendação.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {deps.length > 0 && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Dependências e predecessoras</h3><Badge label={String(deps.length)} /></div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {deps.map(it => {
              const pred = items.find(x => x.id === it.predecessorId)
              const issue = it.predecessorId && !pred ? 'Predecessora não encontrada' : pred && !isDone(pred) ? 'Predecessora ainda não concluída' : 'Dependência registrada'
              const tone = issue.includes('não') || issue.includes('ainda') ? 'tone-amber' : 'tone-blue'
              return (
                <div key={it.id} className="recommendation">
                  <div className="task-meta">
                    <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                    <Badge label={issue} tone={tone} />
                    <Badge label={it.predecessorId || 'Sem ID'} />
                  </div>
                  <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                  <span className="dep-note">{it.dependencyNote || (pred ? `Depende de ${pred.project} — ${pred.demand}` : 'Sem nota.')}</span>
                  <button className="btn small" onClick={() => onEdit(it.id)}>Editar</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gantt */}
      <div className="card">
        <div className="card-head"><h3 className="card-title">Gantt simplificado</h3><Badge label={`${ganttRows.length} frentes`} /></div>
        <div className="card-body">
          {!minDate ? <div className="empty">Sem datas suficientes para montar Gantt.</div> : (
            <div className="gantt-wrap">
              <div className="gantt-head">
                <div className="gantt-label">Frente</div>
                <div className="gantt-axis">
                  {[0, 0.25, 0.5, 0.75, 1].map(p => {
                    const d = addDays(minDate, Math.round(totalDays * p))
                    return <span key={p}>{d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  })}
                </div>
              </div>
              {ganttRows.map(it => {
                const s = parseDate(itemStart(it)) || parseDate(it.dueDate) || minDate
                const e = parseDate(it.dueDate) || s
                const left = clamp(Math.round(((s.getTime() - minDate.getTime()) / 86400000) / totalDays * 100), 0, 100)
                const width = Math.max(2, clamp(Math.round((Math.max(1, (e.getTime() - s.getTime()) / 86400000 + 1) / totalDays) * 100), 2, 100 - left))
                const tone = ['Atrasado','Bloqueado'].includes(riskOf(it)) ? 'danger' : ['Vence hoje','Atenção 7 dias','Sem prazo'].includes(riskOf(it)) ? 'warn' : ''
                return (
                  <div key={it.id} className="gantt-row">
                    <div className="gantt-title">
                      <div className="task-meta">
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                        <Badge label={`${itemRemainingEffort(it)}h`} />
                      </div>
                      <strong>{it.project ?? 'Sem projeto'}</strong>
                      <small>{it.demand ?? ''}{it.predecessorId ? ` · depende de ${it.predecessorId}` : ''}</small>
                    </div>
                    <div className="gantt-line">
                      <span className={`gantt-bar ${tone}`} style={{ left: `${left}%`, width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

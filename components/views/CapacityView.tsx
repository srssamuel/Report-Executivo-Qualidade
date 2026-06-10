'use client'

import type { Item, UserProfile } from '@/lib/domain'
import {
  isDone, ownerLoad, itemRemainingEffort, itemStart,
  capacityTone, normalizeItem, nextId, isoDate, dateFmt, clamp,
  parseDate, addDays, riskOf, productTone,
} from '@/lib/domain'
import { Badge } from '@/components/ui'

export default function CapacityView({ filtered, weeklyCapacity, setWeeklyCapacity, urgentForm, setUrgentForm, simulate, simulated, setSimulated, items, onEdit, canEdit, saveItem, setItems, showToast, profile: _profile }: {
  filtered: Item[]; weeklyCapacity: number; setWeeklyCapacity: (n: number) => void
  urgentForm: { product: string; title: string; owner: string; effort: number; dueDate: string; reason: string }
  setUrgentForm: (f: typeof urgentForm) => void
  simulate: () => { it: Item; score: number; free: number; type: string }[]
  simulated: boolean; setSimulated: (b: boolean) => void
  items: Item[]; onEdit: (id: string) => void; canEdit: boolean
  saveItem: (item: Item) => Promise<void>; setItems: React.Dispatch<React.SetStateAction<Item[]>>
  showToast: (msg: string) => void; profile: UserProfile | null
}) {
  const activItems = filtered.filter(i => !isDone(i))
  const load = ownerLoad(activItems)
  const loadEntries = Object.entries(load).sort((a, b) => b[1] - a[1])
  const totalEffort = activItems.reduce((s, i) => s + itemRemainingEffort(i), 0)
  const deps = filtered.filter(i => i.predecessorId || i.dependencyNote)

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
    if (!urgentForm.title.trim()) { showToast('Informe a demanda urgente antes de salvar.'); return }
    const payload = normalizeItem({
      id: nextId(items), product: urgentForm.product || 'Vivo', project: 'Demanda urgente', demand: urgentForm.title.trim(),
      definition: urgentForm.reason || 'Incluída pelo simulador de capacidade.',
      owner: urgentForm.owner, dueDate: urgentForm.dueDate, startDate: isoDate(new Date()),
      status: 'A iniciar', priority: 'Crítica', progress: 0, effortHours: urgentForm.effort,
      tags: ['Urgente', 'Capacidade'], archived: false,
    })
    setItems(prev => [payload, ...prev])
    await saveItem(payload)
    showToast('Demanda urgente salva na carteira.')
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
            <input type="number" min={1} max={999} value={weeklyCapacity} onChange={e => setWeeklyCapacity(Number(e.target.value))} />
          </label>
        </div>
        <div className="card-body">
          {loadEntries.length === 0 ? <div className="empty">Sem esforço alocado no recorte atual.</div> : (
            <div className="capacity-bars">
              {loadEntries.map(([owner, h]) => {
                const pct = Math.round((h / weeklyCapacity) * 100)
                const tone = capacityTone(pct)
                return (
                  <div key={owner} className="capacity-row">
                    <b title={owner}>{owner}</b>
                    <div className={`capacity-track ${tone}`}><i style={{ width: `${Math.min(160, pct)}%` }} /></div>
                    <small>{Math.round(h)}h / {pct}%</small>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Urgent Simulator */}
      {canEdit && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Simulador de demanda urgente</h3></div>
          <div className="card-body">
            <div className="sim-grid">
              <label>Produto/cliente <input value={urgentForm.product} onChange={e => setUrgentForm({ ...urgentForm, product: e.target.value })} /></label>
              <label>Responsável crítico <input value={urgentForm.owner} onChange={e => setUrgentForm({ ...urgentForm, owner: e.target.value })} placeholder="Ex.: Pedro, Kath" /></label>
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

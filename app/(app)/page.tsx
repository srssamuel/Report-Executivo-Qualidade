'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Item, UserProfile, Filters, Role,
  STATUSES, PRODUCT_SUGGESTIONS,
  normalizeItem,
  filteredItems, sortItems,
  riskOf, scoreOf, dataGaps, isDone, ownersOf,
  dateFmt,
  itemEffort, itemRemainingEffort, itemStart,
  urgencyCandidateScore, recommendationType,
  nextId, clamp, canEdit, canDelete, isAdmin,
} from '@/lib/domain'
import DashboardView from '@/components/views/DashboardView'
import PortfolioView from '@/components/views/PortfolioView'
import BoardView from '@/components/views/BoardView'
import RisksView from '@/components/views/RisksView'
import TimelineView from '@/components/views/TimelineView'
import CapacityView from '@/components/views/CapacityView'
import ExecutiveView from '@/components/views/ExecutiveView'
import ItemDrawer, { type DrawerForm } from '@/components/ItemDrawer'

// ── Main App ──────────────────────────────────────────────────────────────────

type ViewId = 'dashboard' | 'portfolio' | 'board' | 'risks' | 'timeline' | 'capacity' | 'executive'

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'portfolio', label: '📋 Carteira' },
  { id: 'board', label: '🗂 Board' },
  { id: 'risks', label: '⚠️ Riscos' },
  { id: 'timeline', label: '📅 Timeline' },
  { id: 'capacity', label: '⚡ Capacidade' },
  { id: 'executive', label: '📝 Executivo' },
]

export default function AppPage() {
  const supabase = createClient()

  const [items, setItems] = useState<Item[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewId>('dashboard')
  const [modalId, setModalId] = useState<string | null | 'new'>(null)
  const [toast, setToast] = useState('')
  const [toastTimer, setToastTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [uiLayout, setUiLayout] = useState<'standard' | 'wide' | 'ultra'>('wide')
  const [tableDense, setTableDense] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    query: '', product: '', project: '', owner: '', status: '', risk: '', sort: 'dueAsc', criticalOnly: false,
  })
  const [weeklyCapacity, setWeeklyCapacity] = useState(30)
  const [urgentForm, setUrgentForm] = useState({ product: 'Vivo', title: '', owner: '', effort: 16, dueDate: '', reason: '' })
  const [urgentSimulated, setUrgentSimulated] = useState(false)

  // ── Form state (drawer) ───────────────────────────────────────────────────
  const [form, setForm] = useState<DrawerForm>({})

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer) clearTimeout(toastTimer)
    const t = setTimeout(() => setToast(''), 2400)
    setToastTimer(t)
  }, [toastTimer])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, itemsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('items').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      ])

      if (profileRes.data) setProfile(profileRes.data as UserProfile)

      if (itemsRes.data) {
        const mapped = itemsRes.data.map((row: Record<string, unknown>) => normalizeItem({
          id: row.id as string,
          sourceRow: row.source_row as number,
          dueDate: row.due_date as string,
          project: row.project as string,
          demand: row.demand as string,
          definition: row.definition as string,
          owner: row.owner as string,
          status: row.status as string,
          priority: row.priority as string,
          progress: row.progress as number,
          nextAction: row.next_action as string,
          executiveComment: row.executive_comment as string,
          lastUpdate: row.last_update as string,
          tags: row.tags as string[],
          archived: row.archived as boolean,
          product: row.product as string,
          effortHours: row.effort_hours as number,
          teamSize: row.team_size as number,
          predecessorId: row.predecessor_id as string,
          dependencyNote: row.dependency_note as string,
          startDate: row.start_date as string,
        }))
        setItems(mapped)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply layout class to body
  useEffect(() => {
    document.body.classList.remove('mode-standard', 'mode-wide', 'mode-ultra', 'table-dense')
    document.body.classList.add(`mode-${uiLayout}`)
    if (tableDense) document.body.classList.add('table-dense')
  }, [uiLayout, tableDense])

  const role: Role = profile?.role ?? 'viewer'
  const canEditItems = canEdit(role)
  const canDeleteItems = canDelete(role)

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = sortItems(filteredItems(items, filters), filters.sort)

  function uniqueProducts() {
    return [...new Set([...PRODUCT_SUGGESTIONS, ...items.filter(i => !i.archived).map(i => i.product).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }
  function uniqueProjects() {
    return [...new Set(items.filter(i => !i.archived && (!filters.product || i.product === filters.product)).map(i => i.project).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }
  function uniqueOwners() {
    return [...new Set(items.filter(i => !i.archived && (!filters.product || i.product === filters.product)).flatMap(i => ownersOf(i.owner)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────
  async function saveItem(payload: Item) {
    const row = {
      id: payload.id,
      source_row: payload.sourceRow,
      due_date: payload.dueDate || null,
      project: payload.project,
      demand: payload.demand,
      definition: payload.definition,
      owner: payload.owner,
      status: payload.status,
      priority: payload.priority,
      progress: payload.progress,
      next_action: payload.nextAction,
      executive_comment: payload.executiveComment,
      last_update: new Date().toISOString(),
      tags: payload.tags,
      archived: payload.archived,
      product: payload.product,
      effort_hours: payload.effortHours || null,
      team_size: payload.teamSize || null,
      predecessor_id: payload.predecessorId || null,
      dependency_note: payload.dependencyNote || null,
      start_date: payload.startDate || null,
    }
    const { error } = await supabase.from('items').upsert(row)
    if (error) { showToast(`Erro ao salvar: ${error.message}`); throw error }
  }

  async function updateField(id: string, field: keyof Item, value: unknown) {
    const it = items.find(x => x.id === id)
    if (!it) return
    const updated = { ...it, [field]: value, lastUpdate: new Date().toISOString() }
    if (field === 'status' && ['Concluído', 'Entregue'].includes(value as string)) updated.progress = 100
    setItems(prev => prev.map(i => i.id === id ? updated : i))
    await saveItem(updated)

    // record history
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('item_history').insert({
        item_id: id, changed_by: user.id, field,
        old_value: String(it[field] ?? ''), new_value: String(value ?? ''),
      })
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openModal(id: string | null) {
    if (id) {
      const it = items.find(x => x.id === id)
      if (!it) return
      setForm({ ...it, tagsRaw: (it.tags ?? []).join(', '), commentText: '', commentAuthor: profile?.full_name || profile?.email || '', commentType: 'Comentário' })
    } else {
      setForm({ status: 'A iniciar', priority: 'Média', progress: 0, product: filters.product || 'Vivo', tagsRaw: '', commentText: '', commentAuthor: profile?.full_name || profile?.email || '', commentType: 'Comentário' })
    }
    setModalId(id ?? 'new')
  }
  const closeModal = useCallback(() => setModalId(null), [])

  async function submitModal(e: React.FormEvent) {
    e.preventDefault()
    const isNew = modalId === 'new'
    const id = isNew ? nextId(items) : modalId as string
    const payload = normalizeItem({
      ...(isNew ? {} : items.find(x => x.id === id)),
      ...form,
      id,
      tags: String(form.tagsRaw ?? '').split(',').map(x => x.trim()).filter(Boolean),
      progress: clamp(Number(form.progress ?? 0), 0, 100),
      lastUpdate: new Date().toISOString(),
      archived: false,
    })
    if (isNew) {
      setItems(prev => [payload, ...prev])
    } else {
      setItems(prev => prev.map(i => i.id === id ? payload : i))
    }
    await saveItem(payload)
    showToast('Atualização salva.')
    closeModal()
  }

  async function archiveItem() {
    if (!modalId || modalId === 'new') return
    if (!confirm('Arquivar este item? Ele sairá das visões principais.')) return
    const id = modalId as string
    await updateField(id, 'archived', true)
    setItems(prev => prev.map(i => i.id === id ? { ...i, archived: true } : i))
    showToast('Item arquivado.')
    closeModal()
  }

  function duplicateItem() {
    if (!modalId || modalId === 'new') return
    const it = items.find(x => x.id === modalId)
    if (!it) return
    const copy = normalizeItem({ ...it, id: nextId(items), demand: `${it.demand} (cópia)`, comments: [], lastUpdate: new Date().toISOString() })
    setItems(prev => [copy, ...prev])
    saveItem(copy).then(() => showToast('Item duplicado.'))
    closeModal()
  }

  async function addComment() {
    if (!modalId || modalId === 'new') return
    const text = String(form.commentText ?? '').trim()
    if (!text) { showToast('Escreva um comentário antes de adicionar.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('item_comments').insert({
      item_id: modalId,
      author_id: user?.id,
      author_name: form.commentAuthor || profile?.email || 'Usuário',
      comment_type: form.commentType || 'Comentário',
      text,
    })
    await updateField(modalId as string, 'executiveComment', text)
    setForm(f => ({ ...f, commentText: '' }))
    showToast('Comentário registrado.')
  }

  // ── Export helpers ────────────────────────────────────────────────────────
  function downloadBlob(blob: Blob, filename: string) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href)
  }
  function exportJSON() {
    downloadBlob(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json;charset=utf-8' }), `backup-${new Date().toISOString().slice(0, 10)}.json`)
  }
  function exportCSV() {
    const cols = ['id','produto','projeto','demanda','inicio','prazo','esforco_horas','responsavel','status','prioridade','progresso','proxima_acao','comentario_executivo']
    const rows = filtered.map(it => [it.id,it.product,it.project,it.demand,itemStart(it),dateFmt(it.dueDate),itemEffort(it),it.owner,it.status,it.priority,it.progress,it.nextAction,it.executiveComment].map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';'))
    downloadBlob(new Blob([cols.join(';') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }), `report-${new Date().toISOString().slice(0, 10)}.csv`)
  }
  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    try {
      const imported: Item[] = JSON.parse(text)
      if (!Array.isArray(imported)) throw new Error()
      const normalized = imported.map(normalizeItem)
      for (const item of normalized) { await saveItem(item) }
      setItems(normalized)
      showToast('Backup importado com sucesso.')
    } catch { showToast('Arquivo JSON inválido.') }
    e.target.value = ''
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Dashboard helpers ─────────────────────────────────────────────────────
  const total = filtered.length
  const done = filtered.filter(isDone).length
  const active = total - done
  const late = filtered.filter(i => ['Atrasado', 'Bloqueado'].includes(riskOf(i))).length
  const soon = filtered.filter(i => ['Vence hoje', 'Atenção 7 dias'].includes(riskOf(i))).length
  const gaps = filtered.filter(i => dataGaps(i).length > 0 && !isDone(i)).length
  const effort = Math.round(filtered.filter(i => !isDone(i)).reduce((s, i) => s + itemRemainingEffort(i), 0))
  const avgScore = total ? Math.round(filtered.reduce((s, i) => s + scoreOf(i), 0) / total) : 0
  const donutDeg = `${Math.round(avgScore / 100 * 360)}deg`

  // ── Capacity simulation ───────────────────────────────────────────────────
  function simulateUrgent() {
    const notDone = filtered.filter(i => !isDone(i))
    const scored = notDone.map(it => ({
      it,
      score: urgencyCandidateScore(it, urgentForm),
      free: itemRemainingEffort(it),
      type: recommendationType(it, urgentForm),
    })).filter(x => x.score > -20 && x.free > 0).sort((a, b) => b.score - a.score).slice(0, 10)
    return scored
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#5f7188' }}>
        <div>Carregando carteira…</div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* ── Hero ────────────────────────────────────────────── */}
      <header className="hero soft-shell">
        <div className="topline">
          <div className="brandmark">
            <div className="brand-meta">
              <span>QualiData</span>
              <strong>Superintendência Vivo &amp; Nubank</strong>
              <small>Gestão de carteira e capacidade — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="layout-indicator">
              Largura: <strong>{uiLayout === 'standard' ? 'Padrão' : uiLayout === 'ultra' ? 'Ultra' : 'Ampla'}</strong>
            </div>
            {profile && (
              <div className="layout-indicator">
                <strong>{profile.full_name || profile.email}</strong>
                &nbsp;·&nbsp;{profile.role}
              </div>
            )}
            {isAdmin(role) && (
              <a className="btn small" href="/admin/users">Usuários</a>
            )}
            <button className="btn small danger" onClick={signOut}>Sair</button>
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> Ao vivo · {total} frente(s) no recorte</div>
            <h1 className="hero-title">Command Center<br />Qualidade &amp; Dados</h1>
            <p>Visão executiva integrada da carteira Vivo e Nubank — riscos, capacidade e decisões em um único painel.</p>
          </div>
          <div className="hero-actions">
            {canEditItems && <button className="btn primary" onClick={() => openModal(null)}>+ Nova frente</button>}
            <button className="btn" onClick={exportCSV}>CSV</button>
            <button className="btn" onClick={exportJSON}>JSON</button>
            {canEditItems && <label className="btn" style={{ cursor: 'pointer' }}>Importar <input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} /></label>}
            <button className="btn small ghost" onClick={() => { const o: ('standard'|'wide'|'ultra')[] = ['standard','wide','ultra']; setUiLayout(o[(o.indexOf(uiLayout)+1)%3]) }}>
              Largura
            </button>
            <button className="btn small ghost" onClick={() => setTableDense(d => !d)}>
              {tableDense ? 'Confortável' : 'Compacta'}
            </button>
          </div>
        </div>

        <div className="hero-product-strip">
          <button className="brand-pill all" onClick={() => setFilters(f => ({ ...f, product: '' }))}>
            <span />Carteira completa
          </button>
          <button className="brand-pill" onClick={() => setFilters(f => ({ ...f, product: 'Vivo' }))}>
            <span />Vivo
          </button>
          <button className="brand-pill nubank" onClick={() => setFilters(f => ({ ...f, product: 'Nubank' }))}>
            <span />Nubank
          </button>
        </div>

        <div className="hero-metrics" style={{ marginTop: 14 }}>
          {[
            { label: 'Total de frentes', value: total, sub: `${done} concluídas`, color: '' },
            { label: 'Críticos / Atrasados', value: late, sub: `${soon} vencem em breve`, color: late > 0 ? '#bd2f3d' : '' },
            { label: 'Score executivo', value: `${avgScore}%`, sub: 'Média ponderada', color: '' },
            { label: 'Esforço restante', value: `${effort}h`, sub: `${gaps} lacunas de governança`, color: '' },
            { label: 'Frentes ativas', value: active, sub: `${total - active} encerradas`, color: '' },
          ].map(m => (
            <div className="hero-metric" key={m.label}>
              <span>{m.label}</span>
              <strong style={m.color ? { color: m.color } : {}}>{m.value}</strong>
              <small>{m.sub}</small>
            </div>
          ))}
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="toolbar">
        <input className="input" placeholder="Buscar frente, demanda, responsável…" value={filters.query} onChange={e => setFilters(f => ({ ...f, query: e.target.value }))} />
        <select className="select" value={filters.product} onChange={e => setFilters(f => ({ ...f, product: e.target.value, project: '', owner: '' }))}>
          <option value="">Todos os produtos</option>
          {uniqueProducts().map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="select" value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}>
          <option value="">Todos os projetos</option>
          {uniqueProjects().map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="select" value={filters.owner} onChange={e => setFilters(f => ({ ...f, owner: e.target.value }))}>
          <option value="">Todos os responsáveis</option>
          {uniqueOwners().map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">Todos os status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="select" value={filters.sort} onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}>
          <option value="dueAsc">Prazo ↑</option>
          <option value="risk">Risco ↑</option>
          <option value="progressAsc">Progresso ↑</option>
          <option value="product">Produto</option>
          <option value="project">Projeto</option>
          <option value="owner">Responsável</option>
          <option value="updated">Atualização ↓</option>
        </select>
        <div className="toolbar-actions">
          <button className={`btn small ${filters.criticalOnly ? 'dark' : ''}`} onClick={() => setFilters(f => ({ ...f, criticalOnly: !f.criticalOnly }))}>🔴 Críticos</button>
          <button className="btn small ghost" onClick={() => setFilters({ query: '', product: '', project: '', owner: '', status: '', risk: '', sort: 'dueAsc', criticalOnly: false })}>Limpar</button>
        </div>
      </div>

      {/* ── Quick Status ─────────────────────────────────────── */}
      <div className="quick-status">
        {[
          { label: 'Em andamento', count: filtered.filter(i => i.status === 'Em andamento').length, sub: 'frentes ativas' },
          { label: 'Crítico / Atrasado', count: late, sub: 'exigem ação imediata', cls: late > 0 ? 'danger' : '' },
          { label: 'Vence em breve', count: soon, sub: 'nos próximos 7 dias', cls: soon > 0 ? 'warn' : '' },
          { label: 'Concluídos', count: done, sub: `de ${total} frentes`, cls: done > 0 ? 'good' : '' },
          { label: 'Lacunas governança', count: gaps, sub: 'sem prazo/resp/status', cls: gaps > 0 ? 'warn' : '' },
        ].map(t => (
          <div key={t.label} className={`status-tile ${t.cls ?? ''}`}>
            <span>{t.label}</span>
            <strong>{t.count}</strong>
            <small>{t.sub}</small>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="tabs">
        {VIEWS.map(v => (
          <button key={v.id} className={`tab ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Views ────────────────────────────────────────────── */}

      {view === 'dashboard' && <DashboardView filtered={filtered} donutDeg={donutDeg} avgScore={avgScore} late={late} soon={soon} gaps={gaps} active={active} total={total} onEdit={openModal} />}
      {view === 'portfolio' && <PortfolioView filtered={filtered} allItems={items} onEdit={openModal} />}
      {view === 'board' && <BoardView filtered={filtered} allItems={items} onEdit={openModal} canEdit={canEditItems} onFieldChange={updateField} />}
      {view === 'risks' && <RisksView filtered={filtered} allItems={items} onEdit={openModal} />}
      {view === 'timeline' && <TimelineView filtered={filtered} onEdit={openModal} />}
      {view === 'capacity' && <CapacityView filtered={filtered} weeklyCapacity={weeklyCapacity} setWeeklyCapacity={setWeeklyCapacity} urgentForm={urgentForm} setUrgentForm={setUrgentForm} simulate={simulateUrgent} simulated={urgentSimulated} setSimulated={setUrgentSimulated} items={items} onEdit={openModal} canEdit={canEditItems} saveItem={saveItem} setItems={setItems} showToast={showToast} profile={profile} />}
      {view === 'executive' && <ExecutiveView filtered={filtered} filters={filters} />}

      {/* ── ItemDrawer ───────────────────────────────────────── */}
      <ItemDrawer
        openId={modalId}
        items={items}
        form={form}
        setForm={setForm}
        canEdit={canEditItems}
        canDelete={canDeleteItems}
        onSubmit={submitModal}
        onClose={closeModal}
        onArchive={archiveItem}
        onDuplicate={duplicateItem}
        onAddComment={addComment}
      />

      {/* ── Toast ────────────────────────────────────────────── */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

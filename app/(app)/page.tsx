'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Briefcase, Kanban, AlertTriangle, Calendar,
  Zap, FileText, Archive, GripVertical, Download, Upload, Plus,
  LogOut, Users, ArrowUpDown, X, MessageSquare, Copy, TrendingUp,
} from 'lucide-react'
import { HBarChart, VBarChart, DonutChart, ProgressGauge } from './charts'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import {
  Item, UserProfile, Filters, Role, Gain, Product, GainType,
  STATUSES, PRIORITIES, PRODUCT_SUGGESTIONS, GAIN_TYPES, gainTypeTone,
  normalizeItem, normalizeStatus, inferProduct,
  filteredItems, sortItems, countsBy,
  riskOf, riskSeverity, riskTone, statusTone, priorityTone, productTone,
  scoreOf, healthOf, dataGaps, isDone, ownersOf,
  dateFmt, daysToDue, relativeDateText, monthLabel,
  itemEffort, itemRemainingEffort, itemTeamSize, itemStart,
  ownerLoad, capacityTone, urgencyCandidateScore, recommendationType,
  executiveLines, nextId, clamp, isoDate, addDays, parseDate, canEdit, canDelete, isAdmin,
} from '@/lib/domain'

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: unknown) {
  return String(s ?? '')
}

function Badge({ label, tone = 'tone-gray' }: { label: string; tone?: string }) {
  return <span className={`badge ${tone}`}>{label}</span>
}

function ProductBadge({ item }: { item: Item }) {
  return <Badge label={item.product || 'Sem produto'} tone={productTone(item.product)} />
}

/* BarChart removed — replaced by Recharts components in ./charts.tsx */

// ── Main App ──────────────────────────────────────────────────────────────────

type ViewId = 'dashboard' | 'portfolio' | 'board' | 'risks' | 'timeline' | 'capacity' | 'executive' | 'archived'

const VIEWS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'portfolio', label: 'Carteira', icon: <Briefcase size={16} /> },
  { id: 'board', label: 'Board', icon: <Kanban size={16} /> },
  { id: 'risks', label: 'Riscos', icon: <AlertTriangle size={16} /> },
  { id: 'timeline', label: 'Timeline', icon: <Calendar size={16} /> },
  { id: 'capacity', label: 'Capacidade', icon: <Zap size={16} /> },
  { id: 'executive', label: 'Executivo', icon: <FileText size={16} /> },
  { id: 'archived', label: 'Arquivados', icon: <Archive size={16} /> },
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
  const [gains, setGains] = useState<Gain[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [focusCommentOnOpen, setFocusCommentOnOpen] = useState(false)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Form state (modal) ────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<Item> & { tagsRaw?: string; commentText?: string; commentAuthor?: string; commentType?: string }>({})
  const [gainForm, setGainForm] = useState<{ gain_type: GainType; kpi: string; gain_value: string; detail: string }>({ gain_type: 'Financeiro', kpi: '', gain_value: '', detail: '' })
  const [modalGains, setModalGains] = useState<Gain[]>([])
  const [modalHistory, setModalHistory] = useState<{ at: string; field: string; old_value: string; new_value: string; changed_by: string }[]>([])

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

      const [profileRes, itemsRes, gainsRes, productsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('items').select('*').order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('gains').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('name'),
      ])

      if (profileRes.data) {
        const prof = profileRes.data as UserProfile & { password_changed?: boolean }
        setProfile(prof)
        // First-login: redirect to password change if not yet changed
        if (prof.password_changed === false) {
          window.location.href = '/reset-password?first=1'
          return
        }
      }
      if (gainsRes.data) setGains(gainsRes.data as Gain[])
      if (productsRes.data) setProducts(productsRes.data as Product[])

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
  }, []) // initial load only

  // Apply layout class to body
  useEffect(() => {
    document.body.classList.remove('mode-standard', 'mode-wide', 'mode-ultra', 'table-dense')
    document.body.classList.add(`mode-${uiLayout}`)
    if (tableDense) document.body.classList.add('table-dense')
  }, [uiLayout, tableDense])

  // Focus comment textarea when opening via quick comment
  useEffect(() => {
    if (focusCommentOnOpen && modalId && modalId !== 'new') {
      const timer = setTimeout(() => {
        commentTextareaRef.current?.focus()
        setFocusCommentOnOpen(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [focusCommentOnOpen, modalId])

  const role: Role = profile?.role ?? 'viewer'
  const canEditItems = canEdit(role)
  const canDeleteItems = canDelete(role)

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = sortItems(filteredItems(items, filters), filters.sort)

  const productNames = products.filter(p => p.active).map(p => p.name)
  function uniqueProducts() {
    return [...new Set([...productNames, ...PRODUCT_SUGGESTIONS, ...items.filter(i => !i.archived).map(i => i.product).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
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
  async function openModal(id: string | null, focusComment = false) {
    if (id) {
      const it = items.find(x => x.id === id)
      if (!it) return
      setForm({ ...it, tagsRaw: (it.tags ?? []).join(', '), commentText: '', commentAuthor: profile?.full_name || profile?.email || '', commentType: 'Comentário' })
      setModalGains(gains.filter(g => g.item_id === id))
      const { data: hist } = await supabase.from('item_history').select('*').eq('item_id', id).order('changed_at', { ascending: false }).limit(30)
      setModalHistory((hist ?? []).map((h: Record<string, unknown>) => ({ at: h.changed_at as string, field: h.field as string, old_value: h.old_value as string, new_value: h.new_value as string, changed_by: h.changed_by as string })))
    } else {
      setForm({ status: 'A iniciar', priority: 'Média', progress: 0, product: filters.product || 'Vivo', tagsRaw: '', commentText: '', commentAuthor: profile?.full_name || profile?.email || '', commentType: 'Comentário' })
      setModalGains([])
      setModalHistory([])
    }
    setGainForm({ gain_type: 'Financeiro', kpi: '', gain_value: '', detail: '' })
    setFocusCommentOnOpen(focusComment)
    setModalId(id ?? 'new')
  }
  function closeModal() { setModalId(null) }

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

  async function addGain() {
    if (!modalId || modalId === 'new') return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('gains').insert({
      item_id: modalId,
      gain_type: gainForm.gain_type,
      kpi: gainForm.kpi || null,
      gain_value: gainForm.gain_value || null,
      detail: gainForm.detail || null,
      created_by: user?.id,
    }).select().single()
    if (error) { showToast(`Erro ao registrar ganho: ${error.message}`); return }
    const newGain = data as Gain
    setGains(prev => [newGain, ...prev])
    setModalGains(prev => [newGain, ...prev])
    setGainForm({ gain_type: 'Financeiro', kpi: '', gain_value: '', detail: '' })
    showToast('Ganho registrado.')
  }

  async function deleteGain(gainId: string) {
    if (!confirm('Remover este ganho?')) return
    await supabase.from('gains').delete().eq('id', gainId)
    setGains(prev => prev.filter(g => g.id !== gainId))
    setModalGains(prev => prev.filter(g => g.id !== gainId))
    showToast('Ganho removido.')
  }

  async function restoreItem(id: string) {
    await updateField(id, 'archived', false)
    setItems(prev => prev.map(i => i.id === id ? { ...i, archived: false } : i))
    showToast('Item restaurado.')
  }

  // ── Bulk product assignment (matches HTML original) ────────────────────
  async function bulkSetProduct() {
    const productName = prompt('Nome do produto para aplicar a todos os itens filtrados:')
    if (!productName || !productName.trim()) return
    const trimmed = productName.trim()
    const count = filtered.length
    if (!confirm(`Aplicar produto "${trimmed}" a ${count} item(ns) filtrado(s)?`)) return
    for (const it of filtered) {
      await updateField(it.id, 'product', trimmed)
    }
    showToast(`Produto "${trimmed}" aplicado a ${count} item(ns).`)
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
  // donutDeg removed — replaced by ProgressGauge SVG

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

  const modalItem = modalId && modalId !== 'new' ? items.find(x => x.id === modalId) : null

  return (
    <div className="app">
      {/* ── Topbar (compact) ────────────────────────────────── */}
      <header className="topbar animate-fade-up">
        <div className="topbar-brand">
          <div>
            <div className="topbar-brand-name">QualiData</div>
            <div className="topbar-brand-title">Superintendência Vivo &amp; Nubank</div>
            <div className="topbar-brand-sub">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="hero-product-strip">
            <button className={`brand-pill all ${filters.product === '' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, product: '' }))}>
              <span />Todos
            </button>
            <button className={`brand-pill ${filters.product === 'Vivo' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, product: 'Vivo' }))}>
              <span />Vivo
            </button>
            <button className={`brand-pill nubank ${filters.product === 'Nubank' ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, product: 'Nubank' }))}>
              <span />Nubank
            </button>
          </div>
          {canEditItems && <button className="btn primary small" onClick={() => openModal(null)}><Plus size={14} /> Nova frente</button>}
          <button className="btn small" onClick={exportCSV}><Download size={14} /> CSV</button>
          <button className="btn small" onClick={exportJSON}><Download size={14} /> JSON</button>
          {canEditItems && <label className="btn small" style={{ cursor: 'pointer' }}><Upload size={14} /> Importar <input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} /></label>}
          <button className="btn small ghost" onClick={() => { const o: ('standard'|'wide'|'ultra')[] = ['standard','wide','ultra']; setUiLayout(o[(o.indexOf(uiLayout)+1)%3]) }}>
            <ArrowUpDown size={14} />
          </button>
          <button className="btn small ghost" onClick={() => setTableDense(d => !d)}>
            {tableDense ? 'Confortável' : 'Compacta'}
          </button>
          {profile && (
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--muted)', fontWeight: 600 }}>
              {profile.full_name || profile.email} · {profile.role}
            </span>
          )}
          {isAdmin(role) && (
            <a className="btn small" href="/admin/users"><Users size={14} /> Usuários</a>
          )}
          <button className="btn small danger" onClick={signOut}><LogOut size={14} /> Sair</button>
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
          {canEditItems && <button className="btn small" onClick={bulkSetProduct}>Marcar produto</button>}
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
        ].map((t, idx) => (
          <div key={t.label} className={`status-tile ${t.cls ?? ''} animate-fade-up stagger-${idx + 1}`}>
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
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* ── Views ────────────────────────────────────────────── */}

      {view === 'dashboard' && <DashboardView filtered={filtered} avgScore={avgScore} late={late} soon={soon} gaps={gaps} active={active} total={total} effort={effort} onEdit={openModal} gains={gains} items={items} />}
      {view === 'portfolio' && <PortfolioView filtered={filtered} onEdit={openModal} onQuickComment={(id) => openModal(id, true)} canEdit={canEditItems} onFieldChange={updateField} allItems={items} productOptions={uniqueProducts()} />}
      {view === 'board' && <BoardView filtered={filtered} onEdit={openModal} onStatusChange={(id, status) => updateField(id, 'status', status)} />}
      {view === 'risks' && <RisksView filtered={filtered} onEdit={openModal} />}
      {view === 'timeline' && <TimelineView filtered={filtered} onEdit={openModal} />}
      {view === 'capacity' && <CapacityView filtered={filtered} weeklyCapacity={weeklyCapacity} setWeeklyCapacity={setWeeklyCapacity} urgentForm={urgentForm} setUrgentForm={setUrgentForm} simulate={simulateUrgent} simulated={urgentSimulated} setSimulated={setUrgentSimulated} items={items} onEdit={openModal} canEdit={canEditItems} saveItem={saveItem} setItems={setItems} showToast={showToast} profile={profile} />}
      {view === 'executive' && <ExecutiveView filtered={filtered} filters={filters} />}
      {view === 'archived' && <ArchivedView items={items} onEdit={openModal} onRestore={restoreItem} canEdit={canEditItems} />}

      {/* ── Modal ────────────────────────────────────────────── */}
      {modalId !== null && (
        <div className="modal-backdrop open" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeModal() }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <h2>{modalId === 'new' ? 'Nova frente' : `Editar ${modalId}`}</h2>
                <p>{modalItem ? `${modalItem.product ?? 'Sem produto'} · ${modalItem.project ?? ''} · Score ${scoreOf(modalItem)}%` : 'Preencha os dados da nova frente.'}</p>
              </div>
              <button className="btn square" onClick={closeModal} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitModal}>
                <div className="form-grid">
                  <label>Produto/cliente
                    <input list="productOptions" value={form.product ?? ''} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} />
                    <datalist id="productOptions">{uniqueProducts().map(p => <option key={p} value={p} />)}</datalist>
                  </label>
                  <label>Projeto
                    <input value={form.project ?? ''} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
                  </label>
                  <label>Responsável(eis)
                    <input value={form.owner ?? ''} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Nome ou nomes separados por vírgula" />
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
                      {items.filter(x => x.id !== modalId && !x.archived).map(x => (
                        <option key={x.id} value={x.id}>{x.id} · {x.project ?? ''} — {x.demand ?? ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="full">Nota de dependência
                    <input value={form.dependencyNote ?? ''} onChange={e => setForm(f => ({ ...f, dependencyNote: e.target.value }))} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 }}>
                  {modalId !== 'new' && canEditItems && <button type="button" className="btn" onClick={duplicateItem}>Duplicar</button>}
                  {modalId !== 'new' && canDeleteItems && <button type="button" className="btn danger" onClick={archiveItem}>Arquivar</button>}
                  <button type="button" className="btn ghost" onClick={closeModal}>Cancelar</button>
                  {canEditItems && <button type="submit" className="btn primary">Salvar</button>}
                </div>
              </form>

              {/* Comments */}
              {modalId !== 'new' && (
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Comentários</h3>
                  {canEditItems && (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input placeholder="Autor" value={form.commentAuthor ?? ''} onChange={e => setForm(f => ({ ...f, commentAuthor: e.target.value }))} />
                        <select value={form.commentType ?? 'Comentário'} onChange={e => setForm(f => ({ ...f, commentType: e.target.value }))}>
                          {['Comentário','Decisão','Risco','Atualização','Bloqueio'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <textarea ref={commentTextareaRef} rows={2} placeholder="Adicionar comentário…" value={form.commentText ?? ''} onChange={e => setForm(f => ({ ...f, commentText: e.target.value }))} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn small primary" type="button" onClick={addComment}>Registrar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Gains */}
              {modalId !== 'new' && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Ganhos registrados</h3>
                  {canEditItems && (
                    <div style={{ display: 'grid', gap: 8, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#5f7188' }}>Tipo de ganho
                          <select value={gainForm.gain_type} onChange={e => setGainForm(f => ({ ...f, gain_type: e.target.value as GainType }))}>
                            {GAIN_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </label>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#5f7188' }}>KPI impactado
                          <input placeholder="Ex.: NPS, CSAT, Tempo médio…" value={gainForm.kpi} onChange={e => setGainForm(f => ({ ...f, kpi: e.target.value }))} />
                        </label>
                      </div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#5f7188' }}>Valor do ganho
                        <input placeholder="Ex.: +12%, R$ 50k/mês, 2h reduzidas…" value={gainForm.gain_value} onChange={e => setGainForm(f => ({ ...f, gain_value: e.target.value }))} />
                      </label>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#5f7188' }}>Detalhamento
                        <textarea rows={2} placeholder="Detalhe o ganho obtido com esta frente…" value={gainForm.detail} onChange={e => setGainForm(f => ({ ...f, detail: e.target.value }))} />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn small primary" type="button" onClick={addGain}>Registrar ganho</button>
                      </div>
                    </div>
                  )}
                  {modalGains.length === 0 ? (
                    <div className="empty" style={{ padding: 12 }}>Nenhum ganho registrado para esta frente.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {modalGains.map(g => (
                        <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          <div style={{ flex: 1 }}>
                            <div className="task-meta" style={{ marginBottom: 4 }}>
                              <Badge label={g.gain_type} tone={gainTypeTone(g.gain_type)} />
                              {g.kpi && <Badge label={g.kpi} tone="tone-blue" />}
                              {g.gain_value && <Badge label={g.gain_value} tone="tone-green" />}
                            </div>
                            {g.detail && <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{g.detail}</p>}
                            <small style={{ color: '#9ca3af' }}>{new Date(g.created_at).toLocaleDateString('pt-BR')} {new Date(g.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
                          </div>
                          {canDeleteItems && <button className="btn small danger" type="button" onClick={() => deleteGain(g.id)}>✕</button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* History */}
              {modalId !== 'new' && modalHistory.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Histórico de alterações</h3>
                  <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#5f7188' }}>Data</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#5f7188' }}>Campo</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#5f7188' }}>De</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#5f7188' }}>Para</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalHistory.map((h, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', color: '#5f7188' }}>{new Date(h.at).toLocaleDateString('pt-BR')} {new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 600 }}>{h.field}</td>
                            <td style={{ padding: '4px 8px', color: '#9ca3af', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.old_value || '—'}</td>
                            <td style={{ padding: '4px 8px', color: '#374151', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.new_value || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

// ── Sub-view components ───────────────────────────────────────────────────────

function DashboardView({ filtered, avgScore, late, soon, gaps, active, total, effort, onEdit, gains, items }: {
  filtered: Item[]; avgScore: number; late: number; soon: number; gaps: number; active: number; total: number; effort: number; onEdit: (id: string) => void; gains: Gain[]; items: Item[]
}) {
  const decisionQueue = [...filtered].filter(i => !isDone(i)).sort((a, b) => riskSeverity(riskOf(a)) - riskSeverity(riskOf(b)) || scoreOf(a) - scoreOf(b)).slice(0, 8)
  const govGaps = [...filtered].filter(i => dataGaps(i).length > 0 && !isDone(i)).sort((a, b) => dataGaps(b).length - dataGaps(a).length).slice(0, 8)
  const ownerCounts: Record<string, number> = {}
  filtered.forEach(it => ownersOf(it.owner).forEach(o => ownerCounts[o] = (ownerCounts[o] ?? 0) + 1))

  const narrative: string[] = []
  const byProduct = Object.entries(countsBy(filtered, i => i.product ?? 'Sem produto')).sort((a, b) => b[1] - a[1])
  if (byProduct.length) narrative.push(`Recorte atual: ${byProduct.map(([p, n]) => `${p} (${n})`).join(' • ')}.`)
  if (late) narrative.push(`${late} frente(s) em condição crítica e devem entrar na pauta de destrave.`)
  if (soon) narrative.push(`${soon} frente(s) exigem acompanhamento próximo para evitar atraso.`)
  const missingNext = filtered.filter(i => !isDone(i) && !i.nextAction).length
  if (missingNext) narrative.push(`${missingNext} item(ns) ativos ainda não têm próxima ação explícita.`)
  if (gaps) narrative.push(`${gaps} item(ns) ativos sem prazo definido, reduzindo previsibilidade.`)
  if (!narrative.length) narrative.push('A carteira filtrada está com governança adequada e sem riscos relevantes de prazo.')

  /* Health tone for KPI hero */
  const healthTone = avgScore >= 80 ? 'green' : avgScore >= 60 ? 'amber' : 'red'

  /* Status distribution for donut */
  const statusDist = countsBy(filtered, i => i.status)

  return (
    <>
      {/* ── KPI Grid ────────────────────────────────────────── */}
      <div className="kpi-grid">
        {[
          { label: 'Score executivo', value: `${avgScore}%`, sub: `Média ponderada · ${total} frentes`, cls: healthTone, hero: true },
          { label: 'Ativas', value: active, sub: 'em execução ou planejadas', cls: 'blue', hero: false },
          { label: 'Concluídas', value: total - active, sub: 'entregues ou canceladas', cls: 'green', hero: false },
          { label: 'Críticas', value: late, sub: 'atrasadas ou bloqueadas', cls: late > 0 ? 'red' : 'green', hero: false },
          { label: 'Lacunas', value: gaps, sub: 'governança incompleta', cls: gaps > 0 ? 'amber' : 'green', hero: false },
          { label: 'Esforço restante', value: `${effort}h`, sub: `${soon} vencem em breve`, cls: 'blue', hero: false },
        ].map((k, idx) => (
          <div className={`kpi ${k.cls}${k.hero ? ' kpi-hero' : ''} animate-fade-up stagger-${idx + 1}`} key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
            <small>{k.sub}</small>
          </div>
        ))}
      </div>

      {/* ── Health + Decision Queue ──────────────────────────── */}
      <div className="dash-section">
        <div className="grid two">
          <div className="card panel-health">
            <div className="card-head">
              <h3 className="card-title">Saúde da carteira</h3>
              <Badge label={`${filtered.length} frentes`} tone="tone-blue" />
            </div>
            <div className="card-body">
              <div className="health-wrap">
                <div className="health-gauge">
                  <ProgressGauge value={avgScore} size={154} />
                </div>
                <div className="insight-list">
                  {narrative.map((n, i) => <div key={i} className="insight"><strong>{n}</strong></div>)}
                </div>
              </div>
            </div>
          </div>
          <div className="card panel-decision">
            <div className="card-head"><h3 className="card-title">Fila de decisão</h3><span className="badge tone-amber">{decisionQueue.length} itens</span></div>
            <div className="card-body">
              <div className="insight-list">
                {decisionQueue.length === 0 ? <div className="empty">Sem itens pendentes no filtro atual.</div> : decisionQueue.map(it => (
                  <div key={it.id} className="decision-card">
                    <div>
                      <div className="task-meta" style={{ marginBottom: 6 }}>
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                        <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                        <Badge label={it.status} tone={statusTone(it.status)} />
                        <Badge label={dateFmt(it.dueDate)} />
                      </div>
                      <strong style={{ fontSize: 13, display: 'block', lineHeight: 1.4 }}>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                      <p style={{ margin: '4px 0 0', color: '#5f7188', fontSize: 12, lineHeight: 1.45 }}>{it.nextAction || it.executiveComment || it.definition || 'Sem próxima ação registrada.'}</p>
                    </div>
                    <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Distribution Charts ─────────────────────────────── */}
      <div className="dash-section">
        <div className="section-head">
          <h2 className="section-title"><TrendingUp size={18} /> Distribuição da carteira</h2>
        </div>
        <div className="grid three">
          <div className="card panel-product">
            <div className="card-head"><h3 className="card-title">Por produto</h3></div>
            <div className="card-body chart-container">
              <HBarChart data={countsBy(filtered, i => i.product ?? 'Sem produto')} total={filtered.length} />
            </div>
          </div>
          <div className="card panel-status">
            <div className="card-head"><h3 className="card-title">Por status</h3></div>
            <div className="card-body chart-container">
              <VBarChart data={statusDist} total={filtered.length} />
            </div>
          </div>
          <div className="card panel-risk">
            <div className="card-head"><h3 className="card-title">Por risco</h3></div>
            <div className="card-body chart-container">
              <DonutChart data={countsBy(filtered, i => riskOf(i))} total={filtered.length} centerLabel={`${filtered.length}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Owners + Governance Gaps ────────────────────────── */}
      <div className="dash-section">
        <div className="grid two">
          <div className="card panel-owner">
            <div className="card-head"><h3 className="card-title">Por responsável</h3></div>
            <div className="card-body chart-container">
              <HBarChart data={ownerCounts} total={filtered.length} />
            </div>
          </div>
          <div className="card panel-gaps">
            <div className="card-head"><h3 className="card-title">Lacunas de governança</h3><Badge label={`${govGaps.length} itens`} tone="tone-amber" /></div>
            <div className="card-body">
              <div className="insight-list">
                {govGaps.length === 0 ? <div className="empty">Sem lacunas críticas de governança.</div> : govGaps.map(it => (
                  <div key={it.id} className="insight" style={{ cursor: 'pointer' }} onClick={() => onEdit(it.id)}>
                    <div className="task-meta" style={{ marginBottom: 6 }}>
                      <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                      <Badge label={dataGaps(it).join(', ')} tone="tone-amber" />
                      <Badge label={it.owner || 'Sem responsável'} />
                    </div>
                    <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                    <span>Recom.: definir {dataGaps(it).slice(0, 2).join(' e ')} para cobrança objetiva.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gains Summary ───────────────────────────────────── */}
      {gains.length > 0 && (
        <div className="dash-section">
          <div className="section-head">
            <h2 className="section-title">Ganhos registrados</h2>
            <Badge label={`${gains.length} registros`} tone="tone-green" />
          </div>
          <div className="grid two">
            <div className="card">
              <div className="card-head"><h3 className="card-title">Ganhos por tipo</h3></div>
              <div className="card-body">
                <div className="chart-container">
                  <HBarChart data={countsBy(gains, g => g.gain_type)} total={gains.length} />
                </div>
                <div className="gain-type-grid">
                  {(GAIN_TYPES as readonly string[]).map(t => {
                    const count = gains.filter(g => g.gain_type === t).length
                    return (
                      <div key={t} className="gain-type-card">
                        <Badge label={t} tone={gainTypeTone(t)} />
                        <div className="gain-type-value">{count}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3 className="card-title">Ganhos recentes</h3></div>
              <div className="card-body">
                <div className="insight-list">
                  {gains.slice(0, 8).map(g => {
                    const it = items.find(x => x.id === g.item_id)
                    return (
                      <div key={g.id} className="insight" style={{ cursor: it ? 'pointer' : 'default' }} onClick={() => it && onEdit(it.id)}>
                        <div className="task-meta" style={{ marginBottom: 6 }}>
                          <Badge label={g.gain_type} tone={gainTypeTone(g.gain_type)} />
                          {g.kpi && <Badge label={g.kpi} tone="tone-blue" />}
                          {g.gain_value && <Badge label={g.gain_value} tone="tone-green" />}
                        </div>
                        <strong>{it ? `${it.product ?? ''} — ${it.project ?? it.demand ?? 'Sem projeto'}` : g.item_id}</strong>
                        {g.detail && <span style={{ color: '#5f7188', fontSize: 12, lineHeight: 1.4 }}>{g.detail}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PortfolioView({ filtered, onEdit, onQuickComment, canEdit, onFieldChange, allItems, productOptions }: {
  filtered: Item[]; onEdit: (id: string) => void; onQuickComment: (id: string) => void; canEdit: boolean; onFieldChange: (id: string, field: keyof Item, value: unknown) => void; allItems: Item[]; productOptions: string[]
}) {
  const [textExpanded, setTextExpanded] = useState(false)
  const textareaStyle: React.CSSProperties = textExpanded ? { minHeight: 128, minWidth: 180 } : { minHeight: 56, minWidth: 180 }

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
        <table>
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
              <tr><td colSpan={17}><div className="empty">Nenhum item no filtro atual.</div></td></tr>
            ) : filtered.map(it => (
              <tr key={it.id}>
                {/* ID */}
                <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{it.id}</td>

                {/* Produto — inline input com datalist (era só badge) */}
                <td style={{ minWidth: 110 }}>
                  {canEdit ? (
                    <>
                      <input className="mini-input" list="portfolioProductOpts" defaultValue={it.product ?? ''} onBlur={e => onFieldChange(it.id, 'product', e.target.value.trim())} style={{ minWidth: 100 }} />
                      <datalist id="portfolioProductOpts">{productOptions.map(p => <option key={p} value={p} />)}</datalist>
                    </>
                  ) : <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />}
                </td>

                {/* Projeto — inline input */}
                <td className="row-title" style={{ minWidth: 140 }}>
                  {canEdit
                    ? <input className="mini-input" defaultValue={it.project ?? ''} onBlur={e => onFieldChange(it.id, 'project', e.target.value)} style={{ minWidth: 130 }} />
                    : it.project}
                </td>

                {/* Demanda — inline textarea (era input) */}
                <td style={{ minWidth: 200 }}>
                  {canEdit
                    ? <textarea className="mini-textarea" defaultValue={it.demand ?? ''} onBlur={e => onFieldChange(it.id, 'demand', e.target.value)} style={textareaStyle} />
                    : it.demand}
                </td>

                {/* Início — date input (NOVO) */}
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canEdit
                    ? <input type="date" className="mini-input" defaultValue={it.startDate ?? ''} onBlur={e => onFieldChange(it.id, 'startDate', e.target.value)} style={{ minWidth: 130 }} />
                    : (it.startDate ? dateFmt(it.startDate) : '—')
                  }
                </td>

                {/* Prazo — date input */}
                <td style={{ whiteSpace: 'nowrap' }}>
                  {canEdit
                    ? <input type="date" className="mini-input" defaultValue={it.dueDate ?? ''} onBlur={e => onFieldChange(it.id, 'dueDate', e.target.value)} style={{ minWidth: 130 }} />
                    : dateFmt(it.dueDate)
                  }
                  <div style={{ fontSize: 11, color: '#5f7188', marginTop: 2 }}>{relativeDateText(it.dueDate)}</div>
                </td>

                {/* Capacidade: Esforço + Equipe + Restante (NOVO) */}
                <td style={{ minWidth: 120 }}>
                  {canEdit ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="number" className="mini-input" min={0} defaultValue={it.effortHours ?? ''} placeholder="h" onBlur={e => onFieldChange(it.id, 'effortHours', Number(e.target.value) || 0)} style={{ width: 50 }} />
                        <span style={{ fontSize: 10, color: '#5f7188' }}>h</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="number" className="mini-input" min={1} defaultValue={it.teamSize ?? 1} placeholder="eq" onBlur={e => onFieldChange(it.id, 'teamSize', Number(e.target.value) || 1)} style={{ width: 50 }} />
                        <span style={{ fontSize: 10, color: '#5f7188' }}>eq</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#5f7188' }}>Restante: {itemRemainingEffort(it)}h</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12 }}>
                      {itemEffort(it)}h · {itemTeamSize(it)} eq<br />
                      <span style={{ fontSize: 10, color: '#5f7188' }}>Restante: {itemRemainingEffort(it)}h</span>
                    </div>
                  )}
                </td>

                {/* Predecessor + Nota de dependência (NOVO) */}
                <td style={{ minWidth: 140 }}>
                  {canEdit ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select className="mini-select" value={it.predecessorId ?? ''} onChange={e => onFieldChange(it.id, 'predecessorId', e.target.value)}>
                        <option value="">Sem predecessor</option>
                        {allItems.filter(x => x.id !== it.id && !x.archived).map(x => (
                          <option key={x.id} value={x.id}>{x.id} · {x.project ?? ''}</option>
                        ))}
                      </select>
                      <textarea className="mini-textarea" defaultValue={it.dependencyNote ?? ''} placeholder="Nota de dependência…" onBlur={e => onFieldChange(it.id, 'dependencyNote', e.target.value)} style={{ minHeight: 36, minWidth: 130 }} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 12 }}>
                      {it.predecessorId ? <span style={{ fontWeight: 600 }}>{it.predecessorId}</span> : '—'}
                      {it.dependencyNote && <div style={{ fontSize: 11, color: '#5f7188', marginTop: 2 }}>{it.dependencyNote}</div>}
                    </div>
                  )}
                </td>

                {/* Responsável — inline input */}
                <td style={{ minWidth: 120 }}>
                  {canEdit
                    ? <input className="mini-input" defaultValue={it.owner ?? ''} onBlur={e => onFieldChange(it.id, 'owner', e.target.value)} style={{ minWidth: 110 }} />
                    : it.owner}
                </td>

                {/* Status — inline select */}
                <td>
                  {canEdit
                    ? <select className="mini-select" value={it.status} onChange={e => onFieldChange(it.id, 'status', e.target.value)}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    : <Badge label={it.status} tone={statusTone(it.status)} />
                  }
                </td>

                {/* Prioridade — inline select (era só badge) */}
                <td>
                  {canEdit
                    ? <select className="mini-select" value={it.priority ?? 'Média'} onChange={e => onFieldChange(it.id, 'priority', e.target.value)}>
                        {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    : <Badge label={it.priority ?? 'Média'} tone={priorityTone(it.priority ?? 'Média')} />
                  }
                </td>

                {/* Progresso — input numérico + barra (era só barra) */}
                <td style={{ minWidth: 100 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {canEdit ? (
                      <input type="number" className="mini-input" min={0} max={100} defaultValue={it.progress ?? 0} onBlur={e => onFieldChange(it.id, 'progress', clamp(Number(e.target.value), 0, 100))} style={{ width: 48 }} />
                    ) : (
                      <span style={{ fontSize: 11 }}>{it.progress ?? 0}%</span>
                    )}
                    <div className="progress-line" style={{ width: 50 }}><i style={{ width: `${it.progress ?? 0}%` }} /></div>
                  </div>
                </td>

                {/* Risco — badge */}
                <td><Badge label={riskOf(it)} tone={riskTone(riskOf(it))} /></td>

                {/* Score */}
                <td style={{ textAlign: 'center', fontWeight: 800, color: '#123e7c' }}>{scoreOf(it)}%</td>

                {/* Próxima ação — textarea */}
                <td>
                  {canEdit
                    ? <textarea className="mini-textarea" defaultValue={it.nextAction ?? ''} onBlur={e => onFieldChange(it.id, 'nextAction', e.target.value)} style={textareaStyle} />
                    : it.nextAction}
                </td>

                {/* Comentário executivo — textarea (NOVO) */}
                <td>
                  {canEdit
                    ? <textarea className="mini-textarea" defaultValue={it.executiveComment ?? ''} onBlur={e => onFieldChange(it.id, 'executiveComment', e.target.value)} style={textareaStyle} />
                    : it.executiveComment}
                </td>

                {/* Ações — Abrir + Coment. (era só Editar) */}
                <td className="row-actions" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small" onClick={() => onEdit(it.id)}>Abrir</button>
                  <button className="btn small" onClick={() => onQuickComment(it.id)} style={{ marginLeft: 4 }}><MessageSquare size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Sortable Card (DnD) ────────────────────────────────────────────────────
function SortableTaskCard({ item, onEdit }: { item: Item; onEdit: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <article ref={setNodeRef} style={style} className={`task-card${isDragging ? ' dragging' : ''}`} {...attributes}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <button className="btn-drag" {...listeners} aria-label="Arrastar" style={{ cursor: 'grab', background: 'none', border: 'none', padding: '2px 0', color: 'var(--muted-2)', flexShrink: 0 }}>
          <GripVertical size={14} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-meta">
            <Badge label={item.product ?? 'Sem produto'} tone={productTone(item.product)} />
            <Badge label={riskOf(item)} tone={riskTone(riskOf(item))} />
            <Badge label={item.priority ?? 'Média'} tone={priorityTone(item.priority ?? 'Média')} />
          </div>
          <h4>{item.project ?? 'Sem projeto'}</h4>
          <p>{item.demand ?? item.definition ?? 'Sem demanda'}</p>
          <div><small>{dateFmt(item.dueDate)} · {item.owner ?? 'Sem responsável'}</small></div>
          <div className="progress-line"><i style={{ width: `${clamp(Number(item.progress ?? 0), 0, 100)}%` }} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <small>Score {scoreOf(item)}%</small>
            <button className="btn small" onClick={() => onEdit(item.id)}>Editar</button>
          </div>
        </div>
      </div>
    </article>
  )
}

const BOARD_LANES: { status: string; dot: string }[] = [
  { status: 'A iniciar', dot: 'lane-dot-iniciar' },
  { status: 'Em andamento', dot: 'lane-dot-andamento' },
  { status: 'Em validação', dot: 'lane-dot-validacao' },
  { status: 'Bloqueado', dot: 'lane-dot-bloqueado' },
  { status: 'Concluído', dot: 'lane-dot-concluido' },
  { status: 'Entregue', dot: 'lane-dot-concluido' },
]

function BoardView({ filtered, onEdit, onStatusChange }: { filtered: Item[]; onEdit: (id: string) => void; onStatusChange: (id: string, newStatus: string) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    let targetStatus: string | null = null

    // If dropped on a lane (lane IDs are prefixed with "lane-")
    if (overId.startsWith('lane-')) {
      const laneStatus = overId.replace('lane-', '')
      const lane = BOARD_LANES.find(l => l.status === laneStatus)
      if (lane) targetStatus = lane.status
    } else {
      // Dropped on another card — find which lane that card belongs to
      const targetItem = filtered.find(i => i.id === overId)
      if (targetItem) targetStatus = targetItem.status
    }

    if (targetStatus) {
      const item = filtered.find(i => i.id === activeId)
      if (item && item.status !== targetStatus) {
        onStatusChange(activeId, targetStatus)
      }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="board">
        {BOARD_LANES.map(({ status, dot }) => {
          const rows = filtered.filter(it => it.status === status)
          const ids = rows.map(r => r.id)
          return (
            <SortableContext key={status} items={ids} strategy={verticalListSortingStrategy}>
              <DroppableLane laneId={`lane-${status}`} status={status} dot={dot} count={rows.length}>
                {rows.length === 0 ? (
                  <div className="empty" style={{ padding: 18 }}>Sem itens</div>
                ) : rows.map(it => (
                  <SortableTaskCard key={it.id} item={it} onEdit={onEdit} />
                ))}
              </DroppableLane>
            </SortableContext>
          )
        })}
      </div>
    </DndContext>
  )
}

// ── Droppable Lane wrapper ────────────────────────────────────────────────
function DroppableLane({ laneId, status, dot, count, children }: {
  laneId: string; status: string; dot: string; count: number; children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: laneId })
  return (
    <div ref={setNodeRef} className={`lane${isOver ? ' lane-over' : ''}`}>
      <div className="lane-head">
        <div className={`lane-dot ${dot}`} />
        <h3>{status}</h3>
        <Badge label={String(count)} />
      </div>
      {children}
    </div>
  )
}

function RisksView({ filtered, onEdit }: { filtered: Item[]; onEdit: (id: string) => void }) {
  const critical = [...filtered].filter(i => ['Bloqueado','Atrasado'].includes(riskOf(i))).sort((a, b) => scoreOf(a) - scoreOf(b))
  const attention = [...filtered].filter(i => ['Vence hoje','Atenção 7 dias'].includes(riskOf(i))).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  const gapItems = [...filtered].filter(i => dataGaps(i).length && !isDone(i)).sort((a, b) => dataGaps(b).length - dataGaps(a).length)

  function RiskList({ list, empty, showGaps = false }: { list: Item[]; empty: string; showGaps?: boolean }) {
    return list.length === 0 ? <div className="empty">{empty}</div> : (
      <>
        {list.map(it => (
          <div key={it.id} className="risk-item">
            <div className="task-meta">
              <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
              <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
              <Badge label={dateFmt(it.dueDate)} />
              <Badge label={it.status} tone={statusTone(it.status)} />
            </div>
            <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
            <span style={{ color: '#5f7188', fontSize: 13 }}>{showGaps ? `Lacunas: ${dataGaps(it).join(', ')}` : it.nextAction || it.executiveComment || it.definition || 'Sem detalhe.'}</span>
            <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      <div className="traffic-legend" style={{ marginBottom: 16 }}>
        <div className="legend-chip critical"><span /><div><strong>Crítico / Bloqueado</strong><small>Ação imediata necessária — destravar na próxima reunião</small></div></div>
        <div className="legend-chip attention"><span /><div><strong>Atenção / Vence em breve</strong><small>Monitorar diariamente — risco de atraso em até 7 dias</small></div></div>
        <div className="legend-chip control"><span /><div><strong>Em controle</strong><small>No prazo — manter cadência de acompanhamento</small></div></div>
      </div>
      <div className="matrix">
        <div className="matrix-col card">
          <div className="card-head"><h3 className="card-title">Críticos / Atrasados</h3><Badge label={String(critical.length)} tone="tone-red" /></div>
          <div className="card-body"><RiskList list={critical} empty="Nenhum item crítico no filtro atual." /></div>
        </div>
        <div className="matrix-col card">
          <div className="card-head"><h3 className="card-title">Vencimento próximo</h3><Badge label={String(attention.length)} tone="tone-amber" /></div>
          <div className="card-body"><RiskList list={attention} empty="Nenhum vencimento crítico próximo." /></div>
        </div>
        <div className="matrix-col card">
          <div className="card-head"><h3 className="card-title">Lacunas de dados</h3><Badge label={String(gapItems.length)} tone="tone-amber" /></div>
          <div className="card-body"><RiskList list={gapItems} empty="Nenhuma lacuna relevante identificada." showGaps /></div>
        </div>
      </div>
    </>
  )
}

function TimelineView({ filtered, onEdit }: { filtered: Item[]; onEdit: (id: string) => void }) {
  const sorted = [...filtered].sort((a, b) => (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31'))
  const groups = sorted.reduce<Record<string, Item[]>>((acc, it) => {
    const k = monthLabel(it.dueDate); (acc[k] ??= []).push(it); return acc
  }, {})

  if (Object.keys(groups).length === 0) return <div className="empty">Sem itens na timeline.</div>

  return (
    <div className="timeline">
      {Object.entries(groups).map(([month, rows]) => (
        <article key={month} className="card timeline-month">
          <h3>{month} <Badge label={String(rows.length)} /></h3>
          {rows.map(it => (
            <div key={it.id} className="timeline-item">
              <div>
                <strong>{dateFmt(it.dueDate)}</strong>
                <br /><small>{relativeDateText(it.dueDate)}</small>
              </div>
              <div>
                <div className="task-meta">
                  <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                  <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                  <Badge label={it.status} tone={statusTone(it.status)} />
                </div>
                <strong style={{ display: 'block', marginTop: 4 }}>{it.project ?? 'Sem projeto'}</strong>
                <span style={{ color: '#5f7188' }}>{it.demand ?? 'Sem demanda'}</span>
              </div>
              <button className="btn small" onClick={() => onEdit(it.id)}>Editar</button>
            </div>
          ))}
        </article>
      ))}
    </div>
  )
}

function CapacityView({ filtered, weeklyCapacity, setWeeklyCapacity, urgentForm, setUrgentForm, simulate, simulated, setSimulated, items, onEdit, canEdit, saveItem, setItems, showToast, profile }: {
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

function ExecutiveView({ filtered, filters }: { filtered: Item[]; filters: Filters }) {
  const [copied, setCopied] = useState(false)
  const report = executiveLines(filtered, filters)

  const insights: string[] = []
  const late = filtered.filter(i => ['Bloqueado','Atrasado'].includes(riskOf(i))).length
  const noNext = filtered.filter(i => !isDone(i) && !i.nextAction).length
  const byProject = Object.entries(countsBy(filtered, i => i.project ?? 'Sem projeto')).sort((a, b) => b[1] - a[1])[0]
  const byProduct = Object.entries(countsBy(filtered, i => i.product ?? 'Sem produto')).sort((a, b) => b[1] - a[1])
  if (byProduct.length) insights.push(`Distribuição: ${byProduct.map(([p, n]) => `${p} (${n})`).join(' • ')}.`)
  if (late) insights.push(`${late} frente(s) em condição crítica. Pauta executiva deve começar por destrave.`)
  if (noNext) insights.push(`${noNext} item(ns) sem próxima ação — principal risco de perda de controle gerencial.`)
  if (byProject) insights.push(`Projeto com maior concentração: "${byProject[0]}" (${byProject[1]} frentes). Verificar capacidade.`)
  if (!insights.length) insights.push('Recorte equilibrado. Manter checkpoint preventivo e registrar decisões no histórico.')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Insights executivos</h3>
          <button className="btn small" onClick={() => { navigator.clipboard?.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
            <Copy size={14} /> {copied ? 'Copiado' : 'Copiar relatório'}
          </button>
        </div>
        <div className="card-body insight-list">
          {insights.map((ins, i) => <div key={i} className="insight"><strong>{ins}</strong></div>)}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3 className="card-title">Relatório textual executivo</h3></div>
        <div className="card-body">
          <textarea className="report-box" style={{ width: '100%' }} readOnly value={report} />
        </div>
      </div>
    </div>
  )
}

function ArchivedView({ items, onEdit, onRestore, canEdit }: {
  items: Item[]; onEdit: (id: string) => void; onRestore: (id: string) => void; canEdit: boolean
}) {
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
            <div className="empty" style={{ padding: 32 }}>Nenhum item arquivado. Itens arquivados podem ser restaurados aqui.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Produto</th><th>Projeto</th><th>Demanda</th>
                <th>Status</th><th>Responsável</th><th>Última atualização</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {archived.map(it => (
                <tr key={it.id} style={{ opacity: 0.75 }}>
                  <td style={{ fontWeight: 700 }}>{it.id}</td>
                  <td><Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} /></td>
                  <td>{it.project ?? '—'}</td>
                  <td>{it.demand ?? '—'}</td>
                  <td><Badge label={it.status} tone={statusTone(it.status)} /></td>
                  <td>{it.owner ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#5f7188' }}>{it.lastUpdate ? new Date(it.lastUpdate).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="row-actions" style={{ display: 'flex', gap: 4 }}>
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

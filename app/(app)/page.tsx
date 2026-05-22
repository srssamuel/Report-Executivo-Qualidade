'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/shared/supabase/client'
import {
  LayoutDashboard, Briefcase, Kanban, AlertTriangle, Calendar,
  Zap, FileText, Archive, Download, Upload, Plus,
  LogOut, Users, ArrowUpDown, X, Sun, Moon,
} from 'lucide-react'
import { Badge, ConfirmDialog } from '@/shared/components'
import {
  Item, UserProfile, Filters, Role, Gain, Product, GainType,
  STATUSES, PRIORITIES, PRODUCT_SUGGESTIONS, GAIN_TYPES, GAIN_TYPE_LABELS, gainTypeTone,
  normalizeItem,
  filteredItems, sortItems,
  riskOf,
  scoreOf, dataGaps, isDone, ownersOf,
  dateFmt,
  itemEffort, itemRemainingEffort, itemStart,
  urgencyCandidateScore, recommendationType,
  nextId, clamp, canEdit, canDelete, isAdmin,
} from '@/shared/domain'

// Import feature components
import { DashboardView } from '@/features/dashboard'
import { PortfolioView } from '@/features/portfolio'
import { BoardView } from '@/features/board'
import { RisksView } from '@/features/risks'
import { TimelineView } from '@/features/timeline'
import { CapacityView } from '@/features/capacity'
import { ExecutiveView } from '@/features/executive'
import { ArchivedView } from '@/features/archived'

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
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [focusCommentOnOpen, setFocusCommentOnOpen] = useState(false)
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Form state (modal) ────────────────────────────────────────────────────
  const [form, setForm] = useState<Partial<Item> & { tagsRaw?: string; commentText?: string; commentAuthor?: string; commentType?: string }>({})
  const [gainForm, setGainForm] = useState<{ gain_type: GainType; kpi: string; gain_value: string; detail: string }>({ gain_type: 'Financeiro', kpi: '', gain_value: '', detail: '' })
  const [modalGains, setModalGains] = useState<Gain[]>([])
  const [modalHistory, setModalHistory] = useState<{ at: string; field: string; old_value: string; new_value: string; changed_by: string }[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; variant?: 'default' | 'danger'
    inputMode?: boolean; inputPlaceholder?: string; inputDefaultValue?: string
    confirmLabel?: string; onConfirm: (value?: string) => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (stored === 'light') {
      setDarkMode(false)
      document.documentElement.removeAttribute('data-theme')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  function toggleDarkMode() {
    setDarkMode(prev => {
      const next = !prev
      if (next) {
        document.documentElement.setAttribute('data-theme', 'dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
        localStorage.setItem('theme', 'light')
      }
      return next
    })
  }

  function openConfirm(opts: Omit<typeof confirmDialog, 'open'>) {
    setConfirmDialog({ ...opts, open: true })
  }
  function closeConfirm() {
    setConfirmDialog(prev => ({ ...prev, open: false }))
  }

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 2400)
  }, [])

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          setLoadError('Sessão expirada. Faça login novamente.')
          setLoading(false)
          return
        }

        const [profileRes, itemsRes, gainsRes, productsRes] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('id', user.id).single(),
          supabase.from('items').select('*').order('due_date', { ascending: true, nullsFirst: false }),
          supabase.from('gains').select('*').order('created_at', { ascending: false }),
          supabase.from('products').select('*').order('name'),
        ])

        if (profileRes.data) {
          const prof = profileRes.data as UserProfile & { password_changed?: boolean }
          setProfile(prof)
          if (prof.password_changed === false) {
            window.location.href = '/reset-password?first=1'
            return
          }
        }
        if (itemsRes.error) {
          setLoadError(`Erro ao carregar itens: ${itemsRes.error.message}`)
        }
        if (gainsRes.data) setGains(gainsRes.data as Gain[])
        if (productsRes.data) setProducts(productsRes.data as Product[])

        if (itemsRes.data) {
          const mapped = itemsRes.data.map((row: Record<string, unknown>, i: number) => normalizeItem(mapRow(row), i))
          setItems(mapped)
        }
      } catch (err) {
        setLoadError(`Erro de conexão: ${err instanceof Error ? err.message : 'Tente novamente.'}`)
      } finally {
        setLoading(false)
      }
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

  const productNames = useMemo(() => products.filter(p => p.active).map(p => p.name), [products])
  const uniqueProductList = useMemo(() =>
    [...new Set([...productNames, ...PRODUCT_SUGGESTIONS, ...items.filter(i => !i.archived).map(i => i.product).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [productNames, items]
  )
  const uniqueProjectList = useMemo(() =>
    [...new Set(items.filter(i => !i.archived && (!filters.product || i.product === filters.product)).map(i => i.project).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items, filters.product]
  )
  const uniqueOwnerList = useMemo(() =>
    [...new Set(items.filter(i => !i.archived && (!filters.product || i.product === filters.product)).flatMap(i => ownersOf(i.owner)))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items, filters.product]
  )

  // ── Persist to Supabase ───────────────────────────────────────────────────
  async function saveItem(payload: Item) {
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      id: payload.id,
      source_row: payload.sourceRow ?? null,
      due_date: payload.dueDate || null,
      original_date: payload.originalDate || null,
      project: payload.project || null,
      demand: payload.demand || null,
      definition: payload.definition || null,
      owner: payload.owner || null,
      status: payload.status,
      priority: payload.priority,
      progress: payload.progress,
      next_action: payload.nextAction || null,
      executive_comment: payload.executiveComment || null,
      last_update: new Date().toISOString(),
      tags: payload.tags,
      archived: payload.archived,
      source_status: payload.sourceStatus || null,
      product: payload.product || null,
      effort_hours: payload.effortHours || null,
      team_size: payload.teamSize || null,
      predecessor_id: payload.predecessorId || null,
      dependency_note: payload.dependencyNote || null,
      start_date: payload.startDate || null,
      updated_by: user?.id ?? null,
    }
    const { error } = await supabase.from('items').upsert(row)
    if (error) {
      showToast(`Erro ao salvar: ${error.message}`)
      // Rollback: reload items from DB to undo optimistic update
      const { data } = await supabase.from('items').select('*').order('due_date', { ascending: true, nullsFirst: false })
      if (data) setItems(data.map((r: Record<string, unknown>, i: number) => normalizeItem(mapRow(r), i)))
      throw error
    }
  }

  /** Map snake_case DB row to camelCase Item */
  function mapRow(r: Record<string, unknown>): Partial<Item> {
    return {
      id: r.id as string,
      sourceRow: r.source_row as number | undefined,
      dueDate: r.due_date as string | undefined,
      originalDate: r.original_date as string | undefined,
      project: r.project as string | undefined,
      demand: r.demand as string | undefined,
      definition: r.definition as string | undefined,
      owner: r.owner as string | undefined,
      status: r.status as string,
      priority: r.priority as string,
      progress: r.progress as number,
      nextAction: r.next_action as string | undefined,
      executiveComment: r.executive_comment as string | undefined,
      lastUpdate: r.last_update as string | undefined,
      tags: r.tags as string[] | undefined,
      archived: r.archived as boolean,
      sourceStatus: r.source_status as string | undefined,
      product: r.product as string | undefined,
      effortHours: r.effort_hours as number | undefined,
      teamSize: r.team_size as number | undefined,
      predecessorId: r.predecessor_id as string | undefined,
      dependencyNote: r.dependency_note as string | undefined,
      startDate: r.start_date as string | undefined,
    }
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

  function archiveItem() {
    if (!modalId || modalId === 'new') return
    openConfirm({
      title: 'Arquivar item',
      message: 'Arquivar este item? Ele sairá das visões principais mas poderá ser restaurado.',
      variant: 'danger',
      confirmLabel: 'Arquivar',
      onConfirm: async () => {
        closeConfirm()
        const id = modalId as string
        await updateField(id, 'archived', true)
        setItems(prev => prev.map(i => i.id === id ? { ...i, archived: true } : i))
        showToast('Item arquivado.')
        closeModal()
      },
    })
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

  function deleteGain(gainId: string) {
    openConfirm({
      title: 'Remover ganho',
      message: 'Tem certeza que deseja remover este ganho? A ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Remover',
      onConfirm: async () => {
        closeConfirm()
        await supabase.from('gains').delete().eq('id', gainId)
        setGains(prev => prev.filter(g => g.id !== gainId))
        setModalGains(prev => prev.filter(g => g.id !== gainId))
        showToast('Ganho removido.')
      },
    })
  }

  async function restoreItem(id: string) {
    await updateField(id, 'archived', false)
    setItems(prev => prev.map(i => i.id === id ? { ...i, archived: false } : i))
    showToast('Item restaurado.')
  }

  // ── Bulk product assignment ──────────────────────────────────────────────
  function bulkSetProduct() {
    openConfirm({
      title: 'Atribuir produto em lote',
      message: `Informe o nome do produto para aplicar aos ${filtered.length} item(ns) filtrado(s):`,
      inputMode: true,
      inputPlaceholder: 'Nome do produto…',
      confirmLabel: 'Aplicar',
      onConfirm: async (value) => {
        closeConfirm()
        const trimmed = (value ?? '').trim()
        if (!trimmed) return
        for (const it of filtered) {
          await updateField(it.id, 'product', trimmed)
        }
        showToast(`Produto "${trimmed}" aplicado a ${filtered.length} item(ns).`)
      },
    })
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
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Carregando carteira…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="loading-screen">
        <AlertTriangle size={32} className="error-text" />
        <p className="error-text">{loadError}</p>
        <button className="btn primary" onClick={() => window.location.reload()}>Tentar novamente</button>
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
          {canEditItems && <label className="btn small" style={{ cursor: 'pointer' }}><Upload size={14} /> Importar <input type="file" accept=".json" className="sr-file-input" onChange={importJSON} /></label>}
          <button className="btn small ghost" onClick={() => { const o: ('standard'|'wide'|'ultra')[] = ['standard','wide','ultra']; setUiLayout(o[(o.indexOf(uiLayout)+1)%3]) }}>
            <ArrowUpDown size={14} />
          </button>
          <button className="btn small ghost" onClick={() => setTableDense(d => !d)}>
            {tableDense ? 'Confortável' : 'Compacta'}
          </button>
          <button className="btn small ghost theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Modo claro' : 'Modo escuro'}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {profile && (
            <span className="user-info">
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
          {uniqueProductList.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="select" value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}>
          <option value="">Todos os projetos</option>
          {uniqueProjectList.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="select" value={filters.owner} onChange={e => setFilters(f => ({ ...f, owner: e.target.value }))}>
          <option value="">Todos os responsáveis</option>
          {uniqueOwnerList.map(o => <option key={o}>{o}</option>)}
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
      {view === 'portfolio' && <PortfolioView filtered={filtered} onEdit={openModal} onQuickComment={(id) => openModal(id, true)} canEdit={canEditItems} onFieldChange={updateField} allItems={items} productOptions={uniqueProductList} />}
      {view === 'board' && <BoardView filtered={filtered} onEdit={openModal} onStatusChange={(id, status) => updateField(id, 'status', status)} />}
      {view === 'risks' && <RisksView filtered={filtered} onEdit={openModal} />}
      {view === 'timeline' && <TimelineView filtered={filtered} onEdit={openModal} />}
      {view === 'capacity' && <CapacityView filtered={filtered} weeklyCapacity={weeklyCapacity} setWeeklyCapacity={setWeeklyCapacity} urgentForm={urgentForm} setUrgentForm={setUrgentForm} simulate={simulateUrgent} simulated={urgentSimulated} setSimulated={setUrgentSimulated} items={items} onEdit={openModal} canEdit={canEditItems} saveItem={saveItem} setItems={setItems} showToast={showToast} />}
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
                    <datalist id="productOptions">{uniqueProductList.map(p => <option key={p} value={p} />)}</datalist>
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
                <div className="modal-form-actions">
                  {modalId !== 'new' && canEditItems && <button type="button" className="btn" onClick={duplicateItem}>Duplicar</button>}
                  {modalId !== 'new' && canDeleteItems && <button type="button" className="btn danger" onClick={archiveItem}>Arquivar</button>}
                  <button type="button" className="btn ghost" onClick={closeModal}>Cancelar</button>
                  {canEditItems && <button type="submit" className="btn primary">Salvar</button>}
                </div>
              </form>

              {/* Comments */}
              {modalId !== 'new' && (
                <div>
                  <h3 className="modal-section-title">Comentários</h3>
                  {canEditItems && (
                    <div className="comment-form">
                      <div className="comment-form-row">
                        <input placeholder="Autor" value={form.commentAuthor ?? ''} onChange={e => setForm(f => ({ ...f, commentAuthor: e.target.value }))} />
                        <select value={form.commentType ?? 'Comentário'} onChange={e => setForm(f => ({ ...f, commentType: e.target.value }))}>
                          {['Comentário','Decisão','Risco','Atualização','Bloqueio'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <textarea ref={commentTextareaRef} rows={2} placeholder="Adicionar comentário…" value={form.commentText ?? ''} onChange={e => setForm(f => ({ ...f, commentText: e.target.value }))} />
                      <div className="modal-form-actions-end">
                        <button className="btn small primary" type="button" onClick={addComment}>Registrar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Gains */}
              {modalId !== 'new' && (
                <div className="modal-section">
                  <h3 className="modal-section-title">Ganhos registrados</h3>
                  {canEditItems && (
                    <div className="gain-form">
                      <div className="gain-form-row">
                        <label>Tipo de ganho
                          <select value={gainForm.gain_type} onChange={e => setGainForm(f => ({ ...f, gain_type: e.target.value as GainType }))}>
                            {GAIN_TYPES.map(t => <option key={t} value={t}>{GAIN_TYPE_LABELS[t]}</option>)}
                          </select>
                        </label>
                        <label>KPI impactado
                          <input placeholder="Ex.: NPS, CSAT, Tempo médio…" value={gainForm.kpi} onChange={e => setGainForm(f => ({ ...f, kpi: e.target.value }))} />
                        </label>
                      </div>
                      <label>Valor do ganho
                        <input placeholder="Ex.: +12%, R$ 50k/mês, 2h reduzidas…" value={gainForm.gain_value} onChange={e => setGainForm(f => ({ ...f, gain_value: e.target.value }))} />
                      </label>
                      <label>Detalhamento
                        <textarea rows={2} placeholder="Detalhe o ganho obtido com esta frente…" value={gainForm.detail} onChange={e => setGainForm(f => ({ ...f, detail: e.target.value }))} />
                      </label>
                      <div className="modal-form-actions-end">
                        <button className="btn small primary" type="button" onClick={addGain}>Registrar ganho</button>
                      </div>
                    </div>
                  )}
                  {modalGains.length === 0 ? (
                    <div className="empty">Nenhum ganho registrado para esta frente.</div>
                  ) : (
                    <div className="gain-list">
                      {modalGains.map(g => (
                        <div key={g.id} className="gain-card">
                          <div className="gain-card-body">
                            <div className="task-meta gain-card-meta">
                              <Badge label={g.gain_type} tone={gainTypeTone(g.gain_type)} />
                              {g.kpi && <Badge label={g.kpi} tone="tone-blue" />}
                              {g.gain_value && <Badge label={g.gain_value} tone="tone-green" />}
                            </div>
                            {g.detail && <p className="gain-detail">{g.detail}</p>}
                            <small className="gain-timestamp">{new Date(g.created_at).toLocaleDateString('pt-BR')} {new Date(g.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>
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
                <div className="modal-section">
                  <h3 className="modal-section-title">Histórico de alterações</h3>
                  <div className="history-wrap">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Campo</th>
                          <th>De</th>
                          <th>Para</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalHistory.map((h, i) => (
                          <tr key={i}>
                            <td>{new Date(h.at).toLocaleDateString('pt-BR')} {new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="history-field">{h.field}</td>
                            <td className="history-old">{h.old_value || '—'}</td>
                            <td className="history-new">{h.new_value || '—'}</td>
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

      {/* ── Confirm Dialog ──────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        inputMode={confirmDialog.inputMode}
        inputPlaceholder={confirmDialog.inputPlaceholder}
        inputDefaultValue={confirmDialog.inputDefaultValue}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />

      {/* ── Toast ────────────────────────────────────────────── */}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

export type Role = 'admin' | 'superintendente' | 'lider' | 'analista' | 'viewer'

export interface ItemComment {
  id?: string
  at: string
  author: string
  type: string
  text: string
}

export interface HistoryEntry {
  at: string
  field: string
  from: unknown
  to: unknown
}

export interface Item {
  id: string
  sourceRow?: number
  dueDate?: string
  originalDate?: string
  project?: string
  demand?: string
  definition?: string
  owner?: string
  status: string
  priority: string
  progress: number
  nextAction?: string
  executiveComment?: string
  lastUpdate?: string
  tags: string[]
  archived: boolean
  sourceStatus?: string
  product?: string
  effortHours?: number
  teamSize?: number
  predecessorId?: string
  dependencyNote?: string
  startDate?: string
  comments?: ItemComment[]
  history?: HistoryEntry[]
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: Role
  created_at: string
}

export const STATUSES = [
  'A iniciar','Em andamento','Em validação','Bloqueado',
  'Atrasado','Pausado','Concluído','Entregue','Cancelado','Sem status',
]
export const PRIORITIES = ['Crítica','Alta','Média','Baixa']
export const PRODUCT_SUGGESTIONS = ['Vivo','Nubank','Enel','Athena','Madeira Madeira','Interno','Data CX','Outro']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  superintendente: 'Superintendente',
  lider: 'Líder',
  analista: 'Analista',
  viewer: 'Visualizador',
}

export function canEdit(role: Role) {
  return ['admin','superintendente','lider','analista'].includes(role)
}
export function canDelete(role: Role) {
  return ['admin','superintendente','lider'].includes(role)
}
export function isAdmin(role: Role) { return role === 'admin' }

export function esc(str: unknown): string {
  return String(str ?? '').replace(/[&<>'"]/g, (c) =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c] ?? c
  )
}

export function today(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function parseDate(iso?: string | null): Date | null {
  if (!iso) return null
  const [y,m,d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function dateFmt(iso?: string | null): string {
  const d = parseDate(iso)
  return d ? d.toLocaleDateString('pt-BR') : 'Sem prazo'
}

export function daysToDue(iso?: string | null): number | null {
  const d = parseDate(iso)
  if (!d) return null
  return Math.round((d.getTime() - today().getTime()) / 86400000)
}

export function relativeDateText(iso?: string): string {
  const d = daysToDue(iso)
  if (d === null) return 'Sem prazo'
  if (d < 0) return `${Math.abs(d)} dia(s) de atraso`
  if (d === 0) return 'vence hoje'
  return `faltam ${d} dia(s)`
}

export function isDone(it: Item): boolean {
  return ['Concluído','Entregue','Cancelado'].includes(it.status)
}

export function ownersOf(owner?: string): string[] {
  return String(owner ?? '')
    .replace(/\s+e\s+/gi, ',')
    .replace(/\s*&\s*/g, ',')
    .replace(/\s*\/\s*/g, ',')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

export function normalizeStatus(status: unknown): string {
  const raw = String(status ?? '').trim()
  const found = STATUSES.find(s => s.toLowerCase() === raw.toLowerCase())
  return found ?? (raw ? raw : 'Sem status')
}

export function defaultProgress(status: string): number {
  const s = normalizeStatus(status)
  if (['Concluído','Entregue'].includes(s)) return 100
  if (['Em andamento','Em validação'].includes(s)) return 50
  return 0
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0))
}

export function inferProduct(item: Partial<Item>): string {
  const text = `${item.project ?? ''} ${item.demand ?? ''} ${item.definition ?? ''}`.toLowerCase()
  if (text.includes('nubank') || text.includes('nu ')) return 'Nubank'
  if (text.includes('vivo')) return 'Vivo'
  return item.product ?? 'Vivo'
}

export function estimateEffortHours(item: Item): number {
  const base =
    item.priority === 'Crítica' ? 40 :
    item.priority === 'Alta' ? 24 :
    item.priority === 'Média' ? 16 : 8
  const textLen = String(item.definition ?? '').length
  const bonus = Math.min(32, Math.floor(textLen / 120) * 4)
  return base + bonus
}

export function normalizeItem(raw: Partial<Item>, idx = 0): Item {
  const status = normalizeStatus(raw.status)
  const progress = raw.progress != null
    ? clamp(Number(raw.progress), 0, 100)
    : defaultProgress(status)
  return {
    id: raw.id ?? `G6-${String(idx + 1).padStart(3, '0')}`,
    sourceRow: raw.sourceRow,
    dueDate: raw.dueDate ?? '',
    originalDate: raw.originalDate ?? '',
    project: raw.project ?? '',
    demand: raw.demand ?? '',
    definition: raw.definition ?? '',
    owner: raw.owner ?? '',
    status,
    priority: raw.priority ?? 'Média',
    progress,
    nextAction: raw.nextAction ?? '',
    executiveComment: raw.executiveComment ?? '',
    lastUpdate: raw.lastUpdate ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    archived: raw.archived ?? false,
    sourceStatus: raw.sourceStatus ?? status,
    product: raw.product ?? inferProduct(raw),
    effortHours: raw.effortHours ? clamp(Number(raw.effortHours), 0, 9999) : undefined,
    teamSize: raw.teamSize ? clamp(Number(raw.teamSize), 1, 50) : undefined,
    predecessorId: raw.predecessorId ?? '',
    dependencyNote: raw.dependencyNote ?? '',
    startDate: raw.startDate ?? '',
    comments: raw.comments ?? [],
    history: raw.history ?? [],
  }
}

export function riskOf(it: Item): string {
  if (isDone(it)) return 'Concluído/Baixo risco'
  if (it.archived) return 'Arquivado'
  if (it.status === 'Bloqueado') return 'Bloqueado'
  const days = daysToDue(it.dueDate)
  if (days === null) return 'Sem prazo'
  if (days < 0 || it.status === 'Atrasado') return 'Atrasado'
  if (days === 0) return 'Vence hoje'
  if (days <= 7) return 'Atenção 7 dias'
  return 'Em controle'
}

export function riskSeverity(risk: string): number {
  return (
    { 'Bloqueado':0,'Atrasado':1,'Vence hoje':2,'Atenção 7 dias':3,'Sem prazo':4,'Em controle':5,'Concluído/Baixo risco':6,'Arquivado':7 }[risk] ?? 9
  )
}

export function riskTone(risk: string): string {
  if (['Atrasado','Bloqueado'].includes(risk)) return 'tone-red'
  if (['Vence hoje','Atenção 7 dias','Sem prazo'].includes(risk)) return 'tone-amber'
  if (risk === 'Concluído/Baixo risco') return 'tone-green'
  return 'tone-blue'
}

export function statusTone(status: string): string {
  if (['Bloqueado','Atrasado'].includes(status)) return 'tone-red'
  if (['Concluído','Entregue'].includes(status)) return 'tone-green'
  if (['Em validação','Em andamento'].includes(status)) return 'tone-blue'
  if (status === 'Pausado') return 'tone-amber'
  return 'tone-gray'
}

export function priorityTone(priority: string): string {
  if (priority === 'Crítica') return 'tone-red'
  if (priority === 'Alta') return 'tone-amber'
  if (priority === 'Baixa') return 'tone-gray'
  return 'tone-blue'
}

export function productTone(product?: string): string {
  const p = String(product ?? '').toLowerCase()
  if (p.includes('nubank') || p === 'nu') return 'tone-purple'
  if (p.includes('vivo')) return 'tone-blue'
  if (p.includes('interno')) return 'tone-gray'
  return 'tone-green'
}

export function dataGaps(it: Item): string[] {
  const gaps: string[] = []
  if (!it.product) gaps.push('sem produto')
  if (!it.dueDate) gaps.push('sem prazo')
  if (!it.owner) gaps.push('sem responsável')
  if (!it.status || it.status === 'Sem status') gaps.push('sem status')
  if (!it.definition) gaps.push('sem definição')
  if (!it.nextAction && !isDone(it)) gaps.push('sem próxima ação')
  return gaps
}

export function scoreOf(it: Item): number {
  if (isDone(it)) return 100
  let score = 0
  if (it.product) score += 12
  if (it.dueDate) score += 18
  if (it.owner) score += 14
  if (it.status && it.status !== 'Sem status') score += 12
  if (it.definition) score += 14
  if (it.nextAction) score += 16
  if (it.priority) score += 8
  if ((it.progress ?? 0) > 0) score += 6
  return clamp(score, 0, 100)
}

export function healthOf(it: Item): string {
  const s = scoreOf(it)
  if (isDone(it)) return 'Concluído'
  if (s < 55) return 'Crítico'
  if (s < 78) return 'Atenção'
  return 'Saudável'
}

export function itemEffort(it: Item): number {
  return clamp(Number(it.effortHours ?? estimateEffortHours(it)), 0, 9999)
}

export function itemRemainingEffort(it: Item): number {
  return Math.max(0, Math.round(itemEffort(it) * (1 - clamp(Number(it.progress ?? 0), 0, 100) / 100)))
}

export function itemTeamSize(it: Item): number {
  return Math.max(1, Math.round(Number(it.teamSize ?? ownersOf(it.owner).length ?? 1)))
}

export function itemStart(it: Item): string {
  if (it.startDate) return it.startDate
  if (!it.dueDate) return ''
  const due = parseDate(it.dueDate)
  if (!due) return ''
  const effort = itemEffort(it)
  const team = itemTeamSize(it)
  const days = Math.max(1, Math.ceil(effort / (team * 6)))
  const start = new Date(due)
  start.setDate(start.getDate() - days)
  return start.toISOString().slice(0, 10)
}

export interface Filters {
  query: string
  product: string
  project: string
  owner: string
  status: string
  risk: string
  sort: string
  criticalOnly: boolean
}

export function filteredItems(items: Item[], filters: Filters): Item[] {
  const q = filters.query.toLowerCase()
  return items.filter(it => {
    if (it.archived) return false
    if (filters.product && it.product !== filters.product) return false
    if (filters.project && it.project !== filters.project) return false
    if (filters.owner && !ownersOf(it.owner).includes(filters.owner)) return false
    if (filters.status && it.status !== filters.status) return false
    if (filters.risk && riskOf(it) !== filters.risk) return false
    if (filters.criticalOnly && !['Bloqueado','Atrasado','Vence hoje'].includes(riskOf(it))) return false
    if (q) {
      const haystack = `${it.project} ${it.demand} ${it.owner} ${it.definition} ${it.nextAction} ${it.product}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function sortItems(list: Item[], sort: string): Item[] {
  return [...list].sort((a, b) => {
    if (sort === 'risk') return riskSeverity(riskOf(a)) - riskSeverity(riskOf(b)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    if (sort === 'progressAsc') return Number(a.progress ?? 0) - Number(b.progress ?? 0)
    if (sort === 'product') return String(a.product).localeCompare(String(b.product), 'pt-BR') || String(a.project).localeCompare(String(b.project), 'pt-BR')
    if (sort === 'project') return String(a.project).localeCompare(String(b.project), 'pt-BR')
    if (sort === 'owner') return String(a.owner).localeCompare(String(b.owner), 'pt-BR')
    if (sort === 'updated') return String(b.lastUpdate ?? '').localeCompare(String(a.lastUpdate ?? ''))
    return (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || riskSeverity(riskOf(a)) - riskSeverity(riskOf(b))
  })
}

export function countsBy<T>(list: T[], getter: (item: T) => string): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, it) => {
    const key = getter(it) || 'Não informado'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

export function ownerLoad(list: Item[]): Record<string, number> {
  const load: Record<string, number> = {}
  list.filter(i => !isDone(i)).forEach(it => {
    const owners = ownersOf(it.owner)
    const people = owners.length ? owners : ['Sem responsável']
    const share = itemRemainingEffort(it) / people.length
    people.forEach(o => { load[o] = (load[o] ?? 0) + share })
  })
  return load
}

export function capacityTone(percent: number): string {
  return percent >= 115 ? 'danger' : percent >= 85 ? 'warn' : ''
}

export function urgencyCandidateScore(it: Item, urgent: { owner?: string; dueDate?: string; effort: number }): number {
  if (isDone(it)) return -999
  const urgentOwners = ownersOf(urgent.owner)
  const candidateOwners = ownersOf(it.owner)
  const overlap = urgentOwners.length ? candidateOwners.filter(o => urgentOwners.includes(o)).length : 0
  let score = 0
  score += overlap ? 42 : 4
  score += it.priority === 'Baixa' ? 24 : it.priority === 'Média' ? 16 : it.priority === 'Alta' ? 6 : -18
  score += ['A iniciar','Pausado','Sem status'].includes(it.status) ? 16 : it.status === 'Em andamento' ? 8 : -4
  const urgentDue = parseDate(urgent.dueDate), due = parseDate(it.dueDate)
  if (urgentDue && due) { score += due > urgentDue ? 18 : -8 }
  if (!it.dueDate) score += 6
  score += Math.min(18, itemRemainingEffort(it) / 4)
  if (['Bloqueado','Atrasado','Vence hoje'].includes(riskOf(it))) score -= 18
  return Math.round(score)
}

export function recommendationType(it: Item, urgent: { owner?: string; effort: number }): string {
  const u = ownersOf(urgent.owner), c = ownersOf(it.owner)
  const overlap = u.length && c.some(o => u.includes(o))
  if (['A iniciar','Pausado','Sem status'].includes(it.status)) return 'Pausar ou postergar início'
  if (overlap && itemRemainingEffort(it) >= urgent.effort * 0.5) return 'Renegociar prazo para liberar capacidade'
  if (it.priority === 'Baixa' || it.priority === 'Média') return 'Reduzir escopo ou fatiar entrega'
  return 'Reavaliar dono ou pedir reforço'
}

export function executiveLines(list: Item[], filters: Filters): string {
  const total = list.length
  const done = list.filter(isDone).length
  const active = total - done
  const late = list.filter(i => ['Atrasado','Bloqueado'].includes(riskOf(i))).length
  const soon = list.filter(i => ['Vence hoje','Atenção 7 dias'].includes(riskOf(i))).length
  const gaps = list.filter(i => dataGaps(i).length > 0 && !isDone(i)).length
  const effort = Math.round(list.filter(i => !isDone(i)).reduce((s, i) => s + itemRemainingEffort(i), 0))
  const health = total ? Math.round(list.reduce((s, i) => s + scoreOf(i), 0) / total) : 0
  const byProduct = Object.entries(countsBy(list, i => i.product ?? 'Sem produto')).sort((a, b) => b[1] - a[1])
  const top = [...list].filter(i => !isDone(i)).sort((a, b) => riskSeverity(riskOf(a)) - riskSeverity(riskOf(b)) || scoreOf(a) - scoreOf(b)).slice(0, 7)
  const filterInfo = [
    filters.product && `Produto: ${filters.product}`,
    filters.project && `Projeto: ${filters.project}`,
    filters.owner && `Resp.: ${filters.owner}`,
    filters.status && `Status: ${filters.status}`,
    filters.criticalOnly && 'Foco crítico ativo',
  ].filter(Boolean).join(' | ') || 'Carteira completa'
  const productText = byProduct.length ? byProduct.map(([p, n]) => `• ${p}: ${n} frente(s)`).join('\n') : '• Sem produto informado'
  const topText = top.map(i => `• [${i.product ?? 'Sem produto'}] ${i.project ?? 'Sem projeto'} — ${i.demand ?? 'Sem demanda'} | ${riskOf(i)} | Prazo: ${dateFmt(i.dueDate)} | Resp.: ${i.owner ?? 'N/I'}${i.nextAction ? ` | Próxima ação: ${i.nextAction}` : ''}`).join('\n')
  return `*Report Executivo — Superintendência Vivo e Nubank — ${new Date().toLocaleDateString('pt-BR')}*
_${filterInfo}_

*1. Status global*
A carteira possui *${total} frente(s)* no recorte atual, sendo *${active} ativa(s)* e *${done} concluída(s)/entregue(s)*. O score executivo está em *${health}%*. Esforço remanescente estimado: *${effort}h*.

*2. Distribuição por produto/cliente*
${productText}

*3. Pontos de atenção*
• *${late}* frente(s) críticas, atrasadas ou bloqueadas.
• *${soon}* frente(s) vencendo hoje ou em até 7 dias.
• *${gaps}* frente(s) com lacunas de governança.

*4. Fila de decisão / acompanhamento*
${topText || '• Sem riscos críticos no recorte atual.'}

*5. Direcionamento recomendado*
Priorizar destrave das frentes críticas, formalizar prazo e próxima ação dos itens sem governança, e manter esta carteira como ritual semanal da Superintendência.`
}

export function nextId(items: Item[]): string {
  const nums = items.map(i => String(i.id ?? '').match(/G6-(\d+)/)?.[1]).filter(Boolean).map(Number)
  const n = (nums.length ? Math.max(...nums) : 0) + 1
  return `G6-${String(n).padStart(3, '0')}`
}

export function monthLabel(iso?: string): string {
  const d = parseDate(iso)
  return d ? d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Sem prazo definido'
}

export function isoDate(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ── Score de risco composto (V2) ─────────────────────────────────────────────

export type RiskBand = 'Crítico' | 'Alto' | 'Médio' | 'Baixo'

export interface RiskFactor {
  key: 'prazo' | 'status' | 'progresso' | 'staleness' | 'dependencia'
  label: string
  detail: string
  raw: number          // 0–100 antes do peso
  weight: number       // 0–1
  contribution: number // contribuição final para o score (inclui ajuste de combinação crítica)
}

export interface RiskScoreResult {
  score: number
  band: RiskBand
  factors: RiskFactor[]
  mainReason: string
}

const RISK_WEIGHTS = { prazo: 0.40, status: 0.20, progresso: 0.15, staleness: 0.15, dependencia: 0.10 } as const

function factorPrazo(it: Item): { raw: number; detail: string } {
  const d = daysToDue(it.dueDate)
  if (d === null) return { raw: 50, detail: 'Sem prazo definido' }
  if (d < 0) return { raw: 100, detail: `Vencido há ${Math.abs(d)} dia(s)` }
  if (d === 0) return { raw: 85, detail: 'Vence hoje' }
  if (d <= 3) return { raw: 75, detail: `Vence em ${d} dia(s)` }
  if (d <= 7) return { raw: 60, detail: `Vence em ${d} dia(s)` }
  if (d <= 14) return { raw: 35, detail: `Vence em ${d} dias` }
  return { raw: 10, detail: `Folga de ${d} dias` }
}

function factorStatus(it: Item): { raw: number; detail: string } {
  const map: Record<string, number> = {
    'Bloqueado': 100, 'Atrasado': 90, 'Pausado': 100,
    'A iniciar': 30, 'Em validação': 30, 'Em andamento': 20,
  }
  return { raw: map[it.status] ?? 30, detail: it.status }
}

function factorProgresso(it: Item): { raw: number; detail: string } {
  const start = parseDate(it.startDate)
  const due = parseDate(it.dueDate)
  if (!start || !due || due.getTime() <= start.getTime()) return { raw: 0, detail: 'Sem janela de datas para comparar' }
  const span = due.getTime() - start.getTime()
  const elapsed = clamp(Math.round((today().getTime() - start.getTime()) / span * 100), 0, 100)
  const gap = clamp(elapsed - (it.progress ?? 0), 0, 100)
  return { raw: gap, detail: `${elapsed}% do prazo decorrido · ${it.progress ?? 0}% concluído` }
}

function factorStaleness(it: Item): { raw: number; detail: string } {
  if (!it.lastUpdate) return { raw: 50, detail: 'Nunca atualizado' }
  const days = Math.floor((Date.now() - new Date(it.lastUpdate).getTime()) / 86400000)
  if (days >= 14) return { raw: 100, detail: `Sem atualização há ${days} dias` }
  if (days >= 7) return { raw: 60, detail: `Sem atualização há ${days} dias` }
  if (days >= 3) return { raw: 25, detail: `Atualizado há ${days} dias` }
  return { raw: 0, detail: 'Atualizado recentemente' }
}

function factorDependencia(it: Item, all: Item[]): { raw: number; detail: string } {
  if (it.predecessorId) {
    const pred = all.find(x => x.id === it.predecessorId)
    if (!pred) return { raw: 60, detail: `Predecessora ${it.predecessorId} não encontrada` }
    if (isDone(pred)) return { raw: 0, detail: 'Predecessora concluída' }
    const predLate = ['Bloqueado', 'Atrasado'].includes(pred.status) || ((daysToDue(pred.dueDate) ?? 1) < 0)
    if (predLate) return { raw: 100, detail: `Predecessora ${pred.id} bloqueada/atrasada` }
    return { raw: 60, detail: `Aguarda ${pred.id} em andamento` }
  }
  if (it.dependencyNote) return { raw: 40, detail: it.dependencyNote }
  return { raw: 0, detail: 'Sem dependência' }
}

export function riskBand(score: number): RiskBand {
  if (score >= 70) return 'Crítico'
  if (score >= 50) return 'Alto'
  if (score >= 30) return 'Médio'
  return 'Baixo'
}

export function riskBandTone(band: RiskBand): string {
  if (band === 'Crítico') return 'tone-red'
  if (band === 'Alto') return 'tone-amber'
  if (band === 'Médio') return 'tone-gray'
  return 'tone-green'
}

export function riskScore(it: Item, all: Item[]): RiskScoreResult | null {
  if (isDone(it) || it.archived) return null
  const rawParts: { key: RiskFactor['key']; label: string; raw: number; detail: string }[] = [
    { key: 'prazo', label: 'Prazo', ...factorPrazo(it) },
    { key: 'status', label: 'Status', ...factorStatus(it) },
    { key: 'progresso', label: 'Progresso vs tempo', ...factorProgresso(it) },
    { key: 'staleness', label: 'Atualização', ...factorStaleness(it) },
    { key: 'dependencia', label: 'Dependência', ...factorDependencia(it, all) },
  ]
  // Boost de combinação crítica: Bloqueado/Atrasado + prazo vencido é pior que a soma das partes.
  // O boost é distribuído proporcionalmente entre os fatores prazo e status para que
  // score === Math.round(factors.reduce((s, f) => s + f.contribution, 0)) continue verdadeiro.
  const isCriticalStatus = ['Bloqueado', 'Atrasado'].includes(it.status)
  const isOverdue = (daysToDue(it.dueDate) ?? 0) < 0
  const totalBoost = isCriticalStatus && isOverdue ? 10 : 0
  // Aplica metade do boost no fator prazo e metade no fator status (ambos já em raw=100 neste caso)
  const boostPerCriticalFactor = totalBoost / 2
  const factors: RiskFactor[] = rawParts.map(p => {
    const isBoostTarget = totalBoost > 0 && (p.key === 'prazo' || p.key === 'status')
    const contribution = p.raw * RISK_WEIGHTS[p.key] + (isBoostTarget ? boostPerCriticalFactor : 0)
    return { key: p.key, label: p.label, detail: p.detail, raw: p.raw, weight: RISK_WEIGHTS[p.key], contribution }
  })
  const score = Math.round(factors.reduce((s, f) => s + f.contribution, 0))
  return { score, band: riskBand(score), factors, mainReason: riskOf(it) }
}

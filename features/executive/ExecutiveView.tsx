'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Printer } from 'lucide-react'
import {
  Item,
  Filters,
  Role,
  UserProfile,
  executiveLines,
  isDone,
  riskOf,
  countsBy,
  ownersOf,
  dataGaps,
  dateFmt,
  ROLE_LABELS,
  riskScore,
  scoreOf,
  daysToDue,
  itemRemainingEffort,
  ownerLoad,
} from '@/shared/domain'
import { createClient } from '@/lib/supabase/client'

// ── Faixa de KPIs com tendência (delta vs snapshot ≥6 dias) ─────────────────

interface Snapshot {
  day: string
  critical: number
  on_time_pct: number
  freshness_pct: number
  access_adherence_pct: number
  health: number
  effort_hours: number
}

function Delta({ now, then, invert = false, suffix = '' }: { now: number; then: number | null; invert?: boolean; suffix?: string }) {
  if (then === null) return <small style={{ color: 'var(--muted)' }}>tendência em formação</small>
  const diff = Math.round(now - then)
  if (diff === 0) return <small style={{ color: 'var(--muted)' }}>estável vs 7d</small>
  const good = invert ? diff < 0 : diff > 0
  return (
    <small style={{ color: good ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{suffix} vs 7d
    </small>
  )
}

function KpiTrendStrip({ items }: { items: Item[] }) {
  const [baseline, setBaseline] = useState<Snapshot | null>(null)
  const [todaySnap, setTodaySnap] = useState<Snapshot | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('portfolio_snapshots')
      .select('day, critical, on_time_pct, freshness_pct, access_adherence_pct, health, effort_hours')
      .order('day', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data?.length) return
        const snaps = data as Snapshot[]
        setTodaySnap(snaps[0])
        const cutoff = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
        // baseline = snapshot mais recente com pelo menos 6 dias de idade
        const base = snaps.find(s => s.day <= cutoff)
        if (base) setBaseline(base)
      })
  }, [])

  const active = items.filter(it => !it.archived && !isDone(it))
  const scored = active.map(it => riskScore(it, items)).filter((r): r is NonNullable<typeof r> => r !== null)
  const critical = scored.filter(r => r.band === 'Crítico').length
  const overdue = active.filter(it => (daysToDue(it.dueDate) ?? 1) < 0).length
  const onTimePct = active.length ? Math.round(((active.length - overdue) / active.length) * 100) : 100
  const fresh = active.filter(it => it.lastUpdate && Date.now() - new Date(it.lastUpdate).getTime() <= 7 * 86400000).length
  const freshnessPct = active.length ? Math.round((fresh / active.length) * 100) : 100
  const notArchived = items.filter(it => !it.archived)
  const health = notArchived.length ? Math.round(notArchived.reduce((s, i) => s + scoreOf(i), 0) / notArchived.length) : 0
  const effort = Math.round(active.reduce((s, i) => s + itemRemainingEffort(i), 0))
  const adherence = todaySnap?.access_adherence_pct ?? null

  const kpis: { label: string; value: string; now: number; then: number | null; invert?: boolean; suffix?: string }[] = [
    { label: 'Saúde da carteira', value: `${health}`, now: health, then: baseline?.health ?? null },
    { label: 'Frentes críticas', value: `${critical}`, now: critical, then: baseline?.critical ?? null, invert: true },
    { label: 'No prazo', value: `${onTimePct}%`, now: onTimePct, then: baseline?.on_time_pct ?? null, suffix: 'pp' },
    { label: 'Freshness ≤7d', value: `${freshnessPct}%`, now: freshnessPct, then: baseline?.freshness_pct ?? null, suffix: 'pp' },
    { label: 'Aderência de acesso', value: adherence !== null ? `${Math.round(adherence)}%` : '—', now: adherence ?? 0, then: adherence !== null ? (baseline?.access_adherence_pct ?? null) : null, suffix: 'pp' },
    { label: 'Esforço restante', value: `${effort}h`, now: effort, then: baseline?.effort_hours ?? null, invert: true, suffix: 'h' },
  ]

  return (
    <div className="grid three" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      {kpis.map(k => (
        <div key={k.label} className="impact-box">
          <span>{k.label}</span>
          <strong>{k.value}</strong>
          <Delta now={k.now} then={k.then} invert={k.invert} suffix={k.suffix} />
        </div>
      ))}
    </div>
  )
}

interface ExecutiveViewProps {
  filtered: Item[]
  filters: Filters
  items: Item[] // todos os itens (não filtrados) — base do painel de aderência de uso
  userProfiles: UserProfile[]
  profile: UserProfile | null
}

// Uma frente é "crítica" quando está bloqueada, atrasada ou vencendo hoje.
const CRITICAL_RISKS = ['Bloqueado', 'Atrasado', 'Vence hoje']
const isCritical = (i: Item) => CRITICAL_RISKS.includes(riskOf(i))
// Aderência = concluída OU ainda dentro do prazo (não-crítica).
const isAdherent = (i: Item) => isDone(i) || !isCritical(i)

interface ResourceStat {
  name: string
  total: number
  pendentes: number
  criticas: number
  aderentes: number
  aderencia: number
  lastUpdateIso: string | null
}

function adherenceTone(pct: number): string {
  if (pct >= 85) return 'tone-green'
  if (pct >= 70) return 'tone-blue'
  if (pct >= 55) return 'tone-amber'
  return 'tone-red'
}

function buildResourceStats(items: Item[]): ResourceStat[] {
  const map = new Map<string, Item[]>()
  for (const it of items) {
    const owners = ownersOf(it.owner)
    const keys = owners.length ? owners : ['Sem responsável']
    for (const owner of keys) {
      const arr = map.get(owner) ?? []
      arr.push(it)
      map.set(owner, arr)
    }
  }

  const stats: ResourceStat[] = []
  for (const [name, list] of map) {
    const total = list.length
    const pendentes = list.filter(i => !isDone(i)).length
    const criticas = list.filter(isCritical).length
    const aderentes = list.filter(isAdherent).length
    const aderencia = total ? Math.round((aderentes / total) * 100) : 0

    let lastUpdateIso: string | null = null
    let lastMs = -Infinity
    for (const i of list) {
      if (!i.lastUpdate) continue
      const ms = new Date(i.lastUpdate).getTime()
      if (Number.isFinite(ms) && ms > lastMs) {
        lastMs = ms
        lastUpdateIso = i.lastUpdate
      }
    }

    stats.push({ name, total, pendentes, criticas, aderentes, aderencia, lastUpdateIso })
  }

  stats.sort(
    (a, b) =>
      b.criticas - a.criticas ||
      b.pendentes - a.pendentes ||
      a.aderencia - b.aderencia ||
      a.name.localeCompare(b.name, 'pt-BR'),
  )
  return stats
}

function firstName(name?: string): string {
  return String(name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
}

// Liga um colaborador (UserProfile) à sua estatística de frentes (owner é texto livre na planilha).
function matchStat(person: UserProfile, stats: ResourceStat[]): ResourceStat | null {
  const full = String(person.full_name ?? '').trim().toLowerCase()
  if (full) {
    const exact = stats.find(s => s.name.toLowerCase() === full)
    if (exact) return exact
    const partial = stats.find(s => {
      const sn = s.name.toLowerCase()
      return sn.includes(full) || full.includes(sn)
    })
    if (partial) return partial
  }
  const fn = firstName(person.full_name)
  if (fn) {
    const byFirst = stats.find(s => firstName(s.name) === fn)
    if (byFirst) return byFirst
  }
  return null
}

interface ManagerGroup {
  manager: UserProfile
  reports: { person: UserProfile; stat: ResourceStat | null }[]
  totalFrentes: number
  totalAderentes: number
  aderencia: number
  desdobrados: number
  pendentesDesdobro: number
}

function buildManagerGroups(userProfiles: UserProfile[], stats: ResourceStat[]): ManagerGroup[] {
  const byId = new Map(userProfiles.map(u => [u.id, u]))
  const reportsByManager = new Map<string, UserProfile[]>()
  for (const u of userProfiles) {
    if (!u.manager_id) continue
    if (!byId.has(u.manager_id)) continue
    const arr = reportsByManager.get(u.manager_id) ?? []
    arr.push(u)
    reportsByManager.set(u.manager_id, arr)
  }

  const groups: ManagerGroup[] = []
  for (const [managerId, people] of reportsByManager) {
    const manager = byId.get(managerId)!
    const reports = people
      .map(person => ({ person, stat: matchStat(person, stats) }))
      .sort((a, b) => (b.stat?.criticas ?? 0) - (a.stat?.criticas ?? 0))

    let totalFrentes = 0
    let totalAderentes = 0
    let desdobrados = 0
    for (const r of reports) {
      if (r.stat && r.stat.total > 0) {
        totalFrentes += r.stat.total
        totalAderentes += r.stat.aderentes
        desdobrados += 1
      }
    }
    const aderencia = totalFrentes ? Math.round((totalAderentes / totalFrentes) * 100) : 0
    groups.push({
      manager,
      reports,
      totalFrentes,
      totalAderentes,
      aderencia,
      desdobrados,
      pendentesDesdobro: reports.length - desdobrados,
    })
  }

  groups.sort(
    (a, b) =>
      b.pendentesDesdobro - a.pendentesDesdobro ||
      a.aderencia - b.aderencia ||
      a.manager.full_name?.localeCompare(b.manager.full_name ?? '', 'pt-BR') ||
      0,
  )
  return groups
}

// ─────────────────────────────────────────────────────────────────────────────
// Aderência de USO por usuário — mede TODOS os papéis operacionais (inclusive quem
// tem zero frente), por nível, com farol. Denominador = pessoas cadastradas, não
// "itens que existem". É isto que transforma o report em cobrança e não em vitrine.
//
// Parâmetros ajustáveis (calibre aqui a cadência esperada do time):
const USAGE_LEVELS: Role[] = ['gerente', 'coordenador', 'consultor', 'analista', 'lider']
const FRESH_DAYS = 3 // 🟢 atualizou nos últimos N dias
const ATTENTION_DAYS = 7 // 🟡 entre FRESH_DAYS e N; acima disso → 🔴
// Pesos do índice de uso (somam 1): frescor pesa mais (é o sinal de "uso vivo").
const W_FRESCOR = 0.45
const W_GOVERNANCA = 0.3
const W_PRAZO = 0.25

type Farol = 'verde' | 'amarelo' | 'vermelho'
const FAROL_EMOJI: Record<Farol, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }
const FAROL_TONE: Record<Farol, string> = { verde: 'tone-green', amarelo: 'tone-amber', vermelho: 'tone-red' }
const FAROL_HEX: Record<Farol, string> = { verde: '#10b981', amarelo: '#f59e0b', vermelho: '#ef4444' }
const ROLE_PLURAL: Partial<Record<Role, string>> = {
  gerente: 'Gerentes',
  coordenador: 'Coordenadores',
  consultor: 'Consultores',
  analista: 'Analistas',
  lider: 'Líderes',
}

interface UserUsage {
  person: UserProfile
  carteira: number
  ativos: number
  completos: number
  criticasSemAcao: number
  diasDesdeUpdate: number | null
  governanca: number
  indice: number
  farol: Farol
  motivo: string
}

function normUsageName(s?: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function buildUsage(allItems: Item[], userProfiles: UserProfile[], nowMs: number): UserUsage[] {
  // ownersOf() já canoniza os donos para os full_name cadastrados (setCanonicalOwners na page).
  const byOwner = new Map<string, Item[]>()
  for (const it of allItems) {
    for (const owner of ownersOf(it.owner)) {
      const k = normUsageName(owner)
      const arr = byOwner.get(k) ?? []
      arr.push(it)
      byOwner.set(k, arr)
    }
  }

  return userProfiles
    .filter(u => USAGE_LEVELS.includes(u.role))
    .map(person => {
      const list = byOwner.get(normUsageName(person.full_name)) ?? []
      const carteira = list.length
      const ativosList = list.filter(i => !i.archived && !isDone(i))
      const ativos = ativosList.length

      let lastMs = -Infinity
      for (const i of list) {
        if (!i.lastUpdate) continue
        const ms = new Date(i.lastUpdate).getTime()
        if (Number.isFinite(ms) && ms > lastMs) lastMs = ms
      }
      const diasDesdeUpdate = lastMs > -Infinity ? Math.max(0, Math.floor((nowMs - lastMs) / 86400000)) : null

      const completos = ativosList.filter(i => dataGaps(i).length === 0).length
      const criticasSemAcao = ativosList.filter(i => CRITICAL_RISKS.includes(riskOf(i)) && !i.nextAction).length
      const governanca = ativos ? Math.round((completos / ativos) * 100) : carteira ? 100 : 0
      const aderenciaPrazo = carteira ? Math.round((list.filter(isAdherent).length / carteira) * 100) : 0

      let indice: number
      let farol: Farol
      let motivo: string
      if (carteira === 0) {
        indice = 0
        farol = 'vermelho'
        motivo = 'sem carteira cadastrada'
      } else {
        const frescorScore =
          diasDesdeUpdate === null
            ? 0
            : diasDesdeUpdate <= FRESH_DAYS
              ? 100
              : diasDesdeUpdate <= ATTENTION_DAYS
                ? 65
                : diasDesdeUpdate <= 30
                  ? 25
                  : 0
        indice = Math.round(W_FRESCOR * frescorScore + W_GOVERNANCA * governanca + W_PRAZO * aderenciaPrazo)
        if (diasDesdeUpdate === null || diasDesdeUpdate > ATTENTION_DAYS || indice < 50) {
          farol = 'vermelho'
          motivo =
            diasDesdeUpdate === null
              ? 'nunca atualizou as frentes'
              : diasDesdeUpdate > ATTENTION_DAYS
                ? `sem atualização há ${diasDesdeUpdate} dias`
                : `índice de uso baixo (${indice}%)`
        } else if (indice < 75 || diasDesdeUpdate > FRESH_DAYS || governanca < 70 || criticasSemAcao > 0) {
          farol = 'amarelo'
          motivo =
            criticasSemAcao > 0
              ? `${criticasSemAcao} frente(s) crítica(s) sem próxima ação`
              : governanca < 70
                ? `governança ${governanca}% (${ativos - completos} item(ns) incompletos)`
                : diasDesdeUpdate > FRESH_DAYS
                  ? `última atualização há ${diasDesdeUpdate} dias`
                  : `índice ${indice}%`
        } else {
          farol = 'verde'
          motivo = ''
        }
      }

      return { person, carteira, ativos, completos, criticasSemAcao, diasDesdeUpdate, governanca, indice, farol, motivo }
    })
}

interface LevelSummary {
  key: string
  label: string
  count: number
  comUso: number
  cobertura: number
  verdes: number
  amarelos: number
  vermelhos: number
  indiceMedio: number
  farol: Farol
}

function summarizeUsage(list: UserUsage[], key: string, label: string): LevelSummary {
  const count = list.length
  const comUso = list.filter(u => u.carteira > 0).length
  const cobertura = count ? Math.round((comUso / count) * 100) : 0
  const verdes = list.filter(u => u.farol === 'verde').length
  const amarelos = list.filter(u => u.farol === 'amarelo').length
  const vermelhos = list.filter(u => u.farol === 'vermelho').length
  const indiceMedio = count ? Math.round(list.reduce((s, u) => s + u.indice, 0) / count) : 0
  let farol: Farol = 'verde'
  if (count === 0) farol = 'amarelo'
  else if (cobertura < 60 || vermelhos > verdes) farol = 'vermelho'
  else if (amarelos + vermelhos >= verdes) farol = 'amarelo'
  return { key, label, count, comUso, cobertura, verdes, amarelos, vermelhos, indiceMedio, farol }
}

function buildUsageReport(total: LevelSummary, levels: LevelSummary[], usage: UserUsage[], dateLabel: string): string {
  const out: string[] = [`*Cobrança de uso — Report Executivo — ${dateLabel}*`, '']
  out.push(
    `*GERAL (${total.count})* — ${FAROL_EMOJI.verde}${total.verdes} ${FAROL_EMOJI.amarelo}${total.amarelos} ${FAROL_EMOJI.vermelho}${total.vermelhos} · cobertura ${total.cobertura}% · índice médio ${total.indiceMedio}%`,
    '',
  )
  for (const lv of levels) {
    out.push(
      `*${lv.label.toUpperCase()} (${lv.count})* — ${FAROL_EMOJI.verde}${lv.verdes} ${FAROL_EMOJI.amarelo}${lv.amarelos} ${FAROL_EMOJI.vermelho}${lv.vermelhos} · cobertura ${lv.cobertura}% · índice ${lv.indiceMedio}%`,
    )
    const pend = usage
      .filter(u => u.person.role === lv.key && u.farol !== 'verde')
      .sort((a, b) => (a.farol === 'vermelho' ? 0 : 1) - (b.farol === 'vermelho' ? 0 : 1) || a.indice - b.indice)
    for (const u of pend) {
      out.push(`  ${FAROL_EMOJI[u.farol]} ${u.person.full_name || u.person.email} — ${u.motivo}`)
    }
    if (!pend.length) out.push('  ✅ Time todo em dia.')
    out.push('')
  }
  out.push('_Atualizem hoje o status das frentes: prazo, próxima ação, status e evidência. O que não está no sistema não existe na gestão._')
  return out.join('\n')
}

function lastUpdateLabel(iso: string | null): string {
  if (!iso) return '—'
  const formatted = dateFmt(iso)
  return formatted === 'Sem prazo' ? '—' : formatted
}

// Renderiza marcação inline do relatório (*negrito* e _itálico_) como HTML semântico.
const INLINE_RE = /(\*[^*\n]+\*|_[^_\n]+_)/g
function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const token = m[0]
    const inner = token.slice(1, -1)
    if (token.startsWith('*')) out.push(<strong key={`${keyBase}-s${i}`}>{inner}</strong>)
    else out.push(<em key={`${keyBase}-e${i}`} className="rp-em">{inner}</em>)
    last = idx + token.length
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// Converte o relatório textual (markdown estilo WhatsApp) num documento executivo
// estruturado — título, metadado, seções numeradas, listas e parágrafos. O botão
// "Copiar relatório" continua copiando o texto cru; isto é só a pré-visualização.
function ReportPreview({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let titleDone = false
  let listBuf: string[] = []
  let k = 0

  const flushList = () => {
    if (!listBuf.length) return
    const items = listBuf
    listBuf = []
    const idx = k++
    blocks.push(
      <ul key={`rp-${idx}`} className="rp-list">
        {items.map((it, j) => (
          <li key={j} className="rp-item">
            {renderInline(it, `rp-li-${idx}-${j}`)}
          </li>
        ))}
      </ul>,
    )
  }

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      flushList()
      continue
    }

    const section = line.match(/^\*(\d+)\.\s+(.*?)\*$/)
    const bullet = line.match(/^•\s+(.*)$/)
    const fullyBold = /^\*[^*]+\*$/.test(line)
    const fullyItalic = /^_[^_]+_$/.test(line)

    if (!titleDone && fullyBold) {
      titleDone = true
      flushList()
      blocks.push(
        <p key={`rp-${k++}`} className="rp-title">
          {line.slice(1, -1)}
        </p>,
      )
    } else if (fullyItalic) {
      flushList()
      blocks.push(
        <p key={`rp-${k++}`} className="rp-meta">
          {line.slice(1, -1)}
        </p>,
      )
    } else if (section) {
      flushList()
      blocks.push(
        <p key={`rp-${k++}`} className="rp-section">
          <span className="rp-section-num">{section[1]}</span>
          <span>{section[2]}</span>
        </p>,
      )
    } else if (bullet) {
      listBuf.push(bullet[1] ?? '')
    } else {
      flushList()
      const idx = k++
      blocks.push(
        <p key={`rp-${idx}`} className="rp-para">
          {renderInline(line, `rp-p-${idx}`)}
        </p>,
      )
    }
  }
  flushList()

  return <div className="report-preview" tabIndex={0} role="region" aria-label="Prévia do relatório executivo">{blocks}</div>
}

export function ExecutiveView({ filtered, filters, items, userProfiles, profile }: ExecutiveViewProps) {
  const [copied, setCopied] = useState(false)
  const [copiedUsage, setCopiedUsage] = useState(false)
  const [generatedAt, setGeneratedAt] = useState('')

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('pt-BR'))
  }, [])

  const report = executiveLines(filtered, filters)

  const resourceStats = useMemo(() => buildResourceStats(filtered), [filtered])
  const managerGroups = useMemo(
    () => buildManagerGroups(userProfiles, resourceStats),
    [userProfiles, resourceStats],
  )

  // ── Aderência de uso (todos os papéis operacionais, sobre TODOS os itens, não o recorte) ──
  const usage = useMemo(() => buildUsage(items, userProfiles, Date.now()), [items, userProfiles])
  const levelSummaries = useMemo(
    () =>
      USAGE_LEVELS.map(role =>
        summarizeUsage(usage.filter(u => u.person.role === role), role, ROLE_PLURAL[role] ?? role),
      ).filter(l => l.count > 0),
    [usage],
  )
  const totalUsage = useMemo(() => summarizeUsage(usage, 'all', 'Geral'), [usage])
  const usageReport = useMemo(
    () => buildUsageReport(totalUsage, levelSummaries, usage, generatedAt || new Date().toLocaleDateString('pt-BR')),
    [totalUsage, levelSummaries, usage, generatedAt],
  )
  const usageByLevel = useMemo(
    () => levelSummaries.map(lv => ({ lv, people: usage.filter(u => u.person.role === lv.key).sort((a, b) => a.indice - b.indice) })),
    [levelSummaries, usage],
  )
  const copyUsage = () => {
    navigator.clipboard?.writeText(usageReport)
    setCopiedUsage(true)
    setTimeout(() => setCopiedUsage(false), 2000)
  }

  // KPIs globais do recorte filtrado.
  const totalFrentes = filtered.length
  const totalPendentes = filtered.filter(i => !isDone(i)).length
  const totalCriticas = filtered.filter(isCritical).length
  const totalAderentes = filtered.filter(isAdherent).length
  const aderenciaGlobal = totalFrentes ? Math.round((totalAderentes / totalFrentes) * 100) : 0
  const recursosCount = resourceStats.length

  // Insights executivos (mantidos do recorte anterior).
  const insights: string[] = []
  const noNext = filtered.filter(i => !isDone(i) && !i.nextAction).length
  const byProject = Object.entries(countsBy(filtered, i => i.project ?? 'Sem projeto')).sort((a, b) => b[1] - a[1])[0]
  const byProduct = Object.entries(countsBy(filtered, i => i.product ?? 'Sem produto')).sort((a, b) => b[1] - a[1])
  if (byProduct.length) insights.push(`Distribuição: ${byProduct.map(([p, n]) => `${p} (${n})`).join(' • ')}.`)
  if (totalCriticas) insights.push(`${totalCriticas} frente(s) em condição crítica. Pauta executiva deve começar por destrave.`)
  if (noNext) insights.push(`${noNext} item(ns) sem próxima ação — principal risco de perda de controle gerencial.`)
  if (byProject) insights.push(`Projeto com maior concentração: "${byProject[0]}" (${byProject[1]} frentes). Verificar capacidade.`)
  if (!insights.length) insights.push('Recorte equilibrado. Manter checkpoint preventivo e registrar decisões no histórico.')

  const copyReport = () => {
    navigator.clipboard?.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Boletim de 1 tela (redesign §7): nota A–E + 3 decisões da semana ── */
  const carteiraScore = totalFrentes ? Math.round(filtered.reduce((sum, i) => sum + scoreOf(i), 0) / totalFrentes) : 0
  const usoMedio = usage.length ? Math.round(usage.reduce((sum, u) => sum + u.indice, 0) / usage.length) : 0
  const riscoScore = totalPendentes ? Math.max(0, 100 - Math.round((totalCriticas / totalPendentes) * 100)) : 100
  const notaComposta = Math.round(carteiraScore * 0.35 + aderenciaGlobal * 0.25 + usoMedio * 0.25 + riscoScore * 0.15)
  const NOTA = notaComposta >= 85 ? 'A' : notaComposta >= 70 ? 'B' : notaComposta >= 55 ? 'C' : notaComposta >= 40 ? 'D' : 'E'
  const notaCor = notaComposta >= 70 ? '#0a6e49' : notaComposta >= 55 ? '#8f5200' : '#bd2f3d'
  const farol = (v: number) => (v >= 70 ? '🟢' : v >= 55 ? '🟡' : '🔴')

  const decisoes: string[] = []
  const topRisco = filtered
    .map(i => ({ i, rs: riskScore(i, filtered) }))
    .filter((x): x is { i: Item; rs: NonNullable<ReturnType<typeof riskScore>> } => x.rs !== null)
    .sort((a, b) => b.rs.score - a.rs.score)[0]
  if (topRisco && topRisco.rs.score >= 50) {
    decisoes.push(`Destravar "${topRisco.i.project ?? topRisco.i.id}" — maior risco da carteira (score ${topRisco.rs.score}, ${topRisco.rs.mainReason}).`)
  }
  const topLacuna = [...filtered].filter(i => !isDone(i) && dataGaps(i).length > 0).sort((a, b) => dataGaps(b).length - dataGaps(a).length)[0]
  if (topLacuna) {
    decisoes.push(`Completar a governança de "${topLacuna.project ?? topLacuna.id}" — ${dataGaps(topLacuna).join(', ')}.`)
  }
  const cargaTop = Object.entries(ownerLoad(filtered)).filter(([o]) => o !== 'Sem responsável').sort((a, b) => b[1] - a[1])[0]
  if (cargaTop) {
    decisoes.push(`Avaliar redistribuição: ${cargaTop[0]} concentra ${Math.round(cargaTop[1])}h de esforço restante.`)
  }
  if (!decisoes.length) decisoes.push('Sem pendências estruturais — manter o ritual semanal e o registro de decisões.')

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* ── Boletim de 1 tela: a nota da operação sem rolar ── */}
      <div className="card">
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', minWidth: 110 }}>
            <div aria-label={`Nota geral ${NOTA}`} style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: notaCor }}>{NOTA}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>nota geral · {notaComposta}/100</div>
            <div style={{ fontSize: 10, color: 'var(--muted-2)' }}>carteira 35 · governança 25 · uso 25 · risco 15</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <div style={{ fontSize: 12 }}>{farol(carteiraScore)} <b>Carteira</b> · {carteiraScore}% <span style={{ color: 'var(--muted)' }}>governança média das frentes</span></div>
              <div style={{ fontSize: 12 }}>{farol(aderenciaGlobal)} <b>Aderência</b> · {aderenciaGlobal}% <span style={{ color: 'var(--muted)' }}>frentes sem lacunas</span></div>
              <div style={{ fontSize: 12 }}>{farol(usoMedio)} <b>Uso do portal</b> · {usoMedio} <span style={{ color: 'var(--muted)' }}>índice médio do time</span></div>
              <div style={{ fontSize: 12 }}>{farol(riscoScore)} <b>Risco</b> · {totalCriticas} crítica(s) <span style={{ color: 'var(--muted)' }}>de {totalPendentes} abertas</span></div>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              <b style={{ fontSize: 12 }}>3 decisões da semana</b>
              <ol style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-title, #0b1f3a)', display: 'grid', gap: 2 }}>
                {decisoes.slice(0, 3).map((d, i) => <li key={i}>{d}</li>)}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs com tendência — alimentados pelos snapshots diários (lib/tracking) */}
      <KpiTrendStrip items={items} />

      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Resumo executivo para distribuição</h3>
            <small style={{ color: 'var(--muted)' }}>
              {profile?.full_name || profile?.email
                ? `Gerado por ${profile.full_name || profile.email}`
                : 'Resumo de aderência por recurso e desdobramento por gestor'}
              {generatedAt ? ` · ${generatedAt}` : ''}
            </small>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" onClick={copyReport}>
              <Copy size={14} /> {copied ? 'Copiado' : 'Copiar relatório'}
            </button>
            <button className="btn small primary" onClick={() => window.print()}>
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
            }}
          >
            <div className="kpi blue">
              <span>Frentes no recorte</span>
              <strong>{totalFrentes}</strong>
              <small>{recursosCount} recurso(s) responsável(is)</small>
            </div>
            <div className="kpi amber">
              <span>Pendentes</span>
              <strong>{totalPendentes}</strong>
              <small>não concluídas</small>
            </div>
            <div className="kpi red">
              <span>Críticas</span>
              <strong>{totalCriticas}</strong>
              <small>bloqueado / atrasado / vence hoje</small>
            </div>
            <div className={`kpi ${aderenciaGlobal >= 70 ? 'green' : aderenciaGlobal >= 55 ? 'amber' : 'red'}`}>
              <span>Aderência global</span>
              <strong>{aderenciaGlobal}%</strong>
              <small>frentes em dia</small>
            </div>
          </div>
        </div>
      </div>

      {/* ── Faróis de uso por nível (mede TODOS, inclusive quem tem zero) ── */}
      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Faróis de uso por nível</h3>
            <small style={{ color: 'var(--muted)' }}>
              Cobertura e disciplina de uso de todos os cadastrados — inclui quem tem zero frente. Atualizou ≤ {FRESH_DAYS}d = em dia · ≤ {ATTENTION_DAYS}d = atenção · acima = crítico.
            </small>
          </div>
          <button className="btn small primary" onClick={copyUsage}>
            <Copy size={14} /> {copiedUsage ? 'Copiado' : 'Copiar cobrança de uso'}
          </button>
        </div>
        <div className="card-body">
          {usage.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nenhum colaborador operacional (gerente/coordenador/consultor/analista) cadastrado.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <div className="kpi" style={{ borderLeft: `4px solid ${FAROL_HEX[totalUsage.farol]}` }}>
                <span>Geral · {totalUsage.count} pessoas</span>
                <strong>{FAROL_EMOJI[totalUsage.farol]} {totalUsage.indiceMedio}%</strong>
                <small>🟢{totalUsage.verdes} 🟡{totalUsage.amarelos} 🔴{totalUsage.vermelhos} · cobertura {totalUsage.cobertura}%</small>
              </div>
              {levelSummaries.map(lv => (
                <div key={lv.key} className="kpi" style={{ borderLeft: `4px solid ${FAROL_HEX[lv.farol]}` }}>
                  <span>{lv.label} · {lv.count}</span>
                  <strong>{FAROL_EMOJI[lv.farol]} {lv.indiceMedio}%</strong>
                  <small>🟢{lv.verdes} 🟡{lv.amarelos} 🔴{lv.vermelhos} · cobertura {lv.cobertura}%</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Aderência de uso por usuário (agrupado por nível) ── */}
      {usageByLevel.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3 className="card-title">Aderência de uso por usuário</h3>
            <span className="badge tone-gray">{usage.length} pessoa(s)</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 18 }}>
            {usageByLevel.map(({ lv, people }) => (
              <div key={lv.key} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <strong>
                    {lv.label}{' '}
                    <span className={`badge ${FAROL_TONE[lv.farol]}`}>{FAROL_EMOJI[lv.farol]} índice {lv.indiceMedio}%</span>
                  </strong>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    🟢{lv.verdes} 🟡{lv.amarelos} 🔴{lv.vermelhos} · cobertura {lv.cobertura}% ({lv.comUso}/{lv.count} usam)
                  </span>
                </div>
                <div className="table-wrap" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th style={{ textAlign: 'center' }}>Carteira</th>
                        <th style={{ textAlign: 'center' }}>Ativas</th>
                        <th style={{ textAlign: 'center' }}>Últ. atualização</th>
                        <th style={{ textAlign: 'center' }}>Governança</th>
                        <th style={{ textAlign: 'center' }}>Índice</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map(u => (
                        <tr key={u.person.id}>
                          <td><strong>{u.person.full_name || u.person.email}</strong></td>
                          <td style={{ textAlign: 'center' }}>{u.carteira}</td>
                          <td style={{ textAlign: 'center' }}>{u.ativos}</td>
                          <td style={{ textAlign: 'center' }}>
                            {u.diasDesdeUpdate === null ? '—' : u.diasDesdeUpdate === 0 ? 'hoje' : `${u.diasDesdeUpdate}d`}
                          </td>
                          <td style={{ textAlign: 'center' }}>{u.carteira ? `${u.governanca}%` : '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${FAROL_TONE[u.farol]}`}>{u.indice}%</span>
                          </td>
                          <td>
                            <span className={`badge ${FAROL_TONE[u.farol]}`}>{FAROL_EMOJI[u.farol]}</span>{' '}
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.motivo || 'em dia'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Aderência por recurso</h3>
          <span className="badge tone-gray">{recursosCount} recurso(s)</span>
        </div>
        <div className="card-body">
          {resourceStats.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nenhum recurso no recorte atual.</p>
          ) : (
            <div className="table-wrap" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Recurso</th>
                    <th style={{ textAlign: 'center' }}>Frentes</th>
                    <th style={{ textAlign: 'center' }}>Pendentes</th>
                    <th style={{ textAlign: 'center' }}>Críticas</th>
                    <th style={{ textAlign: 'center' }}>Aderência</th>
                    <th>Última atualização</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceStats.map(s => (
                    <tr key={s.name}>
                      <td><strong>{s.name}</strong></td>
                      <td style={{ textAlign: 'center' }}>{s.total}</td>
                      <td style={{ textAlign: 'center' }}>{s.pendentes}</td>
                      <td style={{ textAlign: 'center' }}>
                        {s.criticas > 0 ? <span className="badge tone-red">{s.criticas}</span> : '0'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${adherenceTone(s.aderencia)}`}>{s.aderencia}%</span>
                      </td>
                      <td>{lastUpdateLabel(s.lastUpdateIso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Desdobramento por gestor</h3>
          <span className="badge tone-gray">{managerGroups.length} gestor(es)</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 18 }}>
          {managerGroups.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Nenhuma relação de gestor → time configurada ainda. Defina o gestor de cada usuário na
              administração para monitorar o desdobramento das frentes.
            </p>
          ) : (
            managerGroups.map(g => (
              <div key={g.manager.id} style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{g.manager.full_name || g.manager.email}</strong>{' '}
                    <span className="badge tone-indigo">{ROLE_LABELS[g.manager.role]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="badge tone-gray">{g.reports.length} no time</span>
                    {g.pendentesDesdobro > 0 ? (
                      <span className="badge tone-amber">{g.pendentesDesdobro} sem desdobrar</span>
                    ) : (
                      <span className="badge tone-green">Time todo desdobrado</span>
                    )}
                    <span className={`badge ${adherenceTone(g.aderencia)}`}>
                      Aderência {g.aderencia}%
                    </span>
                  </div>
                </div>
                <div className="table-wrap" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Colaborador</th>
                        <th>Papel</th>
                        <th style={{ textAlign: 'center' }}>Frentes</th>
                        <th style={{ textAlign: 'center' }}>Pendentes</th>
                        <th style={{ textAlign: 'center' }}>Críticas</th>
                        <th style={{ textAlign: 'center' }}>Aderência</th>
                        <th style={{ textAlign: 'center' }}>Desdobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.reports.map(({ person, stat }) => (
                        <tr key={person.id}>
                          <td><strong>{person.full_name || person.email}</strong></td>
                          <td><span className="badge tone-gray">{ROLE_LABELS[person.role]}</span></td>
                          <td style={{ textAlign: 'center' }}>{stat?.total ?? 0}</td>
                          <td style={{ textAlign: 'center' }}>{stat?.pendentes ?? 0}</td>
                          <td style={{ textAlign: 'center' }}>
                            {stat && stat.criticas > 0 ? (
                              <span className="badge tone-red">{stat.criticas}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {stat && stat.total > 0 ? (
                              <span className={`badge ${adherenceTone(stat.aderencia)}`}>{stat.aderencia}%</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {stat && stat.total > 0 ? (
                              <span className="badge tone-green">Sim</span>
                            ) : (
                              <span className="badge tone-amber">Pendente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Insights executivos</h3>
        </div>
        <div className="card-body insight-list">
          {insights.map((ins, i) => (
            <div key={i} className="insight"><strong>{ins}</strong></div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3 className="card-title">Relatório textual executivo</h3>
            <small style={{ color: 'var(--muted)' }}>
              Formatação pronta para WhatsApp / Teams — use “Copiar relatório” para enviar aos
              colaboradores
            </small>
          </div>
        </div>
        <div className="card-body">
          <ReportPreview text={report} />
        </div>
      </div>
    </div>
  )
}

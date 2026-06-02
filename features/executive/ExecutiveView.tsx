'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Printer } from 'lucide-react'
import {
  Item,
  Filters,
  UserProfile,
  executiveLines,
  isDone,
  riskOf,
  countsBy,
  ownersOf,
  dateFmt,
  ROLE_LABELS,
} from '@/shared/domain'

interface ExecutiveViewProps {
  filtered: Item[]
  filters: Filters
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

  return <div className="report-preview">{blocks}</div>
}

export function ExecutiveView({ filtered, filters, userProfiles, profile }: ExecutiveViewProps) {
  const [copied, setCopied] = useState(false)
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
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

      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Aderência por recurso</h3>
          <span className="badge tone-gray">{recursosCount} recurso(s)</span>
        </div>
        <div className="card-body">
          {resourceStats.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nenhum recurso no recorte atual.</p>
          ) : (
            <div className="table-wrap">
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
                <div className="table-wrap">
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

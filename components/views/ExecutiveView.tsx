'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item, Filters, UserProfile } from '@/lib/domain'
import {
  isDone, daysToDue, riskScore, scoreOf, itemRemainingEffort, executiveLines, isoDate, countsBy, riskOf,
} from '@/lib/domain'

interface Snapshot { day: string; total: number; active: number; critical: number; high: number; on_time_pct: number; freshness_pct: number; access_adherence_pct: number; health: number; effort_hours: number }
interface AccessRow { user_id: string; day: string }
interface ProfileRow { id: string; email: string; full_name: string | null }
interface HistoryRow { changed_by: string | null; changed_at: string }

function Delta({ now, before, invert = false, suffix = '' }: { now: number; before?: number; invert?: boolean; suffix?: string }) {
  if (before === undefined) return <span className="delta" style={{ color: 'var(--muted)' }}>—</span>
  const diff = Math.round(now - before)
  if (diff === 0) return <span className="delta" style={{ color: 'var(--muted)' }}>estável</span>
  const good = invert ? diff < 0 : diff > 0
  return <span className={`delta ${good ? 'up' : 'down'}`}>{diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{suffix} vs sem. ant.</span>
}

export default function ExecutiveView({ filtered, allItems, filters, profile }: {
  filtered: Item[]; allItems: Item[]; filters: Filters; profile: UserProfile | null
}) {
  const supabase = createClient()
  const [copied, setCopied] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [access, setAccess] = useState<AccessRow[]>([])
  const [team, setTeam] = useState<ProfileRow[]>([])
  const [updates, setUpdates] = useState<HistoryRow[]>([])

  const isLeadership = profile?.role === 'admin' || profile?.role === 'superintendente'

  // Stable "now" captured at component mount via useState(init fn).
  // Date.now() inside render body is flagged by react-hooks/purity — using state init
  // executes once and the value is stable across re-renders without causing extra renders.
  const [now] = useState<number>(() => Date.now())

  useEffect(() => {
    async function loadTracking() {
      const since = isoDate(new Date(Date.now() - 7 * 86400000))
      const [snapRes, accessRes, histRes, teamRes] = await Promise.all([
        supabase.from('portfolio_snapshots').select('*').order('day', { ascending: false }).limit(14),
        supabase.from('daily_access').select('user_id, day').gte('day', since),
        supabase.from('item_history').select('changed_by, changed_at').gte('changed_at', `${since}T00:00:00Z`),
        isLeadership ? supabase.from('user_profiles').select('id, email, full_name') : Promise.resolve({ data: [] }),
      ])
      setSnapshots((snapRes.data as Snapshot[]) ?? [])
      setAccess((accessRes.data as AccessRow[]) ?? [])
      setUpdates((histRes.data as HistoryRow[]) ?? [])
      setTeam((teamRes.data as ProfileRow[]) ?? [])
    }
    loadTracking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeItems = filtered.filter(i => !isDone(i))
  const scored = activeItems.map(i => riskScore(i, allItems)).filter((r): r is NonNullable<typeof r> => r !== null)
  const critical = scored.filter(r => r.band === 'Crítico').length
  const overdue = activeItems.filter(i => (daysToDue(i.dueDate) ?? 1) < 0).length
  const onTimePct = activeItems.length ? Math.round(((activeItems.length - overdue) / activeItems.length) * 100) : 100
  const freshPct = activeItems.length ? Math.round((activeItems.filter(i => i.lastUpdate && now - new Date(i.lastUpdate).getTime() <= 7 * 86400000).length / activeItems.length) * 100) : 100
  const health = filtered.length ? Math.round(filtered.reduce((s, i) => s + scoreOf(i), 0) / filtered.length) : 0
  const effort = Math.round(activeItems.reduce((s, i) => s + itemRemainingEffort(i), 0))
  const accessUsers = new Set(access.map(a => a.user_id))
  const adherencePct = team.length ? Math.round((accessUsers.size / team.length) * 100) : (accessUsers.size > 0 ? 100 : 0)

  const baseline = snapshots.find(s => (now - new Date(`${s.day}T12:00:00Z`).getTime()) / 86400000 >= 6)

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(new Date(now - (6 - i) * 86400000))), [now])
  const updatesByUser = countsBy(updates.filter(u => u.changed_by), u => String(u.changed_by))

  const queue = activeItems
    .map(it => ({ it, rs: riskScore(it, allItems) }))
    .filter((x): x is { it: Item; rs: NonNullable<ReturnType<typeof riskScore>> } => x.rs !== null)
    .sort((a, b) => b.rs.score - a.rs.score)
    .slice(0, 7)

  const report = executiveLines(filtered, filters)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <h3 className="card-title">Indicadores executivos</h3>
          <button className="btn small" onClick={() => { navigator.clipboard?.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
            {copied ? '✓ Copiado' : 'Copiar relatório'}
          </button>
        </div>
        <div className="card-body">
          <div className="exec-kpis">
            <div className="exec-kpi"><span>Saúde da carteira</span><strong>{health}<small style={{ fontSize: 12, color: 'var(--muted)' }}> /100</small></strong><br /><Delta now={health} before={baseline?.health} /></div>
            <div className="exec-kpi"><span>Frentes críticas</span><strong style={{ color: critical > 0 ? 'var(--red)' : undefined }}>{critical}</strong><br /><Delta now={critical} before={baseline?.critical} invert /></div>
            <div className="exec-kpi"><span>Entregas no prazo</span><strong>{onTimePct}%</strong><br /><Delta now={onTimePct} before={baseline?.on_time_pct} suffix=" pp" /></div>
            <div className="exec-kpi"><span>Freshness ≤ 7d</span><strong style={{ color: freshPct < 60 ? 'var(--amber)' : undefined }}>{freshPct}%</strong><br /><Delta now={freshPct} before={baseline?.freshness_pct} suffix=" pp" /></div>
            <div className="exec-kpi"><span>Aderência de acesso · 7d</span><strong>{adherencePct}%</strong><br /><Delta now={adherencePct} before={baseline?.access_adherence_pct} suffix=" pp" /></div>
            <div className="exec-kpi"><span>Esforço restante</span><strong>{effort}<small style={{ fontSize: 12, color: 'var(--muted)' }}> h</small></strong><br /><Delta now={effort} before={baseline?.effort_hours} invert suffix=" h" /></div>
          </div>
        </div>
      </div>

      <div className="grid two">
        {isLeadership && (
          <div className="card">
            <div className="card-head"><h3 className="card-title">Aderência do time — últimos 7 dias</h3></div>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              {team.length === 0 ? <div className="empty">Sem dados de acesso ainda.</div> : team.map(u => {
                const userDays = new Set(access.filter(a => a.user_id === u.id).map(a => a.day))
                const nUpdates = updatesByUser[u.id] ?? 0
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <b style={{ width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.email}</b>
                    <span className="adherence-dots">{last7.map(d => <i key={d} className={userDays.has(d) ? 'on' : ''} title={d} />)}</span>
                    <small style={{ marginLeft: 'auto', color: userDays.size === 0 ? 'var(--red)' : '#5f7188' }}>
                      {userDays.size}/7 · {nUpdates} atualizações
                    </small>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-head"><h3 className="card-title">Fila de decisão</h3></div>
          <div className="card-body" style={{ display: 'grid', gap: 8 }}>
            {queue.length === 0 ? <div className="empty">Sem riscos abertos no recorte.</div> : queue.map(({ it, rs }) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span className={`score-chip ${rs.band === 'Crítico' ? 'tone-red' : rs.band === 'Alto' ? 'tone-amber' : 'tone-gray'}`}>{rs.score}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.demand || it.project} <small style={{ color: '#5f7188' }}>· {riskOf(it)}</small></span>
                <small style={{ color: '#5f7188' }}>{it.owner || 'N/I'}</small>
              </div>
            ))}
          </div>
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

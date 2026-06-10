import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeItem, isDone, daysToDue, riskScore, scoreOf, itemRemainingEffort, isoDate, type Item } from '@/lib/domain'

/** Upsert do acesso diário (throttle de 5 min) + snapshot lazy da carteira. Nunca lança. */
export async function registerDailyActivity(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const day = isoDate(new Date())
    const now = new Date().toISOString()

    const { data: existing } = await supabase
      .from('daily_access').select('last_seen').eq('user_id', userId).eq('day', day).maybeSingle()

    if (!existing) {
      await supabase.from('daily_access').insert({ user_id: userId, day, first_seen: now, last_seen: now })
    } else if (Date.now() - new Date(existing.last_seen).getTime() > 5 * 60 * 1000) {
      await supabase.from('daily_access').update({ last_seen: now }).eq('user_id', userId).eq('day', day)
    }

    await ensureDailySnapshot(supabase, day)
  } catch {
    // tracking nunca pode derrubar a página
  }
}

async function ensureDailySnapshot(supabase: SupabaseClient, day: string): Promise<void> {
  const { data: snap } = await supabase.from('portfolio_snapshots').select('day').eq('day', day).maybeSingle()
  if (snap) return

  const [{ data: rows }, { data: profiles }, { data: access }] = await Promise.all([
    supabase.from('items').select('*'),
    supabase.from('user_profiles').select('id'),
    supabase.from('daily_access').select('user_id').gte('day', isoDate(new Date(Date.now() - 7 * 86400000))),
  ])
  if (!rows) return

  const items: Item[] = rows.map((row: Record<string, unknown>, i: number) => normalizeItem({
    id: row.id as string, dueDate: row.due_date as string, startDate: row.start_date as string,
    project: row.project as string, demand: row.demand as string, owner: row.owner as string,
    status: row.status as string, priority: row.priority as string, progress: row.progress as number,
    nextAction: row.next_action as string, lastUpdate: row.last_update as string,
    archived: row.archived as boolean, product: row.product as string,
    effortHours: row.effort_hours as number, teamSize: row.team_size as number,
    predecessorId: row.predecessor_id as string, dependencyNote: row.dependency_note as string,
    tags: (row.tags as string[]) ?? [], definition: row.definition as string,
  }, i)).filter(it => !it.archived)

  const activeItems = items.filter(it => !isDone(it))
  const scored = activeItems.map(it => riskScore(it, items)).filter((r): r is NonNullable<typeof r> => r !== null)
  const critical = scored.filter(r => r.band === 'Crítico').length
  const high = scored.filter(r => r.band === 'Alto').length
  const overdue = activeItems.filter(it => (daysToDue(it.dueDate) ?? 1) < 0).length
  const fresh = activeItems.filter(it => it.lastUpdate && Date.now() - new Date(it.lastUpdate).getTime() <= 7 * 86400000).length
  const activeUsers = new Set((access ?? []).map(a => a.user_id)).size
  const totalUsers = profiles?.length ?? 0

  // Race benigno: dois primeiros-acessos simultâneos podem tentar inserir o mesmo dia;
  // o segundo falha na PK e é absorvido pelo try/catch externo — resultado idempotente.
  await supabase.from('portfolio_snapshots').insert({
    day,
    total: items.length,
    active: activeItems.length,
    critical,
    high,
    on_time_pct: activeItems.length ? Math.round(((activeItems.length - overdue) / activeItems.length) * 100) : 100,
    freshness_pct: activeItems.length ? Math.round((fresh / activeItems.length) * 100) : 100,
    access_adherence_pct: totalUsers ? Math.round((activeUsers / totalUsers) * 100) : 0,
    health: items.length ? Math.round(items.reduce((s, i) => s + scoreOf(i), 0) / items.length) : 0,
    effort_hours: Math.round(activeItems.reduce((s, i) => s + itemRemainingEffort(i), 0)),
  })
}

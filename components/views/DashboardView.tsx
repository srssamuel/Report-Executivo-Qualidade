'use client'

import type { Item } from '@/lib/domain'
import {
  isDone, riskSeverity, riskOf, scoreOf, ownersOf,
  countsBy, dateFmt, dataGaps, productTone, riskTone, statusTone,
} from '@/lib/domain'
import { Badge, BarChart } from '@/components/ui'

export default function DashboardView({ filtered, donutDeg, avgScore, late, soon, gaps, active, total, onEdit }: {
  filtered: Item[]; donutDeg: string; avgScore: number; late: number; soon: number; gaps: number; active: number; total: number; onEdit: (id: string) => void
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

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'Total', value: total, sub: 'frentes no recorte', cls: 'blue' },
          { label: 'Ativas', value: active, sub: 'em execução ou planejadas', cls: 'blue' },
          { label: 'Concluídas', value: total - active, sub: 'entregues ou canceladas', cls: 'green' },
          { label: 'Críticas', value: late, sub: 'atrasadas ou bloqueadas', cls: late > 0 ? 'red' : 'green' },
          { label: 'Lacunas', value: gaps, sub: 'governança incompleta', cls: gaps > 0 ? 'amber' : 'green' },
          { label: 'Score', value: `${avgScore}%`, sub: 'média da carteira', cls: avgScore < 60 ? 'red' : avgScore < 80 ? 'amber' : 'green' },
        ].map(k => (
          <div className={`kpi ${k.cls}`} key={k.label}>
            <span>{k.label}</span>
            <strong>{k.value}</strong>
            <small>{k.sub}</small>
          </div>
        ))}
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        <div className="card panel-health">
          <div className="card-head"><h3 className="card-title">Saúde da carteira</h3></div>
          <div className="card-body">
            <div className="health-wrap">
              <div className="donut" style={{ ['--deg' as string]: donutDeg }} data-label={`${avgScore}%`} />
              <div className="insight-list">
                {narrative.map((n, i) => <div key={i} className="insight"><strong>{n}</strong></div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="card panel-decision">
          <div className="card-head"><h3 className="card-title">Fila de decisão</h3><span className="badge tone-amber">{decisionQueue.length} itens</span></div>
          <div className="card-body insight-list">
            {decisionQueue.length === 0 ? <div className="empty">Sem itens pendentes no filtro atual.</div> : decisionQueue.map(it => (
              <div key={it.id} className="decision-card">
                <div>
                  <div className="task-meta" style={{ marginBottom: 4 }}>
                    <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                    <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                    <Badge label={it.status} tone={statusTone(it.status)} />
                    <Badge label={dateFmt(it.dueDate)} />
                  </div>
                  <strong style={{ fontSize: 13, display: 'block' }}>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                  <p style={{ margin: '3px 0 0', color: '#5f7188', fontSize: 12 }}>{it.nextAction || it.executiveComment || it.definition || 'Sem próxima ação registrada.'}</p>
                </div>
                <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid three" style={{ marginBottom: 16 }}>
        <div className="card panel-product">
          <div className="card-head"><h3 className="card-title">Por produto</h3></div>
          <div className="card-body"><BarChart data={countsBy(filtered, i => i.product ?? 'Sem produto')} total={filtered.length} /></div>
        </div>
        <div className="card panel-status">
          <div className="card-head"><h3 className="card-title">Por status</h3></div>
          <div className="card-body"><BarChart data={countsBy(filtered, i => i.status)} total={filtered.length} /></div>
        </div>
        <div className="card panel-risk">
          <div className="card-head"><h3 className="card-title">Por risco</h3></div>
          <div className="card-body"><BarChart data={countsBy(filtered, i => riskOf(i))} total={filtered.length} /></div>
        </div>
      </div>

      <div className="grid two">
        <div className="card panel-owner">
          <div className="card-head"><h3 className="card-title">Por responsável</h3></div>
          <div className="card-body"><BarChart data={ownerCounts} total={filtered.length} /></div>
        </div>
        <div className="card panel-gaps">
          <div className="card-head"><h3 className="card-title">Lacunas de governança</h3></div>
          <div className="card-body insight-list">
            {govGaps.length === 0 ? <div className="empty">Sem lacunas críticas de governança.</div> : govGaps.map(it => (
              <div key={it.id} className="insight">
                <div className="task-meta" style={{ marginBottom: 4 }}>
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
    </>
  )
}

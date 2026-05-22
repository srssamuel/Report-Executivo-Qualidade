'use client'

import React from 'react'
import { TrendingUp } from 'lucide-react'
import {
  Item,
  Gain,
  isDone,
  riskSeverity,
  riskOf,
  scoreOf,
  dataGaps,
  ownersOf,
  countsBy,
  productTone,
  riskTone,
  statusTone,
  dateFmt,
  gainTypeTone,
  GAIN_TYPES
} from '@/shared/domain'
import { Badge, ProgressGauge, HBarChart, VBarChart, DonutChart } from '@/shared/components'

interface DashboardViewProps {
  filtered: Item[]
  avgScore: number
  late: number
  soon: number
  gaps: number
  active: number
  total: number
  effort: number
  onEdit: (id: string) => void
  gains: Gain[]
  items: Item[]
}

export function DashboardView({
  filtered,
  avgScore,
  late,
  soon,
  gaps,
  active,
  total,
  effort,
  onEdit,
  gains,
  items,
}: DashboardViewProps) {
  const decisionQueue = [...filtered]
    .filter(i => !isDone(i))
    .sort((a, b) => riskSeverity(riskOf(a)) - riskSeverity(riskOf(b)) || scoreOf(a) - scoreOf(b))
    .slice(0, 8)

  const govGaps = [...filtered]
    .filter(i => dataGaps(i).length > 0 && !isDone(i))
    .sort((a, b) => dataGaps(b).length - dataGaps(a).length)
    .slice(0, 8)

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
            <div className="card-head">
              <h3 className="card-title">Fila de decisão</h3>
              <span className="badge tone-amber">{decisionQueue.length} itens</span>
            </div>
            <div className="card-body">
              <div className="insight-list">
                {decisionQueue.length === 0 ? (
                  <div className="empty">Sem itens pendentes no filtro atual.</div>
                ) : (
                  decisionQueue.map(it => (
                    <div key={it.id} className="decision-card">
                      <div>
                        <div className="task-meta" style={{ marginBottom: 6 }}>
                          <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                          <Badge label={riskOf(it)} tone={riskTone(riskOf(it))} />
                          <Badge label={it.status} tone={statusTone(it.status)} />
                          <Badge label={dateFmt(it.dueDate)} />
                        </div>
                        <strong style={{ fontSize: 13, display: 'block', lineHeight: 1.4 }}>
                          {it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}
                        </strong>
                        <p style={{ margin: '4px 0 0', color: '#5f7188', fontSize: 12, lineHeight: 1.45 }}>
                          {it.nextAction || it.executiveComment || it.definition || 'Sem próxima ação registrada.'}
                        </p>
                      </div>
                      <button className="btn small" onClick={() => onEdit(it.id)}>Atualizar</button>
                    </div>
                  ))
                )}
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
            <div className="card-head">
              <h3 className="card-title">Lacunas de governança</h3>
              <Badge label={`${govGaps.length} itens`} tone="tone-amber" />
            </div>
            <div className="card-body">
              <div className="insight-list">
                {govGaps.length === 0 ? (
                  <div className="empty">Sem lacunas críticas de governança.</div>
                ) : (
                  govGaps.map(it => (
                    <div key={it.id} className="insight" style={{ cursor: 'pointer' }} onClick={() => onEdit(it.id)}>
                      <div className="task-meta" style={{ marginBottom: 6 }}>
                        <Badge label={it.product ?? 'Sem produto'} tone={productTone(it.product)} />
                        <Badge label={dataGaps(it).join(', ')} tone="tone-amber" />
                        <Badge label={it.owner || 'Sem responsável'} />
                      </div>
                      <strong>{it.project ?? 'Sem projeto'} — {it.demand ?? 'Sem demanda'}</strong>
                      <span>Recom.: definir {dataGaps(it).slice(0, 2).join(' e ')} para cobrança objetiva.</span>
                    </div>
                  ))
                )}
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
                      <div
                        key={g.id}
                        className="insight"
                        style={{ cursor: it ? 'pointer' : 'default' }}
                        onClick={() => it && onEdit(it.id)}
                      >
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

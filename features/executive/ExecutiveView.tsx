'use client'

import React, { useState } from 'react'
import { Copy } from 'lucide-react'
import {
  Item,
  Filters,
  executiveLines,
  isDone,
  riskOf,
  countsBy,
} from '@/shared/domain'

interface ExecutiveViewProps {
  filtered: Item[]
  filters: Filters
}

export function ExecutiveView({ filtered, filters }: ExecutiveViewProps) {
  const [copied, setCopied] = useState(false)
  const report = executiveLines(filtered, filters)

  const insights: string[] = []
  const late = filtered.filter(i => ['Bloqueado', 'Atrasado'].includes(riskOf(i))).length
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
          <button
            className="btn small"
            onClick={() => {
              navigator.clipboard?.writeText(report)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
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

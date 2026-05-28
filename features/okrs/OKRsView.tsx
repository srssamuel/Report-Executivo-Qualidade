'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  TrendingUp, CheckCircle, AlertTriangle, Calendar, Award,
  Check, Edit, Plus, Trash2,
  Users, Copy, Sparkles, UserCheck,
  Settings, ShieldAlert
} from 'lucide-react'
import {
  OKRTarget, OKRMeasurement, OKRFeedback, Perspective, Direcao, Role,
  okrStatusTone, okrPerspectiveTone, calculateOkrAtingimento, resolveOkrStatus, formatOkrValue
} from '@/shared/domain'
import { Badge } from '@/shared/components'

interface OKRsViewProps {
  targets: OKRTarget[]
  measurements: OKRMeasurement[]
  feedbacks: OKRFeedback[]
  role: Role
  _currentUserId: string
  currentUserFullName: string
  onSaveMeasurement: (okrId: string, mes: string, resultado: number | null, comentario: string, acaoSugerida: string) => Promise<void>
  onAuditMeasurement: (measurementId: string, audited: boolean, feedback: string) => Promise<void>
  onSaveTarget: (target: Partial<OKRTarget>) => Promise<void>
  onDeleteTarget: (id: string) => Promise<void>
  onAddFeedback: (feedback: Omit<OKRFeedback, 'id' | 'created_at' | 'date'>) => Promise<void>
  onDeleteFeedback: (id: string) => Promise<void>
  onCloneToQ3: (managerName: string, sourcePeriod: string, targetPeriod: string) => Promise<void>
  isFallback?: boolean
}

type TabId = 'dashboard' | 'measurements' | 'recontracting'

const PERIODS = [
  { id: 'Q1', label: '1º Trimestre (Jan-Mar)' },
  { id: 'Q2', label: '2º Trimestre (Abr-Jun)' },
  { id: 'Q3', label: '3º Trimestre (Jul-Set)' }
]

const PERSPECTIVES: Perspective[] = ['Performance', 'Governança', 'Valor', 'Projetos']

const MANAGERS = ['Pedro Almeida', 'Kathellen', 'Luiz Bertoldo', 'Thyyellisson', 'Aleff']

export function OKRsView({
  targets,
  measurements,
  feedbacks: _feedbacks,
  role,
  _currentUserId,
  currentUserFullName,
  onSaveMeasurement,
  onAuditMeasurement,
  onSaveTarget,
  onDeleteTarget,
  onAddFeedback: _onAddFeedback,
  onDeleteFeedback: _onDeleteFeedback,
  onCloneToQ3,
  isFallback = false
}: OKRsViewProps) {
  const isSuperOrAdmin = ['admin', 'superintendente'].includes(role)

  // Find if current user name matches any manager
  const matchedManager = useMemo(() => {
    if (!currentUserFullName) return null
    const name = currentUserFullName.toLowerCase()
    return MANAGERS.find(m => name.includes(m.toLowerCase()) || m.toLowerCase().includes(name)) || null
  }, [currentUserFullName])

  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [selectedManager, setSelectedManager] = useState<string>(() => {
    if (!isSuperOrAdmin && matchedManager) {
      return matchedManager
    }
    return isSuperOrAdmin ? 'Todos' : 'Pedro Almeida'
  })
  
  useEffect(() => {
    if (!isSuperOrAdmin && matchedManager && selectedManager !== matchedManager) {
      setSelectedManager(matchedManager)
    }
  }, [matchedManager, isSuperOrAdmin, selectedManager])

  const [selectedPeriod, setSelectedPeriod] = useState<string>('Q1')
  const [selectedPerspective, setSelectedPerspective] = useState<string>('')

  
  // Lançamento state
  const [expandedOkrId, setExpandedOkrId] = useState<string | null>(null)
  const [editOkrForm, setEditOkrForm] = useState<Partial<OKRTarget> | null>(null)
  const [isCreatingTarget, setIsCreatingTarget] = useState(false)
  const [newTarget, setNewTarget] = useState<Partial<OKRTarget>>({
    perspectiva: 'Performance',
    direcao: 'Maior é melhor',
    peso: 1,
    periodo: 'Q3',
    periodicidade: 'Mensal'
  })

  // Measurement form state
  const [measurementForm, setMeasurementForm] = useState<{
    mes: string
    resultado: string
    comentario: string
    acaoSugerida: string
  }>({ mes: '', resultado: '', comentario: '', acaoSugerida: '' })

  // Audit form state
  const [auditForm, setAuditForm] = useState<{
    id: string
    audited: boolean
    feedback: string
  }>({ id: '', audited: false, feedback: '' })


  // ── Derived Data ──────────────────────────────────────────────────────────
  
  // Filtered OKRs for selected manager and period
  const managerTargets = useMemo(() => {
    if (selectedManager === 'Todos') {
      return targets.filter(t => t.periodo === selectedPeriod)
    }
    return targets.filter(t => t.responsavel === selectedManager && t.periodo === selectedPeriod)
  }, [targets, selectedManager, selectedPeriod])

  // Map okr_targets UUID to array of okr_measurements
  const okrMeasurementsMap = useMemo(() => {
    const map: Record<string, OKRMeasurement[]> = {}
    measurements.forEach(m => {
      if (!map[m.okr_id]) map[m.okr_id] = []
      map[m.okr_id].push(m)
    })
    return map
  }, [measurements])

  // Calculate scores and stats
  const okrStats = useMemo(() => {
    let totalWeight = 0
    let totalScore = 0
    let totalKRs = 0
    let countAtingido = 0
    let countParcial = 0
    let countCritico = 0
    let countPendente = 0
    let countAudited = 0
    let countNotAudited = 0

    const perspectiveScores: Record<Perspective, { score: number; weight: number }> = {
      Performance: { score: 0, weight: 0 },
      Governança: { score: 0, weight: 0 },
      Valor: { score: 0, weight: 0 },
      Projetos: { score: 0, weight: 0 }
    }

    managerTargets.forEach(t => {
      const okrMeasures = okrMeasurementsMap[t.id] || []
      
      // Calculate average achievement of this KR across all months
      let krAtingimentoSum = 0
      let krAtingimentoCount = 0
      
      okrMeasures.forEach(m => {
        if (m.resultado_apurado !== null && m.resultado_apurado !== undefined) {
          const at = calculateOkrAtingimento(m.resultado_apurado, t.meta_numerica, t.direcao)
          if (at !== null) {
            krAtingimentoSum += at
            krAtingimentoCount++
          }
          if (m.audited) countAudited++
          else countNotAudited++
        } else {
          countPendente++
        }

        // Count status per measurement
        if (m.resultado_apurado !== null && m.resultado_apurado !== undefined) {
          const st = resolveOkrStatus(calculateOkrAtingimento(m.resultado_apurado, t.meta_numerica, t.direcao))
          if (st === 'Atingido') countAtingido++
          else if (st === 'Parcial') countParcial++
          else if (st === 'Crítico') countCritico++
        }
      })

      const krAvgAtingimento = krAtingimentoCount > 0 ? (krAtingimentoSum / krAtingimentoCount) : null

      if (krAvgAtingimento !== null) {
        totalScore += krAvgAtingimento * t.peso
        totalWeight += t.peso
        
        perspectiveScores[t.perspectiva].score += krAvgAtingimento * t.peso
        perspectiveScores[t.perspectiva].weight += t.peso
      }

      totalKRs++
    })

    const globalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : null

    const computedPerspectives = PERSPECTIVES.map(p => {
      const w = perspectiveScores[p].weight
      const s = w > 0 ? (perspectiveScores[p].score / w) * 100 : null
      return { perspective: p, score: s, weight: w }
    })

    return {
      globalScore,
      totalWeight,
      totalKRs,
      countAtingido,
      countParcial,
      countCritico,
      countPendente,
      countAudited,
      countNotAudited,
      perspectives: computedPerspectives
    }
  }, [managerTargets, okrMeasurementsMap])


  // Action: Save a target
  const handleSaveTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetData = isCreatingTarget ? newTarget : editOkrForm
    if (!targetData) return

    try {
      const payload = {
        ...targetData,
        responsavel: targetData.responsavel || (selectedManager === 'Todos' ? 'Pedro Almeida' : selectedManager),
        periodo: selectedPeriod,
        meta_numerica: Number(targetData.meta_numerica) || 0,
        peso: Number(targetData.peso) || 1
      }
      await onSaveTarget(payload)
      setIsCreatingTarget(false)
      setEditOkrForm(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Action: Clone to next quarter
  const handleCloneQ3 = async () => {
    if (selectedManager === 'Todos') {
      alert('Por favor, selecione um gerente específico no filtro superior para realizar a recontratação.')
      return
    }
    const prev = selectedPeriod === 'Q3' ? 'Q2' : 'Q1'
    if (!confirm(`Deseja mesmo recontratar os OKRs de ${selectedManager} para o ${selectedPeriod}? A estrutura de KRs do trimestre anterior (${prev}) será clonada.`)) return
    try {
      await onCloneToQ3(selectedManager, prev, selectedPeriod)
    } catch (err) {
      console.error(err)
    }
  }

  // Action: Save a result
  const handleSaveResult = async (okrId: string, mes: string) => {
    const val = measurementForm.resultado.trim() === '' ? null : Number(measurementForm.resultado.replace(',', '.'))
    try {
      await onSaveMeasurement(okrId, mes, val, measurementForm.comentario, measurementForm.acaoSugerida)
      setMeasurementForm({ mes: '', resultado: '', comentario: '', acaoSugerida: '' })
      setExpandedOkrId(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Action: Audit a result
  const handleAuditResult = async (measurementId: string) => {
    try {
      await onAuditMeasurement(measurementId, auditForm.audited, auditForm.feedback)
      setAuditForm({ id: '', audited: false, feedback: '' })
      setExpandedOkrId(null)
    } catch (err) {
      console.error(err)
    }
  }


  return (
    <div className="okr-workspace animate-fade-up">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes okrPulse {
          0% { transform: scale(0.85); opacity: 0.5; }
          50% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0.5; }
        }
        .pulse-dot {
          animation: okrPulse 1.6s infinite ease-in-out;
        }
      `}} />
      {isFallback && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 8,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          lineHeight: '1.4em',
          color: '#d97706'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Modo Demonstração (Dados Locais Ativos):</strong> A estrutura de tabelas remotas do Supabase ainda não foi criada na nuvem. Você pode testar e interagir normalmente com o painel! Para salvar permanentemente na nuvem, execute a migração SQL (arquivo <code>009_okrs.sql</code>) no SQL Editor do Supabase.
            </span>
          </div>
        </div>
      )}

      {/* Head com controles de filtro globais */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <h2>Acompanhamento Tático de OKRs</h2>
          <p className="subtitle">Gestão de metas, governança, evidências e rituais de desenvolvimento</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="control-group">
            <span className="control-label"><Users size={12} /> Gerente</span>
            <select
              className="select small"
              value={selectedManager}
              onChange={e => setSelectedManager(e.target.value)}
              disabled={!isSuperOrAdmin}
            >
              {isSuperOrAdmin && <option value="Todos">Todos os Gerentes</option>}
              {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="control-group">
            <span className="control-label"><Calendar size={12} /> Período</span>
            <select
              className="select small"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
            >
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Award size={15} /> Dashboard Executivo
        </button>
        <button
          className={`tab ${activeTab === 'measurements' ? 'active' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          <TrendingUp size={15} /> Lançamento &amp; Auditoria
        </button>
        <button
          className={`tab ${activeTab === 'recontracting' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('recontracting')
            setIsCreatingTarget(false)
            setEditOkrForm(null)
          }}
        >
          <Settings size={15} /> Contratação &amp; Q3
        </button>
      </div>

      {/* Aba 1: Dashboard Executivo */}
      {activeTab === 'dashboard' && (
        <div className="okr-dashboard-tab">
          <div className="quick-status" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className={`status-tile ${okrStats.globalScore !== null ? (okrStats.globalScore >= 100 ? 'good' : (okrStats.globalScore >= 70 ? 'warn' : 'danger')) : ''}`}>
              <span>Score Executivo OKRs</span>
              <strong>{okrStats.globalScore !== null ? `${okrStats.globalScore.toFixed(1)}%` : '—'}</strong>
              <small>Média ponderada do trimestre</small>
            </div>
            <div className="status-tile">
              <span>Resultado KRs</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className="badge tone-green" title="Atingidos">{okrStats.countAtingido}</span>
                <span className="badge tone-amber" title="Parciais">{okrStats.countParcial}</span>
                <span className="badge tone-red" title="Críticos">{okrStats.countCritico}</span>
                <span className="badge tone-gray" title="Pendentes">{okrStats.countPendente}</span>
              </div>
              <small style={{ marginTop: 6 }}>Total de medições no período</small>
            </div>
            <div className={`status-tile ${okrStats.countNotAudited > 0 ? 'warn' : 'good'}`}>
              <span>Auditoria Superintendência</span>
              <strong>{okrStats.countAudited} / {okrStats.countAudited + okrStats.countNotAudited}</strong>
              <small>{okrStats.countNotAudited} pendentes de checagem</small>
            </div>
            <div className="status-tile">
              <span>Total de Metas</span>
              <strong>{okrStats.totalKRs} KRs</strong>
              <small>Peso total: {okrStats.totalWeight}</small>
            </div>
          </div>

          <div className="grid-2-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            {/* Perspectivas / Pilares */}
            <div className="card">
              <div className="card-head">
                <h3>Atingimento por Perspectiva</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {okrStats.perspectives.map(p => (
                  <div key={p.perspective} className="perspective-row">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className={`badge ${okrPerspectiveTone(p.perspective)}`}>{p.perspective}</span>
                        <span style={{ fontSize: 11, color: '#5f7188' }}>Peso: {p.weight}</span>
                      </div>
                      <strong style={{ fontSize: 13 }}>{p.score !== null ? `${p.score.toFixed(1)}%` : 'Sem lançamentos'}</strong>
                    </div>
                    <div className="progress-line" style={{ height: 6 }}>
                      <i 
                        className={p.score !== null ? (p.score >= 100 ? 'tone-green' : (p.score >= 70 ? 'tone-amber' : 'tone-red')) : ''} 
                        style={{ width: `${Math.min(100, p.score || 0)}%`, height: '100%' }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Governança de Metas e Instruções */}
            <div className="card">
              <div className="card-head">
                <h3>Regras &amp; Governança de Auditoria</h3>
              </div>
              <div className="card-body" style={{ fontSize: 12, lineHeight: '1.5em' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: 10, background: 'rgba(99, 102, 241, 0.05)', borderRadius: 6, borderLeft: '3px solid #6366f1' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 12, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={12} /> Recontratação Trimestral</h4>
                    Neste módulo você pode recontratar os OKRs para o 3º Trimestre. A recontratação copia a árvore de objetivos e KRs, mas reinicia as apurações semanais/mensais para Julho, Agosto e Setembro.
                  </div>
                  <div style={{ padding: 10, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 6, borderLeft: '3px solid #10b981' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}><UserCheck size={12} /> Fluxo de Apuração e Evidências</h4>
                    Os gerentes devem lançar mensalmente o <strong>Resultado Apurado</strong> e anexar no campo de <strong>Evidência/Comentário</strong> o link da comprovação ou notas de apoio. Lançamentos sem evidência clara serão invalidados.
                  </div>
                  <div style={{ padding: 10, background: 'rgba(245, 158, 11, 0.05)', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: 12, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} /> Roteiro de Auditoria por Pilar</h4>
                    <ul>
                      <li><strong>Performance</strong>: Checagem baseada em relatórios do NEP Delivery Control.</li>
                      <li><strong>Governança</strong>: Validação das atas de reuniões e relatórios semanais.</li>
                      <li><strong>Valor</strong>: Comprovação financeira homologada pela Superintendência.</li>
                      <li><strong>Projetos</strong>: Aderência rigorosa às metas SMART descritas no projeto.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aba 2: Lançamento & Auditoria */}
      {activeTab === 'measurements' && (
        <div className="okr-measurements-tab">
          {isSuperOrAdmin ? (
            selectedManager === 'Todos' ? (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.05)',
                borderLeft: '3px solid #6366f1',
                borderRadius: 4,
                fontSize: 12,
                lineHeight: '1.4em',
                marginBottom: 15,
                color: 'var(--text-title)'
              }}>
                <strong>Visão Consolidada de Auditoria (Todos os Gerentes):</strong> Analise e homologue os lançamentos de toda a equipe. Clique em qualquer badge de mês na coluna <strong>Resultados Periódicos</strong> para validar as evidências individuais.
              </div>
            ) : (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(99, 102, 241, 0.05)',
                borderLeft: '3px solid #6366f1',
                borderRadius: 4,
                fontSize: 12,
                lineHeight: '1.4em',
                marginBottom: 15,
                color: 'var(--text-title)'
              }}>
                <strong>Visão de Auditoria / Superintendência:</strong> Selecione qualquer gerente no filtro superior para auditar ou ajustar seus lançamentos. Clique em qualquer badge de mês na coluna <strong>Resultados Periódicos</strong> para validar as evidências ou homologar as metas.
              </div>
            )
          ) : (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(16, 185, 129, 0.05)',
              borderLeft: '3px solid #10b981',
              borderRadius: 4,
              fontSize: 12,
              lineHeight: '1.4em',
              marginBottom: 15,
              color: 'var(--text-title)'
            }}>
              <strong>Olá, {currentUserFullName || selectedManager}!</strong> Suas metas do período estão listadas abaixo. Clique em qualquer badge marcado como <strong>Pendente</strong> (com a bolinha laranja) ou nos meses que já preencheu na coluna <strong>Resultados Periódicos</strong> para digitar o seu resultado apurado e colar a evidência de entrega.
            </div>
          )}

          <div className="toolbar" style={{ padding: 10, background: 'rgba(0,0,0,0.02)', borderRadius: 6, marginBottom: 15, display: 'flex', gap: 10 }}>
            <span style={{ alignSelf: 'center', fontWeight: 600, fontSize: 12 }}>Filtrar por Perspectiva:</span>
            <select
              className="select small"
              value={selectedPerspective}
              onChange={e => setSelectedPerspective(e.target.value)}
            >
              <option value="">Todas as Perspectivas</option>
              {PERSPECTIVES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Perspectiva</th>
                  <th>Objetivo &amp; Key Result</th>
                  <th>Meta</th>
                  <th>Resultados Periódicos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {managerTargets.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">Nenhum OKR cadastrado para {selectedManager === 'Todos' ? 'os gerentes' : selectedManager} em {selectedPeriod}. Vá para a aba "Contratação" para cadastrar ou recontratar OKRs.</div>
                    </td>
                  </tr>
                ) : (
                  managerTargets
                    .filter(t => !selectedPerspective || t.perspectiva === selectedPerspective)
                    .map(t => {
                      const okrMeasures = (okrMeasurementsMap[t.id] || []).sort((a, b) => {
                        const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
                        return months.indexOf(a.mes) - months.indexOf(b.mes)
                      })

                      return (
                        <React.Fragment key={t.id}>
                          <tr>
                            <td style={{ fontWeight: 700 }}>{t.id_okr}</td>
                            <td>
                              <Badge label={t.perspectiva} tone={okrPerspectiveTone(t.perspectiva)} />
                              {selectedManager === 'Todos' && (
                                <div style={{ marginTop: 4 }}>
                                  <Badge label={t.responsavel} tone="tone-blue" />
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-title)' }}>{t.objetivo}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.key_result}</div>
                            </td>
                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {t.meta_exibida}
                              <div style={{ fontSize: 10, color: '#5f7188', fontWeight: 400 }}>Peso: {t.peso}</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {okrMeasures.map(m => {
                                  const rating = calculateOkrAtingimento(m.resultado_apurado, t.meta_numerica, t.direcao)
                                  const status = resolveOkrStatus(rating)
                                  const isPending = m.resultado_apurado === null
                                  const displayVal = !isPending ? formatOkrValue(m.resultado_apurado, t.unidade) : 'Pendente'
                                  
                                  return (
                                    <div
                                      key={m.id}
                                      className={`okr-monthly-badge ${okrStatusTone(status)}`}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        border: isPending ? '1px dashed #f59e0b' : '1px solid rgba(0,0,0,0.05)',
                                        minWidth: 54,
                                        cursor: 'pointer',
                                        background: m.audited ? 'rgba(16, 185, 129, 0.08)' : (isPending ? 'rgba(245, 158, 11, 0.04)' : 'rgba(0,0,0,0.02)'),
                                        position: 'relative',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onClick={() => {
                                        setExpandedOkrId(expandedOkrId === m.id ? null : m.id)
                                        setMeasurementForm({
                                          mes: m.mes,
                                          resultado: m.resultado_apurado !== null ? String(m.resultado_apurado) : '',
                                          comentario: m.evidencia_comentario || '',
                                          acaoSugerida: m.acao_sugerida || ''
                                        })
                                        setAuditForm({
                                          id: m.id,
                                          audited: m.audited,
                                          feedback: m.audit_feedback || ''
                                        })
                                      }}
                                      title={m.audited ? "Auditado pela Superintendência" : "Clique para registrar seu resultado apurado"}
                                    >
                                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {m.mes}
                                        {m.audited ? (
                                          <Check size={8} style={{ color: '#10b981', display: 'inline' }} />
                                        ) : (
                                          isPending && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} className="pulse-dot" />
                                        )}
                                      </span>
                                      <strong style={{ fontSize: 11, marginTop: 1, color: isPending ? '#d97706' : 'inherit' }}>
                                        {displayVal}
                                      </strong>
                                    </div>
                                  )
                                })}
                              </div>
                            </td>
                            <td>
                              <button
                                className="btn small ghost"
                                onClick={() => {
                                  setExpandedOkrId(expandedOkrId === t.id + '-info' ? null : t.id + '-info')
                                }}
                              >
                                Regras de Auditoria
                              </button>
                            </td>
                          </tr>

                          {/* Painel de Regras de Auditoria */}
                          {expandedOkrId === t.id + '-info' && (
                            <tr>
                              <td colSpan={6} style={{ padding: 15, background: 'var(--card-bg-hover)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                                  <div>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--text-title)' }}>Como Apurar esta KR:</h4>
                                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{t.como_apurar || 'Nenhuma regra descrita.'}</p>
                                  </div>
                                  <div>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: 12, color: 'var(--text-title)' }}>Observações &amp; Baseline:</h4>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                      <strong>Baseline Referência:</strong> {t.baseline_referencia || 'Não informado.'}
                                      {t.observacoes && <p style={{ margin: '6px 0 0 0' }}><strong>Obs:</strong> {t.observacoes}</p>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Painel de Lançamento / Auditoria Ativo */}
                          {okrMeasures.map(m => {
                            if (expandedOkrId !== m.id) return null
                            const rating = calculateOkrAtingimento(m.resultado_apurado, t.meta_numerica, t.direcao)
                            
                            return (
                              <tr key={m.id + '-form'} style={{ background: 'rgba(99, 102, 241, 0.02)' }}>
                                <td colSpan={6} style={{ padding: '15px 20px', borderLeft: '4px solid #6366f1' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span>Apuração do mês de <strong>{m.mes}</strong></span>
                                      {m.audited ? <Badge label="Auditado" tone="tone-green" /> : <Badge label="Pendente de auditoria" tone="tone-amber" />}
                                    </h4>
                                    <button className="btn small square ghost" onClick={() => setExpandedOkrId(null)}>✕</button>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                    {/* Lançamento do Gerente */}
                                    <div style={{ paddingRight: 10 }}>
                                      <h5 style={{ margin: '0 0 10px 0', fontSize: 12 }}>Lançamento de Resultados (Gerente)</h5>
                                      <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                          <label style={{ flex: 1 }}>Resultado Apurado
                                            <input
                                              className="input"
                                              type="text"
                                              placeholder={`Ex: 0.90, 320000, 5`}
                                              value={measurementForm.resultado}
                                              onChange={e => setMeasurementForm(f => ({ ...f, resultado: e.target.value }))}
                                              disabled={m.audited && !isSuperOrAdmin}
                                            />
                                          </label>
                                          <div style={{ flex: 1, alignSelf: 'end', paddingBottom: 6 }}>
                                            <span style={{ fontSize: 11, color: '#5f7188' }}>
                                              Meta: {t.meta_exibida} ({t.unidade})
                                            </span>
                                          </div>
                                        </div>

                                        <label>Evidência / Comprovação
                                          <textarea
                                            className="textarea"
                                            rows={2}
                                            placeholder="Cole o link do SharePoint ou descreva onde a evidência foi registrada..."
                                            value={measurementForm.comentario}
                                            onChange={e => setMeasurementForm(f => ({ ...f, comentario: e.target.value }))}
                                            disabled={m.audited && !isSuperOrAdmin}
                                          />
                                        </label>

                                        {rating !== null && rating < 1.0 && (
                                          <label>Plano de Ação Corretiva
                                            <input
                                              className="input"
                                              type="text"
                                              placeholder="O que será feito para reverter este resultado?"
                                              value={measurementForm.acaoSugerida}
                                              onChange={e => setMeasurementForm(f => ({ ...f, acaoSugerida: e.target.value }))}
                                              disabled={m.audited && !isSuperOrAdmin}
                                            />
                                          </label>
                                        )}

                                        {(!m.audited || isSuperOrAdmin) && (
                                          <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
                                            <button
                                              className="btn primary small"
                                              onClick={() => handleSaveResult(t.id, m.mes)}
                                            >
                                              Salvar Lançamento
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Auditoria Executiva */}
                                    <div style={{ borderLeft: '1px solid rgba(0,0,0,0.08)', paddingLeft: 20 }}>
                                      <h5 style={{ margin: '0 0 10px 0', fontSize: 12 }}>Checkdesk de Auditoria (Superintendência)</h5>
                                      {isSuperOrAdmin ? (
                                        <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
                                          <label style={{ flexDirection: 'row', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                                            <input
                                              type="checkbox"
                                              checked={auditForm.audited}
                                              onChange={e => setAuditForm(f => ({ ...f, audited: e.target.checked }))}
                                            />
                                            <span><strong>Aprovar e Marcar como Auditado</strong></span>
                                          </label>

                                          <label>Feedback de Auditoria / Instrução Executiva
                                            <textarea
                                              className="textarea"
                                              rows={2}
                                              placeholder="Descreva as checagens realizadas ou correções exigidas..."
                                              value={auditForm.feedback}
                                              onChange={e => setAuditForm(f => ({ ...f, feedback: e.target.value }))}
                                            />
                                          </label>

                                          <div style={{ marginTop: 5 }}>
                                            <button
                                              className="btn small"
                                              style={{ background: '#10b981', color: 'white' }}
                                              onClick={() => handleAuditResult(m.id)}
                                            >
                                              Registrar Auditoria
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 6, fontSize: 11 }}>
                                          {m.audited ? (
                                            <div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 700, marginBottom: 6 }}>
                                                <CheckCircle size={14} /> Metas Auditadas com Sucesso
                                              </div>
                                              <p style={{ margin: '0 0 6px 0' }}><strong>Feedback Superintendência:</strong> {m.audit_feedback || 'Nenhuma ressalva cadastrada.'}</p>
                                              <p style={{ margin: 0, fontSize: 10, color: '#5f7188' }}>Alterações bloqueadas para o Gerente. Solicite o destrave com a Superintendência se houver correções.</p>
                                            </div>
                                          ) : (
                                            <div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontWeight: 700, marginBottom: 6 }}>
                                                <AlertTriangle size={14} /> Aguardando Auditoria
                                              </div>
                                              Lançado pelo gerente. Aguardando homologação do superintendente no ritual tático semanal.
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aba 3: Contratação & Recontratação (Q3) */}
      {activeTab === 'recontracting' && (
        <div className="okr-recontracting-tab">
          {managerTargets.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.01)', borderRadius: 6, border: '1px dashed rgba(0,0,0,0.1)' }}>
              <Copy size={36} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.7 }} />
              <h3>Contrato de OKRs Vazio</h3>
              <p style={{ maxWidth: 460, margin: '6px auto 20px auto', fontSize: 12, color: 'var(--text-muted)' }}>
                Nenhum OKR cadastrado para {selectedManager === 'Todos' ? 'os gerentes' : selectedManager} no período <strong>{selectedPeriod}</strong>. 
                {selectedManager !== 'Todos' && 'Você pode clonar a estrutura de KRs do trimestre anterior para iniciar as apurações rapidamente e economizar tempo.'}
              </p>
              
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {selectedManager !== 'Todos' && (selectedPeriod === 'Q2' || selectedPeriod === 'Q3') && (
                  <button className="btn primary" onClick={handleCloneQ3}>
                    🔄 Recontratar OKRs do {selectedPeriod === 'Q3' ? '2º Trimestre (Q2)' : '1º Trimestre (Q1)'} para o {selectedPeriod}
                  </button>
                )}
                {selectedManager !== 'Todos' && (
                  <button className="btn" onClick={() => setIsCreatingTarget(true)}>
                    <Plus size={14} /> Cadastrar Nova KR do Zero
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <h3>Metas Contratadas no Período ({managerTargets.length})</h3>
                {isSuperOrAdmin && (
                  <button className="btn primary small" onClick={() => {
                    setNewTarget({
                      perspectiva: 'Performance',
                      direcao: 'Maior é melhor',
                      peso: 1,
                      periodo: selectedPeriod,
                      periodicidade: 'Mensal',
                      responsavel: selectedManager === 'Todos' ? 'Pedro Almeida' : selectedManager
                    })
                    setIsCreatingTarget(true)
                    setEditOkrForm(null)
                  }}>
                    <Plus size={14} /> Nova KR
                  </button>
                )}
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Perspectiva</th>
                      <th>Objetivo</th>
                      <th>Key Result</th>
                      <th>Meta</th>
                      <th>Peso</th>
                      {isSuperOrAdmin && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {managerTargets.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}>{t.id_okr}</td>
                        <td>
                          <Badge label={t.perspectiva} tone={okrPerspectiveTone(t.perspectiva)} />
                          {selectedManager === 'Todos' && (
                            <div style={{ marginTop: 4 }}>
                              <Badge label={t.responsavel} tone="tone-blue" />
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{t.objetivo}</td>
                        <td>{t.key_result}</td>
                        <td><strong>{t.meta_exibida}</strong> ({t.unidade})</td>
                        <td>{t.peso}</td>
                        {isSuperOrAdmin && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn small" onClick={() => {
                                setEditOkrForm(t)
                                setIsCreatingTarget(false)
                              }}>
                                <Edit size={12} />
                              </button>
                              <button className="btn small danger" onClick={() => {
                                if (confirm(`Deseja mesmo excluir o OKR ${t.id_okr}?`)) onDeleteTarget(t.id)
                              }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form Modal de Criação/Edição */}
          {(isCreatingTarget || editOkrForm !== null) && (
            <div className="modal-backdrop open" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-backdrop')) { setIsCreatingTarget(false); setEditOkrForm(null); } }}>
              <div className="modal" style={{ maxWidth: 640 }}>
                <div className="modal-head">
                  <h2>{isCreatingTarget ? 'Cadastrar Novo KR' : `Editar KR ${editOkrForm?.id_okr}`}</h2>
                  <button className="btn square ghost" onClick={() => { setIsCreatingTarget(false); setEditOkrForm(null); }}>✕</button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleSaveTargetSubmit}>
                    <div className="form-grid">
                      {isSuperOrAdmin && (
                        <label>Gerente Responsável
                          <select
                            className="select"
                            value={isCreatingTarget ? (newTarget.responsavel || (selectedManager === 'Todos' ? 'Pedro Almeida' : selectedManager)) : (editOkrForm?.responsavel || '')}
                            onChange={e => {
                              const val = e.target.value
                              if (isCreatingTarget) setNewTarget(f => ({ ...f, responsavel: val }))
                              else setEditOkrForm(f => f ? ({ ...f, responsavel: val }) : null)
                            }}
                          >
                            {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </label>
                      )}

                      <label>ID OKR
                        <input
                          className="input"
                          required
                          placeholder="Ex: OKR-051"
                          value={isCreatingTarget ? (newTarget.id_okr || '') : (editOkrForm?.id_okr || '')}
                          onChange={e => {
                            const val = e.target.value.toUpperCase()
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, id_okr: val }))
                            else setEditOkrForm(f => f ? ({ ...f, id_okr: val }) : null)
                          }}
                        />
                      </label>

                      <label>Perspectiva
                        <select
                          className="select"
                          value={isCreatingTarget ? newTarget.perspectiva : editOkrForm?.perspectiva}
                          onChange={e => {
                            const val = e.target.value as Perspective
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, perspectiva: val }))
                            else setEditOkrForm(f => f ? ({ ...f, perspectiva: val }) : null)
                          }}
                        >
                          {PERSPECTIVES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>

                      <label className="full">Objetivo Estratégico
                        <input
                          className="input"
                          required
                          placeholder="Ex: Alavancar o ROI de Qualidade..."
                          value={isCreatingTarget ? (newTarget.objetivo || '') : (editOkrForm?.objetivo || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, objetivo: val }))
                            else setEditOkrForm(f => f ? ({ ...f, objetivo: val }) : null)
                          }}
                        />
                      </label>

                      <label className="full">Key Result (KR)
                        <input
                          className="input"
                          required
                          placeholder="Ex: Reduzir churn em 5%..."
                          value={isCreatingTarget ? (newTarget.key_result || '') : (editOkrForm?.key_result || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, key_result: val }))
                            else setEditOkrForm(f => f ? ({ ...f, key_result: val }) : null)
                          }}
                        />
                      </label>

                      <label>Periodicidade
                        <select
                          className="select"
                          value={isCreatingTarget ? newTarget.periodicidade : editOkrForm?.periodicidade}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, periodicidade: val }))
                            else setEditOkrForm(f => f ? ({ ...f, periodicidade: val }) : null)
                          }}
                        >
                          {['Semanal', 'Mensal', 'Trimestral', 'Semanal/Mensal'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>

                      <label>Direção da Meta
                        <select
                          className="select"
                          value={isCreatingTarget ? newTarget.direcao : editOkrForm?.direcao}
                          onChange={e => {
                            const val = e.target.value as Direcao
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, direcao: val }))
                            else setEditOkrForm(f => f ? ({ ...f, direcao: val }) : null)
                          }}
                        >
                          {['Maior é melhor', 'Menor é melhor', 'Igual/meta exata'].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </label>

                      <label>Unidade de Medida
                        <input
                          className="input"
                          required
                          placeholder="Ex: %, R$, Qtd, 0/1"
                          value={isCreatingTarget ? (newTarget.unidade || '') : (editOkrForm?.unidade || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, unidade: val }))
                            else setEditOkrForm(f => f ? ({ ...f, unidade: val }) : null)
                          }}
                        />
                      </label>

                      <label>Tipo de Apuração
                        <input
                          className="input"
                          required
                          placeholder="Ex: Aderência, Evolução, Valor"
                          value={isCreatingTarget ? (newTarget.tipo_apuracao || '') : (editOkrForm?.tipo_apuracao || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, tipo_apuracao: val }))
                            else setEditOkrForm(f => f ? ({ ...f, tipo_apuracao: val }) : null)
                          }}
                        />
                      </label>

                      <label>Meta Numérica (Banco)
                        <input
                          className="input"
                          required
                          type="number"
                          step="any"
                          placeholder="Ex: 0.90, 300000, 3"
                          value={isCreatingTarget ? (newTarget.meta_numerica ?? '') : (editOkrForm?.meta_numerica ?? '')}
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value)
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, meta_numerica: val }))
                            else setEditOkrForm(f => f ? ({ ...f, meta_numerica: val }) : null)
                          }}
                        />
                      </label>

                      <label>Meta Exibida (Interface)
                        <input
                          className="input"
                          required
                          placeholder="Ex: ≥90%, >R$ 300k, 3"
                          value={isCreatingTarget ? (newTarget.meta_exibida || '') : (editOkrForm?.meta_exibida || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, meta_exibida: val }))
                            else setEditOkrForm(f => f ? ({ ...f, meta_exibida: val }) : null)
                          }}
                        />
                      </label>

                      <label>Peso
                        <input
                          className="input"
                          required
                          type="number"
                          min={1}
                          value={isCreatingTarget ? (newTarget.peso ?? 1) : (editOkrForm?.peso ?? 1)}
                          onChange={e => {
                            const val = Number(e.target.value)
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, peso: val }))
                            else setEditOkrForm(f => f ? ({ ...f, peso: val }) : null)
                          }}
                        />
                      </label>

                      <label>Baseline Referência
                        <input
                          className="input"
                          placeholder="Ex: Média Q4/2025..."
                          value={isCreatingTarget ? (newTarget.baseline_referencia || '') : (editOkrForm?.baseline_referencia || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, baseline_referencia: val }))
                            else setEditOkrForm(f => f ? ({ ...f, baseline_referencia: val }) : null)
                          }}
                        />
                      </label>

                      <label className="full">Como Apurar (Diretriz de Auditoria)
                        <textarea
                          className="textarea"
                          rows={2}
                          placeholder="Explicação passo a passo de como calcular o resultado apurado..."
                          value={isCreatingTarget ? (newTarget.como_apurar || '') : (editOkrForm?.como_apurar || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, como_apurar: val }))
                            else setEditOkrForm(f => f ? ({ ...f, como_apurar: val }) : null)
                          }}
                        />
                      </label>

                      <label className="full">Observações Adicionais
                        <input
                          className="input"
                          placeholder="Comentários extras sobre regras especiais..."
                          value={isCreatingTarget ? (newTarget.observacoes || '') : (editOkrForm?.observacoes || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (isCreatingTarget) setNewTarget(f => ({ ...f, observacoes: val }))
                            else setEditOkrForm(f => f ? ({ ...f, observacoes: val }) : null)
                          }}
                        />
                      </label>
                    </div>

                    <div className="modal-form-actions" style={{ marginTop: 20 }}>
                      <button type="button" className="btn ghost" onClick={() => { setIsCreatingTarget(false); setEditOkrForm(null); }}>Cancelar</button>
                      <button type="submit" className="btn primary">Salvar KR</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

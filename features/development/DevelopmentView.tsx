'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Zap, Users, AlertTriangle, ChevronLeft,
  ChevronRight, RotateCcw, FileText, CheckCircle2, Trash2, Edit3,
  Plus, Target, Heart, ArrowRight, User, Award as Star, Play
} from 'lucide-react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip
} from 'recharts'
import {
  CLOSED_QUESTIONS,
  OPEN_QUESTIONS,
  DOMAINS,
  COMPETENCIES
} from '@/lib/assessment/perfilCientificoQuestions'
import {
  computePerfilCientificoScores
} from '@/lib/assessment/perfilCientificoScoring'
import { Item, Role, OKRFeedback, UserPDI, ProfileEvaluation, UserProfile } from '@/shared/domain'

interface DevelopmentViewProps {
  items: Item[]
  pdis: UserPDI[]
  evaluations: ProfileEvaluation[]
  feedbacks: OKRFeedback[]
  userProfiles: UserProfile[]
  role: Role
  currentUserId: string
  currentUserFullName: string
  onSavePDI: (pdi: Partial<UserPDI>) => Promise<void>
  onDeletePDI: (id: string) => Promise<void>
  onSaveEvaluation: (evaluation: Omit<ProfileEvaluation, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onDeleteEvaluation: (id: string) => Promise<void>
  onAddFeedback: (feedback: Omit<OKRFeedback, 'id' | 'created_at' | 'date'>) => Promise<void>
  onDeleteFeedback: (id: string) => Promise<void>
  isFallback?: boolean
}

type TabId = 'perfil' | 'feedbacks' | 'pdi'

export function DevelopmentView({
  items,
  pdis,
  evaluations,
  feedbacks,
  userProfiles,
  role,
  currentUserId,
  currentUserFullName,
  onSavePDI,
  onDeletePDI,
  onSaveEvaluation,
  onDeleteEvaluation,
  onAddFeedback,
  onDeleteFeedback,
  isFallback = false
}: DevelopmentViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('perfil')
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>(currentUserFullName)
  
  // Questionnaire state
  const [isSurveyActive, setIsSurveyActive] = useState<boolean>(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({})
  
  // Feedback modal state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false)
  const [feedbackForm, setFeedbackForm] = useState({
    trimestre: 'Q2',
    feedback_type: '1:1 Tático Semanal',
    strengths: '',
    improvements: '',
    action_plan: '',
    general_notes: ''
  })

  // PDI modal state
  const [isPdiModalOpen, setIsPdiModalOpen] = useState<boolean>(false)
  const [editingPdiId, setEditingPdiId] = useState<string | null>(null)
  const [pdiForm, setPdiForm] = useState({
    trimestre: 'Q2',
    objetivo_carreira: '',
    competencias_foco: [] as string[],
    plano_acao: '',
    status: 'Ativo' as 'Ativo' | 'Concluído' | 'Suspenso'
  })

  const isSuperOrAdmin = role === 'admin' || role === 'superintendente'

  // Dynamic list of viewable collaborators based on role hierarchy
  const viewableCollaborators = useMemo(() => {
    if (isSuperOrAdmin) {
      // Admin/Super view anyone
      const profileNames = userProfiles.map(u => u.full_name || u.email).filter(Boolean)
      const itemOwners = [...new Set(items.filter(i => !i.archived && i.owner).map(i => i.owner!))]
      return Array.from(new Set([currentUserFullName, ...profileNames, ...itemOwners])).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }
    
    // Subordinates list based on role
    const subordinates = userProfiles.filter(u => {
      if (role === 'gerente') {
        return ['coordenador', 'lider', 'analista', 'viewer'].includes(u.role)
      }
      if (role === 'coordenador' || role === 'lider') {
        return ['analista', 'viewer'].includes(u.role)
      }
      return false
    }).map(u => u.full_name || u.email).filter(Boolean)

    return Array.from(new Set([currentUserFullName, ...subordinates])).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [role, currentUserFullName, userProfiles, items, isSuperOrAdmin])

  // Select first available viewable collaborator if current selection is not viewable
  useEffect(() => {
    if (viewableCollaborators.length > 0 && !viewableCollaborators.includes(selectedCollaborator)) {
      setSelectedCollaborator(viewableCollaborators[0])
    }
  }, [viewableCollaborators, selectedCollaborator])

  // Find active evaluation for the selected collaborator
  const currentEvaluation = useMemo(() => {
    return evaluations.find(e => 
      e.collaborator_name.toLowerCase() === selectedCollaborator.toLowerCase() ||
      selectedCollaborator.toLowerCase().includes(e.collaborator_name.toLowerCase()) ||
      e.collaborator_name.toLowerCase().includes(selectedCollaborator.toLowerCase())
    )
  }, [evaluations, selectedCollaborator])

  // Find active PDI for the selected collaborator
  const currentPdi = useMemo(() => {
    return pdis.find(p => 
      p.collaborator_name.toLowerCase() === selectedCollaborator.toLowerCase() ||
      selectedCollaborator.toLowerCase().includes(p.collaborator_name.toLowerCase()) ||
      p.collaborator_name.toLowerCase().includes(selectedCollaborator.toLowerCase())
    )
  }, [pdis, selectedCollaborator])

  // Filter feedbacks for the selected collaborator
  const collaboratorFeedbacks = useMemo(() => {
    return feedbacks.filter(f => 
      f.responsavel.toLowerCase() === selectedCollaborator.toLowerCase() ||
      selectedCollaborator.toLowerCase().includes(f.responsavel.toLowerCase()) ||
      f.responsavel.toLowerCase().includes(selectedCollaborator.toLowerCase())
    )
  }, [feedbacks, selectedCollaborator])

  // LocalStorage draft functionality for scientific questionnaire
  const draftKey = `vertice_draft_${selectedCollaborator}`

  useEffect(() => {
    if (isSurveyActive) {
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        try {
          const parsed = JSON.parse(draft)
          setAnswers(parsed.answers || {})
          setOpenAnswers(parsed.openAnswers || {})
          setCurrentQuestionIndex(parsed.currentQuestionIndex || 0)
        } catch (e) {
          console.error("Erro ao carregar rascunho: ", e)
        }
      }
    }
  }, [isSurveyActive, draftKey])

  const saveSurveyDraft = (updatedAnswers: Record<string, string>, updatedOpen: Record<string, string>, nextIndex: number) => {
    localStorage.setItem(draftKey, JSON.stringify({
      answers: updatedAnswers,
      openAnswers: updatedOpen,
      currentQuestionIndex: nextIndex
    }))
  }

  const clearSurveyDraft = () => {
    localStorage.removeItem(draftKey)
  }

  // ── Auto-capture items/operational status ───────────────────────────────────
  const autoStatusSummary = useMemo(() => {
    if (!selectedCollaborator) return ''
    
    // Filter non-archived items belonging to this collaborator
    const collabItems = items.filter(i => 
      !i.archived && 
      i.owner && 
      (i.owner.toLowerCase() === selectedCollaborator.toLowerCase() ||
       selectedCollaborator.toLowerCase().includes(i.owner.toLowerCase()) ||
       i.owner.toLowerCase().includes(selectedCollaborator.toLowerCase()))
    )
    
    const total = collabItems.length
    if (total === 0) {
      return `### Sumário de Atividades (Captura Automática)\n* Nenhuma atividade ativa na carteira para o colaborador no momento.`
    }
    
    const completed = collabItems.filter(i => i.status === 'Concluído' || i.progress === 100).length
    const late = collabItems.filter(i => i.status === 'Atrasado' || i.status === 'Crítico').length
    const blocked = collabItems.filter(i => i.status === 'Bloqueado').length
    const inProgress = total - completed - late - blocked
    
    const attentionItems = collabItems.filter(i => ['Atrasado', 'Crítico', 'Bloqueado'].includes(i.status))
    
    let summary = `### Sumário de Atividades (Captura Automática)\n`
    summary += `* **Frentes Ativas:** ${total}\n`
    summary += `* **Status:** ${completed} Concluídas, ${inProgress} Em Andamento, ${late} Atrasadas, ${blocked} Bloqueadas\n\n`
    
    if (attentionItems.length > 0) {
      summary += `#### Pontos de Atenção (Atrasos/Bloqueios):\n`
      attentionItems.forEach(i => {
        summary += `- [${i.id}] ${i.demand || i.project || 'Sem título'} (${i.status})\n`
      });
    } else {
      summary += `* Nenhuma atividade crítica ou bloqueada identificada na carteira.`
    }
    
    return summary
  }, [selectedCollaborator, items])

  // Open feedback modal and inject auto-captured status
  const handleOpenFeedbackModal = () => {
    setFeedbackForm({
      trimestre: 'Q2',
      feedback_type: '1:1 Tático Semanal',
      strengths: '',
      improvements: '',
      action_plan: '',
      general_notes: autoStatusSummary // Pre-fill with the auto-capture markdown!
    })
    setIsFeedbackModalOpen(true)
  }

  // Handle survey navigation and scoring
  const handleAnswerSelect = (questionCode: string, optionValue: string) => {
    const updatedAnswers = { ...answers, [questionCode]: optionValue }
    setAnswers(updatedAnswers)
    
    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)
    saveSurveyDraft(updatedAnswers, openAnswers, nextIndex)
  }

  const handleOpenAnswerChange = (questionCode: string, text: string) => {
    const updatedOpen = { ...openAnswers, [questionCode]: text }
    setOpenAnswers(updatedOpen)
    saveSurveyDraft(answers, updatedOpen, currentQuestionIndex)
  }

  const handleSurveyNext = () => {
    const nextIndex = currentQuestionIndex + 1
    setCurrentQuestionIndex(nextIndex)
    saveSurveyDraft(answers, openAnswers, nextIndex)
  }

  const handleSurveyBack = () => {
    if (currentQuestionIndex > 0) {
      const prevIndex = currentQuestionIndex - 1
      setCurrentQuestionIndex(prevIndex)
      saveSurveyDraft(answers, openAnswers, prevIndex)
    }
  }

  // Compute results and submit evaluation
  const handleCompleteSurvey = async () => {
    // 1. Prepare scoring responses array
    const scoringResponses = Object.entries(answers).map(([code, answer]) => ({
      code,
      answer
    }))

    // 2. Call the scientific scoring engine
    const scoresResult = computePerfilCientificoScores(scoringResponses)

    // 3. Generate deterministic premium Portuguese narrative report
    const sortedComp = Object.entries(scoresResult.competencyScores)
      .map(([slug, score]) => {
        const comp = COMPETENCIES.find(c => c.slug === slug)
        return { slug, name: comp ? comp.name : slug, score }
      })
      .sort((a, b) => b.score - a.score)
    
    const strengths = sortedComp.slice(0, 3)
    const focuses = sortedComp.slice(-3).reverse()

    let narrative = `### Análise Executiva de Perfil Científico (Protocolo Vértice)\n\n`
    narrative += `#### 1. Síntese Geral do Perfil\n`
    const highDomain = Object.entries(scoresResult.domainScores).sort((a, b) => b[1] - a[1])[0]
    const domName = DOMAINS.find(d => d.slug === highDomain[0])?.name || highDomain[0]
    
    narrative += `Com base nas respostas situacionais analisadas sob o rigor do Protocolo Vértice, o profissional apresenta excelente alinhamento operacional e maturidade tática. O seu principal destaque reside no domínio de **${domName}** com média de **${highDomain[1]}/100**, o que revela forte discernimento estratégico e capacidade analítica em cenários de alta complexidade.\n\n`
    
    narrative += `#### 2. Principais Fortalezas (Top 3 Competências)\n`
    strengths.forEach((s, idx) => {
      narrative += `* **${idx + 1}. ${s.name}** (${s.score}/100): Ponto focal de alta proficiência. Representa segurança na condução de processos e resolução de problemas operacionais.\n`
    })
    narrative += `\n`

    narrative += `#### 3. Oportunidades de Desenvolvimento (Top 3 Focos de Crescimento)\n`
    focuses.forEach((f, idx) => {
      narrative += `* **${idx + 1}. ${f.name}** (${f.score}/100): Área recomendada para PDI. Pequenos ajustes de atitude e foco aqui gerarão saltos exponenciais de eficiência operacional.\n`
    })
    narrative += `\n`

    narrative += `#### 4. Diagnóstico Completo por Domínio Vértice\n`
    DOMAINS.forEach(d => {
      const score = scoresResult.domainScores[d.slug] || 0
      let details: string
      if (score >= 80) {
        details = 'Nível Excepcional. Atua com excelência sistêmica, apto a mentorear outros membros do time e otimizar rotinas.'
      } else if (score >= 60) {
        details = 'Proficiente. Resolve problemas com boa autonomia e entrega valor coerente alinhado aos padrões.'
      } else {
        details = 'Em desenvolvimento. Demanda supervisão tática e incentivos dirigidos para consolidar boas práticas.'
      }
      narrative += `* **${d.name}** (${score}/100): ${details} _(${d.description})_\n`
    })

    const payload = {
      user_id: currentUserId,
      collaborator_name: selectedCollaborator,
      status: 'completed' as const,
      answers: answers as Record<string, string | number>,
      open_answers: openAnswers as Record<string, string>,
      domain_scores: scoresResult.domainScores as Record<string, number>,
      competency_scores: scoresResult.competencyScores as Record<string, number>,
      subcompetency_scores: scoresResult.subCompetencyScores as Record<string, number>,
      consistency_index: scoresResult.consistencyIndex,
      consistency_label: scoresResult.consistencyLabel,
      laudo_narrativo: narrative
    }

    try {
      await onSaveEvaluation(payload)
      clearSurveyDraft()
      setIsSurveyActive(false)
      setCurrentQuestionIndex(0)
      setAnswers({})
      setOpenAnswers({})
    } catch (e) {
      console.error("Erro ao salvar avaliação: ", e)
    }
  }

  // Handle feedback submit
  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      responsavel: selectedCollaborator,
      trimestre: feedbackForm.trimestre,
      feedback_type: feedbackForm.feedback_type,
      author_id: currentUserId,
      author_name: currentUserFullName,
      strengths: feedbackForm.strengths || undefined,
      improvements: feedbackForm.improvements || undefined,
      action_plan: feedbackForm.action_plan || undefined,
      general_notes: feedbackForm.general_notes || undefined
    }

    try {
      await onAddFeedback(payload)
      setIsFeedbackModalOpen(false)
    } catch (err) {
      console.error("Erro ao registrar 1:1: ", err)
    }
  }

  // Handle PDI submit
  const handleSavePdiSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Partial<UserPDI> = {
      ...(editingPdiId ? { id: editingPdiId } : {}),
      user_id: currentUserId,
      collaborator_name: selectedCollaborator,
      trimestre: pdiForm.trimestre,
      objetivo_carreira: pdiForm.objetivo_carreira,
      competencias_foco: pdiForm.competencias_foco,
      plano_acao: pdiForm.plano_acao,
      status: pdiForm.status
    }

    try {
      await onSavePDI(payload)
      setIsPdiModalOpen(false)
      setEditingPdiId(null)
    } catch (err) {
      console.error("Erro ao salvar PDI: ", err)
    }
  }

  const handleEditPdi = () => {
    if (currentPdi) {
      setEditingPdiId(currentPdi.id)
      setPdiForm({
        trimestre: currentPdi.trimestre,
        objetivo_carreira: currentPdi.objetivo_carreira,
        competencias_foco: currentPdi.competencias_foco,
        plano_acao: currentPdi.plano_acao,
        status: currentPdi.status
      })
      setIsPdiModalOpen(true)
    } else {
      setEditingPdiId(null)
      setPdiForm({
        trimestre: 'Q2',
        objetivo_carreira: '',
        competencias_foco: [],
        plano_acao: '',
        status: 'Ativo'
      })
      setIsPdiModalOpen(true)
    }
  }

  const handleStructurePdiFromEvaluation = () => {
    if (!currentEvaluation) return
    
    // Pick the 3 competencies with the lowest scores as focus candidates
    const sortedLow = Object.entries(currentEvaluation.competency_scores)
      .map(([slug, score]) => {
        const comp = COMPETENCIES.find(c => c.slug === slug)
        return { slug, name: comp ? comp.name : slug, score }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map(item => item.slug)

    setEditingPdiId(null)
    setPdiForm({
      trimestre: 'Q2',
      objetivo_carreira: `Desenvolver excelência tática e analítica maximizando as competências do Protocolo Vértice.`,
      competencias_foco: sortedLow,
      plano_acao: `1. Executar as metas acordadas nos rituais de One-on-One.\n2. Dedicar foco de 30 minutos diários em auto-estudo das competências mapeadas em atraso.`,
      status: 'Ativo'
    })
    setActiveTab('pdi')
    setIsPdiModalOpen(true)
  }

  // Prep Radar Data
  const radarData = useMemo(() => {
    if (!currentEvaluation) return []
    return DOMAINS.map(d => ({
      domain: d.name,
      score: currentEvaluation.domain_scores[d.slug] || 0
    }))
  }, [currentEvaluation])

  return (
    <div className="features-container">
      {isFallback && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fef3c7',
          padding: '10px 15px',
          borderRadius: 8,
          marginBottom: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
          color: '#d97706'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Modo Demonstração (Dados Locais Ativos):</strong> A tabela de Desenvolvimento ainda não foi homologada na nuvem. Suas respostas e atas serão salvas localmente na página. Para persistência, aplique a migração <code>010_development_pdi.sql</code>.
            </span>
          </div>
        </div>
      )}

      {/* Header and Collaborator Select */}
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <h2>Desenvolvimento de Talentos & Perfil Executivo</h2>
          <p className="subtitle">Avaliação científica Protocolo Vértice, planos de desenvolvimento (PDI) e atas táticas de 1:1.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="control-group">
            <span className="control-label"><Users size={12} /> Colaborador</span>
            <select
              className="select small"
              value={selectedCollaborator}
              onChange={e => setSelectedCollaborator(e.target.value)}
              disabled={viewableCollaborators.length <= 1}
            >
              {viewableCollaborators.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Top Level Navigation Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button
          className={`tab ${activeTab === 'perfil' ? 'active' : ''}`}
          onClick={() => { setActiveTab('perfil'); setIsSurveyActive(false); }}
        >
          <TrendingUp size={15} /> Perfil Científico Vértice
        </button>
        <button
          className={`tab ${activeTab === 'feedbacks' ? 'active' : ''}`}
          onClick={() => { setActiveTab('feedbacks'); setIsSurveyActive(false); }}
        >
          <Star size={15} /> Atas One-on-One
        </button>
        <button
          className={`tab ${activeTab === 'pdi' ? 'active' : ''}`}
          onClick={() => { setActiveTab('pdi'); setIsSurveyActive(false); }}
        >
          <Target size={15} /> Plano de Desenvolvimento (PDI)
        </button>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. PERFIL CIENTÍFICO */}
      {activeTab === 'perfil' && (
        <div className="tab-pane">
          {isSurveyActive ? (
            /* Active Interactive SJT Questionnaire Survey */
            <div className="card" style={{ padding: 25, maxWidth: 800, margin: '0 auto', boxShadow: 'var(--shadow-soft)' }}>
              {currentQuestionIndex < 108 ? (
                /* Situational closed questions (0 to 107) */
                (() => {
                  const q = CLOSED_QUESTIONS[currentQuestionIndex]
                  const progressPct = ((currentQuestionIndex) / 113) * 100
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#5f7188', textTransform: 'uppercase' }}>
                          Questão Situacional {currentQuestionIndex + 1} de 113
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                          {Math.round(progressPct)}% Concluído
                        </span>
                      </div>
                      
                      {/* Premium progress bar */}
                      <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 25, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: 'var(--color-primary)', transition: 'width 0.3s ease' }}></div>
                      </div>

                      <div style={{ marginBottom: 25 }}>
                        <h4 style={{ fontSize: 16, lineHeight: '1.5em', fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>
                          {q.prompt}
                        </h4>
                      </div>

                      {/* Options stack with auto-advance and premium hover styling */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 30 }}>
                        {q.options.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleAnswerSelect(q.code, opt.value)}
                            style={{
                              textAlign: 'left',
                              padding: '14px 18px',
                              borderRadius: 8,
                              border: answers[q.code] === opt.value ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                              backgroundColor: answers[q.code] === opt.value ? 'var(--color-primary-light, #eff6ff)' : '#fff',
                              cursor: 'pointer',
                              fontSize: 13,
                              color: '#334155',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              gap: 12,
                              alignItems: 'flex-start'
                            }}
                            className="option-button"
                          >
                            <span style={{
                              fontWeight: 700,
                              color: answers[q.code] === opt.value ? 'var(--color-primary)' : '#94a3b8',
                              backgroundColor: answers[q.code] === opt.value ? '#fff' : '#f1f5f9',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontSize: 11
                            }}>
                              {opt.value.toUpperCase()}
                            </span>
                            <span style={{ lineHeight: '1.4em' }}>{opt.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Navigation controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                        <button
                          onClick={handleSurveyBack}
                          disabled={currentQuestionIndex === 0}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 12 }}
                        >
                          <ChevronLeft size={16} /> Voltar
                        </button>
                        
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>
                          Rascunho salvo no navegador automaticamente.
                        </div>

                        <button
                          onClick={() => { if (confirm('Deseja reiniciar a avaliação e apagar o progresso atual?')) { clearSurveyDraft(); setAnswers({}); setOpenAnswers({}); setCurrentQuestionIndex(0); } }}
                          className="btn"
                          style={{ color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12 }}
                        >
                          Reiniciar
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                /* Open-ended textual questions (108 to 112) */
                (() => {
                  const openIdx = currentQuestionIndex - 108
                  const q = OPEN_QUESTIONS[openIdx]
                  const progressPct = ((currentQuestionIndex) / 113) * 100
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#5f7188', textTransform: 'uppercase' }}>
                          Questão Aberta de Contexto {openIdx + 1} de 5
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                          {Math.round(progressPct)}% Concluído
                        </span>
                      </div>
                      
                      {/* Premium progress bar */}
                      <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 25, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, backgroundColor: 'var(--color-primary)', transition: 'width 0.3s ease' }}></div>
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <h4 style={{ fontSize: 16, lineHeight: '1.5em', fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>
                          {q.prompt}
                        </h4>
                        <p style={{ fontSize: 13, color: '#64748b' }}>
                          {q.helper}
                        </p>
                      </div>

                      <div style={{ marginBottom: 30 }}>
                        <textarea
                          rows={6}
                          className="textarea"
                          placeholder="Digite detalhadamente a sua resposta..."
                          value={openAnswers[q.code] || ''}
                          onChange={e => handleOpenAnswerChange(q.code, e.target.value)}
                          style={{ width: '100%', padding: 14, borderRadius: 8, fontSize: 13 }}
                        />
                      </div>

                      {/* Navigation controls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                        <button
                          onClick={handleSurveyBack}
                          className="btn btn-secondary"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontSize: 12 }}
                        >
                          <ChevronLeft size={16} /> Voltar
                        </button>
                        
                        <div style={{ display: 'flex', gap: 10 }}>
                          {currentQuestionIndex < 112 ? (
                            <button
                              onClick={handleSurveyNext}
                              disabled={!(openAnswers[q.code]?.trim())}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', fontSize: 12 }}
                            >
                              Próximo <ChevronRight size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={handleCompleteSurvey}
                              disabled={!(openAnswers[q.code]?.trim())}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                            >
                              Finalizar e Gerar Laudo <CheckCircle2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          ) : currentEvaluation ? (
            /* Scientific Profile Dashboard */
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 340px',
                gap: 20,
                alignItems: 'start'
              }} className="responsive-grid">
                
                {/* Left Side: Radar and Narrative */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* Radar Chart Panel */}
                  <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ alignSelf: 'flex-start', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Radar de Competências Executivas</h3>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Distribuição de pontuações médias normalizadas (0-100) por domínio científico</p>
                      </div>
                      
                      {/* Consistency Badge */}
                      {currentEvaluation.consistency_index !== null && currentEvaluation.consistency_index !== undefined && (
                        <div style={{
                          backgroundColor: currentEvaluation.consistency_index >= 80 ? '#f0fdf4' : (currentEvaluation.consistency_index >= 60 ? '#fffbeb' : '#fef2f2'),
                          border: `1px solid ${currentEvaluation.consistency_index >= 80 ? '#bbf7d0' : (currentEvaluation.consistency_index >= 60 ? '#fef3c7' : '#fecaca')}`,
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          color: currentEvaluation.consistency_index >= 80 ? '#15803d' : (currentEvaluation.consistency_index >= 60 ? '#b45309' : '#b91c1c')
                        }}>
                          Consistência: {currentEvaluation.consistency_index}% ({currentEvaluation.consistency_label})
                        </div>
                      )}
                    </div>
                    
                    {/* Fixed size responsive container for Recharts */}
                    <div style={{ width: '100%', height: 350, display: 'flex', justifyContent: 'center' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="domain" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                          <Radar name="Perfil Vértice" dataKey="score" stroke="var(--color-primary, #2563eb)" fill="var(--color-primary, #2563eb)" fillOpacity={0.3} />
                          <Tooltip formatter={(value) => [`${value} / 100`, 'Pontuação']} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Textual Narrative Report Card */}
                  <div className="card" style={{ padding: 25 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 15, marginBottom: 15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Diagnóstico Científico Executivo</h3>
                      </div>
                      
                      {selectedCollaborator === currentUserFullName && (
                        <button
                          onClick={() => { if (confirm('Tem certeza que deseja refazer a sua avaliação de perfil? Seus dados atuais serão arquivados.')) { onDeleteEvaluation(currentEvaluation.id); } }}
                          className="btn btn-secondary small"
                          style={{ fontSize: 10, color: '#ef4444' }}
                        >
                          <RotateCcw size={10} /> Refazer Avaliação
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: 13, lineHeight: '1.6em', color: '#334155' }} className="markdown-content">
                      {currentEvaluation.laudo_narrativo ? (
                        currentEvaluation.laudo_narrativo.split('\n').map((line, idx) => {
                          if (line.startsWith('###')) {
                            return <h3 key={idx} style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 10, color: '#0f172a' }}>{line.replace('###', '').trim()}</h3>
                          }
                          if (line.startsWith('####')) {
                            return <h4 key={idx} style={{ fontSize: 14, fontWeight: 700, marginTop: 15, marginBottom: 8, color: '#1e293b' }}>{line.replace('####', '').trim()}</h4>
                          }
                          if (line.startsWith('*')) {
                            return <li key={idx} style={{ marginLeft: 15, marginBottom: 5 }}>{line.replace('*', '').trim()}</li>
                          }
                          if (line.trim() === '') return <div key={idx} style={{ height: 10 }} />
                          return <p key={idx} style={{ marginBottom: 10 }}>{line}</p>
                        })
                      ) : (
                        <p>Nenhum laudo gerado para esta avaliação.</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Right Side: Quick Stats and Domain Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  
                  {/* PDI Transition Card */}
                  {!currentPdi ? (
                    <div className="card" style={{
                      padding: 20,
                      backgroundColor: 'var(--color-primary-light, #f0f7ff)',
                      border: '1px dashed var(--color-primary, #2563eb)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <Target size={26} style={{ color: 'var(--color-primary)' }} />
                      <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Sem PDI Ativo Estruturado</h4>
                      <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: '1.4em' }}>
                        Utilize o diagnóstico das competências em atraso para criar um Plano de Desenvolvimento focado.
                      </p>
                      <button
                        onClick={handleStructurePdiFromEvaluation}
                        className="btn btn-primary small"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                      >
                        Estruturar PDI Conectado <ArrowRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="card" style={{ padding: 20, backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>PDI Vinculado Ativo</h4>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: '#475569', marginBottom: 10 }}>
                        O colaborador já possui um Plano de Desenvolvimento focado em <strong>{currentPdi.competencias_foco.length} competências</strong>.
                      </p>
                      <button
                        onClick={() => setActiveTab('pdi')}
                        className="btn btn-secondary small"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Ver Detalhes do PDI
                      </button>
                    </div>
                  )}

                  {/* Domain Breakdown list */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: 13, fontWeight: 700 }}>Scores por Domínio Vértice</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                      {DOMAINS.map(d => {
                        const score = currentEvaluation.domain_scores[d.slug] || 0
                        return (
                          <div key={d.slug}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{d.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)' }}>{score}/100</span>
                            </div>
                            {/* Score progress bar */}
                            <div style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${score}%`,
                                backgroundColor: score >= 80 ? '#22c55e' : (score >= 60 ? 'var(--color-primary)' : '#e2e8f0'),
                                borderRadius: 3
                              }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          ) : (
            /* Landing view encouraging user to start evaluation */
            <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 650, margin: '20px auto', boxShadow: 'var(--shadow-soft)' }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light, #f0f7ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto'
              }}>
                <Heart size={30} style={{ color: 'var(--color-primary)' }} />
              </div>
              
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
                Avaliação de Perfil Científico Vértice
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: '1.6em', marginBottom: 30 }}>
                {selectedCollaborator === currentUserFullName ? (
                  "Descubra as suas principais forças executivas e oportunidades de carreira através de uma avaliação situacional rica com 108 perguntas mapeando 5 domínios fundamentais. O processo leva em média 20 minutos e conta com salvamento automático."
                ) : (
                  `O colaborador ${selectedCollaborator} ainda não realizou a Avaliação de Perfil Científico. Incentive-o(a) a completar a avaliação para liberar a geração do laudo e estruturar o Plano de Desenvolvimento Individual.`
                )}
              </p>

              {selectedCollaborator === currentUserFullName ? (
                <button
                  onClick={() => setIsSurveyActive(true)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', fontSize: 13, fontWeight: 600 }}
                >
                  <Play size={14} fill="#fff" /> Iniciar Avaliação de Perfil
                </button>
              ) : (
                <div style={{ padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 12, color: '#475569', display: 'inline-block' }}>
                  Apenas o próprio colaborador pode realizar o questionário no seu painel logado.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. ONE-ON-ONES (ATAS E HISTÓRICO) */}
      {activeTab === 'feedbacks' && (
        <div className="tab-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Histórico de One-on-Ones</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Registro semanal e pactuações táticas de desenvolvimento de {selectedCollaborator}</p>
            </div>
            
            {isSuperOrAdmin && (
              <button
                onClick={handleOpenFeedbackModal}
                className="btn btn-primary small"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Registrar Novo 1:1
              </button>
            )}
          </div>

          {collaboratorFeedbacks.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', border: '1px dashed #e2e8f0', backgroundColor: '#fafbfc' }}>
              <Star size={24} style={{ color: '#94a3b8', marginBottom: 10 }} />
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#475569' }}>Nenhum feedback registrado</h4>
              <p style={{ margin: '5px 0 0 0', fontSize: 11, color: '#64748b' }}>
                Nenhuma ata de One-on-One cadastrada para {selectedCollaborator} no trimestre.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {collaboratorFeedbacks.map(f => (
                <div key={f.id} className="card" style={{ padding: 20, position: 'relative' }}>
                  
                  {/* Delete button for Admin */}
                  {isSuperOrAdmin && (
                    <button
                      onClick={() => { if (confirm('Excluir este feedback permanentemente?')) onDeleteFeedback(f.id); }}
                      style={{
                        position: 'absolute',
                        top: 15,
                        right: 15,
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: 4
                      }}
                      title="Excluir ata"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  {/* Header info */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 15, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#475569'
                    }}>
                      <User size={16} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {f.feedback_type}
                      </h4>
                      <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                        Trimestre: {f.trimestre} | Registrado por: {f.author_name} em {new Date(f.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {/* Form fields review */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }} className="responsive-grid">
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Pontos Fortes Mapeados</h5>
                      <p style={{ margin: 0, fontSize: 12, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderLeft: '3px solid #22c55e', minHeight: 40, whiteSpace: 'pre-wrap' }}>
                        {f.strengths || 'Sem pontos cadastrados.'}
                      </p>
                    </div>

                    <div>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Oportunidades de Melhoria</h5>
                      <p style={{ margin: 0, fontSize: 12, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderLeft: '3px solid #f59e0b', minHeight: 40, whiteSpace: 'pre-wrap' }}>
                        {f.improvements || 'Sem oportunidades cadastradas.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 15 }} className="responsive-grid">
                    <div>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Plano de Ação Acordado</h5>
                      <p style={{ margin: 0, fontSize: 12, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderLeft: '3px solid var(--color-primary)', minHeight: 40, whiteSpace: 'pre-wrap' }}>
                        {f.action_plan || 'Sem ações pactuadas.'}
                      </p>
                    </div>

                    <div>
                      <h5 style={{ margin: '0 0 5px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Status de Atividades & Notas</h5>
                      <div style={{ margin: 0, fontSize: 11, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderLeft: '3px solid #64748b', minHeight: 40 }} className="markdown-content">
                        {f.general_notes ? (
                          f.general_notes.split('\n').map((line, idx) => {
                            if (line.startsWith('###')) return <h5 key={idx} style={{ fontSize: 11, fontWeight: 700, margin: '8px 0 4px 0', color: '#0f172a' }}>{line.replace('###', '').trim()}</h5>
                            if (line.startsWith('####')) return <h6 key={idx} style={{ fontSize: 10, fontWeight: 700, margin: '6px 0 2px 0', color: '#1e293b' }}>{line.replace('####', '').trim()}</h6>
                            if (line.startsWith('*')) return <p key={idx} style={{ margin: '0 0 3px 0', paddingLeft: 6 }}>• {line.replace('*', '').trim()}</p>
                            if (line.startsWith('-')) return <p key={idx} style={{ margin: '0 0 3px 0', paddingLeft: 12, color: '#b91c1c' }}>- {line.replace('-', '').trim()}</p>
                            return <p key={idx} style={{ margin: '0 0 3px 0' }}>{line}</p>
                          })
                        ) : (
                          'Nenhuma nota adicional registrada.'
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. PLANO DE DESENVOLVIMENTO INDIVIDUAL (PDI) */}
      {activeTab === 'pdi' && (
        <div className="tab-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Plano de Desenvolvimento Individual (PDI)</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Metas de carreira, competências de foco e plano de ação estruturado de {selectedCollaborator}</p>
            </div>
            
            {isSuperOrAdmin && (
              <button
                onClick={handleEditPdi}
                className="btn btn-primary small"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {currentPdi ? <Edit3 size={14} /> : <Plus size={14} />}
                {currentPdi ? 'Editar PDI Ativo' : 'Estruturar Novo PDI'}
              </button>
            )}
          </div>

          {!currentPdi ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', border: '1px dashed #e2e8f0', backgroundColor: '#fafbfc' }}>
              <Target size={24} style={{ color: '#94a3b8', marginBottom: 10 }} />
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#475569' }}>Nenhum PDI ativo estruturado</h4>
              <p style={{ margin: '5px 0 0 0', fontSize: 11, color: '#64748b' }}>
                {isSuperOrAdmin ? (
                  "Mapeie competências de foco e objetivos de desenvolvimento para apoiar este colaborador taticamente."
                ) : (
                  "Seu PDI corporativo ainda não foi estruturado. Solicite uma agenda com seu gestor nos rituais de One-on-One."
                )}
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 25, borderTop: '4px solid var(--color-primary)' }}>
              
              {/* Delete button for Admin */}
              {isSuperOrAdmin && (
                <button
                  onClick={() => { if (confirm('Excluir este PDI permanentemente?')) onDeletePDI(currentPdi.id); }}
                  style={{
                    position: 'absolute',
                    top: 15,
                    right: 15,
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: 4
                  }}
                  title="Excluir PDI"
                >
                  <Trash2 size={14} />
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 15, marginBottom: 20 }}>
                <div>
                  <span style={{
                    backgroundColor: currentPdi.status === 'Ativo' ? '#e0f2fe' : (currentPdi.status === 'Concluído' ? '#dcfce7' : '#f1f5f9'),
                    color: currentPdi.status === 'Ativo' ? '#0369a1' : (currentPdi.status === 'Concluído' ? '#15803d' : '#475569'),
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    display: 'inline-block',
                    marginBottom: 5
                  }}>
                    PDI {currentPdi.status}
                  </span>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Plano de Desenvolvimento para {currentPdi.trimestre}
                  </h4>
                </div>
                
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Última atualização: {new Date(currentPdi.updated_at || '').toLocaleDateString('pt-BR')}
                </span>
              </div>

              {/* Career Goal */}
              <div style={{ marginBottom: 20 }}>
                <h5 style={{ margin: '0 0 5px 0', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Objetivo de Carreira / Meta Principal</h5>
                <p style={{ margin: 0, fontSize: 13, color: '#1e293b', backgroundColor: '#f8fafc', padding: 14, borderRadius: 8, fontWeight: 500, borderLeft: '3px solid var(--color-primary)' }}>
                  "{currentPdi.objetivo_carreira}"
                </p>
              </div>

              {/* Competencies chips */}
              <div style={{ marginBottom: 25 }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Competências de Foco Vértice</h5>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {currentPdi.competencias_foco.map(slug => {
                    const comp = COMPETENCIES.find(c => c.slug === slug)
                    return (
                      <span
                        key={slug}
                        style={{
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '6px 12px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#334155',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Star size={10} style={{ color: 'var(--color-primary)' }} />
                        {comp ? comp.name : slug}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Actions agreed */}
              <div>
                <h5 style={{ margin: '0 0 5px 0', fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Plano de Ações Pactuadas</h5>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', backgroundColor: '#f8fafc', padding: 14, borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: '1.5em' }}>
                  {currentPdi.plano_acao}
                </p>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* 1. Novo Feedback One-on-One Modal */}
      {isFeedbackModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card modal-content" style={{
            width: '100%',
            maxWidth: 750,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 25,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: 16, fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              Registrar Reunião de One-on-One
            </h3>

            <form onSubmit={handleSaveFeedback}>
              
              {/* Auto-capture Active activities status card */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: 15,
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)', fontWeight: 700, marginBottom: 8 }}>
                  <Zap size={14} /> Captura Automática de Status Operacional ({selectedCollaborator})
                </div>
                <div style={{ color: '#475569', lineHeight: '1.4em', fontSize: 11 }}>
                  O sistema analisou a carteira de projetos atual do colaborador e gerou o sumário abaixo que será anexado às Notas Gerais da ata:
                </div>
                
                {/* Visual statistics */}
                <div style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  padding: 10,
                  borderRadius: 6,
                  marginTop: 10,
                  color: '#334155'
                }}>
                  {autoStatusSummary}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }} className="responsive-grid">
                <div className="control-group">
                  <span className="control-label">Trimestre</span>
                  <select
                    className="select small"
                    value={feedbackForm.trimestre}
                    onChange={e => setFeedbackForm({ ...feedbackForm, trimestre: e.target.value })}
                  >
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Abr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Set)</option>
                  </select>
                </div>

                <div className="control-group">
                  <span className="control-label">Tipo de Registro</span>
                  <select
                    className="select small"
                    value={feedbackForm.feedback_type}
                    onChange={e => setFeedbackForm({ ...feedbackForm, feedback_type: e.target.value })}
                  >
                    <option value="1:1 Tático Semanal">1:1 Tático Semanal</option>
                    <option value="Feedback Formal de Perfil">Feedback Formal de Perfil</option>
                    <option value="Alinhamento e PDI">Alinhamento e PDI</option>
                  </select>
                </div>
              </div>

              <div className="control-group" style={{ marginBottom: 15 }}>
                <span className="control-label">Pontos Fortes Mapeados na Semana</span>
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="Quais comportamentos, entregas ou atitudes de destaque o colaborador apresentou?"
                  value={feedbackForm.strengths}
                  onChange={e => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                  required
                />
              </div>

              <div className="control-group" style={{ marginBottom: 15 }}>
                <span className="control-label">Oportunidades de Melhoria / Gap de Atitude</span>
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="Onde o colaborador ficou abaixo do esperado? Quais atitudes ou entregas precisam mudar?"
                  value={feedbackForm.improvements}
                  onChange={e => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })}
                  required
                />
              </div>

              <div className="control-group" style={{ marginBottom: 15 }}>
                <span className="control-label">Plano de Ações Acordadas</span>
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="Quais as tarefas de foco e prazos pactuados com o colaborador para a próxima semana?"
                  value={feedbackForm.action_plan}
                  onChange={e => setFeedbackForm({ ...feedbackForm, action_plan: e.target.value })}
                  required
                />
              </div>

              <div className="control-group" style={{ marginBottom: 20 }}>
                <span className="control-label">Status de Atividades (Anexado Automaticamente)</span>
                <textarea
                  rows={5}
                  className="textarea"
                  value={feedbackForm.general_notes}
                  onChange={e => setFeedbackForm({ ...feedbackForm, general_notes: e.target.value })}
                  placeholder="Notas gerais sobre a carteira..."
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 15 }}>
                <button
                  type="button"
                  onClick={() => setIsFeedbackModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Salvar Ata 1:1
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 2. Create/Edit PDI Modal */}
      {isPdiModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card modal-content" style={{
            width: '100%',
            maxWidth: 650,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 25,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: 16, fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              {editingPdiId ? 'Editar PDI Corporativo' : 'Estruturar Novo PDI'}
            </h3>

            <form onSubmit={handleSavePdiSubmit}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }} className="responsive-grid">
                <div className="control-group">
                  <span className="control-label">Trimestre</span>
                  <select
                    className="select small"
                    value={pdiForm.trimestre}
                    onChange={e => setPdiForm({ ...pdiForm, trimestre: e.target.value })}
                  >
                    <option value="Q1">Q1 (Jan-Mar)</option>
                    <option value="Q2">Q2 (Abr-Jun)</option>
                    <option value="Q3">Q3 (Jul-Set)</option>
                  </select>
                </div>

                <div className="control-group">
                  <span className="control-label">Status</span>
                  <select
                    className="select small"
                    value={pdiForm.status}
                    onChange={e => setPdiForm({ ...pdiForm, status: e.target.value as 'Ativo' | 'Concluído' | 'Suspenso' })}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Suspenso">Suspenso</option>
                  </select>
                </div>
              </div>

              <div className="control-group" style={{ marginBottom: 15 }}>
                <span className="control-label">Objetivo de Carreira / Meta Principal</span>
                <textarea
                  rows={2}
                  className="textarea"
                  placeholder="Qual o objetivo de evolução profissional deste colaborador? (ex: Assumir liderança da frente Vivo)"
                  value={pdiForm.objetivo_carreira}
                  onChange={e => setPdiForm({ ...pdiForm, objetivo_carreira: e.target.value })}
                  required
                />
              </div>

              <div className="control-group" style={{ marginBottom: 15 }}>
                <span className="control-label">Competências em Foco do Protocolo Vértice</span>
                <div style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  padding: 10,
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  backgroundColor: '#fff'
                }}>
                  {COMPETENCIES.map(comp => (
                    <label key={comp.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={pdiForm.competencias_foco.includes(comp.slug)}
                        onChange={e => {
                          const checked = e.target.checked
                          setPdiForm(prev => {
                            const current = prev.competencias_foco
                            const next = checked 
                              ? [...current, comp.slug]
                              : current.filter(s => s !== comp.slug)
                            return { ...prev, competencias_foco: next }
                          })
                        }}
                      />
                      <span>{comp.name} <span style={{ color: '#94a3b8', fontSize: 10 }}>({DOMAINS.find(d => d.slug === comp.domain)?.name})</span></span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>
                  Selecione as competências do Protocolo Vértice que serão prioritárias no trimestre.
                </div>
              </div>

              <div className="control-group" style={{ marginBottom: 20 }}>
                <span className="control-label">Plano de Ações Pactuadas</span>
                <textarea
                  rows={4}
                  className="textarea"
                  placeholder="Quais as tarefas de foco, cursos, mentorias ou metas específicas acordadas para o desenvolvimento destas competências?"
                  value={pdiForm.plano_acao}
                  onChange={e => setPdiForm({ ...pdiForm, plano_acao: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f1f5f9', paddingTop: 15 }}>
                <button
                  type="button"
                  onClick={() => setIsPdiModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Salvar PDI
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, Zap, Users, AlertTriangle, ChevronLeft,
  ChevronRight, RotateCcw, FileText, CheckCircle2, Trash2, Edit3,
  Plus, Target, Heart, ArrowRight, User, Award as Star, Play,
  Sparkles, X, Clock, BookOpen, MessageSquare
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
import { Item, Role, OKRFeedback, OKRTarget, OKRMeasurement, UserPDI, ProfileEvaluation, UserProfile, isQuarter, periodoCoversQuarter } from '@/shared/domain'

// Renderiza markdown inline simples (negrito **x**) como nós React — sem
// dangerouslySetInnerHTML. Usado no laudo para destacar nomes de competência.
function renderInlineMd(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? (
      <strong key={i} style={{ color: '#0f172a', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

// Banda de score → rótulo, nota e cores. Base do comentário determinístico por
// item no detalhamento (18 competências + ~54 sub-competências).
function scoreBand(score: number): { label: string; note: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Excepcional', note: 'Ponto forte consolidado', color: '#047857', bg: '#ecfdf5' }
  if (score >= 60) return { label: 'Proficiente', note: 'Sólido, com espaço para refinar', color: '#b45309', bg: '#fffbeb' }
  return { label: 'Em desenvolvimento', note: 'Priorize no plano de desenvolvimento', color: '#be123c', bg: '#fff1f2' }
}

// Cor por domínio (consistente com o detalhamento do laudo) — usada no seletor
// de competências do PDI.
const DOMAIN_COLOR: Record<string, string> = {
  cognicao: '#2563eb',
  negocio: '#0891b2',
  energia: '#db2777',
  relacao: '#7c3aed',
  crescimento: '#059669',
}

interface DevelopmentViewProps {
  items: Item[]
  pdis: UserPDI[]
  evaluations: ProfileEvaluation[]
  feedbacks: OKRFeedback[]
  userProfiles: UserProfile[]
  okrTargets: OKRTarget[]
  okrMeasurements: OKRMeasurement[]
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
  okrTargets,
  okrMeasurements,
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

  // AI analysis state
  const [isFinalizing, setIsFinalizing] = useState(false)

  // PDI history expanded cards
  const [expandedPdis, setExpandedPdis] = useState<Set<string>>(new Set())

  // Item 8 — Resumo inteligente das atas de 1:1 (auto-load + cache local)
  const [ataSummary, setAtaSummary] = useState<string>('')
  const [ataSummaryLoading, setAtaSummaryLoading] = useState<boolean>(false)
  const [ataSummaryProvider, setAtaSummaryProvider] = useState<string | null>(null)
  const [ataSummaryError, setAtaSummaryError] = useState<boolean>(false)
  const [ataRefreshNonce, setAtaRefreshNonce] = useState<number>(0)

  const isSuperOrAdmin = role === 'admin' || role === 'superintendente'

  // Dynamic list of viewable collaborators based on role hierarchy
  const viewableCollaborators = useMemo(() => {
    if (isSuperOrAdmin) {
      // Admin/Super veem qualquer colaborador CADASTRADO. Fonte única: user_profiles — não mais
      // owners de texto livre dos itens (fim da poluição "Kath e Pedro" e duplicatas por caixa).
      const profileNames = userProfiles.map(u => u.full_name || u.email).filter(Boolean)
      return Array.from(new Set([currentUserFullName, ...profileNames].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
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
  }, [role, currentUserFullName, userProfiles, isSuperOrAdmin])

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

  // All PDIs for selected collaborator, sorted by updated_at desc (newest first)
  const collaboratorPdis = useMemo(() => {
    return pdis
      .filter(p =>
        p.collaborator_name.toLowerCase() === selectedCollaborator.toLowerCase() ||
        selectedCollaborator.toLowerCase().includes(p.collaborator_name.toLowerCase()) ||
        p.collaborator_name.toLowerCase().includes(selectedCollaborator.toLowerCase())
      )
      .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())
  }, [pdis, selectedCollaborator])

  // Id do colaborador selecionado no cadastro (vínculo confiável, não por nome).
  const selectedCollaboratorId = useMemo(
    () => userProfiles.find(u => (u.full_name || u.email) === selectedCollaborator)?.id ?? null,
    [userProfiles, selectedCollaborator],
  )

  // OKRs do colaborador: por responsavel_user_id (confiável). Fallback por nome p/ dados legados.
  const collaboratorOkrTargets = useMemo(() => {
    if (selectedCollaboratorId) {
      const byId = okrTargets.filter(t => t.responsavel_user_id === selectedCollaboratorId)
      if (byId.length) return byId
    }
    const nameParts = selectedCollaborator.toLowerCase().split(' ').filter(p => p.length > 2)
    return okrTargets.filter(t => {
      const resp = t.responsavel.toLowerCase()
      return resp === selectedCollaborator.toLowerCase() || nameParts.some(part => resp.includes(part))
    })
  }, [okrTargets, selectedCollaborator, selectedCollaboratorId])

  // OKR measurements for the collaborator's targets
  const collaboratorOkrMeasurements = useMemo(() => {
    const ids = new Set(collaboratorOkrTargets.map(t => t.id))
    return okrMeasurements.filter(m => ids.has(m.okr_id))
  }, [okrMeasurements, collaboratorOkrTargets])

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

  // ── Item 8: chave de cache do resumo de atas (auto-invalida ao surgir nova ata) ─
  const ataCacheKey = useMemo(() => {
    const latestFeedbackDate = collaboratorFeedbacks
      .map(f => f.date)
      .sort()
      .slice(-1)[0] ?? 'none'
    return `vertice_ata_summary_${selectedCollaborator}_${collaboratorFeedbacks.length}:${latestFeedbackDate}`
  }, [selectedCollaborator, collaboratorFeedbacks])

  // Força regeração: limpa o cache da chave atual e incrementa o nonce do efeito
  const handleRegenerateAta = () => {
    try {
      localStorage.removeItem(ataCacheKey)
    } catch {
      // localStorage indisponível — segue para o re-fetch mesmo assim
    }
    setAtaRefreshNonce(n => n + 1)
  }

  // ── Item 8: carrega resumo inteligente das atas quando a aba 1:1 está ativa ───
  // Economia de tokens: sem histórico → captura determinística; cache hit → instantâneo;
  // só um cache miss real gasta uma chamada de LLM.
  useEffect(() => {
    if (activeTab !== 'feedbacks' || !selectedCollaborator) return

    // Sem nenhuma ata registrada → usa a captura automática determinística (zero API)
    if (collaboratorFeedbacks.length === 0) {
      setAtaSummary(autoStatusSummary)
      setAtaSummaryProvider(null)
      setAtaSummaryError(false)
      setAtaSummaryLoading(false)
      return
    }

    let ignore = false

    // Cache hit → restaura sem gastar tokens
    try {
      const cached = localStorage.getItem(ataCacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { summary: string; provider: string | null }
        setAtaSummary(parsed.summary)
        setAtaSummaryProvider(parsed.provider)
        setAtaSummaryError(false)
        setAtaSummaryLoading(false)
        return
      }
    } catch {
      // cache corrompido — ignora e refaz
      try { localStorage.removeItem(ataCacheKey) } catch { /* noop */ }
    }

    // Snapshot de aderência dos OKRs do colaborador (apenas KRs já apurados)
    const attainments = collaboratorOkrTargets
      .map(t => {
        const meas = collaboratorOkrMeasurements.filter(m => m.okr_id === t.id)
        const lastWithResult = meas.filter(m => m.resultado_apurado !== null).slice(-1)[0]
        return lastWithResult?.atingimento ?? null
      })
      .filter((v): v is number => v !== null)

    const okrAdherence = attainments.length > 0
      ? {
          total: collaboratorOkrTargets.length,
          avg_attainment: Math.round(attainments.reduce((a, b) => a + b, 0) / attainments.length),
          on_track: attainments.filter(v => v >= 70).length,
          at_risk: attainments.filter(v => v < 70).length
        }
      : undefined

    // 1:1s mais recentes primeiro, truncados ao contrato da API
    const recentOneonones = [...collaboratorFeedbacks]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12)
      .map(f => ({
        date: f.date ? new Date(f.date).toLocaleDateString('pt-BR') : undefined,
        type: f.feedback_type,
        trimestre: f.trimestre,
        strengths: f.strengths || undefined,
        improvements: f.improvements || undefined,
        action_plan: f.action_plan || undefined
      }))

    setAtaSummaryLoading(true)
    setAtaSummaryError(false)

    fetch('/api/ai/ata-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collaborator_name: selectedCollaborator,
        status_summary: autoStatusSummary,
        okr_adherence: okrAdherence,
        recent_oneonones: recentOneonones
      })
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ summary: string; provider: string }>
      })
      .then(data => {
        if (ignore) return
        setAtaSummary(data.summary)
        setAtaSummaryProvider(data.provider)
        setAtaSummaryLoading(false)
        try {
          localStorage.setItem(ataCacheKey, JSON.stringify({ summary: data.summary, provider: data.provider }))
        } catch {
          // quota de localStorage — não-fatal, resumo segue visível na sessão
        }
      })
      .catch(() => {
        if (ignore) return
        // Fallback para a captura determinística → o card nunca fica vazio
        setAtaSummary(autoStatusSummary)
        setAtaSummaryProvider(null)
        setAtaSummaryError(true)
        setAtaSummaryLoading(false)
      })

    return () => { ignore = true }
  }, [activeTab, selectedCollaborator, collaboratorFeedbacks, collaboratorOkrTargets, collaboratorOkrMeasurements, autoStatusSummary, ataCacheKey, ataRefreshNonce])

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
    setIsFinalizing(true)
    try {
      // 1. Respostas situacionais
      const scoringResponses = Object.entries(answers).map(([code, answer]) => ({
        code,
        answer
      }))

      // 2. Motor de scoring determinístico (3 níveis + consistência)
      const scoresResult = computePerfilCientificoScores(scoringResponses)

      // 3. Narrativa determinística — FALLBACK (usada só quando não há provedor
      //    de IA). Usa nomes reais de competência/domínio, as respostas abertas
      //    e a ressalva de consistência. Não é mais um texto-padrão genérico.
      const compName = (slug: string) => COMPETENCIES.find(c => c.slug === slug)?.name ?? slug
      const sortedComp = Object.entries(scoresResult.competencyScores)
        .map(([slug, score]) => ({ name: compName(slug), score }))
        .sort((a, b) => b.score - a.score)
      const strengths = sortedComp.slice(0, 3)
      const focuses = sortedComp.slice(-3).reverse()
      const sortedDom = Object.entries(scoresResult.domainScores)
        .map(([slug, score]) => ({ name: DOMAINS.find(d => d.slug === slug)?.name ?? slug, score }))
        .sort((a, b) => b.score - a.score)
      const topDom = sortedDom[0]
      const lowDom = sortedDom[sortedDom.length - 1]
      const ci = scoresResult.consistencyIndex
      const ciLine =
        ci == null
          ? 'O índice de consistência não pôde ser calculado nesta avaliação.'
          : ci >= 80
            ? `O índice de consistência (${Math.round(ci)}/100) é alto — respostas coerentes entre situações distintas conferem confiabilidade a esta leitura.`
            : ci >= 60
              ? `O índice de consistência (${Math.round(ci)}/100) é moderado — a leitura é válida, mas vale confirmar alguns pontos na prática.`
              : `O índice de consistência (${Math.round(ci)}/100) é baixo — interprete com cautela e valide com observação direta.`

      let fallback = `### Síntese Executiva do Perfil\n`
      if (topDom) fallback += `O perfil tem como principal força o domínio de **${topDom.name}** (${Math.round(topDom.score)}/100). ${ciLine}\n\n`
      if (lowDom && lowDom.name !== topDom?.name) fallback += `O maior espaço de evolução está em **${lowDom.name}** (${Math.round(lowDom.score)}/100).\n\n`
      fallback += `### Fortalezas Principais e Manifestação Operacional\n`
      strengths.forEach(s => { fallback += `* **${s.name}** (${Math.round(s.score)}/100) — competência consolidada; tende a ser referência do time nas situações que a exigem.\n` })
      fallback += `\n### Oportunidades de Desenvolvimento com Ações Práticas\n`
      focuses.forEach(f => { fallback += `* **${f.name}** (${Math.round(f.score)}/100) — priorize no PDI com uma ação concreta e mensurável para os próximos 90 dias.\n` })
      const pain = openAnswers['OPEN-PAINS']?.trim()
      const obj = openAnswers['OPEN-OBJECTIVE']?.trim()
      if (pain || obj) {
        fallback += `\n### Leitura à Luz do Relato\n`
        if (pain && focuses[0]) fallback += `Sobre o desafio relatado — “${pain}” — desenvolver **${focuses[0].name}** é a alavanca mais direta.\n`
        if (obj && strengths[0]) fallback += `Para o objetivo de “${obj}”, as forças em **${strengths[0].name}**${strengths[1] ? ` e **${strengths[1].name}**` : ''} são a base a capitalizar.\n`
      }
      fallback += `\n### Trilha de PDI Recomendada\n`
      focuses.forEach((f, i) => { fallback += `${i + 1}. Desenvolver **${f.name}** com meta clara e checkpoint mensal.\n` })
      fallback += `\n_Laudo determinístico do Protocolo Vértice. Com um provedor de IA conectado, o laudo passa a ser redigido e personalizado a partir das respostas abertas._`

      // 4. Laudo AI-PRIMÁRIO: gera via IA (OpenAI/Ollama). Usa o fallback se a
      //    IA estiver indisponível — degradação graciosa, nunca trava a entrega.
      let laudo = fallback
      try {
        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collaborator_name: selectedCollaborator,
            domain_scores: scoresResult.domainScores,
            competency_scores: scoresResult.competencyScores,
            open_answers: openAnswers,
            consistency_index: scoresResult.consistencyIndex ?? 0,
            consistency_label: scoresResult.consistencyLabel ?? 'não calculado'
          })
        })
        if (res.ok) {
          const data = (await res.json()) as { analysis?: string }
          if (data.analysis && data.analysis.trim().length > 80) laudo = data.analysis.trim()
        }
      } catch {
        // mantém o fallback determinístico
      }

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
        laudo_narrativo: laudo
      }

      await onSaveEvaluation(payload)
      clearSurveyDraft()
      setIsSurveyActive(false)
      setCurrentQuestionIndex(0)
      setAnswers({})
      setOpenAnswers({})
    } catch (e) {
      console.error('Erro ao salvar avaliação: ', e)
    } finally {
      setIsFinalizing(false)
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

  const handleEditPdi = (pdi?: UserPDI) => {
    if (pdi) {
      setEditingPdiId(pdi.id)
      setPdiForm({
        trimestre: pdi.trimestre,
        objetivo_carreira: pdi.objetivo_carreira,
        competencias_foco: pdi.competencias_foco,
        plano_acao: pdi.plano_acao,
        status: pdi.status
      })
    } else {
      setEditingPdiId(null)
      setPdiForm({
        trimestre: 'Q2',
        objetivo_carreira: '',
        competencias_foco: [],
        plano_acao: '',
        status: 'Ativo'
      })
    }
    setIsPdiModalOpen(true)
  }

  // Gera um rascunho de PDI personalizado a partir de dados reais do colaborador:
  // competências avaliadas (nome + descrição do Protocolo Vértice), domínios
  // agregados, último 1:1 registrado e OKRs ativos. Síncrono de propósito — o
  // gestor revisa e edita o formulário antes de salvar.
  const handleStructurePdiFromEvaluation = () => {
    if (!currentEvaluation) return

    // Primeira frase de uma descrição (insight curto, sem cortar no meio)
    const firstSentence = (text: string) => {
      const trimmed = text.trim()
      const match = trimmed.match(/^.*?[.!?](\s|$)/)
      return (match ? match[0] : trimmed).trim()
    }

    // 1. Competências ordenadas por score (nome real + descrição do instrumento)
    const rankedComp = Object.entries(currentEvaluation.competency_scores)
      .map(([slug, score]) => {
        const comp = COMPETENCIES.find(c => c.slug === slug)
        return { slug, name: comp?.name ?? slug, description: comp?.description ?? '', score }
      })
      .sort((a, b) => a.score - b.score)

    const focuses = rankedComp.slice(0, 3)                     // 3 menores = foco do PDI
    const topStrength = rankedComp[rankedComp.length - 1]      // maior = alavanca a capitalizar
    const focusSlugs = focuses.map(f => f.slug)

    // 2. Domínios agregados — maior força x maior lacuna
    const rankedDom = Object.entries(currentEvaluation.domain_scores)
      .map(([slug, score]) => ({ name: DOMAINS.find(d => d.slug === slug)?.name ?? slug, score }))
      .sort((a, b) => b.score - a.score)
    const topDom = rankedDom[0]
    const lowDom = rankedDom[rankedDom.length - 1]

    // 3. Objetivo de carreira declarado na avaliação (resposta aberta), se houver
    const declaredObjective = currentEvaluation.open_answers?.['OPEN-OBJECTIVE']?.trim()

    // 4. Último 1:1 registrado — fios de continuidade (plano de ação / evolução)
    const lastFeedback = collaboratorFeedbacks
      .slice()
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0]
    const lastActionPlan = lastFeedback?.action_plan?.trim()
    const lastImprovements = lastFeedback?.improvements?.trim()

    // 5. OKRs ativos do colaborador — ancoragem do desenvolvimento ao resultado
    const activeOkrs = collaboratorOkrTargets.slice(0, 2).map(t => t.objetivo).filter(Boolean)

    // ── Objetivo de carreira personalizado ──────────────────────────────────
    let objetivo = declaredObjective ? `Objetivo declarado: "${declaredObjective}". ` : ''
    if (topDom) {
      objetivo += `Capitalizar a força em ${topDom.name} (${Math.round(topDom.score)}/100)`
      if (topStrength) objetivo += `, com destaque para ${topStrength.name},`
      const gap = lowDom && lowDom.name !== topDom.name
        ? `${lowDom.name} (${Math.round(lowDom.score)}/100)`
        : 'os pontos mapeados em desenvolvimento'
      objetivo += ` enquanto eleva o domínio de ${gap} ao longo do trimestre.`
    } else {
      objetivo += `Elevar de forma consistente as competências do Protocolo Vértice mapeadas em desenvolvimento.`
    }

    // ── Plano de ação multi-etapas, ancorado em dados reais ──────────────────
    const steps: string[] = []
    focuses.forEach(f => {
      const insight = f.description ? ` — ${firstSentence(f.description)}` : ''
      steps.push(`${steps.length + 1}. Desenvolver ${f.name} (${Math.round(f.score)}/100)${insight} Definir 1 ação mensurável e checkpoint mensal no 1:1.`)
    })
    if (topStrength) {
      steps.push(`${steps.length + 1}. Usar ${topStrength.name} (${Math.round(topStrength.score)}/100) como alavanca: mentorar um par ou liderar uma frente onde essa força acelere o time.`)
    }
    if (activeOkrs.length > 0) {
      steps.push(`${steps.length + 1}. Conectar o desenvolvimento ao resultado: vincular as ações aos OKRs ativos — ${activeOkrs.join('; ')}.`)
    }
    if (lastActionPlan) {
      steps.push(`${steps.length + 1}. Dar continuidade ao último 1:1: ${lastActionPlan}`)
    } else if (lastImprovements) {
      steps.push(`${steps.length + 1}. Retomar os pontos de evolução do último 1:1: ${lastImprovements}`)
    }

    setEditingPdiId(null)
    setPdiForm({
      trimestre: 'Q2',
      objetivo_carreira: objetivo,
      competencias_foco: focusSlugs,
      plano_acao: steps.join('\n'),
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      ` }} />
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
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
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
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
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
                              disabled={!(openAnswers[q.code]?.trim()) || isFinalizing}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', fontSize: 13, fontWeight: 600, backgroundColor: isFinalizing ? '#16a34a' : '#22c55e', borderColor: '#22c55e', opacity: isFinalizing ? 0.85 : 1 }}
                            >
                              {isFinalizing ? (
                                <>
                                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                                  Gerando laudo com IA…
                                </>
                              ) : (
                                <>Finalizar e Gerar Laudo <CheckCircle2 size={16} /></>
                              )}
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
                        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Evidência — Radar dos 5 Domínios</h3>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Médias normalizadas (0–100) por domínio científico — base quantitativa do laudo acima</p>
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

                  {/* Laudo (diagnóstico) — protagonista da tela (order:-1 sobe antes do radar) */}
                  <div className="card" style={{ padding: 25, order: -1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 15, marginBottom: 15 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Laudo de Perfil Científico</h3>
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
                          const t = line.trim()
                          if (t.startsWith('####')) {
                            return <h4 key={idx} style={{ fontSize: 13.5, fontWeight: 700, marginTop: 16, marginBottom: 8, color: '#1e293b' }}>{renderInlineMd(t.replace(/^#+\s*/, ''))}</h4>
                          }
                          if (t.startsWith('###')) {
                            return <h3 key={idx} style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: 22, marginBottom: 10, color: 'var(--color-primary)', borderLeft: '3px solid var(--color-primary)', paddingLeft: 10 }}>{renderInlineMd(t.replace(/^#+\s*/, ''))}</h3>
                          }
                          if (/^\d+\.\s/.test(t)) {
                            return <li key={idx} style={{ marginLeft: 18, marginBottom: 6, listStylePosition: 'inside' }}>{renderInlineMd(t.replace(/^\d+\.\s*/, ''))}</li>
                          }
                          if (t.startsWith('*') || t.startsWith('-')) {
                            return <li key={idx} style={{ marginLeft: 18, marginBottom: 6 }}>{renderInlineMd(t.replace(/^[*-]\s*/, ''))}</li>
                          }
                          if (t === '') return <div key={idx} style={{ height: 9 }} />
                          return <p key={idx} style={{ marginBottom: 10 }}>{renderInlineMd(t)}</p>
                        })
                      ) : (
                        <p>Nenhum laudo gerado para esta avaliação.</p>
                      )}
                    </div>
                  </div>


                  {/* Detalhamento por competência — todos os itens e sub-itens */}
                  <div className="card" style={{ padding: 24 }}>
                    <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 14, marginBottom: 18 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Detalhamento por competência</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>Score e leitura de cada uma das 18 competências e ~54 sub-competências avaliadas</p>
                    </div>
                    {DOMAINS.map(domain => {
                      const domainScores = currentEvaluation.domain_scores as Record<string, number>
                      const compScores = currentEvaluation.competency_scores as Record<string, number>
                      const subScores = (currentEvaluation.subcompetency_scores ?? {}) as Record<string, number>
                      const dScore = Math.round(domainScores[domain.slug] ?? 0)
                      const dBand = scoreBand(dScore)
                      const comps = COMPETENCIES.filter(c => c.domain === domain.slug)
                      return (
                        <div key={domain.slug} style={{ marginBottom: 20 }}>
                          <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{domain.code}. {domain.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: dBand.color, whiteSpace: 'nowrap' }}>{dScore}/100 · {dBand.label}</span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b', lineHeight: '1.5em' }}>{domain.description}</p>
                          </div>
                          {comps.map(comp => {
                            const cScore = Math.round(compScores[comp.slug] ?? 0)
                            const cBand = scoreBand(cScore)
                            return (
                              <div key={comp.slug} style={{ padding: '0 0 12px 12px', marginBottom: 10, borderLeft: `2px solid ${cBand.bg}` }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{comp.name}</span>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: cBand.color, whiteSpace: 'nowrap' }}>{cScore}/100 · {cBand.label}</span>
                                </div>
                                <p style={{ margin: '3px 0 8px', fontSize: 11.5, color: '#475569', lineHeight: '1.5em' }}>
                                  <strong style={{ color: cBand.color }}>{cBand.note}.</strong> {comp.description}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {comp.subCompetencies.map(sub => {
                                    const sScore = Math.round(subScores[sub.slug] ?? 0)
                                    const sBand = scoreBand(sScore)
                                    return (
                                      <span key={sub.slug} title={`${sub.name}: ${sScore}/100 · ${sBand.label}`} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: sBand.bg, color: sBand.color, fontWeight: 600 }}>
                                        {sub.name} · {sScore}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
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
            /* Landing view — onboarding instructions + start button */
            <div style={{ maxWidth: 680, margin: '20px auto' }}>
              {selectedCollaborator === currentUserFullName ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: 'var(--shadow-soft)' }}>

                  {/* Header */}
                  <div style={{
                    background: 'linear-gradient(135deg, var(--color-primary, #2563eb) 0%, #1d4ed8 100%)',
                    padding: '32px 36px',
                    textAlign: 'center',
                    color: '#fff'
                  }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto'
                    }}>
                      <BookOpen size={28} />
                    </div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                      Avaliação de Perfil Científico Vértice
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: '1.5em' }}>
                      108 questões situacionais + 5 questões discursivas mapeando 5 domínios executivos
                    </p>
                  </div>

                  {/* Instructions */}
                  <div style={{ padding: '28px 36px' }}>

                    <h3 style={{ margin: '0 0 16px 0', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Antes de Iniciar — Leia com Atenção
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                      {[
                        { icon: <Clock size={16} />, text: 'Reserve de 20 a 30 minutos sem interrupções. Avaliações feitas com pressa ou pausas longas podem comprometer a precisão do diagnóstico.' },
                        { icon: <Heart size={16} />, text: 'Escolha um ambiente calmo e silencioso. Concentração plena garante que suas respostas reflitam com fidelidade o seu estilo de atuação real.' },
                        { icon: <CheckCircle2 size={16} />, text: 'Responda com base no que você realmente faz — não no que acha que seria o ideal. O instrumento detecta inconsistências e padrões reais de comportamento.' },
                        { icon: <Star size={16} />, text: 'Não existe resposta certa ou errada. Cada alternativa reflete um perfil legítimo de competência. Não há ganho em "agradar" — o laudo só é útil quando honesto.' },
                      ].map((item, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '12px 16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #f1f5f9'
                        }}>
                          <span style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                          <span style={{ fontSize: 13, color: '#334155', lineHeight: '1.5em' }}>{item.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* What you'll get */}
                    <div style={{
                      backgroundColor: 'var(--color-primary-light, #eff6ff)',
                      border: '1px solid var(--color-primary-border, #bfdbfe)',
                      borderRadius: 8,
                      padding: '14px 18px',
                      marginBottom: 24
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                        O que você vai receber ao final:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          'Radar de 5 domínios executivos',
                          'Score por competência (100+)',
                          'Laudo científico narrativo',
                          'Base para o seu PDI trimestral',
                        ].map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1e40af' }}>
                            <ArrowRight size={11} />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setIsSurveyActive(true)}
                      className="btn btn-primary"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 24px', fontSize: 14, fontWeight: 600 }}
                    >
                      <Play size={14} fill="#fff" /> Iniciar Avaliação de Perfil
                    </button>
                    <p style={{ textAlign: 'center', margin: '10px 0 0 0', fontSize: 11, color: '#94a3b8' }}>
                      Progresso salvo automaticamente no navegador — você pode pausar e retomar.
                    </p>
                  </div>

                </div>
              ) : (
                <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                  <User size={32} style={{ color: '#94a3b8', marginBottom: 12 }} />
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 700, color: '#334155' }}>
                    Avaliação não realizada
                  </h4>
                  <p style={{ margin: '0 auto', fontSize: 13, color: '#64748b', lineHeight: '1.6em', maxWidth: 400 }}>
                    {selectedCollaborator} ainda não completou a Avaliação de Perfil Científico.
                    Incentive-o(a) a acessar o painel e realizar a avaliação para liberar o laudo e estruturar o PDI.
                  </p>
                  <div style={{ marginTop: 16, padding: '10px 15px', backgroundColor: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#475569', display: 'inline-block' }}>
                    Apenas o próprio colaborador pode responder o questionário pelo seu painel logado.
                  </div>
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

          {/* Item 8 — Resumo inteligente do colaborador (auto-gerado por IA + cache local) */}
          <div
            className="card"
            style={{
              padding: 0,
              marginBottom: 18,
              border: '1px solid #e2e8f0',
              borderTop: '3px solid var(--color-primary)',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '12px 18px', backgroundColor: '#f8fafc',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Sparkles size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', letterSpacing: '0.02em' }}>
                  Resumo Inteligente do Colaborador
                </span>
                {ataSummaryProvider && !ataSummaryLoading && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '2px 7px', borderRadius: 99,
                    color: ataSummaryProvider === 'openai' ? '#1d4ed8' : '#7c3aed',
                    backgroundColor: ataSummaryProvider === 'openai' ? '#eff6ff' : '#f5f3ff',
                    border: `1px solid ${ataSummaryProvider === 'openai' ? '#bfdbfe' : '#ddd6fe'}`
                  }}>
                    {ataSummaryProvider === 'openai' ? 'IA · OpenAI' : 'IA · Local'}
                  </span>
                )}
              </div>
              {isSuperOrAdmin && collaboratorFeedbacks.length > 0 && (
                <button
                  onClick={handleRegenerateAta}
                  disabled={ataSummaryLoading}
                  className="btn small"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: ataSummaryLoading ? 0.6 : 1, flexShrink: 0 }}
                  title="Regerar resumo com IA"
                >
                  <RotateCcw size={12} /> Regerar
                </button>
              )}
            </div>

            <div style={{ padding: '14px 18px' }}>
              {ataSummaryLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 12, padding: '6px 0' }}>
                  <span style={{
                    width: 14, height: 14, border: '2px solid #e2e8f0', borderTopColor: 'var(--color-primary)',
                    borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite'
                  }} />
                  <Clock size={13} style={{ flexShrink: 0 }} />
                  Sintetizando histórico de 1:1 e aderência de OKRs…
                </div>
              ) : (
                <>
                  {ataSummaryError && (
                    <div style={{
                      fontSize: 10.5, color: '#92400e', backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 10
                    }}>
                      IA indisponível no momento — exibindo captura automática da carteira.
                    </div>
                  )}
                  <div className="markdown-content" style={{ fontSize: 12, color: '#334155', lineHeight: '1.55em' }}>
                    {(ataSummary || autoStatusSummary).split('\n').map((line, idx) => {
                      const t = line.trim()
                      if (t === '') return <div key={idx} style={{ height: 6 }} />
                      if (t.startsWith('####')) {
                        return <h5 key={idx} style={{ fontSize: 11, fontWeight: 700, margin: '8px 0 3px 0', color: '#1e293b' }}>{renderInlineMd(t.replace(/^#+\s*/, ''))}</h5>
                      }
                      if (t.startsWith('###')) {
                        return (
                          <h4 key={idx} style={{
                            fontSize: 11.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                            margin: '12px 0 6px 0', color: 'var(--color-primary)',
                            borderLeft: '3px solid var(--color-primary)', paddingLeft: 9
                          }}>{renderInlineMd(t.replace(/^#+\s*/, ''))}</h4>
                        )
                      }
                      if (/^\d+\./.test(t)) {
                        return <p key={idx} style={{ margin: '0 0 3px 0', paddingLeft: 14 }}>{renderInlineMd(t)}</p>
                      }
                      if (t.startsWith('*') || t.startsWith('-')) {
                        return <p key={idx} style={{ margin: '0 0 3px 0', paddingLeft: 12 }}>• {renderInlineMd(t.replace(/^[*-]\s*/, ''))}</p>
                      }
                      return <p key={idx} style={{ margin: '0 0 4px 0' }}>{renderInlineMd(t)}</p>
                    })}
                  </div>
                </>
              )}
            </div>
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
              {collaboratorFeedbacks.map(f => {
                // OKRs active during this feedback's quarter (compatível com legado Jan-Jun)
                const periodOkrs = collaboratorOkrTargets.filter(t =>
                  isQuarter(f.trimestre) ? periodoCoversQuarter(t.periodo, f.trimestre) : true
                )

                return (
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
                        width: 32, height: 32, borderRadius: '50%',
                        backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#475569'
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

                    {/* OKR Context Strip — OKRs ativos no período */}
                    {periodOkrs.length > 0 && (
                      <div style={{
                        backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                        borderRadius: 6, padding: '8px 12px', marginBottom: 14
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#92400e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <Target size={9} style={{ flexShrink: 0 }} />
                          OKRs ativos em {f.trimestre}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {periodOkrs.slice(0, 3).map(t => {
                            const measForTarget = collaboratorOkrMeasurements.filter(m => m.okr_id === t.id)
                            const lastWithResult = measForTarget.filter(m => m.resultado_apurado !== null).slice(-1)[0]
                            const pct = lastWithResult?.atingimento ?? null
                            return (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 10, color: '#78350f', lineHeight: '1.3em', display: 'block' }}>
                                    {t.key_result.length > 70 ? `${t.key_result.slice(0, 70)}…` : t.key_result}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#a16207' }}>
                                    {t.perspectiva} · Meta: {t.meta_exibida}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <div style={{ width: 50, height: 4, backgroundColor: '#fde68a', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%', borderRadius: 2,
                                      width: `${Math.min(pct ?? 0, 100)}%`,
                                      backgroundColor: pct !== null ? (pct >= 100 ? '#16a34a' : pct >= 70 ? '#2563eb' : '#d97706') : '#d97706'
                                    }} />
                                  </div>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: pct !== null ? (pct >= 100 ? '#15803d' : pct >= 70 ? '#1d4ed8' : '#92400e') : '#94a3b8' }}>
                                    {pct !== null ? `${pct}%` : 'S/M'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                          {periodOkrs.length > 3 && (
                            <span style={{ fontSize: 9, color: '#a16207', marginTop: 2 }}>
                              +{periodOkrs.length - 3} OKRs adicionais no período
                            </span>
                          )}
                        </div>
                      </div>
                    )}

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
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. PLANO DE DESENVOLVIMENTO INDIVIDUAL (PDI) */}
      {activeTab === 'pdi' && (
        <div className="tab-pane">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

            {/* ── LEFT CONTEXT PANEL ──────────────────────────────── */}
            <div style={{ width: 270, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Context Card 1 — Perfil Vértice */}
              <div className="card" style={{ padding: 16, borderTop: '3px solid #8b5cf6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Star size={13} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Perfil Vértice
                  </span>
                </div>

                {currentEvaluation ? (
                  <>
                    {/* Domain scores as mini progress bars */}
                    {DOMAINS.map(d => {
                      const score = (currentEvaluation.domain_scores as Record<string, number>)[d.slug] ?? 0
                      return (
                        <div key={d.slug} style={{ marginBottom: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, lineHeight: 1 }}>{d.name}</span>
                            <span style={{ fontSize: 10, color: '#334155', fontWeight: 700 }}>{score}</span>
                          </div>
                          <div style={{ height: 5, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${score}%`,
                              backgroundColor: score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : '#f59e0b',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                        </div>
                      )
                    })}

                    {/* Top strengths */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#15803d', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ▲ Top Fortalezas
                      </div>
                      {Object.entries(currentEvaluation.competency_scores as Record<string, number>)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([slug, score]) => {
                          const comp = COMPETENCIES.find(c => c.slug === slug)
                          return (
                            <div key={slug} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#166534', marginBottom: 2 }}>
                              <span>• {comp?.name ?? slug}</span>
                              <span style={{ fontWeight: 700, marginLeft: 6 }}>{score}</span>
                            </div>
                          )
                        })}
                    </div>

                    {/* Dev areas */}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#b45309', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ▼ Áreas de Foco
                      </div>
                      {Object.entries(currentEvaluation.competency_scores as Record<string, number>)
                        .sort((a, b) => a[1] - b[1])
                        .slice(0, 3)
                        .map(([slug, score]) => {
                          const comp = COMPETENCIES.find(c => c.slug === slug)
                          return (
                            <div key={slug} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#92400e', marginBottom: 2 }}>
                              <span>• {comp?.name ?? slug}</span>
                              <span style={{ fontWeight: 700, marginLeft: 6 }}>{score}</span>
                            </div>
                          )
                        })}
                    </div>

                    <button
                      onClick={() => setActiveTab('perfil')}
                      style={{ marginTop: 10, fontSize: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      Ver avaliação completa <ArrowRight size={10} />
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <User size={20} style={{ color: '#cbd5e1', marginBottom: 6 }} />
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Avaliação não realizada</p>
                    <button
                      onClick={() => setActiveTab('perfil')}
                      style={{ marginTop: 8, fontSize: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, margin: '8px auto 0' }}
                    >
                      Ir para avaliação <ArrowRight size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Context Card 2 — Últimas 1:1s */}
              <div className="card" style={{ padding: 16, borderTop: '3px solid #10b981' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <MessageSquare size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Últimas 1:1s
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: '#94a3b8' }}>{collaboratorFeedbacks.length} reg.</span>
                </div>

                {collaboratorFeedbacks.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: 0 }}>Nenhuma ata registrada</p>
                ) : (
                  <>
                    {collaboratorFeedbacks.slice(0, 3).map((f, i) => (
                      <div
                        key={f.id}
                        style={{
                          marginBottom: i < Math.min(collaboratorFeedbacks.length, 3) - 1 ? 10 : 0,
                          paddingBottom: i < Math.min(collaboratorFeedbacks.length, 3) - 1 ? 10 : 0,
                          borderBottom: i < Math.min(collaboratorFeedbacks.length, 3) - 1 ? '1px solid #f1f5f9' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#334155' }}>{f.feedback_type}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 4 }}>
                            {f.trimestre}
                          </span>
                        </div>
                        {f.strengths && (
                          <p style={{ margin: '0 0 2px 0', fontSize: 10, color: '#166534', borderLeft: '2px solid #22c55e', paddingLeft: 5, lineHeight: '1.3em' }}>
                            {f.strengths.length > 75 ? `${f.strengths.slice(0, 75)}…` : f.strengths}
                          </p>
                        )}
                        {f.action_plan && (
                          <p style={{ margin: 0, fontSize: 10, color: '#1e40af', borderLeft: '2px solid var(--color-primary)', paddingLeft: 5, lineHeight: '1.3em' }}>
                            {f.action_plan.length > 75 ? `${f.action_plan.slice(0, 75)}…` : f.action_plan}
                          </p>
                        )}
                      </div>
                    ))}
                    {collaboratorFeedbacks.length > 3 && (
                      <button
                        onClick={() => setActiveTab('feedbacks')}
                        style={{ marginTop: 8, fontSize: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        Ver todos ({collaboratorFeedbacks.length}) <ArrowRight size={10} />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Context Card 3 — OKRs Ativos */}
              {collaboratorOkrTargets.length > 0 && (
                <div className="card" style={{ padding: 16, borderTop: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <Target size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      OKRs Ativos
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 9, color: '#94a3b8' }}>{collaboratorOkrTargets.length} KRs</span>
                  </div>
                  {collaboratorOkrTargets.slice(0, 5).map(t => {
                    const measForTarget = collaboratorOkrMeasurements.filter(m => m.okr_id === t.id)
                    const lastWithResult = measForTarget.filter(m => m.resultado_apurado !== null).slice(-1)[0]
                    const pct = lastWithResult?.atingimento ?? null
                    return (
                      <div key={t.id} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', marginBottom: 3, lineHeight: '1.3em' }}>
                          {t.key_result.length > 65 ? `${t.key_result.slice(0, 65)}…` : t.key_result}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ flex: 1, height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min(pct ?? 0, 100)}%`,
                              backgroundColor: pct !== null ? (pct >= 100 ? '#10b981' : pct >= 70 ? '#3b82f6' : '#f59e0b') : '#e2e8f0',
                              transition: 'width 0.4s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: pct !== null ? (pct >= 100 ? '#15803d' : pct >= 70 ? '#1d4ed8' : '#92400e') : '#94a3b8', whiteSpace: 'nowrap' }}>
                            {pct !== null ? `${pct}%` : 'S/M'}
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                          {t.perspectiva} · {t.periodo} · Meta: {t.meta_exibida}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {/* ── RIGHT: PDI HISTORY ───────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Plano de Desenvolvimento Individual (PDI)</h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                    Histórico de planos de {selectedCollaborator}
                    {collaboratorPdis.length > 0 && ` · ${collaboratorPdis.length} plano${collaboratorPdis.length > 1 ? 's' : ''}`}
                  </p>
                </div>
                {isSuperOrAdmin && (
                  <button
                    onClick={() => handleEditPdi()}
                    className="btn btn-primary small"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                  >
                    <Plus size={14} /> Novo PDI
                  </button>
                )}
              </div>

              {/* PDI list / empty state */}
              {collaboratorPdis.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', border: '1px dashed #e2e8f0', backgroundColor: '#fafbfc' }}>
                  <Target size={28} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 600, color: '#475569' }}>Nenhum PDI estruturado</h4>
                  <p style={{ margin: '0 auto', fontSize: 11, color: '#64748b', maxWidth: 360, lineHeight: '1.5em' }}>
                    {isSuperOrAdmin
                      ? 'Mapeie competências de foco e objetivos de desenvolvimento para apoiar este colaborador taticamente. Use o contexto do painel ao lado como referência.'
                      : 'Seu PDI corporativo ainda não foi estruturado. Solicite uma agenda com seu gestor nos rituais de One-on-One.'}
                  </p>
                  {isSuperOrAdmin && currentEvaluation && (
                    <button
                      onClick={handleStructurePdiFromEvaluation}
                      className="btn btn-primary small"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16 }}
                    >
                      <Sparkles size={13} /> Estruturar PDI do Perfil Vértice
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {collaboratorPdis.map((pdi, idx) => {
                    const isExpanded = expandedPdis.has(pdi.id) || idx === 0
                    const isActive = pdi.status === 'Ativo'
                    const statusColor = isActive ? 'var(--color-primary)' : pdi.status === 'Concluído' ? '#10b981' : '#94a3b8'
                    const statusBg = isActive ? '#eff6ff' : pdi.status === 'Concluído' ? '#dcfce7' : '#f1f5f9'
                    const statusText = isActive ? '#1d4ed8' : pdi.status === 'Concluído' ? '#15803d' : '#475569'

                    return (
                      <div
                        key={pdi.id}
                        className="card"
                        style={{ overflow: 'hidden', borderTop: `3px solid ${statusColor}` }}
                      >
                        {/* Collapsible header */}
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? 'transparent' : '#fafbfc'
                          }}
                          onClick={() => setExpandedPdis(prev => {
                            const next = new Set(prev)
                            if (next.has(pdi.id)) next.delete(pdi.id)
                            else next.add(pdi.id)
                            return next
                          })}
                        >
                          <span style={{
                            backgroundColor: statusBg, color: statusText,
                            padding: '2px 9px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                            textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '0.04em'
                          }}>
                            {pdi.status}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pdi.objetivo_carreira || `Plano ${pdi.trimestre}`}
                            </p>
                            <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>
                              {pdi.trimestre} · Atualizado: {new Date(pdi.updated_at || '').toLocaleDateString('pt-BR')}
                              {pdi.competencias_foco.length > 0 && ` · ${pdi.competencias_foco.length} competência${pdi.competencias_foco.length > 1 ? 's' : ''}`}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            {isSuperOrAdmin && (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); handleEditPdi(pdi) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px 5px', borderRadius: 6 }}
                                  title="Editar PDI"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); if (confirm('Excluir este PDI permanentemente?')) onDeletePDI(pdi.id) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 5px', borderRadius: 6 }}
                                  title="Excluir PDI"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                            <ChevronRight
                              size={14}
                              style={{
                                color: '#94a3b8',
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.15s ease'
                              }}
                            />
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div style={{ padding: '0 18px 20px 18px', borderTop: '1px solid #f1f5f9' }}>

                            {/* Career goal */}
                            <div style={{ marginTop: 16, marginBottom: 16 }}>
                              <h5 style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                Objetivo de Carreira / Meta Principal
                              </h5>
                              <p style={{ margin: 0, fontSize: 13, color: '#1e293b', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, fontWeight: 500, borderLeft: '3px solid var(--color-primary)', lineHeight: '1.5em' }}>
                                "{pdi.objetivo_carreira}"
                              </p>
                            </div>

                            {/* Competencies with optional Vértice score */}
                            {pdi.competencias_foco.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <h5 style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                  Competências Vértice em Foco
                                </h5>
                                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                                  {pdi.competencias_foco.map(slug => {
                                    const comp = COMPETENCIES.find(c => c.slug === slug)
                                    const evalScore = currentEvaluation
                                      ? (currentEvaluation.competency_scores as Record<string, number>)[slug]
                                      : undefined
                                    return (
                                      <span key={slug} style={{
                                        backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
                                        padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#334155',
                                        display: 'inline-flex', alignItems: 'center', gap: 5
                                      }}>
                                        <Star size={10} style={{ color: 'var(--color-primary)' }} />
                                        {comp?.name ?? slug}
                                        {evalScore !== undefined && (
                                          <span style={{
                                            fontSize: 9, fontWeight: 700, marginLeft: 2,
                                            color: evalScore >= 80 ? '#15803d' : evalScore >= 60 ? '#1d4ed8' : '#92400e'
                                          }}>
                                            {evalScore}
                                          </span>
                                        )}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Action plan */}
                            <div>
                              <h5 style={{ margin: '0 0 6px 0', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                                Plano de Ações Pactuadas
                              </h5>
                              <p style={{ margin: 0, fontSize: 12, color: '#334155', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', lineHeight: '1.5em' }}>
                                {pdi.plano_acao}
                              </p>
                            </div>

                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* 1. Novo Feedback One-on-One Modal */}
      {isFeedbackModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}
          onClick={e => { if (e.target === e.currentTarget) setIsFeedbackModalOpen(false) }}
        >
          <div className="card modal-content" style={{
            width: '100%', maxWidth: 760, maxHeight: '92vh',
            overflowY: 'auto', padding: 0, boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            borderRadius: 12
          }}>

            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '20px 24px', borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: 'rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(99,102,241,0.4)'
                }}>
                  <Users size={18} style={{ color: '#a5b4fc' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                    Registrar Reunião de One-on-One
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                    Ata de desenvolvimento · {selectedCollaborator}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFeedbackModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
                  color: '#94a3b8', cursor: 'pointer', padding: '6px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s'
                }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFeedback} style={{ padding: '24px' }}>

              {/* Section 1 — Contexto */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Contexto da Reunião
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="responsive-grid">
                  <div className="control-group" style={{ margin: 0 }}>
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
                  <div className="control-group" style={{ margin: 0 }}>
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
              </div>

              {/* Section 2 — Status da Carteira (auto-capture) */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Zap size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Status da Carteira
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                  <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap' }}>captura automática</span>
                </div>
                <div style={{
                  backgroundColor: '#fffbeb', border: '1px solid #fde68a',
                  padding: 14, borderRadius: 8, fontSize: 12
                }}>
                  <div style={{ fontSize: 11, color: '#92400e', marginBottom: 8, lineHeight: '1.4em' }}>
                    Sumário da carteira de projetos de <strong>{selectedCollaborator}</strong> gerado pelo sistema. Editável antes de salvar.
                  </div>
                  <textarea
                    rows={5}
                    className="textarea"
                    value={feedbackForm.general_notes}
                    onChange={e => setFeedbackForm({ ...feedbackForm, general_notes: e.target.value })}
                    placeholder="Status da carteira..."
                    style={{ fontFamily: 'monospace', fontSize: 11, backgroundColor: '#fff' }}
                  />
                </div>
              </div>

              {/* Section 3 — Análise de Desempenho */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Análise de Desempenho
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="control-group" style={{ margin: 0 }}>
                    <span className="control-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={11} style={{ color: '#10b981' }} /> Pontos Fortes Mapeados
                    </span>
                    <textarea
                      rows={3}
                      className="textarea"
                      placeholder="Quais comportamentos, entregas ou atitudes de destaque o colaborador apresentou neste período?"
                      value={feedbackForm.strengths}
                      onChange={e => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                      required
                    />
                  </div>
                  <div className="control-group" style={{ margin: 0 }}>
                    <span className="control-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle size={11} style={{ color: '#f59e0b' }} /> Oportunidades de Melhoria
                    </span>
                    <textarea
                      rows={3}
                      className="textarea"
                      placeholder="Onde o colaborador ficou abaixo do esperado? Quais atitudes ou entregas precisam mudar?"
                      value={feedbackForm.improvements}
                      onChange={e => setFeedbackForm({ ...feedbackForm, improvements: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 4 — Pactuações */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Pactuações
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div className="control-group" style={{ margin: 0 }}>
                  <span className="control-label">Plano de Ações Acordadas</span>
                  <textarea
                    rows={3}
                    className="textarea"
                    placeholder="Quais as tarefas de foco e prazos pactuados com o colaborador para o próximo período?"
                    value={feedbackForm.action_plan}
                    onChange={e => setFeedbackForm({ ...feedbackForm, action_plan: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                borderTop: '1px solid #f1f5f9', paddingTop: 18, marginTop: 20
              }}>
                <button type="button" onClick={() => setIsFeedbackModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> Salvar Ata 1:1
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 2. Create/Edit PDI Modal */}
      {isPdiModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}
          onClick={e => { if (e.target === e.currentTarget) setIsPdiModalOpen(false) }}
        >
          <div className="card modal-content" style={{
            width: '100%', maxWidth: 660, maxHeight: '92vh',
            overflowY: 'auto', padding: 0, boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            borderRadius: 12
          }}>

            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%)',
              padding: '20px 24px', borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  <Target size={18} style={{ color: '#fff' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {editingPdiId ? 'Editar PDI Corporativo' : 'Estruturar Novo PDI'}
                  </h3>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                    Plano de Desenvolvimento Individual · {selectedCollaborator}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPdiModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
                  color: '#fff', cursor: 'pointer', padding: '6px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePdiSubmit} style={{ padding: '24px' }}>

              {/* Section 1 — Período e Status */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Período e Status
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="responsive-grid">
                  <div className="control-group" style={{ margin: 0 }}>
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
                  <div className="control-group" style={{ margin: 0 }}>
                    <span className="control-label">Status do PDI</span>
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
              </div>

              {/* Section 2 — Objetivo de Carreira */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Objetivo de Carreira
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div className="control-group" style={{ margin: 0 }}>
                  <span className="control-label">Meta Principal de Evolução Profissional</span>
                  <textarea
                    rows={2}
                    className="textarea"
                    placeholder="Qual o objetivo de evolução profissional deste colaborador? (ex: Assumir liderança da frente Vivo)"
                    value={pdiForm.objetivo_carreira}
                    onChange={e => setPdiForm({ ...pdiForm, objetivo_carreira: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Section 3 — Competências Vértice */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Star size={14} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Competências Vértice em Foco
                  </span>
                  {pdiForm.competencias_foco.length > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--color-primary)', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 8px', borderRadius: 999 }}>
                      {pdiForm.competencias_foco.length} selecionada{pdiForm.competencias_foco.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 14px' }}>
                  Toque para selecionar as competências prioritárias deste trimestre — agrupadas pelos 5 domínios.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {DOMAINS.map(domain => {
                    const comps = COMPETENCIES.filter(c => c.domain === domain.slug)
                    const color = DOMAIN_COLOR[domain.slug] ?? '#2563eb'
                    return (
                      <div key={domain.slug}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: 'none' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>{domain.name}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="responsive-grid">
                          {comps.map(comp => {
                            const selected = pdiForm.competencias_foco.includes(comp.slug)
                            return (
                              <button
                                key={comp.slug}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setPdiForm(prev => {
                                  const has = prev.competencias_foco.includes(comp.slug)
                                  return { ...prev, competencias_foco: has ? prev.competencias_foco.filter(s => s !== comp.slug) : [...prev.competencias_foco, comp.slug] }
                                })}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', width: '100%',
                                  padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                                  border: `1.5px solid ${selected ? color : '#e2e8f0'}`,
                                  background: selected ? `${color}14` : '#fff',
                                  transition: 'border-color 0.12s, background 0.12s'
                                }}
                              >
                                <span style={{
                                  width: 18, height: 18, borderRadius: 5, flex: 'none',
                                  border: `1.5px solid ${selected ? color : '#cbd5e1'}`,
                                  background: selected ? color : '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: 1
                                }}>
                                  {selected ? '✓' : ''}
                                </span>
                                <span style={{ fontSize: 12.5, fontWeight: selected ? 600 : 500, color: selected ? '#0f172a' : '#334155', lineHeight: 1.25 }}>
                                  {comp.name}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 4 — Plano de Ações */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <CheckCircle2 size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Plano de Ações
                  </span>
                  <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                </div>
                <div className="control-group" style={{ margin: 0 }}>
                  <span className="control-label">Ações Pactuadas, Cursos e Mentorias</span>
                  <textarea
                    rows={4}
                    className="textarea"
                    placeholder="Quais as tarefas de foco, cursos, mentorias ou metas específicas acordadas para o desenvolvimento das competências selecionadas?"
                    value={pdiForm.plano_acao}
                    onChange={e => setPdiForm({ ...pdiForm, plano_acao: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 10,
                borderTop: '1px solid #f1f5f9', paddingTop: 18, marginTop: 20
              }}>
                <button type="button" onClick={() => setIsPdiModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={14} /> Salvar PDI
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  DOMAINS,
  COMPETENCIES,
  OPEN_QUESTIONS
} from '@/lib/assessment/perfilCientificoQuestions'

// Mapas slug→nome legível, derivados da fonte única da verdade (o modelo do
// instrumento). Evita hardcode de nomes — que era a origem da divergência de
// domínios no prompt anterior.
const DOMAIN_NAME: Record<string, string> = Object.fromEntries(DOMAINS.map((d) => [d.slug, d.name]))
const COMP_NAME: Record<string, string> = Object.fromEntries(COMPETENCIES.map((c) => [c.slug, c.name]))
const OPEN_PROMPT: Record<string, string> = Object.fromEntries(OPEN_QUESTIONS.map((o) => [o.code, o.prompt]))
const DOMAIN_LIST = DOMAINS.map((d) => d.name).join(', ')

// Rate limit por usuário (in-memory por instância). Como o laudo usa a chave
// paga de IA, a janela é mais apertada que a de outros endpoints.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 8
const RATE_LIMIT_WINDOW_MS = 60_000
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

const BodySchema = z.object({
  collaborator_name: z.string().min(1).max(120),
  domain_scores: z.record(z.string(), z.number()),
  competency_scores: z.record(z.string(), z.number()),
  open_answers: z.record(z.string(), z.string()).optional(),
  consistency_index: z.number().min(0).max(100),
  consistency_label: z.string()
})

function buildPrompt(body: z.infer<typeof BodySchema>): string {
  const domName = (slug: string) => DOMAIN_NAME[slug] ?? slug
  const compName = (slug: string) => COMP_NAME[slug] ?? slug

  const domains = Object.entries(body.domain_scores)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `• ${domName(k)}: ${Math.round(v)}/100`)
    .join('\n')

  const topComps = Object.entries(body.competency_scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `• ${compName(k)}: ${Math.round(v)}/100`)
    .join('\n')

  const bottomComps = Object.entries(body.competency_scores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k, v]) => `• ${compName(k)}: ${Math.round(v)}/100`)
    .join('\n')

  const openSection =
    body.open_answers && Object.keys(body.open_answers).length > 0
      ? `\nRespostas dissertativas do colaborador (use-as para personalizar o laudo — conecte cada uma aos números e cite trechos quando fizer sentido):\n${Object.entries(body.open_answers)
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => `— ${OPEN_PROMPT[k] ?? k}\n  "${v.trim()}"`)
          .join('\n')}`
      : ''

  const consistencyNote =
    body.consistency_index >= 80
      ? 'respostas coerentes entre situações distintas — alta confiabilidade da leitura'
      : body.consistency_index >= 60
        ? 'consistência moderada — interprete os padrões com atenção'
        : 'consistência baixa — leia o laudo com cautela e valide com observação direta'

  return `Você é um especialista em desenvolvimento humano do Protocolo Vértice — um instrumento de avaliação de competências profissionais baseado em ${DOMAINS.length} domínios: ${DOMAIN_LIST}. A avaliação usa 108 itens situacionais (diante de um cenário real, a pessoa escolhe a alternativa mais próxima de como age) e 5 perguntas abertas. Os escores vão de 0 a 100.

Gere um LAUDO interpretativo personalizado em português brasileiro. Seja específico, profissional e honesto — nunca genérico. O valor do laudo está em CRUZAR os números com as respostas dissertativas: explique o que a pessoa relatou à luz do que foi medido.

Colaborador: ${body.collaborator_name}
Índice de consistência: ${body.consistency_index}% (${body.consistency_label}) — ${consistencyNote}.

Pontuação por domínio:
${domains}

Competências de maior força (Top 5):
${topComps}

Competências em desenvolvimento (3 menores):
${bottomComps}
${openSection}

Estruture o laudo EXATAMENTE com estes blocos (markdown, títulos com ###):

### Síntese Executiva do Perfil
(2 parágrafos: quem é este profissional, seu estilo de atuação, o que os dados revelam — e o que o índice de consistência diz sobre a confiabilidade da leitura)

### Fortalezas Principais e Manifestação Operacional
(Como as competências de topo aparecem no dia a dia — concreto e contextualizado ao trabalho descrito pela pessoa)

### Oportunidades de Desenvolvimento com Ações Práticas
(Para CADA uma das 3 competências em desenvolvimento: 1 insight + 1 ação concreta e mensurável)

### Trilha de PDI Recomendada
(3 prioridades para o próximo trimestre, com justificativa ancorada nos dados e nas respostas abertas)

### Mensagem de Fortalecimento Profissional
(1 parágrafo motivacional e personalizado — quando possível, responda diretamente ao que o colaborador escreveu nas perguntas abertas)

Limite: 600-850 palavras. Tom: profissional, direto, orientado a resultado. Não invente competências fora da lista. Sem elogios vazios.`
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(30000)
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`)
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content ?? ''
}

async function callOllama(prompt: string, baseUrl: string, model: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 1200 }
    }),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = (await res.json()) as { response?: string }
  return data.response ?? ''
}

export async function POST(req: NextRequest) {
  // Auth obrigatória: o laudo consome a chave paga de IA. Sem isto, o endpoint
  // público poderia ser abusado para queimar créditos. (proxy.ts exclui /api,
  // então a verificação tem de viver aqui.)
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch { /* read-only em alguns contextos */ }
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Limite de gerações de laudo por IA excedido. Aguarde 1 minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', details: parsed.error.issues }, { status: 400 })
  }

  const prompt = buildPrompt(parsed.data)

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const analysis = await callOpenAI(prompt, openaiKey)
      return NextResponse.json({ analysis, provider: 'openai' })
    } catch (err) {
      console.error('OpenAI call failed, trying Ollama fallback:', err)
    }
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'deepseek-coder-v2:16b'
  if (ollamaBase) {
    try {
      const analysis = await callOllama(prompt, ollamaBase, ollamaModel)
      return NextResponse.json({ analysis, provider: 'ollama' })
    } catch (err) {
      console.error('Ollama call failed:', err)
      return NextResponse.json({ error: 'Falha ao gerar análise com IA local' }, { status: 503 })
    }
  }

  return NextResponse.json(
    { error: 'Nenhum provedor de IA configurado (OPENAI_API_KEY ou OLLAMA_BASE_URL)' },
    { status: 503 }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Rate limit por usuário (in-memory por instância). O resumo de ata consome a
// chave paga de IA, então a janela é apertada — o cache no cliente garante que
// recargas repetidas não cheguem aqui.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
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

const OneOnOneSchema = z.object({
  date: z.string().max(40).optional(),
  type: z.string().max(80).optional(),
  trimestre: z.string().max(20).optional(),
  strengths: z.string().max(2000).optional(),
  improvements: z.string().max(2000).optional(),
  action_plan: z.string().max(2000).optional()
})

const BodySchema = z.object({
  collaborator_name: z.string().min(1).max(120),
  status_summary: z.string().max(4000),
  okr_adherence: z
    .object({
      total: z.number(),
      avg_attainment: z.number(),
      on_track: z.number(),
      at_risk: z.number()
    })
    .optional(),
  recent_oneonones: z.array(OneOnOneSchema).max(20)
})

function buildPrompt(body: z.infer<typeof BodySchema>): string {
  const okrLine = body.okr_adherence
    ? `${body.okr_adherence.total} OKRs vinculados · aderência média ${Math.round(body.okr_adherence.avg_attainment)}% · ${body.okr_adherence.on_track} no rumo / ${body.okr_adherence.at_risk} em risco`
    : 'Sem OKRs vinculados ao colaborador no período.'

  const history =
    body.recent_oneonones.length > 0
      ? body.recent_oneonones
          .map((f, idx) => {
            const head = `${idx + 1}. ${f.date || 'sem data'} — ${f.type || '1:1'}${f.trimestre ? ` (${f.trimestre})` : ''}`
            const parts: string[] = []
            if (f.strengths?.trim()) parts.push(`   Pontos fortes: ${f.strengths.trim()}`)
            if (f.improvements?.trim()) parts.push(`   Pontos a evoluir: ${f.improvements.trim()}`)
            if (f.action_plan?.trim()) parts.push(`   Plano de ação pactuado: ${f.action_plan.trim()}`)
            return parts.length > 0 ? `${head}\n${parts.join('\n')}` : head
          })
          .join('\n\n')
      : 'Nenhuma reunião 1:1 registrada ainda — baseie o panorama apenas no status operacional.'

  return `Você é um especialista em gestão de pessoas e desenvolvimento de times de alta performance. Sintetize, de forma inteligente e acionável, o panorama de um colaborador a partir do histórico de reuniões 1:1 (One-on-Ones), do status operacional atual da carteira e da aderência aos OKRs. O resumo será lido pelo gestor antes da próxima conversa e desdobrado para acompanhamento.

Colaborador: ${body.collaborator_name}

Status operacional atual (captura automática da carteira):
${body.status_summary}

Aderência a OKRs: ${okrLine}

Histórico de One-on-Ones (mais recente primeiro):
${history}

Gere um RESUMO INTELIGENTE em português brasileiro, em markdown, com EXATAMENTE estes blocos (títulos com ###):

### Panorama do Colaborador
(2 a 4 frases: momento atual, evolução percebida ao longo dos 1:1s e o que o status operacional reforça)

### Temas Recorrentes
(padrões que se repetem nas atas — forças já consolidadas e pontos de evolução que voltam a aparecer)

### Compromissos em Aberto
(planos de ação dos 1:1s que ainda parecem pendentes ou exigem acompanhamento; conecte aos atrasos/bloqueios do status operacional quando fizer sentido)

### Foco Sugerido para o Próximo 1:1
(2 a 3 pontos objetivos e específicos para pautar a próxima conversa)

Limite: 250-400 palavras. Seja específico, direto e honesto. Baseie-se SOMENTE nos dados fornecidos — não invente fatos, números ou compromissos. Sem elogios vazios.`
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
      max_tokens: 700,
      temperature: 0.6
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
      options: { temperature: 0.6, num_predict: 700 }
    }),
    signal: AbortSignal.timeout(120000)
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const data = (await res.json()) as { response?: string }
  return data.response ?? ''
}

export async function POST(req: NextRequest) {
  // Auth obrigatória: o resumo consome a chave paga de IA. (proxy.ts exclui
  // /api, então a verificação tem de viver aqui.)
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
      { error: 'Limite de resumos por IA excedido. Aguarde 1 minuto.' },
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
      const summary = await callOpenAI(prompt, openaiKey)
      return NextResponse.json({ summary, provider: 'openai' })
    } catch (err) {
      console.error('OpenAI call failed, trying Ollama fallback:', err)
    }
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'deepseek-coder-v2:16b'
  if (ollamaBase) {
    try {
      const summary = await callOllama(prompt, ollamaBase, ollamaModel)
      return NextResponse.json({ summary, provider: 'ollama' })
    } catch (err) {
      console.error('Ollama call failed:', err)
      return NextResponse.json({ error: 'Falha ao gerar resumo com IA local' }, { status: 503 })
    }
  }

  return NextResponse.json(
    { error: 'Nenhum provedor de IA configurado (OPENAI_API_KEY ou OLLAMA_BASE_URL)' },
    { status: 503 }
  )
}

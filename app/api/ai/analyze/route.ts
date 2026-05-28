import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const BodySchema = z.object({
  collaborator_name: z.string().min(1).max(120),
  domain_scores: z.record(z.string(), z.number()),
  competency_scores: z.record(z.string(), z.number()),
  open_answers: z.record(z.string(), z.string()).optional(),
  consistency_index: z.number().min(0).max(100),
  consistency_label: z.string()
})

function buildPrompt(body: z.infer<typeof BodySchema>): string {
  const topDomains = Object.entries(body.domain_scores)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `• ${k}: ${v}/100`)
    .join('\n')

  const topComps = Object.entries(body.competency_scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `• ${k}: ${v}/100`)
    .join('\n')

  const bottomComps = Object.entries(body.competency_scores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k, v]) => `• ${k}: ${v}/100`)
    .join('\n')

  const openSection =
    body.open_answers && Object.keys(body.open_answers).length > 0
      ? `\nRespostas Discursivas do Colaborador:\n${Object.entries(body.open_answers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')}`
      : ''

  return `Você é um especialista em desenvolvimento humano e científico do Protocolo Vértice — um framework de avaliação de competências executivas baseado em 5 domínios: Liderança, Execução, Relacionamento, Inovação e Gestão.

Analise o perfil científico abaixo e gere uma análise executiva personalizada em português brasileiro. Seja específico, profissional e encorajador.

Colaborador: ${body.collaborator_name}
Índice de Consistência: ${body.consistency_index}% (${body.consistency_label})

Pontuação por Domínio:
${topDomains}

Competências Fortaleza (Top 5):
${topComps}

Oportunidades de Desenvolvimento (Bottom 3):
${bottomComps}
${openSection}

Gere uma análise com os seguintes blocos (use markdown leve com títulos ###):

### Síntese Executiva do Perfil
(2 parágrafos: quem é este profissional, seu estilo de atuação, e o que os dados revelam)

### Fortalezas Principais e Manifestação Operacional
(Como as competências de topo se manifestam no dia a dia — seja específico e contextualizado ao ambiente corporativo)

### Oportunidades de Desenvolvimento com Ações Práticas
(Para cada competência em desenvolvimento: 1 insight + 1 ação concreta e mensurável)

### Trilha de PDI Recomendada
(3 prioridades de desenvolvimento para o próximo trimestre com justificativa baseada nos dados)

### Mensagem de Fortalecimento Profissional
(1 parágrafo motivacional e personalizado baseado no perfil específico deste colaborador)

Limite: 600-800 palavras. Tom: profissional, direto, orientado a resultado.`
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

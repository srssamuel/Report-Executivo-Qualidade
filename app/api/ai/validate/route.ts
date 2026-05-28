import { NextResponse } from 'next/server'

export async function GET() {
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    return NextResponse.json({ available: true, provider: 'openai', model: 'gpt-4o-mini' })
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL
  if (ollamaBase) {
    try {
      const res = await fetch(`${ollamaBase}/api/tags`, {
        signal: AbortSignal.timeout(4000)
      })
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string }> }
        const models = data.models ?? []
        const preferredModel = process.env.OLLAMA_MODEL ?? ''
        const match =
          models.find(m => m.name === preferredModel) ??
          models.find(m => m.name.includes('deepseek-coder')) ??
          models.find(m => m.name.includes('samuai')) ??
          models[0]
        if (match) {
          return NextResponse.json({ available: true, provider: 'ollama', model: match.name })
        }
      }
    } catch {
      // Ollama not reachable
    }
  }

  return NextResponse.json({ available: false, provider: null, model: null })
}

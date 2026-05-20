import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const start = Date.now()

  let supabaseStatus: string
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await supabase.from('products').select('id').limit(1)
    supabaseStatus = error ? `error: ${error.message}` : 'connected'
  } catch (err) {
    supabaseStatus = `error: ${err instanceof Error ? err.message : 'unknown'}`
  }

  const latencyMs = Date.now() - start

  return NextResponse.json({
    status: supabaseStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    supabase: supabaseStatus,
    latencyMs,
    environment: process.env.NODE_ENV,
  })
}

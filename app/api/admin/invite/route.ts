import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ── Input validation schemas ────────────────────────────────────────────────

const InviteEntrySchema = z.object({
  email: z.string().email('E-mail inválido').transform(v => v.trim().toLowerCase()),
  role: z.enum(['admin', 'superintendente', 'gerente', 'coordenador', 'consultor', 'lider', 'analista', 'viewer'], {
    error: 'Papel inválido',
  }),
  name: z.string().max(200).optional(),
})

const InviteBodySchema = z.union([
  z.object({ invites: z.array(InviteEntrySchema).min(1).max(50) }),
  InviteEntrySchema.transform(entry => ({ invites: [entry] })),
])

// ── Rate limiting (in-memory per instance) ──────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
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

// Prevent map from growing unbounded
function pruneRateLimitMap() {
  if (rateLimitMap.size > 500) {
    const now = Date.now()
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

interface InviteResult { email: string; ok: boolean; note?: string; error?: string }

export async function POST(request: NextRequest) {
  pruneRateLimitMap()

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
          } catch { /* read-only in some contexts */ }
        },
      },
    }
  )

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Role check
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Rate limit excedido. Aguarde 1 minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  // Validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const parsed = InviteBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { invites } = parsed.data

  // Service role client
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 })
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const results: InviteResult[] = []

  for (const inv of invites) {
    // 1. Upsert invitation record
    await supabase.from('invitations').upsert(
      { email: inv.email, role: inv.role },
      { onConflict: 'email' }
    )

    // 2. Send invite via Supabase Auth
    const { error } = await adminClient.auth.admin.inviteUserByEmail(inv.email, {
      data: { role: inv.role, full_name: inv.name ?? '' },
      redirectTo: `${origin}/reset-password`,
    })

    if (error) {
      if (error.message.includes('already') || error.code === 'email_exists') {
        await supabase.from('user_profiles').update({ role: inv.role }).eq('email', inv.email)
        results.push({ email: inv.email, ok: true, note: 'Já cadastrado — papel atualizado.' })
      } else {
        results.push({ email: inv.email, ok: false, error: error.message })
      }
    } else {
      results.push({ email: inv.email, ok: true, note: 'Convite enviado.' })
    }
  }

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({ ok: true, sent, failed, results })
}

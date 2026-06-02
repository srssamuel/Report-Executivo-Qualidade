import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

// ── Input validation ─────────────────────────────────────────────────────────

const ResetBodySchema = z.object({
  userId: z.string().uuid('userId inválido'),
})

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

function pruneRateLimitMap() {
  if (rateLimitMap.size > 500) {
    const now = Date.now()
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
}

// ── Temporary password generation ────────────────────────────────────────────
// Alphabet excludes ambiguous chars (0/O, 1/l/I) so the admin can dictate it safely.
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generateTempPassword(length = 14): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length]
  }
  // Guarantee complexity: at least one symbol so it survives any policy.
  return `${out}#7`
}

// ── Handler ─────────────────────────────────────────────────────────────────

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

  // Role check — only admin can reset other users' passwords
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

  const parsed = ResetBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { userId } = parsed.data

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

  // Confirm the target user exists and capture their e-mail for the response.
  const { data: target, error: targetError } = await adminClient
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .single()

  if (targetError || !target) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  const tempPassword = generateTempPassword()

  // 1. Set the temporary password via the Admin API.
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    password: tempPassword,
  })
  if (updateError) {
    return NextResponse.json({ error: `Falha ao redefinir senha: ${updateError.message}` }, { status: 500 })
  }

  // 2. Force the first-login flow on next sign-in (must change temp password).
  const { error: flagError } = await adminClient
    .from('user_profiles')
    .update({ password_changed: false })
    .eq('id', userId)
  if (flagError) {
    return NextResponse.json({ error: `Senha redefinida, mas falha ao marcar troca obrigatória: ${flagError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    email: target.email,
    fullName: target.full_name ?? '',
    tempPassword,
    note: 'Senha temporária gerada. O usuário deverá trocá-la no primeiro acesso.',
  })
}

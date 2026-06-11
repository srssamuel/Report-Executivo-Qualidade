import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

/**
 * Valida sessão + role admin e retorna o admin client (service role).
 * Retorna { error, status } em falha — nunca expõe o service key ao client.
 */
export async function requireAdmin(): Promise<
  | { ok: true; adminClient: SupabaseClient; callerId: string }
  | { ok: false; error: string; status: number }
> {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.', status: 401 }

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return { ok: false, error: 'Acesso negado.', status: 403 }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.', status: 500 }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  return { ok: true, adminClient, callerId: user.id }
}

// Alphabet excludes ambiguous chars (0/O, 1/l/I) so the admin can dictate it safely.
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 14): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length]
  }
  // Guarantee complexity: at least one symbol so it survives any policy.
  return `${out}#7`
}

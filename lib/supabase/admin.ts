import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export interface AdminContext {
  adminClient: SupabaseClient
  callerId: string
}

/** Valida sessão + role admin. Retorna admin client (service role) ou um erro http. */
export async function requireAdmin(): Promise<
  { ok: true; ctx: AdminContext } | { ok: false; status: number; error: string }
> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Não autenticado.' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') {
    return { ok: false, status: 403, error: 'Acesso negado.' }
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  return { ok: true, ctx: { adminClient, callerId: user.id } }
}

/** Senha temporária forte e legível (sem caracteres ambíguos). */
export function generateTempPassword(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

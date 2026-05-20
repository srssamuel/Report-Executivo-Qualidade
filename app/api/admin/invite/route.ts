import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'

interface InviteEntry { email: string; role: string; name?: string }
interface InviteResult { email: string; ok: boolean; note?: string; error?: string }

export async function POST(request: NextRequest) {
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
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await request.json()

  const invites: InviteEntry[] = body.invites
    ? body.invites
    : [{ email: body.email, role: body.role, name: body.name }]

  if (!invites.length) return NextResponse.json({ error: 'Nenhum convite.' }, { status: 400 })

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const results: InviteResult[] = []

  for (const inv of invites) {
    const email = inv.email?.trim().toLowerCase()
    if (!email) { results.push({ email: '', ok: false, error: 'E-mail vazio' }); continue }

    // 1. Upsert invitation record
    await supabase.from('invitations').upsert(
      { email, role: inv.role },
      { onConflict: 'email' }
    )

    // 2. Send invite via Supabase Auth
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: inv.role, full_name: inv.name ?? '' },
      redirectTo: `${origin}/reset-password`,
    })

    if (error) {
      if (error.message.includes('already') || error.code === 'email_exists') {
        // User already in auth — update their role in invitations and profile
        await supabase.from('user_profiles').update({ role: inv.role }).eq('email', email)
        results.push({ email, ok: true, note: 'Já cadastrado — papel atualizado.' })
      } else {
        results.push({ email, ok: false, error: error.message })
      }
    } else {
      results.push({ email, ok: true, note: 'Convite enviado.' })
    }
  }

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({ ok: true, sent, failed, results })
}

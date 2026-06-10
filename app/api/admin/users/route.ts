import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, generateTempPassword } from '@/lib/supabase/admin'
import { VALID_ROLES } from '@/lib/domain'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { adminClient } = auth.ctx

  const body = (await request.json()) as {
    email?: unknown
    fullName?: unknown
    role?: unknown
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.fullName ?? '').trim()
  const role = String(body.role ?? 'viewer')

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
  }
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 })
  }

  const tempPassword = generateTempPassword()

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error) {
    const status =
      error.message.includes('already') || error.code === 'email_exists' ? 409 : 500
    return NextResponse.json(
      {
        error:
          status === 409
            ? 'Já existe usuário com este e-mail.'
            : error.message,
      },
      { status }
    )
  }

  // O trigger handle_new_user já criou o profile (role viewer).
  // Sobrescreve com os dados corretos enviados pelo admin.
  const { error: profileError } = await adminClient
    .from('user_profiles')
    .upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role,
      must_change_password: true,
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: data.user.id, tempPassword })
}

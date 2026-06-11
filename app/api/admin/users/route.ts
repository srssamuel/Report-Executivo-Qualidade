import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, generateTempPassword } from '@/lib/supabase/admin'
import { ROLE_LABELS } from '@/shared/domain'

const VALID_ROLES = Object.keys(ROLE_LABELS)

const CreateBodySchema = z.object({
  email: z.string().email('E-mail inválido'),
  fullName: z.string().trim().min(2, 'Informe o nome'),
  role: z.string().refine(r => VALID_ROLES.includes(r), 'Papel inválido'),
})

/** Cria usuário direto (sem e-mail de convite): senha temporária exibida UMA vez. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const parsed = CreateBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 422 })
  }

  const { email, fullName, role } = parsed.data
  const tempPassword = generateTempPassword()

  const { data: created, error: createError } = await auth.adminClient.auth.admin.createUser({
    email: email.toLowerCase(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError || !created.user) {
    return NextResponse.json({ error: `Falha ao criar usuário: ${createError?.message ?? 'sem retorno'}` }, { status: 500 })
  }

  // Perfil: nome + papel + troca obrigatória no primeiro login (fluxo first-login existente).
  const { error: profileError } = await auth.adminClient
    .from('user_profiles')
    .upsert({ id: created.user.id, email: email.toLowerCase(), full_name: fullName, role, password_changed: false })
  if (profileError) {
    return NextResponse.json({ error: `Usuário criado, mas falha no perfil: ${profileError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    userId: created.user.id,
    email: email.toLowerCase(),
    fullName,
    role,
    tempPassword,
    note: 'Senha temporária gerada — não será exibida novamente. O usuário troca no primeiro acesso.',
  })
}

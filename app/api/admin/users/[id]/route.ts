import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/supabase/admin'
import { ROLE_LABELS } from '@/shared/domain'

const VALID_ROLES = Object.keys(ROLE_LABELS)

const PatchBodySchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  role: z.string().refine(r => VALID_ROLES.includes(r), 'Papel inválido').optional(),
}).refine(b => b.fullName !== undefined || b.email !== undefined || b.role !== undefined, 'Nada para atualizar')

/** Edita nome/e-mail/papel. Guard: admin não rebaixa o próprio papel. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }
  const parsed = PatchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.', details: parsed.error.flatten() }, { status: 422 })
  }
  const { fullName, email, role } = parsed.data

  if (id === auth.callerId && role !== undefined && role !== 'admin') {
    return NextResponse.json({ error: 'Você não pode rebaixar o próprio papel — outro admin precisa fazer isso.' }, { status: 400 })
  }

  if (email !== undefined) {
    const { error } = await auth.adminClient.auth.admin.updateUserById(id, { email: email.toLowerCase(), email_confirm: true })
    if (error) return NextResponse.json({ error: `Falha ao atualizar e-mail: ${error.message}` }, { status: 500 })
  }

  const profilePatch: Record<string, unknown> = {}
  if (fullName !== undefined) profilePatch.full_name = fullName
  if (email !== undefined) profilePatch.email = email.toLowerCase()
  if (role !== undefined) profilePatch.role = role
  const { error: profileError } = await auth.adminClient.from('user_profiles').update(profilePatch).eq('id', id)
  if (profileError) {
    return NextResponse.json({ error: `Falha ao atualizar perfil: ${profileError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** Exclui o usuário de verdade (auth + perfil via cascade). Guard: admin não exclui a si. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (id === auth.callerId) {
    return NextResponse.json({ error: 'Você não pode excluir a própria conta.' }, { status: 400 })
  }

  const { error } = await auth.adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: `Falha ao excluir: ${error.message}` }, { status: 500 })

  return NextResponse.json({ ok: true })
}

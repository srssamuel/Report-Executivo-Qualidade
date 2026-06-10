import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/admin'

const VALID_ROLES = ['admin', 'superintendente', 'lider', 'analista', 'viewer'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { adminClient, callerId } = auth.ctx
  const { id } = await params

  const body = (await request.json()) as {
    fullName?: unknown
    email?: unknown
    role?: unknown
  }

  const updates: Record<string, string> = {}

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }
    const { error } = await adminClient.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    updates.email = email
  }

  if (body.fullName !== undefined) {
    updates.full_name = String(body.fullName).trim()
  }

  if (body.role !== undefined) {
    const role = String(body.role)
    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ error: 'Papel inválido.' }, { status: 400 })
    }
    if (id === callerId && role !== 'admin') {
      return NextResponse.json({ error: 'Você não pode rebaixar seu próprio acesso de administrador.' }, { status: 400 })
    }
    updates.role = role
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { adminClient, callerId } = auth.ctx
  const { id } = await params

  if (id === callerId) {
    return NextResponse.json(
      { error: 'Você não pode excluir a si próprio.' },
      { status: 400 }
    )
  }

  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // user_profiles cai via ON DELETE CASCADE (FK para auth.users)
  return NextResponse.json({ ok: true })
}

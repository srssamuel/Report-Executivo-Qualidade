import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, generateTempPassword } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { adminClient } = auth.ctx
  const { id } = await params

  const tempPassword = generateTempPassword()
  const { error } = await adminClient.auth.admin.updateUserById(id, {
    password: tempPassword,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { error: flagError } = await adminClient
    .from('user_profiles')
    .update({ must_change_password: true })
    .eq('id', id)
  if (flagError) return NextResponse.json({ error: flagError.message }, { status: 500 })

  return NextResponse.json({ ok: true, tempPassword })
}

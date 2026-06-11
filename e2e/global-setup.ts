import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Cria um usuário QA EFÊMERO via service role antes da suíte:
 * - e-mail único por execução (sem colisão entre runs paralelos)
 * - perfil promovido a admin (cobre todas as views + /admin/users)
 * - password_changed=true pula o fluxo de primeira senha
 * O teardown apaga o usuário — nenhuma credencial fixa em secret ou código.
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'E2E requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente ' +
      '(usadas só para criar/apagar o usuário QA efêmero).'
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `qa-e2e-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`
  const password = `${randomBytes(18).toString('base64url')}!aA1`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'QA Robot E2E' },
  })
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuário QA: ${error?.message ?? 'sem retorno'}`)
  }

  // O trigger handle_new_user cria o perfil como viewer; promove e pula first-login.
  const { error: profileError } = await admin
    .from('user_profiles')
    .update({ role: 'admin', password_changed: true })
    .eq('id', data.user.id)
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new Error(`Falha ao promover usuário QA: ${profileError.message}`)
  }

  writeFileSync(
    path.join(__dirname, '.qa-user.json'),
    JSON.stringify({ id: data.user.id, email, password })
  )
  console.log(`[e2e] usuário QA efêmero criado: ${email}`)
}

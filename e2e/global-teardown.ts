import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'

/**
 * Apaga o usuário QA efêmero. As FKs em cascata limpam o resto:
 * auth.users → user_profiles (ON DELETE CASCADE) → daily_access (ON DELETE CASCADE).
 */
export default async function globalTeardown(): Promise<void> {
  const statePath = path.join(__dirname, '.qa-user.json')
  if (!existsSync(statePath)) return

  const { id, email } = JSON.parse(readFileSync(statePath, 'utf8')) as { id: string; email: string }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceKey && id) {
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      console.error(`[e2e] ATENÇÃO: falha ao apagar usuário QA ${email}: ${error.message}`)
    } else {
      console.log(`[e2e] usuário QA efêmero apagado: ${email}`)
    }
  }
  rmSync(statePath, { force: true })
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { registerDailyActivity } from '@/shared/tracking'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Registro de acesso diário + snapshot lazy da carteira (nunca lança).
  await registerDailyActivity(supabase, user.id)
  return <>{children}</>
}

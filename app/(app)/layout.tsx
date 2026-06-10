import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { registerDailyActivity } from '@/lib/tracking'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  await registerDailyActivity(supabase, user.id)
  return <>{children}</>
}

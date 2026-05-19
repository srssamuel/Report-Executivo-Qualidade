import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminUsersClient from './client'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/')

  const [{ data: users }, { data: invitations }] = await Promise.all([
    supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('invitations').select('*').order('created_at', { ascending: false }),
  ])

  return <AdminUsersClient users={users ?? []} invitations={invitations ?? []} currentUserId={user.id} />
}

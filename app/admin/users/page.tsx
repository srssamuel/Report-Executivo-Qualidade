import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminUsersClient } from '@/features/admin'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/')

  const [{ data: users }, { data: invitations }, { data: products }, { data: auditLog }] = await Promise.all([
    supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*').order('name'),
    supabase.from('admin_audit_log').select('id, actor_email, action, target_email, created_at').order('created_at', { ascending: false }).limit(50),
  ])

  return (
    <AdminUsersClient
      users={users ?? []}
      invitations={invitations ?? []}
      products={products ?? []}
      currentUserId={user.id}
      auditLog={auditLog ?? []}
    />
  )
}

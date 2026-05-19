'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, ROLE_LABELS, Role } from '@/lib/domain'

interface Invitation { id: string; email: string; role: string; created_at: string; accepted_at: string | null }

export default function AdminUsersClient({ users, invitations, currentUserId }: {
  users: UserProfile[]; invitations: Invitation[]; currentUserId: string
}) {
  const supabase = createClient()
  const [userList, setUserList] = useState(users)
  const [inviteList, setInviteList] = useState(invitations)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('analista')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    // 1. Save invitation record
    const { error: invErr } = await supabase.from('invitations').upsert({ email, role })
    if (invErr) { setError(invErr.message); setLoading(false); return }

    // 2. Send Supabase magic link (user will set their password on first login)
    const { error: authErr } = await supabase.auth.admin
      ? // Admin API not available client-side; use password invite via server route instead
        { error: null }
      : { error: null }

    // Use resend magic link as the invite mechanism
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Erro ao enviar convite.'); setLoading(false); return }

    setSuccess(`Convite enviado para ${email}.`)
    setEmail(''); setLoading(false)
    const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false })
    if (data) setInviteList(data)
  }

  async function changeRole(userId: string, newRole: Role) {
    const { error } = await supabase.from('user_profiles').update({ role: newRole }).eq('id', userId)
    if (error) { alert(error.message); return }
    setUserList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revogar este convite?')) return
    await supabase.from('invitations').delete().eq('id', id)
    setInviteList(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="app">
      <header className="hero soft-shell" style={{ marginBottom: 20 }}>
        <div className="topline">
          <div className="brandmark">
            <div className="brand-meta">
              <span>QualiData — Admin</span>
              <strong>Gestão de usuários</strong>
              <small>Convide colaboradores e controle os papéis de acesso.</small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn" href="/">← Voltar ao painel</a>
          </div>
        </div>
      </header>

      {/* Invite form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3 className="card-title">Convidar novo usuário</h3></div>
        <div className="card-body">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="colaborador@empresa.com" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Papel</label>
              <select value={role} onChange={e => setRole(e.target.value as Role)}>
                <option value="superintendente">Superintendente</option>
                <option value="lider">Líder</option>
                <option value="analista">Analista</option>
                <option value="viewer">Visualizador</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Enviando…' : 'Enviar convite'}</button>
          </form>
          <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>
            O usuário receberá um e-mail com link para definir sua senha e acessar o painel.
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3 className="card-title">Usuários ativos</h3><span className="badge tone-blue">{userList.length}</span></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>E-mail</th><th>Nome</th><th>Papel</th><th>Desde</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {userList.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>{u.full_name || '—'}</td>
                    <td>
                      {u.id === currentUserId
                        ? <span className="badge tone-blue">{ROLE_LABELS[u.role as Role] ?? u.role}</span>
                        : (
                          <select value={u.role} onChange={e => changeRole(u.id, e.target.value as Role)} style={{ minWidth: 160 }}>
                            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td style={{ color: '#5f7188', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {u.id !== currentUserId && (
                        <button className="btn small danger" onClick={async () => {
                          if (!confirm(`Remover acesso de ${u.email}?`)) return
                          await supabase.from('user_profiles').update({ role: 'viewer' }).eq('id', u.id)
                          setUserList(prev => prev.map(x => x.id === u.id ? { ...x, role: 'viewer' } : x))
                        }}>Revogar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending invitations */}
      {inviteList.length > 0 && (
        <div className="card">
          <div className="card-head"><h3 className="card-title">Convites pendentes</h3><span className="badge tone-amber">{inviteList.filter(i => !i.accepted_at).length}</span></div>
          <div className="card-body">
            <div className="table-wrap">
              <table className="admin-table">
                <thead><tr><th>E-mail</th><th>Papel</th><th>Enviado em</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>
                  {inviteList.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.email}</td>
                      <td><span className="badge tone-gray">{ROLE_LABELS[inv.role as Role] ?? inv.role}</span></td>
                      <td style={{ color: '#5f7188', fontSize: 12 }}>{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>{inv.accepted_at ? <span className="badge tone-green">Aceito</span> : <span className="badge tone-amber">Pendente</span>}</td>
                      <td>
                        {!inv.accepted_at && <button className="btn small danger" onClick={() => revokeInvite(inv.id)}>Revogar</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

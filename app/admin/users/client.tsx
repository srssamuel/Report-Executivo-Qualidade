'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile, Role } from '@/lib/domain'
import { ROLE_LABELS } from '@/lib/domain'

interface Invitation { id: string; email: string; role: string; created_at: string; accepted_at: string | null }

interface TempCredential { email: string; password: string; kind: 'novo' | 'reset' }

export default function AdminUsersClient({ users, invitations, currentUserId }: {
  users: UserProfile[]; invitations: Invitation[]; currentUserId: string
}) {
  const supabase = createClient()
  const [userList, setUserList] = useState(users)
  const [inviteList, setInviteList] = useState(invitations)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('analista')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [credential, setCredential] = useState<TempCredential | null>(null)
  const [copied, setCopied] = useState(false)

  async function api(path: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setError(String(data.error ?? 'Erro inesperado.'))
    return { ok: res.ok, data }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    const { ok, data } = await api('/api/admin/users', 'POST', { email, fullName, role })
    setLoading(false)
    if (!ok) return
    setCredential({ email, password: String(data.tempPassword), kind: 'novo' })
    setUserList(prev => [{ id: String(data.userId), email, full_name: fullName, role, created_at: new Date().toISOString() }, ...prev])
    setEmail(''); setFullName('')
  }

  async function handleResetPassword(u: UserProfile) {
    if (!confirm(`Gerar nova senha temporária para ${u.email}? A senha atual deixará de funcionar.`)) return
    setError('')
    const { ok, data } = await api(`/api/admin/users/${u.id}/reset-password`, 'POST')
    if (ok) setCredential({ email: u.email, password: String(data.tempPassword), kind: 'reset' })
  }

  async function handleDelete(u: UserProfile) {
    const typed = prompt(`Excluir DEFINITIVAMENTE o usuário ${u.email}?\nDigite o e-mail para confirmar:`)
    if (typed !== u.email) return
    setError('')
    const { ok } = await api(`/api/admin/users/${u.id}`, 'DELETE')
    if (ok) { setUserList(prev => prev.filter(x => x.id !== u.id)); setSuccess(`Usuário ${u.email} excluído.`) }
  }

  async function handlePatch(u: UserProfile, patch: { fullName?: string; role?: Role }): Promise<boolean> {
    setError('')
    const { ok } = await api(`/api/admin/users/${u.id}`, 'PATCH', patch)
    if (ok) setUserList(prev => prev.map(x => x.id === u.id
      ? { ...x, full_name: patch.fullName ?? x.full_name, role: patch.role ?? x.role }
      : x))
    return ok
  }

  async function handleInvite() {
    setError(''); setSuccess('')
    if (!email) { setError('Preencha o e-mail acima para convidar.'); return }
    const { error: invErr } = await supabase.from('invitations').upsert({ email, role })
    if (invErr) { setError(invErr.message); return }
    const { ok } = await api('/api/admin/invite', 'POST', { email, role })
    if (ok) {
      setSuccess(`Convite enviado para ${email} (sujeito a limites de e-mail do Supabase).`)
      const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false })
      if (data) setInviteList(data)
    }
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revogar este convite?')) return
    await supabase.from('invitations').delete().eq('id', id)
    setInviteList(prev => prev.filter(i => i.id !== id))
  }

  function copyCredential() {
    if (!credential) return
    navigator.clipboard?.writeText(`Acesso QualiData\nE-mail: ${credential.email}\nSenha temporária: ${credential.password}\n(troca obrigatória no primeiro acesso)`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }

  return (
    <div className="app">
      <header className="hero soft-shell" style={{ marginBottom: 20 }}>
        <div className="topline">
          <div className="brandmark">
            <div className="brand-meta">
              <span>QualiData — Admin</span>
              <strong>Gestão de usuários</strong>
              <small>Crie acessos, gerencie papéis e redefina senhas.</small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn" href="/">← Voltar ao painel</Link>
          </div>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3 className="card-title">Criar usuário</h3></div>
        <div className="card-body">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={labelStyle}>Nome completo</label>
              <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Maria Silva" />
            </div>
            <div>
              <label style={labelStyle}>E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="colaborador@empresa.com" />
            </div>
            <div>
              <label style={labelStyle}>Papel</label>
              <select value={role} onChange={e => setRole(e.target.value as Role)}>
                {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
              </select>
            </div>
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Criando…' : 'Criar usuário'}</button>
          </form>
          <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>
            A senha temporária aparece <strong>uma única vez</strong> após criar — repasse ao usuário pelo canal que preferir.
            Alternativa: <button type="button" className="btn small ghost" onClick={handleInvite}>convidar por e-mail</button> (entrega não garantida).
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3 className="card-title">Usuários ativos</h3><span className="badge tone-blue">{userList.length}</span></div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>E-mail</th><th>Nome</th><th>Papel</th><th>Desde</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {userList.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>
                      <input
                        className="mini-input"
                        defaultValue={u.full_name ?? ''}
                        placeholder="—"
                        onBlur={async e => {
                          const next = e.target.value
                          if (next === (u.full_name ?? '')) return
                          const ok = await handlePatch(u, { fullName: next })
                          if (!ok) e.target.value = u.full_name ?? ''
                        }}
                      />
                    </td>
                    <td>
                      {u.id === currentUserId
                        ? <span className="badge tone-blue">{ROLE_LABELS[u.role as Role] ?? u.role}</span>
                        : (
                          <select value={u.role} onChange={e => handlePatch(u, { role: e.target.value as Role })} style={{ minWidth: 160 }}>
                            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td style={{ color: '#5f7188', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn small" onClick={() => handleResetPassword(u)}>Resetar senha</button>
                        {u.id !== currentUserId && (
                          <button className="btn small danger" onClick={() => handleDelete(u)}>Excluir</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                      <td>{!inv.accepted_at && <button className="btn small danger" onClick={() => revokeInvite(inv.id)}>Revogar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {credential && (
        <div className="modal-backdrop open" onClick={e => { if ((e.target as HTMLElement).classList.contains('modal-backdrop')) setCredential(null) }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
            <div className="modal-head">
              <div>
                <h2>{credential.kind === 'novo' ? 'Usuário criado' : 'Senha redefinida'}</h2>
                <p>Esta senha não será exibida novamente.</p>
              </div>
              <button className="btn square" onClick={() => setCredential(null)} aria-label="Fechar">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 6px', color: '#5f7188', fontSize: 13 }}>{credential.email}</p>
              <div style={{ fontFamily: 'Consolas, monospace', fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', background: '#f1f5f9', borderRadius: 10, padding: '14px 16px', textAlign: 'center', userSelect: 'all' }}>
                {credential.password}
              </div>
              <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>O usuário será obrigado a trocar a senha no primeiro acesso.</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button className="btn" onClick={copyCredential}>{copied ? '✓ Copiado' : 'Copiar credenciais'}</button>
                <button className="btn primary" onClick={() => setCredential(null)}>Concluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

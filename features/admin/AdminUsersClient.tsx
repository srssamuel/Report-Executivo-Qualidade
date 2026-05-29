'use client'

import React, { useState, FormEvent } from 'react'
import { createClient } from '@/shared/supabase/client'
import { UserProfile, ROLE_LABELS, Role } from '@/shared/domain'

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  accepted_at: string | null
}

interface InviteResult {
  email: string
  ok: boolean
  note?: string
  error?: string
}

function parseEmailList(raw: string): { email: string; name: string }[] {
  const entries: { email: string; name: string }[] = []
  const parts = raw.split(/[;\n]+/)
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    // Format: "Name <email>"
    const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+)>/)
    if (angleMatch) {
      const rawName = angleMatch[1].replace(/\s*-\s*AeC$/i, '').trim()
      entries.push({ email: angleMatch[2].trim().toLowerCase(), name: rawName })
      continue
    }
    // Format: plain email or "email, email"
    const emails = trimmed.split(/[,\s]+/).filter(e => e.includes('@'))
    for (const em of emails) {
      entries.push({ email: em.trim().toLowerCase(), name: '' })
    }
  }
  // Deduplicate by email
  const seen = new Set<string>()
  return entries.filter(e => {
    if (seen.has(e.email)) return false
    seen.add(e.email)
    return true
  })
}

const INVITE_ROLES: Role[] = ['superintendente', 'gerente', 'coordenador', 'consultor', 'lider', 'analista', 'viewer']

interface AdminUsersClientProps {
  users: UserProfile[]
  invitations: Invitation[]
  currentUserId: string
}

export function AdminUsersClient({ users, invitations, currentUserId }: AdminUsersClientProps) {
  const supabase = createClient()
  const [userList, setUserList] = useState(users)
  const [inviteList, setInviteList] = useState(invitations)
  const [singleEmail, setSingleEmail] = useState('')
  const [batchText, setBatchText] = useState('')
  const [role, setRole] = useState<Role>('analista')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [results, setResults] = useState<InviteResult[]>([])
  const [mode, setMode] = useState<'single' | 'batch'>('batch')

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setResults([]); setLoading(true)

    const invites = mode === 'batch'
      ? parseEmailList(batchText).map(p => ({ email: p.email, role, name: p.name }))
      : [{ email: singleEmail.trim().toLowerCase(), role, name: '' }]

    if (!invites.length) {
      setError('Nenhum e-mail válido encontrado.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invites }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error || 'Erro ao enviar convites.')
      return
    }

    setResults(json.results ?? [])
    setSuccess(`${json.sent} convite(s) enviado(s)${json.failed ? `, ${json.failed} com erro` : ''}.`)
    setSingleEmail('')
    setBatchText('')

    const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false })
    if (data) setInviteList(data as unknown as Invitation[])
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

  const parsed = mode === 'batch' ? parseEmailList(batchText) : []

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
        <div className="card-head">
          <h3 className="card-title">Convidar usuários</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn small ${mode === 'batch' ? 'primary' : ''}`} onClick={() => setMode('batch')} type="button">Em lote</button>
            <button className={`btn small ${mode === 'single' ? 'primary' : ''}`} onClick={() => setMode('single')} type="button">Individual</button>
          </div>
        </div>
        <div className="card-body">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <form onSubmit={handleInvite}>
            {mode === 'batch' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>
                    E-mails (cole vários — separados por ; ou quebra de linha)
                  </label>
                  <textarea
                    value={batchText}
                    onChange={e => setBatchText(e.target.value)}
                    placeholder={"Nome <email@empresa.com>; Nome <email@empresa.com>\nou um e-mail por linha"}
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, background: '#f8fafc' }}
                  />
                  {parsed.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                      <strong>{parsed.length} e-mail(s) detectado(s):</strong>
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {parsed.map(p => (
                          <span key={p.email} style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                            {p.name ? `${p.name} · ` : ''}{p.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '200px auto', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Papel para todos</label>
                    <select value={role} onChange={e => setRole(e.target.value as Role)}>
                      {INVITE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <button className="btn primary" type="submit" disabled={loading || parsed.length === 0}>
                    {loading ? 'Enviando…' : `Enviar ${parsed.length} convite(s)`}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 12, alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>E-mail</label>
                  <input type="email" required value={singleEmail} onChange={e => setSingleEmail(e.target.value)} placeholder="colaborador@empresa.com" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Papel</label>
                  <select value={role} onChange={e => setRole(e.target.value as Role)}>
                    {INVITE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Enviando…' : 'Enviar convite'}</button>
              </div>
            )}
          </form>

          <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>
            Cada usuário receberá um e-mail para definir sua senha no primeiro acesso.
          </p>

          {/* Batch results */}
          {results.length > 0 && (
            <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table className="admin-table" style={{ fontSize: 13 }}>
                <thead><tr><th>E-mail</th><th>Status</th><th>Detalhe</th></tr></thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ background: r.ok ? '#f0fdf4' : '#fef2f2' }}>
                      <td style={{ fontWeight: 600 }}>{r.email}</td>
                      <td>{r.ok ? <span className="badge tone-green">OK</span> : <span className="badge tone-red">Erro</span>}</td>
                      <td style={{ color: '#5f7188', fontSize: 12 }}>{r.note || r.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

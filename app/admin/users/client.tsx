'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserProfile, ROLE_LABELS, Role } from '@/lib/domain'

interface Invitation { id: string; email: string; role: string; created_at: string; accepted_at: string | null }
interface InviteResult { email: string; ok: boolean; note?: string; error?: string }

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

const INVITE_ROLES: Role[] = ['gerente', 'coordenador', 'consultor', 'analista', 'viewer']

export default function AdminUsersClient({ users, invitations, currentUserId }: {
  users: UserProfile[]; invitations: Invitation[]; currentUserId: string
}) {
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

  // ── Criar usuário direto (sem e-mail) + credencial exibida uma vez ──
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'consultor' as Role })
  const [creating, setCreating] = useState(false)
  const [cred, setCred] = useState<{ email: string; name: string; password: string; title: string } | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setCreating(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: createForm.email.trim(), fullName: createForm.name.trim(), role: createForm.role }),
    })
    const json = await res.json()
    setCreating(false)
    if (!res.ok) { setError(json.error || 'Erro ao criar usuário.'); return }
    setCred({ email: json.email, name: json.fullName, password: json.tempPassword, title: 'Usuário criado' })
    setCreateForm({ name: '', email: '', role: 'consultor' })
    const { data } = await supabase.from('user_profiles').select('*').order('created_at')
    if (data) setUserList(data as UserProfile[])
  }

  async function handleReset(u: UserProfile) {
    if (!confirm(`Gerar nova senha temporária para ${u.email}? A senha atual deixa de funcionar.`)) return
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Erro ao resetar senha.'); return }
    setCred({ email: json.email, name: json.fullName, password: json.tempPassword, title: 'Senha resetada' })
  }

  async function handleDelete(u: UserProfile) {
    const typed = prompt(`Excluir DEFINITIVAMENTE ${u.email}?\nDigite o e-mail para confirmar:`)
    if (typed === null) return
    if (typed.trim().toLowerCase() !== (u.email ?? '').toLowerCase()) { setError('E-mail digitado não confere — exclusão cancelada.'); return }
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Erro ao excluir.'); return }
    setUserList(prev => prev.filter(x => x.id !== u.id))
    setSuccess(`${u.email} excluído.`)
  }

  async function handleRename(u: UserProfile, newName: string): Promise<boolean> {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === (u.full_name ?? '')) return true
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: trimmed }),
    })
    if (!res.ok) { const json = await res.json(); setError(json.error || 'Erro ao renomear.'); return false }
    setUserList(prev => prev.map(x => x.id === u.id ? { ...x, full_name: trimmed } : x))
    return true
  }

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

      {/* Credencial gerada — exibida UMA vez */}
      {cred && (
        <div className="card" style={{ marginBottom: 20, borderColor: '#86efac', background: '#f0fdf4' }}>
          <div className="card-head">
            <h3 className="card-title">✅ {cred.title} — anote a senha (não será exibida novamente)</h3>
            <button className="btn small" onClick={() => setCred(null)}>Fechar</button>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 6 }}>
            <div><strong>{cred.name || cred.email}</strong> · {cred.email}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.06em', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px' }}>{cred.password}</code>
              <button className="btn small" onClick={() => { navigator.clipboard.writeText(cred.password); setSuccess('Senha copiada.') }}>Copiar</button>
            </div>
            <small style={{ color: '#166534' }}>O usuário entra com esta senha e é obrigado a trocá-la no primeiro acesso.</small>
          </div>
        </div>
      )}

      {/* Criar usuário direto — caminho primário (sem depender de e-mail) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3 className="card-title">Criar usuário</h3></div>
        <div className="card-body">
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Nome</label>
                <input required value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>E-mail</label>
                <input type="email" required value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="colaborador@empresa.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Papel</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as Role }))}>
                  {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                </select>
              </div>
              <button className="btn primary" type="submit" disabled={creating}>{creating ? 'Criando…' : 'Criar com senha temporária'}</button>
            </div>
          </form>
          <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>
            Cria o acesso na hora, sem depender de e-mail de convite. A senha temporária aparece uma única vez.
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3 className="card-title">Convidar por e-mail (alternativo)</h3>
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
                    <td>
                      <input
                        defaultValue={u.full_name ?? ''}
                        placeholder="—"
                        style={{ minWidth: 140 }}
                        onBlur={async e => { const ok = await handleRename(u, e.target.value); if (!ok) e.target.value = u.full_name ?? '' }}
                      />
                    </td>
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn small" onClick={() => handleReset(u)}>Resetar senha</button>
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

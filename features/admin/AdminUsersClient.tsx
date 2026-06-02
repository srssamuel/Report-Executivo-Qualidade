'use client'

import React, { useState, FormEvent } from 'react'
import { createClient } from '@/shared/supabase/client'
import { UserProfile, ROLE_LABELS, Role, Product } from '@/shared/domain'

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
  products: Product[]
  currentUserId: string
}

export function AdminUsersClient({ users, invitations, products, currentUserId }: AdminUsersClientProps) {
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
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Products management
  const [productList, setProductList] = useState(products)
  const [newProductName, setNewProductName] = useState('')
  const [newProductColor, setNewProductColor] = useState('#3b82f6')
  const [productLoading, setProductLoading] = useState(false)
  const [productError, setProductError] = useState('')

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

  async function changeManager(userId: string, managerId: string) {
    const value = managerId || null
    const { error } = await supabase.from('user_profiles').update({ manager_id: value }).eq('id', userId)
    if (error) { alert(error.message); return }
    setUserList(prev => prev.map(u => u.id === userId ? { ...u, manager_id: value } : u))
  }

  async function revokeInvite(id: string) {
    if (!confirm('Revogar este convite?')) return
    await supabase.from('invitations').delete().eq('id', id)
    setInviteList(prev => prev.filter(i => i.id !== id))
  }

  async function handleResetPassword(userId: string, email: string) {
    if (!confirm(`Gerar nova senha temporária para ${email}? A senha atual deixará de funcionar imediatamente.`)) return
    setResettingId(userId)
    setResetResult(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Erro ao redefinir senha.')
        return
      }
      setResetResult({ email: json.email ?? email, tempPassword: json.tempPassword })
    } finally {
      setResettingId(null)
    }
  }

  async function copyTempPassword() {
    if (!resetResult) return
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard may be unavailable */ }
  }

  async function handleAddProduct(e: FormEvent) {
    e.preventDefault()
    const name = newProductName.trim()
    if (!name) { setProductError('Informe o nome do produto.'); return }
    if (productList.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setProductError('Já existe um produto com este nome.'); return
    }
    setProductError(''); setProductLoading(true)
    const { data, error } = await supabase
      .from('products')
      .insert({ name, color: newProductColor })
      .select('*')
      .single()
    setProductLoading(false)
    if (error || !data) { setProductError(error?.message ?? 'Falha ao cadastrar produto.'); return }
    const created = data as unknown as Product
    setProductList(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    setNewProductName('')
    setNewProductColor('#3b82f6')
  }

  async function toggleProductActive(id: string, active: boolean) {
    const { error } = await supabase.from('products').update({ active }).eq('id', id)
    if (error) { alert(error.message); return }
    setProductList(prev => prev.map(p => p.id === id ? { ...p, active } : p))
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Excluir o produto "${name}"? Itens já lançados mantêm o rótulo, mas ele deixa de aparecer para novos lançamentos.`)) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setProductList(prev => prev.filter(p => p.id !== id))
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
                  <th>E-mail</th><th>Nome</th><th>Papel</th><th>Gestor imediato</th><th>Desde</th><th>Ações</th>
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
                          <select aria-label={`Papel de ${u.full_name || u.email}`} value={u.role} onChange={e => changeRole(u.id, e.target.value as Role)} style={{ minWidth: 160 }}>
                            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                          </select>
                        )
                      }
                    </td>
                    <td>
                      <select aria-label={`Gestor imediato de ${u.full_name || u.email}`} value={u.manager_id ?? ''} onChange={e => changeManager(u.id, e.target.value)} style={{ minWidth: 180 }}>
                        <option value="">— Sem gestor —</option>
                        {userList.filter(m => m.id !== u.id).map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                      </select>
                    </td>
                    <td style={{ color: '#5f7188', fontSize: 12 }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn small"
                          disabled={resettingId === u.id}
                          onClick={() => handleResetPassword(u.id, u.email)}
                        >
                          {resettingId === u.id ? 'Gerando…' : 'Resetar senha'}
                        </button>
                        {u.id !== currentUserId && (
                          <button className="btn small danger" onClick={async () => {
                            if (!confirm(`Remover acesso de ${u.email}?`)) return
                            await supabase.from('user_profiles').update({ role: 'viewer' }).eq('id', u.id)
                            setUserList(prev => prev.map(x => x.id === u.id ? { ...x, role: 'viewer' } : x))
                          }}>Revogar</button>
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

      {/* Products management */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3 className="card-title">Produtos</h3>
          <span className="badge tone-teal">{productList.filter(p => p.active).length} ativo(s)</span>
        </div>
        <div className="card-body">
          {productError && <div className="auth-error">{productError}</div>}

          <form onSubmit={handleAddProduct} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 12, alignItems: 'end', marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Novo produto</label>
              <input type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Nome do produto" maxLength={80} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5f7188', display: 'block', marginBottom: 6 }}>Cor</label>
              <input type="color" aria-label="Cor do produto" value={newProductColor} onChange={e => setNewProductColor(e.target.value)} style={{ width: '100%', height: 38, padding: 2, border: '1px solid #d1d5db', borderRadius: 8, background: '#f8fafc', cursor: 'pointer' }} />
            </div>
            <button className="btn primary" type="submit" disabled={productLoading}>{productLoading ? 'Salvando…' : 'Adicionar'}</button>
          </form>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Cor</th><th>Produto</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {productList.length === 0 ? (
                  <tr><td colSpan={4} style={{ color: '#5f7188', fontSize: 13 }}>Nenhum produto cadastrado.</td></tr>
                ) : productList.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span aria-hidden="true" style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 5, background: p.color, border: '1px solid rgba(15,23,42,0.15)', verticalAlign: 'middle' }} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.active ? <span className="badge tone-green">Ativo</span> : <span className="badge tone-gray">Inativo</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn small" onClick={() => toggleProductActive(p.id, !p.active)}>
                          {p.active ? 'Desativar' : 'Reativar'}
                        </button>
                        <button className="btn small danger" onClick={() => deleteProduct(p.id, p.name)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '10px 0 0', color: '#5f7188', fontSize: 13 }}>
            Desativar oculta o produto de novos lançamentos sem apagar o histórico. Excluir remove o registro — itens já lançados mantêm o rótulo de texto.
          </p>
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

      {/* Temp password result modal */}
      {resetResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Senha temporária gerada"
          onClick={() => setResetResult(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)',
            display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16,
          }}
        >
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, width: '100%' }}>
            <div className="card-head">
              <h3 className="card-title">Senha temporária gerada</h3>
              <span className="badge tone-green">OK</span>
            </div>
            <div className="card-body">
              <p style={{ margin: '0 0 12px', color: '#374151', fontSize: 14 }}>
                Repasse esta senha para <strong>{resetResult.email}</strong> por um canal seguro.
                No próximo acesso o usuário será obrigado a definir uma senha própria.
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
                background: '#0f172a', borderRadius: 10, marginBottom: 12,
              }}>
                <code style={{ flex: 1, color: '#f8fafc', fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {resetResult.tempPassword}
                </code>
                <button className="btn small primary" type="button" onClick={copyTempPassword}>
                  {copied ? 'Copiado ✓' : 'Copiar'}
                </button>
              </div>
              <p style={{ margin: '0 0 16px', color: '#b45309', fontSize: 12, fontWeight: 600 }}>
                ⚠ Esta senha não será exibida novamente. Copie agora.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn" type="button" onClick={() => setResetResult(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

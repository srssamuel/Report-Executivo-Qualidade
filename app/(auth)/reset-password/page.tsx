'use client'

import { useState, useEffect, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

// Proteção contra senha vazada via HIBP k-anonymity — espelha no app layer o
// "leaked password protection" do Supabase. Envia apenas os 5 primeiros chars
// do hash SHA-1 (k-anonymity); a senha nunca sai do dispositivo. Fail-open: se
// a API estiver indisponível, não bloqueia o usuário.
async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const bytes = new TextEncoder().encode(password)
    const digest = await crypto.subtle.digest('SHA-1', bytes)
    const hash = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split('\n').some(line => line.split(':')[0]?.trim().toUpperCase() === suffix)
  } catch {
    return false
  }
}

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isFirstLogin, setIsFirstLogin] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setIsFirstLogin(params.get('first') === '1')
  }, [])

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    setLoading(true)

    // Proteção contra senha vazada (HIBP) — espelha no app o "leaked password
    // protection" do Supabase. Fail-open se a API estiver indisponível.
    if (await isPasswordPwned(password)) {
      setError('Esta senha apareceu em vazamentos de dados públicos. Por segurança, escolha uma senha diferente.')
      setLoading(false)
      return
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.updateUser({ password })
    if (authError) { setError(authError.message); setLoading(false); return }

    // Mark password as changed via SECURITY DEFINER RPC (users can't UPDATE their own profile via RLS)
    const { error: rpcError } = await supabase.rpc('mark_password_changed')
    if (rpcError) {
      setError('Senha atualizada, mas houve erro ao registrar a troca. Tente fazer login novamente.')
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess('Senha alterada com sucesso! Redirecionando…')
    setTimeout(() => window.location.href = '/', 2000)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#123e7c,#3f82cf)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8a98aa' }}>QualiData</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1f3a', lineHeight: 1.2 }}>Report Executivo</div>
          </div>
        </div>

        {isFirstLogin ? (
          <>
            <h1>Bem-vindo ao QualiData!</h1>
            <p>Este é seu primeiro acesso. Por segurança, defina uma senha pessoal para substituir a senha temporária.</p>
          </>
        ) : (
          <>
            <h1>Nova senha</h1>
            <p>Defina uma senha segura de pelo menos 8 caracteres.</p>
          </>
        )}
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        <form onSubmit={handleReset}>
          <div className="auth-field">
            <label htmlFor="new-password">Nova senha</label>
            <input id="new-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </div>
          <div className="auth-field">
            <label htmlFor="confirm-password">Confirmar senha</label>
            <input id="confirm-password" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a nova senha" autoComplete="new-password" />
          </div>
          <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, minHeight: 44 }}>
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
        {!isFirstLogin && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a className="btn ghost" style={{ fontSize: 13 }} href="/login">Voltar ao login</a>
          </div>
        )}
      </div>
    </div>
  )
}

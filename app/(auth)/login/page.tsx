'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    window.location.href = '/'
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Link de redefinição enviado. Verifique seu e-mail.')
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

        {mode === 'login' ? (
          <>
            <h1>Acesso seguro</h1>
            <p>Entre com seu e-mail e senha para acessar o painel executivo.</p>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="auth-field">
                <label>E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" />
              </div>
              <div className="auth-field">
                <label>Senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, minHeight: 44 }}>
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn ghost" style={{ fontSize: 13 }} onClick={() => { setMode('forgot'); setError(''); }}>
                Esqueci a senha
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Redefinir senha</h1>
            <p>Informe seu e-mail e enviaremos um link de redefinição.</p>
            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}
            <form onSubmit={handleForgot}>
              <div className="auth-field">
                <label>E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" />
              </div>
              <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, minHeight: 44 }}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn ghost" style={{ fontSize: 13 }} onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                Voltar ao login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Senha alterada. Redirecionando…')
    setTimeout(() => window.location.href = '/', 2000)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Nova senha</h1>
        <p>Defina uma senha segura de pelo menos 8 caracteres.</p>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        <form onSubmit={handleReset}>
          <div className="auth-field">
            <label>Nova senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="auth-field">
            <label>Confirmar senha</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a nova senha" />
          </div>
          <button className="btn primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, minHeight: 44 }}>
            {loading ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}

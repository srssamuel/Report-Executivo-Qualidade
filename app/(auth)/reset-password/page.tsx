'use client'

import { Suspense, useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const forced = searchParams.get('forced') === '1'
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
    if (error) { setLoading(false); setError(error.message); return }
    const { error: rpcError } = await supabase.rpc('clear_must_change_password')
    if (rpcError) {
      setLoading(false)
      setError('Senha alterada, mas houve falha ao liberar o acesso. Recarregue a página ou contate o administrador.')
      return
    }
    setLoading(false)
    setSuccess('Senha alterada. Redirecionando…')
    setTimeout(() => window.location.href = '/', 2000)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Nova senha</h1>
        <p>Defina uma senha segura de pelo menos 8 caracteres.</p>
        {forced && (
          <div className="auth-error" style={{ background: '#fff4df', color: '#b86b00' }}>
            Você está usando uma senha temporária. Defina sua senha definitiva para continuar.
          </div>
        )}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to console in development, could be sent to external service
    console.error('[ErrorBoundary]', error.message, error.digest)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      fontFamily: 'var(--font-body)',
      color: 'var(--ink)',
    }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>
        Algo deu errado
      </h2>
      <p style={{ color: 'var(--muted)', maxWidth: '400px', textAlign: 'center' }}>
        Ocorreu um erro inesperado. Tente recarregar a página.
      </p>
      <button
        onClick={reset}
        style={{
          background: 'var(--blue-700)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 24px',
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        Tentar novamente
      </button>
    </div>
  )
}

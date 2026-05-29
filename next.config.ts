import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co'} https://*.supabase.co`,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: 'srssamueldatacx-agi',
  project: 'report-executivo-qualidade',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  // Opções de build-time do Sentry v10. Só têm efeito no build de produção
  // (webpack); sob Turbopack (next dev) são ignoradas. Mantê-las aqui elimina os
  // deprecation warnings que apareciam no dev e preserva o comportamento de prod
  // (source maps, anotação de componentes e cron monitors do Vercel).
  webpack: {
    reactComponentAnnotation: {
      enabled: true,
    },
    automaticVercelMonitors: true,
    // Substitui o antigo `disableLogger: true` (tree-shake dos logs de debug).
    treeshake: {
      removeDebugLogging: true,
    },
  },
})


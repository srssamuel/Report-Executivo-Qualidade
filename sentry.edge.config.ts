import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://xxxxxxxxxxxxxxxxxxx.ingest.sentry.io/xxxxxx',
  tracesSampleRate: 0.1,
})

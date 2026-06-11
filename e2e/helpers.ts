import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export interface QaUser {
  id: string
  email: string
  password: string
}

export function qaUser(): QaUser {
  return JSON.parse(readFileSync(path.join(__dirname, '.qa-user.json'), 'utf8')) as QaUser
}

/** As 10 views da SPA, na ordem da navegação. */
export const VIEWS = [
  'Dashboard', 'Carteira', 'Board', 'Riscos', 'Timeline',
  'Capacidade', 'Executivo', 'OKRs Gerentes', 'Desenvolvimento', 'Arquivados',
] as const

/** Faz login com o usuário QA e espera a SPA montar. */
export async function login(page: Page): Promise<void> {
  const { email, password } = qaUser()
  await page.goto('/login')
  await page.fill('#login-email', email)
  await page.fill('#login-password', password)
  await page.click('button[type="submit"]')
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 30_000 })
}

/** Ruído conhecido que não é defeito do app (telemetria da Vercel fora da Vercel, favicon). */
const IGNORED_ERRORS = [/_vercel\/insights/i, /favicon/i, /Failed to load resource.*_vercel/i]

/**
 * Registra erros de runtime (exceções não tratadas + console.error) da página.
 * Chamar ANTES da navegação; o array enche conforme os eventos chegam.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORED_ERRORS.some((re) => re.test(text))) return
    errors.push(`console.error: ${text}`)
  })
  return errors
}

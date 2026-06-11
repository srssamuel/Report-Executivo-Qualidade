import { test, expect } from '@playwright/test'
import { login, qaUser } from './helpers'

test.describe('Autenticação', () => {
  test('login com credenciais válidas entra no painel', async ({ page }) => {
    await login(page)
    await expect(page.getByRole('button', { name: 'Carteira', exact: true })).toBeVisible()
  })

  test('senha incorreta não autentica e permanece no login', async ({ page }) => {
    const { email } = qaUser()
    await page.goto('/login')
    await page.fill('#login-email', email)
    await page.fill('#login-password', 'senha-incorreta-123!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2_000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('rota protegida sem sessão redireciona para /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })
})

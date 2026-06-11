import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Gestão de usuários (admin)', () => {
  test('admin acessa /admin/users e vê a própria linha na tabela', async ({ page }) => {
    await login(page)
    await page.goto('/admin/users')
    // O usuário QA é admin e acabou de ser criado — a própria linha prova
    // que a página renderiza a lista real do banco.
    await expect(page.getByText('QA Robot E2E').first()).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/screens/admin-users.png', fullPage: true })
  })
})

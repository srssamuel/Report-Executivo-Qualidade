import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Gestão de usuários (admin)', () => {
  test('admin acessa /admin/users e vê a própria linha na tabela', async ({ page }) => {
    await login(page)
    await page.goto('/admin/users')
    // O usuário QA é admin e acabou de ser criado. O nome dele aparece nas
    // <option> do seletor de "Gestor imediato" de cada linha — opções de select
    // nunca são "visíveis" para o Playwright, então a asserção certa é
    // toBeAttached: prova que a página carregou a lista real do banco.
    await expect(
      page.locator('option', { hasText: 'QA Robot E2E' }).first()
    ).toBeAttached({ timeout: 15_000 })
    await page.screenshot({ path: 'test-results/screens/admin-users.png', fullPage: true })
  })
})

import { test, expect } from '@playwright/test'
import { login, collectPageErrors, VIEWS } from './helpers'

test.describe('Views da SPA', () => {
  test('navega pelas 10 views sem erros de runtime e captura screenshots', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    for (const label of VIEWS) {
      const tab = page.getByRole('button', { name: label, exact: true })
      await tab.click()
      await expect(tab).toHaveClass(/active/)
      // Tempo de hidratação/render dos gráficos antes do registro visual.
      await page.waitForTimeout(900)
      await page.screenshot({
        path: `test-results/screens/${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
        fullPage: true,
      })
    }

    expect(errors, `Erros de runtime durante a navegação:\n${errors.join('\n')}`).toEqual([])
  })
})

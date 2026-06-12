import { test, expect } from '@playwright/test'
import { login, collectPageErrors } from './helpers'

/**
 * O bloco Desenvolvimento tem 4 abas internas que só renderizam sob interação —
 * erros nelas não aparecem na varredura das 10 views. Esta suíte clica em cada
 * uma, captura screenshot e falha em qualquer erro de runtime.
 */
const INNER_TABS = [
  'Perfil Científico Vértice',
  'Atas One-on-One',
  'Plano de Desenvolvimento (PDI)',
  'Mapa de Perfil do Time', // sem exact: a aba pode ter badge de contagem no nome acessível
] as const

const slug = (label: string) =>
  label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')

test.describe('Desenvolvimento — abas internas', () => {
  test('navega por Vértice, 1:1, PDI e Mapa sem erros de runtime', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    await page.getByRole('button', { name: 'Desenvolvimento', exact: true }).click()

    for (const label of INNER_TABS) {
      const tab = page.getByRole('button', { name: label })
      await tab.click()
      await expect(tab).toHaveClass(/active/)
      // Tempo de hidratação/render (radar do Vértice, tabelas) antes do registro visual.
      await page.waitForTimeout(700)
      await page.screenshot({
        path: `test-results/screens/desenvolvimento-${slug(label)}.png`,
        fullPage: true,
      })
    }

    expect(errors, `Erros de runtime nas abas internas do Desenvolvimento:\n${errors.join('\n')}`).toEqual([])
  })
})

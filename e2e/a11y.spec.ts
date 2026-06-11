import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { login, VIEWS } from './helpers'

test.describe('Acessibilidade (axe-core)', () => {
  test('varredura WCAG por view — zero violações críticas', async ({ page }) => {
    await login(page)

    const critical: string[] = []
    for (const label of VIEWS) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.waitForTimeout(700)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()

      for (const v of results.violations) {
        const line = `[${label}] ${v.impact ?? 'n/d'}: ${v.id} — ${v.nodes.length} nó(s) — ${v.help}`
        // Tudo vai para o log do CI (base da crítica completa); só critical bloqueia.
        console.log(line)
        // Para serious+, detalha seletor e causa — é o endereço da correção.
        if (v.impact === 'critical' || v.impact === 'serious') {
          for (const node of v.nodes.slice(0, 10)) {
            console.log(`    ↳ ${node.target.join(' ')} :: ${node.failureSummary?.replace(/\n\s*/g, ' | ') ?? ''}`)
          }
        }
        if (v.impact === 'critical') critical.push(line)
      }
    }

    expect(critical, `Violações CRÍTICAS de acessibilidade:\n${critical.join('\n')}`).toEqual([])
  })
})

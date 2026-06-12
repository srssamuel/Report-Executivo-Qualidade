import { test, expect } from '@playwright/test'
import { login, collectPageErrors } from './helpers'

/**
 * Testes de INTERAÇÃO (além da navegação): drill-down, modal de item,
 * sino de notificações, personalização do painel e drawer de OKR.
 * Nenhum teste persiste mudança em dados reais — só o user_preferences
 * do usuário QA efêmero, apagado em cascata no teardown.
 */
test.describe('Interações críticas', () => {
  test('drill-down do KPI leva à Carteira e modal de item abre e fecha', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    // KPI "Ativas" é clicável e leva à Carteira com o recorte aplicado.
    await page.getByRole('button', { name: /Ativas/ }).first().click()
    await expect(page.getByRole('button', { name: 'Carteira', exact: true })).toHaveClass(/active/)

    // Board: Editar abre o modal do item; Cancelar fecha sem salvar.
    await page.getByRole('button', { name: 'Board', exact: true }).click()
    const editBtn = page.getByRole('button', { name: 'Editar' }).first()
    if (await editBtn.count() > 0) {
      await editBtn.click()
      await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible()
      await page.getByRole('button', { name: 'Cancelar' }).click()
      await expect(page.getByRole('button', { name: 'Fechar' })).toBeHidden()
    }

    expect(errors, `Erros de runtime:\n${errors.join('\n')}`).toEqual([])
  })

  test('sino de notificações abre, mostra estado e fecha com Escape', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    await page.getByRole('button', { name: /Notificações/ }).click()
    const panelTitle = page.getByText('Notificações', { exact: true })
    await expect(panelTitle).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panelTitle).toBeHidden()

    expect(errors, `Erros de runtime:\n${errors.join('\n')}`).toEqual([])
  })

  test('personalizar painel esconde/restaura seção e fecha com Escape', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    await page.getByRole('button', { name: 'Personalizar painel' }).click()
    await expect(page.getByText('Seções do painel')).toBeVisible()

    // Esconde "Evolução da carteira" → o título da seção some do painel.
    await page.getByLabel('Evolução da carteira').uncheck()
    await expect(page.getByRole('heading', { name: 'Evolução da carteira' })).toBeHidden()

    // Restaurar padrão → a seção volta.
    await page.getByRole('button', { name: 'Restaurar padrão' }).click()
    await expect(page.getByRole('heading', { name: 'Evolução da carteira' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByText('Seções do painel')).toBeHidden()

    expect(errors, `Erros de runtime:\n${errors.join('\n')}`).toEqual([])
  })

  test('drawer de lançamento de OKR abre pelo badge do mês e fecha com Escape', async ({ page }) => {
    const errors = collectPageErrors(page)
    await login(page)

    await page.getByRole('button', { name: 'OKRs Gerentes', exact: true }).click()
    await page.getByRole('button', { name: /Lançamento/ }).click()

    const badge = page.locator('.okr-monthly-badge').first()
    if (await badge.count() > 0) {
      await badge.click()
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()
      await expect(drawer.getByText('Lançamento de Resultados (Gerente)')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
    }

    expect(errors, `Erros de runtime:\n${errors.join('\n')}`).toEqual([])
  })
})

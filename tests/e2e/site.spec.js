import { test, expect } from '@playwright/test'

test.describe('site público', () => {
  test('a página inicial carrega com conteúdos da API', async ({ page }) => {
    const conteudo = page.waitForResponse((r) => r.url().endsWith('/api/publico/conteudo') && r.ok())
    await page.goto('/')
    await conteudo
    await expect(page.getByText('Forças Armadas Angolanas').first()).toBeVisible()
    await expect(page.locator('main, #root').first()).toBeVisible()
  })

  test('lê uma notícia, dá gosto e comenta', async ({ page }) => {
    const { noticias } = await (await page.request.get('http://localhost:3101/api/publico/conteudo')).json()
    await page.goto(`/Noticias/${noticias[0].slug}`)
    await expect(page.getByRole('heading', { name: noticias[0].titulo }).first()).toBeVisible()

    const reacoes = page.getByRole('region', { name: 'Reações e comentários' })
    const gosto = reacoes.getByRole('button', { name: /^Gost/ })
    await expect(gosto).toHaveAttribute('aria-pressed', 'false')
    await gosto.click()
    await expect(gosto).toHaveAttribute('aria-pressed', 'true')
    await expect(gosto).toHaveText(/Gostei\s*1/)

    const texto = `Comentário automático ${Date.now()}`
    await page.locator('#comentarios').getByLabel('Nome').fill('Teste E2E')
    await page.locator('#comentarios').getByLabel('Comentário').fill(texto)
    await page.getByRole('button', { name: 'Publicar comentário' }).click()
    await expect(page.getByText(texto)).toBeVisible()
  })
})

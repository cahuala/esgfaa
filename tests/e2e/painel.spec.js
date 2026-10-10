import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { ADMIN_E2E } from '../../playwright.config.js'

const FOTO = fileURLToPath(new URL('../../src/assets/Logo.png', import.meta.url))

async function entrar(page, { email = ADMIN_E2E.email, senha = ADMIN_E2E.senha } = {}) {
  await page.goto('/admin/')
  await page.getByLabel('E-mail institucional').fill(email)
  await page.getByLabel('Palavra-passe', { exact: true }).fill(senha)
  await page.getByRole('button', { name: /Entrar/ }).click()
}

test.describe('painel de administração', () => {
  test('recusa credenciais erradas', async ({ page }) => {
    await entrar(page, { senha: 'errada-mesmo-123' })
    await expect(page.getByText('E-mail ou palavra-passe incorretos.')).toBeVisible()
  })

  test('cria e publica uma notícia que aparece no site', async ({ page }) => {
    await entrar(page)
    await expect(page.getByText('Administrador').first()).toBeVisible()

    const titulo = `Notícia de teste ${Date.now()}`
    await page.goto('/admin/#/colecao/noticias/novo')
    await page.locator('.doc-titulo').fill(titulo)
    await page.locator('.ProseMirror').click()
    await page.keyboard.type('Corpo escrito pelo teste automático.')

    // sem secção não se publica
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText(/Para publicar, preencha: Secção/)).toBeVisible()

    await page.getByLabel('Secção *').fill('Institucional')
    await page.locator('.doc-entrada').fill('Resumo da notícia criada pelo teste.')
    const envio = page.waitForResponse((r) => r.url().endsWith('/api/admin/ficheiros') && r.status() === 201)
    await page.locator('.doc-capa-vazia input[type=file]').setInputFiles(FOTO)
    await envio
    await expect(page.locator('.doc-capa img')).toHaveAttribute('src', /\/uploads\/\d{4}-\d{2}\/[0-9a-f-]+\.png$/)
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Publicado — já está visível no site.')).toBeVisible()
    await expect(page).toHaveURL(/#\/colecao\/noticias\/noticia-de-teste-\d+$/)
    const slug = page.url().split('/').pop()

    await page.goto('/Noticias')
    await expect(page.getByText(titulo).first()).toBeVisible()
    await page.goto(`/Noticias/${slug}`)
    await expect(page.getByText('Corpo escrito pelo teste automático.')).toBeVisible()
  })

  test('sair termina a sessão', async ({ page }) => {
    await entrar(page)
    await expect(page.getByText('Administrador').first()).toBeVisible()
    const token = await page.evaluate(() => sessionStorage.getItem('esgfaa-admin-sessao'))
    expect(token).toBeTruthy()
    await page.locator('.esg-menu-utilizador > a, .esg-menu-utilizador [data-bs-toggle], .esg-menu-utilizador button').first().click()
    await page.getByText('Sair', { exact: false }).last().click()
    await expect(page.getByLabel('E-mail institucional')).toBeVisible()
    // o token antigo já não serve, mesmo que alguém o tenha copiado
    const r = await page.request.get('http://localhost:3101/api/admin/eu', { headers: { Authorization: `Bearer ${token}` } })
    expect(r.status()).toBe(401)
  })
})

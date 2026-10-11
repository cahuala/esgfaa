import { test, expect } from '@playwright/test'
import { ADMIN_E2E } from '../../playwright.config.js'

test('candidatura por passos chega à Secretaria e é avaliada no painel', async ({ page }) => {
  const email = `e2e${Date.now()}@faa.ao`

  // começa no botão da página inicial
  await page.goto('/')
  await page.getByRole('link', { name: /^Candidatar-me/ }).first().click()
  await expect(page).toHaveURL(/\/Candidatura$/)

  // passo 1: sem curso não avança
  await page.getByRole('button', { name: /Seguinte/ }).click()
  await expect(page.getByText('Escolha o curso a que se quer candidatar.')).toBeVisible()
  await page.locator('label').filter({ hasText: 'Curso de Estado-Maior' }).click()
  await page.getByRole('button', { name: /Seguinte/ }).click()

  // passo 2
  await page.getByLabel('Nome completo').fill('Oficial de Teste E2E')
  await page.getByRole('button', { name: /Seguinte/ }).click()
  await expect(page.getByText('Indique a data de nascimento.')).toBeVisible()
  await page.getByLabel('Data de nascimento').fill('1984-03-15')
  await page.getByLabel('N.º do bilhete de identidade').fill('004512345LA041')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Telefone').fill('+244 923 000 222')
  await page.getByLabel('Província').fill('Luanda')
  await page.getByRole('button', { name: /Seguinte/ }).click()

  // passo 3
  await page.getByLabel('Ramo').selectOption('Força Aérea Nacional')
  await page.getByLabel('Posto').selectOption('Tenente-Coronel')
  await page.getByLabel(/NIP/).fill('20011234')
  await page.getByLabel('Anos de serviço').fill('18')
  await page.getByLabel(/Unidade/).fill('Comando da Força Aérea')
  await page.getByLabel('Habilitações académicas').selectOption('Mestrado')
  await page.getByLabel(/Porque se candidata/).fill('Quero preparar-me para funções de comando e planeamento conjunto.')
  await page.getByRole('button', { name: /Seguinte/ }).click()

  // passo 4: revisão e confirmação
  await expect(page.getByText('Força Aérea Nacional · Tenente-Coronel')).toBeVisible()
  await page.getByText(/Declaro, sob compromisso/).click()
  await page.getByText(/Autorizo a Escola/).click()
  await page.getByRole('button', { name: 'Submeter candidatura' }).click()
  const codigo = (await page.locator('text=/ESG-\\d{4}-[A-Z2-9]{6}/').first().innerText()).trim()
  expect(codigo).toMatch(/^ESG-\d{4}-[A-Z2-9]{6}$/)

  // no painel
  await page.goto('/admin/')
  await page.getByLabel('E-mail institucional').fill(ADMIN_E2E.email)
  await page.getByLabel('Palavra-passe', { exact: true }).fill(ADMIN_E2E.senha)
  await page.getByRole('button', { name: /Entrar/ }).click()
  await page.getByText('Candidaturas').first().click()
  await page.getByPlaceholder('Nome, e-mail ou código…').fill(codigo)
  await expect(page.getByRole('cell', { name: codigo })).toBeVisible()
  await page.getByRole('link', { name: 'Abrir' }).click()
  await page.getByLabel('Estado').selectOption('em_analise')
  await page.getByLabel('Notas internas').fill('Documentos pedidos por e-mail.')
  await page.getByRole('button', { name: 'Guardar avaliação' }).click()
  await expect(page.getByText('Avaliação guardada.')).toBeVisible()
})

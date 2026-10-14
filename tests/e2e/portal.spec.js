import { test, expect } from '@playwright/test'
import { ADMIN_E2E } from '../../playwright.config.js'

const NOVA = 'Portal2026segura'

async function primeiraEntrada(page, email) {
  await page.goto('/portal/')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Palavra-passe', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(/Escolha uma palavra-passe nova para continuar/)).toBeVisible()
  await page.getByLabel(/Palavra-passe atual/).fill(email)
  await page.getByLabel('Nova palavra-passe', { exact: true }).fill(NOVA)
  await page.getByLabel('Repetir a nova palavra-passe').fill(NOVA)
  await page.getByRole('button', { name: 'Guardar nova palavra-passe' }).click()
  await expect(page.locator('#content .page-header')).toContainText(/Bom dia|Boa tarde|Boa noite/)
}

test('Administração Escolar matricula; docente publica; estudante consulta e pede um documento', async ({ page }) => {
  const sufixo = Date.now()
  const estudante = `estudante${sufixo}@esgfaa.gov.ao`
  const docente = `docente${sufixo}@esgfaa.gov.ao`

  // ---------- painel: Secretaria ----------
  await page.goto('/admin/')
  await page.getByLabel('E-mail institucional').fill(ADMIN_E2E.email)
  await page.getByLabel('Palavra-passe', { exact: true }).fill(ADMIN_E2E.senha)
  await page.getByRole('button', { name: /Entrar/ }).click()

  await page.goto('/admin/#/academico/contas')
  await page.getByLabel('Nome completo').fill('Cor. Docente Teste')
  await page.getByLabel('E-mail da Escola').fill(docente)
  await page.getByRole('button', { name: 'Criar docente' }).click()
  await expect(page.getByText(/Docente criado/)).toBeVisible()

  await page.goto('/admin/#/academico/turmas')
  await page.getByLabel('Nome da turma').fill(`CEM E2E ${sufixo}`)
  await page.getByRole('button', { name: 'Criar turma' }).click()
  await page.getByRole('row', { name: new RegExp(`CEM E2E ${sufixo}`) }).getByRole('link', { name: 'Abrir' }).click()

  await page.getByLabel('Nome completo').fill('Maj. Estudante Teste')
  await page.getByLabel('E-mail da Escola').fill(estudante)
  await page.getByRole('button', { name: 'Matricular' }).click()
  await expect(page.getByText(/Matriculado: Maj\. Estudante Teste/)).toBeVisible()

  await page.getByLabel('Código').fill('EST101')
  await page.getByLabel('Nome', { exact: true }).fill('Estratégia Militar')
  await page.getByLabel('Período').selectOption('anual')
  await page.getByRole('button', { name: 'Criar cadeira' }).click()
  await expect(page.getByText('EST101 · Estratégia Militar')).toBeVisible()
  await expect(page.getByText('Docentes por alocar')).toBeVisible()

  // alocação (regente) e programa na ficha da cadeira
  await page.getByRole('link', { name: /Docentes, programa e pauta/ }).click()
  await page.getByRole('tab', { name: /Docentes/ }).click()
  await page.getByRole('button', { name: 'Adicionar docente' }).click()
  const docenteSel = page.getByLabel('Docente 1', { exact: true })
  const opcao = docenteSel.locator('option', { hasText: 'Cor. Docente Teste' })
  await expect(opcao).toHaveCount(1)
  await docenteSel.selectOption(await opcao.getAttribute('value'))
  await page.getByLabel('Horas do docente 1').fill('60')
  await page.getByRole('button', { name: 'Guardar alocação' }).click()
  await expect(page.getByText('Alocação guardada.', { exact: false })).toBeVisible()
  await page.getByRole('tab', { name: /Programa/ }).click()
  await page.locator('.doc-folha, .ProseMirror').first().click()
  await page.keyboard.type('Objetivos: planear operações.')
  await page.getByRole('button', { name: 'Guardar programa' }).click()
  await expect(page.getByText('Programa guardado.')).toBeVisible()

  // ---------- portal: docente ----------
  await primeiraEntrada(page, docente)
  await page.locator('#content').getByText('Estratégia Militar').first().click()
  await page.getByRole('tab', { name: /Avisos/ }).click()
  await expect(page.getByRole('heading', { name: 'Novo aviso' })).toBeVisible()
  await page.getByLabel('Título').fill('Primeira aula')
  await page.getByLabel('Texto').fill('Tragam o programa lido.')
  await page.getByRole('button', { name: 'Publicar aviso' }).click()
  await expect(page.getByText('Tragam o programa lido.')).toBeVisible()
  await page.getByRole('tab', { name: /Materiais/ }).click()
  await expect(page.getByRole('heading', { name: 'Publicar material' })).toBeVisible()
  await page.getByLabel('Título').fill('Programa da cadeira')
  await page.getByLabel('Tipo').selectOption('ligacao')
  await page.getByLabel('Endereço').fill('https://example.org/programa')
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Programa da cadeira')).toBeVisible()

  // pauta: 1.ª e 2.ª prova; MAC 15 sem negativas = dispensado; publica só as provas
  await page.getByRole('tab', { name: 'Notas' }).click()
  await page.getByLabel(/^1\.ª Prova de .*Estudante Teste/).fill('14')
  await page.getByLabel(/^2\.ª Prova de .*Estudante Teste/).fill('16')
  await expect(page.locator('.p-matriz-pauta').getByText('Dispensado')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar pauta' }).click()
  await expect(page.getByText('Pauta guardada.')).toBeVisible()
  await page.getByRole('columnheader', { name: /1\.ª Prova/ }).getByRole('button').click()
  await expect(page.getByText('1.ª Prova: publicada aos estudantes.')).toBeVisible()
  await page.getByRole('columnheader', { name: /2\.ª Prova/ }).getByRole('button').click()
  await expect(page.getByText('2.ª Prova: publicada aos estudantes.')).toBeVisible()
  await page.locator('.p-conta-botao').click()
  await page.getByRole('button', { name: 'Sair' }).click()

  // ---------- portal: estudante ----------
  await primeiraEntrada(page, estudante)
  await expect(page.getByText('Primeira aula')).toBeVisible() // avisos das cadeiras na página inicial
  await page.goto('/portal/#/cadeiras')
  await page.locator('#content').getByText('Estratégia Militar').first().click()
  await expect(page.getByText('Programa da cadeira')).toBeVisible()
  await page.getByRole('tab', { name: 'Programa' }).click()
  await expect(page.getByText('Objetivos: planear operações.')).toBeVisible()
  await page.getByRole('tab', { name: /Materiais/ }).click()
  // o estudante não vê os formulários do docente
  await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0)

  // boletim em matriz: disciplinas × provas
  await page.goto('/portal/#/notas')
  const linha = page.getByRole('row', { name: /Estratégia Militar/ })
  await expect(linha.getByRole('cell').nth(2)).toHaveText('15') // MAC
  await expect(linha.getByText('Dispensado', { exact: true })).toBeVisible()

  await page.goto('/portal/#/pedidos')
  await page.getByLabel('Documento').selectOption('Declaração de matrícula')
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(page.getByText('Pedido enviado à Administração Escolar.')).toBeVisible()
  await expect(page.getByText('Pendente')).toBeVisible()
})

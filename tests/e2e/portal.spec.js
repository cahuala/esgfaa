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
  // página da cadeira (como no Moodle): capítulo novo e uma ligação lá dentro, no modo de edição
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Capítulo 1 — Introdução' : undefined))
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByLabel('Modo de edição').check()
  await page.getByRole('button', { name: 'Novo capítulo' }).click()
  await expect(page.getByRole('heading', { name: /Capítulo 1 — Introdução/ })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar atividade ou recurso' }).last().click()
  await page.getByRole('button', { name: /Ligação/ }).click()
  await page.getByLabel('Título').fill('Leitura obrigatória')
  await page.getByLabel('Endereço').fill('https://example.org/leitura')
  await page.getByRole('button', { name: 'Guardar e publicar' }).click()
  await expect(page.getByText('Recurso publicado.')).toBeVisible()
  await expect(page.locator('#content').getByText('Leitura obrigatória')).toBeVisible()

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

  // questionário com uma pergunta de verdadeiro ou falso, publicado
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByLabel('Modo de edição').check()
  await page.getByRole('button', { name: 'Adicionar atividade ou recurso' }).last().click()
  await page.getByRole('button', { name: /Questionário/ }).click()
  await page.getByLabel('Título').fill('Teste rápido')
  await page.getByRole('button', { name: 'Criar e juntar perguntas' }).click()
  await page.getByLabel('Tipo', { exact: true }).selectOption('vf')
  await page.getByLabel('Enunciado').fill('Clausewitz escreveu "Da Guerra".')
  await page.getByRole('button', { name: 'Juntar pergunta' }).click()
  await expect(page.getByText('Pergunta juntada.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Questionário publicado.')).toBeVisible()
  await page.locator('.p-conta-botao').click()
  await page.getByRole('button', { name: 'Sair' }).click()

  // ---------- portal: estudante ----------
  await primeiraEntrada(page, estudante)
  await expect(page.getByText('Primeira aula')).toBeVisible() // avisos das cadeiras na página inicial
  // o aviso do docente chegou como notificação (sino do cabeçalho)
  await page.getByRole('button', { name: /Notificações \(\d+ por ler\)/ }).click()
  await expect(page.locator('.p-notif-menu').getByText(/Aviso em Estratégia Militar: Primeira aula/)).toBeVisible()
  // mensagem privada ao docente da cadeira
  await page.goto('/portal/#/mensagens')
  await page.locator('.p-lista-conversas').getByText('Cor. Docente Teste').click()
  await page.getByLabel('Mensagem').fill('Bom dia, professor.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.locator('.p-balao').getByText('Bom dia, professor.')).toBeVisible()
  await page.goto('/portal/#/cadeiras')
  await page.locator('#content').getByText('Estratégia Militar').first().click()
  await expect(page.getByRole('heading', { name: /Capítulo 1 — Introdução/ })).toBeVisible()
  await expect(page.getByText('Leitura obrigatória')).toBeVisible()
  // o estudante não tem o modo de edição
  await expect(page.getByLabel('Modo de edição')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Programa' }).click()
  await expect(page.getByText('Objetivos: planear operações.')).toBeVisible()

  // fórum: o estudante abre um tópico
  await page.getByRole('tab', { name: 'Fórum' }).click()
  await page.getByLabel('Assunto').fill('Dúvida sobre o programa')
  await page.getByLabel('Mensagem').fill('O ensaio conta para a MAC?')
  await page.getByRole('button', { name: 'Publicar tópico' }).click()
  await expect(page.getByText('O ensaio conta para a MAC?')).toBeVisible()

  // questionário: responde e recebe a nota logo
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByRole('button', { name: 'Teste rápido' }).click()
  await page.getByRole('button', { name: 'Começar' }).click()
  await page.getByLabel('Verdadeiro').check()
  await page.getByRole('button', { name: 'Entregar' }).click()
  await expect(page.getByText('Nota: 20 valores')).toBeVisible()

  await page.goto('/portal/#/calendario')
  await expect(page.getByRole('grid')).toBeVisible()

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

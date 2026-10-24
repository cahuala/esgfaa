import { test, expect } from '@playwright/test'
import { ADMIN_E2E } from '../../playwright.config.js'

// aviso de privacidade (Lei n.º 22/11) na primeira entrada: quem testa toma conhecimento, como faria uma pessoa
test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('button', { name: 'Tomei conhecimento' }), async (b) => { await b.click() })
})


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
  await expect(page.locator('#content .page-header, #content .p-turma-topo').first()).toContainText(/Bom dia|Boa tarde|Boa noite/)
}

test('verificação pública de certificados, sem entrar no portal', async ({ page }) => {
  await page.goto('/portal/#/verificar')
  await expect(page.getByRole('heading', { name: /Verificar certificado/ })).toBeVisible()
  await page.getByLabel('Código de verificação').fill('ZZZZ-ZZZZ-ZZZZ')
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page.getByText(/Certificado não encontrado/)).toBeVisible()
})

test('Administração Escolar matricula; docente publica; estudante consulta e pede um documento', async ({ page }) => {
  const sufixo = Date.now()
  const estudante = `estudante${sufixo}@esgfaa.gov.ao`
  const docente = `docente${sufixo}@esgfaa.gov.ao`

  // ---------- painel: Secretaria ----------
  await page.goto('/admin/')
  await page.getByLabel('E-mail institucional').fill(ADMIN_E2E.email)
  await page.getByLabel('Palavra-passe', { exact: true }).fill(ADMIN_E2E.senha)
  await page.getByRole('button', { name: /Entrar/ }).click()

  // Pessoal e Quadros: regista o docente e o estudante
  await page.goto('/admin/#/pessoal/registo')
  await page.getByRole('button', { name: 'Docente', exact: true }).click()
  await page.getByLabel('Nome completo').fill('Cor. Docente Teste')
  await page.getByLabel('E-mail da Escola').fill(docente)
  await page.getByRole('button', { name: 'Registar docente' }).click()
  await expect(page.getByText(/Docente registado/)).toBeVisible()
  await page.getByRole('button', { name: 'Estudante', exact: true }).click()
  await page.getByLabel('Nome completo').fill('Maj. Estudante Teste')
  await page.getByLabel('E-mail da Escola').fill(estudante)
  await page.getByRole('button', { name: 'Registar estudante' }).click()
  await expect(page.getByText(/Estudante registado/)).toBeVisible()

  // Administração Escolar: turma e matrícula de quem já está registado

  await page.goto('/admin/#/academico/turmas')
  await page.getByLabel('Nome da turma').fill(`CEM E2E ${sufixo}`)
  await page.getByRole('button', { name: 'Criar turma' }).click()
  await page.getByRole('row', { name: new RegExp(`CEM E2E ${sufixo}`) }).getByRole('link', { name: 'Abrir' }).click()

  await page.getByRole('button', { name: 'Matricular estudantes' }).click()
  await page.getByLabel('Pesquisar estudantes registados').fill(estudante)
  await page.getByRole('checkbox', { name: 'Maj. Estudante Teste' }).check()
  await page.getByRole('button', { name: /Matricular 1 estudante/ }).click()
  await expect(page.getByText(/1 estudante\(s\) matriculado\(s\)/)).toBeVisible()

  await page.getByRole('tab', { name: /Cadeiras e horário/ }).click()
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
  await page.locator('#content a', { hasText: 'Estratégia Militar' }).first().click()
  await page.getByRole('tab', { name: /Avisos/ }).click()
  await expect(page.getByRole('heading', { name: 'Novo aviso' })).toBeVisible()
  await page.getByLabel('Título').fill('Primeira aula')
  await page.getByLabel('Texto').fill('Tragam o programa lido.')
  await page.getByRole('button', { name: 'Publicar aviso' }).click()
  await expect(page.getByText('Tragam o programa lido.')).toBeVisible()
  // página da cadeira (como no Moodle): capítulo novo e uma ligação lá dentro, no modo de edição
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByLabel('Modo de edição').check()
  await page.getByRole('button', { name: 'Novo capítulo' }).click()
  // diálogo do tema (não a janela do navegador)
  await page.getByRole('dialog').getByLabel('Título do novo capítulo').fill('Capítulo 1 — Introdução')
  await page.getByRole('dialog').getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByRole('heading', { name: /Capítulo 1 — Introdução/ })).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar atividade ou recurso' }).last().click()
  await page.getByRole('button', { name: /Ligação/ }).click()
  await page.getByLabel('Título').fill('Leitura obrigatória')
  await page.getByLabel('Endereço').fill('https://example.org/leitura')
  await page.getByRole('button', { name: 'Guardar e publicar' }).click()
  await expect(page.getByText('Recurso publicado.')).toBeVisible()
  await expect(page.locator('#content').getByText('Leitura obrigatória')).toBeVisible()
  // o docente vê a sala como os estudantes a veem e volta ao seu modo
  await page.getByLabel('Modo de edição').uncheck()
  await page.getByRole('button', { name: 'Ver como estudante' }).click()
  await expect(page.getByText('Está a ver a sala de aula como os estudantes a veem.', { exact: false })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Capítulos da cadeira' }).getByRole('button', { name: /Leitura obrigatória/ })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao modo de docente' }).click()
  await expect(page.getByLabel('Modo de edição')).toBeVisible()

  // pauta: 1.ª e 2.ª prova; MAC 15 sem negativas = dispensado; publica só as provas
  await page.getByRole('tab', { name: 'Notas' }).click()
  await page.getByLabel(/^1\.ª Prova de .*Estudante Teste/).fill('14')
  await page.getByLabel(/^2\.ª Prova de .*Estudante Teste/).fill('16')
  await expect(page.locator('.p-matriz-pauta').getByText('Dispensado')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar pauta' }).click()
  await expect(page.getByText('Pauta guardada.')).toBeVisible()
  await page.getByRole('columnheader', { name: /1\.ª Prova/ }).getByRole('button', { name: /publicar/i }).click()
  await expect(page.getByText('1.ª Prova: publicada aos estudantes.')).toBeVisible()
  await page.getByRole('columnheader', { name: /2\.ª Prova/ }).getByRole('button', { name: /publicar/i }).click()
  await expect(page.getByText('2.ª Prova: publicada aos estudantes.')).toBeVisible()

  // questionário com uma pergunta de verdadeiro ou falso, publicado
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByLabel('Modo de edição').check()
  await page.getByRole('button', { name: 'Adicionar atividade ou recurso' }).last().click()
  await page.getByRole('button', { name: /^Prova online \(questionário\)/ }).click()
  await page.getByLabel('Título').fill('Teste rápido')
  await page.getByRole('button', { name: 'Criar e juntar perguntas' }).click()
  await page.getByLabel('Tipo', { exact: true }).selectOption('vf')
  await page.getByLabel('Enunciado').fill('Clausewitz escreveu "Da Guerra".')
  await page.getByRole('button', { name: 'Juntar pergunta' }).click()
  await expect(page.getByText('Pergunta juntada.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar' }).click()
  await expect(page.getByText('Questionário publicado.')).toBeVisible()
  // restrição: o questionário só abre depois de concluir a leitura
  await page.getByRole('tab', { name: /Cadeira/ }).click()
  await page.getByLabel('Modo de edição').check()
  await page.getByRole('button', { name: 'Restrições de Teste rápido' }).click()
  await page.getByRole('button', { name: 'Condição' }).click()
  await page.getByLabel('Condição 1').selectOption({ label: 'Material: Leitura obrigatória' })
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Restrições guardadas.')).toBeVisible()
  // sondagem aos estudantes
  await page.getByRole('button', { name: 'Adicionar atividade ou recurso' }).last().click()
  await page.getByRole('button', { name: /Sondagem/ }).click()
  await page.getByLabel('Título').fill('Visita de estudo')
  await page.getByLabel('Pergunta').fill('Que dia prefere?')
  await page.getByLabel('Opção 1').fill('Quinta')
  await page.getByLabel('Opção 2').fill('Sexta')
  await page.getByRole('button', { name: 'Guardar e publicar' }).click()
  await expect(page.getByText('Sondagem publicada.')).toBeVisible()
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
  // a entrada do estudante é a sua turma; cada cadeira tem a sua sala de aula
  await page.goto('/portal/#/')
  await expect(page.getByRole('heading', { name: /CEM E2E/ })).toBeVisible()
  await page.locator('.p-turma-cadeira', { hasText: 'Estratégia Militar' }).click()
  const indice = page.getByRole('complementary', { name: 'Capítulos da cadeira' })
  const meio = page.locator('.p-sala-meio')
  await expect(indice.getByRole('button', { name: /Capítulo 1 — Introdução/ })).toBeVisible()
  await expect(indice.getByRole('button', { name: /Leitura obrigatória/ })).toBeVisible() // o primeiro capítulo já está aberto
  // o estudante não tem o modo de edição
  await expect(page.getByLabel('Modo de edição')).toHaveCount(0)
  // o capítulo ao meio: o questionário está fechado até concluir a leitura
  await meio.getByRole('button', { name: /Capítulo 1 — Introdução/ }).click()
  await expect(meio.getByText('Precisa de concluir "Leitura obrigatória"')).toBeVisible()
  // abrir a leitura na sala conta como feita e abre o questionário
  await meio.getByRole('button', { name: /Leitura obrigatória/ }).first().click()
  await expect(meio.getByRole('link', { name: 'Abrir a ligação' })).toHaveAttribute('href', 'https://example.org/leitura')
  await page.locator('.p-sala-migalhas').getByRole('button', { name: /Capítulo 1 — Introdução/ }).click()
  await expect(meio.getByText('Precisa de concluir "Leitura obrigatória"')).toHaveCount(0)
  await expect(meio.getByRole('button', { name: /Teste rápido/ })).toBeVisible()
  // responde à sondagem e vê os resultados
  await meio.getByRole('button', { name: /Visita de estudo/ }).click()
  await page.getByLabel('Sexta').check()
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Resposta registada.')).toBeVisible()
  await expect(page.getByText('1 resposta(s)')).toBeVisible()
  await page.getByRole('tab', { name: 'Programa' }).click()
  await expect(page.getByText('Objetivos: planear operações.')).toBeVisible()

  // fórum: o estudante abre um tópico
  await page.getByRole('tab', { name: 'Fórum' }).click()
  await page.getByLabel('Assunto').fill('Dúvida sobre o programa')
  await page.getByLabel('Mensagem').fill('O ensaio conta para a MAC?')
  await page.getByRole('button', { name: 'Publicar tópico' }).click()
  await expect(page.getByText('O ensaio conta para a MAC?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Todos os tópicos' })).toBeVisible() // o tópico novo já abriu

  // questionário: responde e recebe a nota logo
  await page.getByRole('tab', { name: /Sala de aula/ }).click()
  await indice.getByRole('button', { name: /Teste rápido/ }).click()
  await meio.getByRole('button', { name: 'Começar', exact: true }).click()
  await page.getByLabel('Verdadeiro').check()
  await page.getByRole('button', { name: 'Entregar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Entregar' }).click()
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

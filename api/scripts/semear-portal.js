// Dados de DEMONSTRAÇÃO do portal académico (só para desenvolvimento; não usar em produção).
//   npm run semear-portal
// Contas criadas com a palavra-passe inicial igual ao e-mail (o portal pede para a mudar).
import { criarConfig } from '../src/infraestrutura/config.js'
import { criarContentor } from '../src/contentor.js'
import { numeroConta } from '../src/dominio/academico/regras.js'
import { senhaInicial } from '../src/dominio/academico/pessoas/contas.js'

const config = criarConfig()
if (config.producao) {
  console.error('Recusado: estes dados são de demonstração e não devem ir para produção.')
  process.exit(1)
}
const c = criarContentor(config)
const { prisma } = c
const ano = new Date().getFullYear()
const dominio = config.dominioEmail || 'esgfaa.gov.ao'

/*
  Pautas de demonstração, com casos do regulamento: dispensa (MAC ≥ 14), aprovação no exame,
  aprovação e reprovação no recurso, e componentes ainda por publicar.
  Ordem das notas: estudantes por ordem de criação (João, Maria, Pedro, Sofia).
*/
async function semearPautas(turmaId) {
  const cadeiras = Object.fromEntries((await prisma.unidadeCurricular.findMany({ where: { turmaId } })).map((u) => [u.codigo, u]))
  if (!cadeiras.EST101 || (await prisma.notaPauta.count({ where: { cadeiraId: cadeiras.EST101.id } }))) return
  const estudantes = (await prisma.matricula.findMany({ where: { turmaId }, orderBy: { estudanteId: 'asc' } })).map((m) => m.estudanteId)
  const pautas = {
    EST101: { publicadas: ['p1', 'p2', 'exame', 'recurso'], notas: [[15, 16], [12, 13, 11], [16, 9, 7, 12], [8, 10, 6, 8]] },
    LID102: { publicadas: ['p1'], notas: [[14, 17], [12, 13], [15, 15], [11, 10]] },
    GEO103: { publicadas: ['p1', 'p2'], notas: [[17, 18], [11, 12], [14, 15], [9, 13]] },
  }
  for (const [codigo, { publicadas, notas }] of Object.entries(pautas)) {
    if (!cadeiras[codigo]) continue
    await prisma.unidadeCurricular.update({ where: { id: cadeiras[codigo].id }, data: { notasPublicadas: publicadas } })
    await prisma.notaPauta.createMany({ data: notas.map(([p1, p2, exame = null, recurso = null], i) => ({ cadeiraId: cadeiras[codigo].id, estudanteId: estudantes[i], p1, p2, exame, recurso })).filter((l) => l.estudanteId) })
  }
  console.log('Pautas de demonstração criadas.')
}

const PROGRAMA = `<h2>Objetivos</h2><p>Dotar os oficiais de instrumentos de análise e planeamento estratégico ao nível operacional e estratégico-militar.</p>
<h2>Conteúdos</h2><ol><li>Conceitos de estratégia e de arte operacional</li><li>O processo de planeamento de operações</li><li>Estratégia de defesa nacional e cooperação regional (SADC)</li><li>Estudos de caso</li></ol>
<h2>Avaliação</h2><p>Duas provas parcelares (MAC); dispensa de exame com MAC ≥ 14 sem prova negativa. Nota final = 40 % MAC + 60 % exame.</p>
<h2>Bibliografia</h2><ul><li>Clausewitz, C. — <em>Da Guerra</em></li><li>Couto, A. C. — <em>Elementos de Estratégia</em></li></ul>`

/*
  Acrescentos que também correm sobre dados de demonstração antigos (idempotentes):
  períodos, assistente na EST101, programa escrito, e um 1.º ano já concluído para o percurso académico.
*/
async function semearExtras(turma) {
  const porCodigo = Object.fromEntries((await prisma.unidadeCurricular.findMany({ where: { turmaId: turma.id } })).map((u) => [u.codigo, u]))
  await prisma.turma.update({ where: { id: turma.id }, data: { anoCurricular: 2 } })
  if (porCodigo.GEO103) await prisma.unidadeCurricular.update({ where: { id: porCodigo.GEO103.id }, data: { periodo: '2' } })
  if (porCodigo.MET104) await prisma.unidadeCurricular.update({ where: { id: porCodigo.MET104.id }, data: { periodo: 'anual' } })
  if (porCodigo.EST101 && !porCodigo.EST101.programa) await prisma.unidadeCurricular.update({ where: { id: porCodigo.EST101.id }, data: { programa: PROGRAMA } })
  const ana = await prisma.contaPortal.findUnique({ where: { email: `ana.baptista@${dominio}` } })
  if (porCodigo.EST101 && ana) {
    await prisma.docencia.upsert({
      where: { cadeiraId_docenteId: { cadeiraId: porCodigo.EST101.id, docenteId: ana.id } },
      create: { cadeiraId: porCodigo.EST101.id, docenteId: ana.id, papel: 'assistente', horas: 30 }, update: {},
    })
    await prisma.docencia.updateMany({ where: { cadeiraId: porCodigo.EST101.id, papel: 'regente' }, data: { horas: 60 } })
  }

  await semearRecursos(porCodigo, ana)
  await semearCapitulos(porCodigo.EST101, (await prisma.docencia.findFirst({ where: { cadeiraId: porCodigo.EST101?.id, papel: 'regente' } }))?.docenteId)

  // 1.º ano (2025/2026), já concluído: dá história ao percurso académico
  if (await prisma.turma.findFirst({ where: { nome: 'CEM 2025/2026 (demonstração)' } })) return
  const anterior = await prisma.turma.create({ data: { curso: turma.curso, anoLetivo: '2025/2026', anoCurricular: 1, nome: 'CEM 2025/2026 (demonstração)', ativa: false } })
  const estudantes = (await prisma.matricula.findMany({ where: { turmaId: turma.id }, orderBy: { estudanteId: 'asc' } })).map((m) => m.estudanteId)
  for (const e of estudantes) await prisma.matricula.create({ data: { estudanteId: e, turmaId: anterior.id, estado: 'concluida' } })
  const regente = (await prisma.docencia.findFirst({ where: { cadeiraId: porCodigo.EST101?.id } }))?.docenteId
  // [código, nome, período, horas, notas (p1, p2, exame, recurso) de cada estudante]
  const plano = [
    ['HIS001', 'História Militar de Angola', '1', 60, [[16, 15], [13, 12, 12], [14, 15], [11, 9, 10]]],
    ['DIR002', 'Direito Internacional Humanitário', '1', 45, [[15, 14], [12, 14, 13], [10, 12, 11], [9, 8, 7, 11]]],
    ['TAT003', 'Tática Geral', '2', 75, [[17, 18], [14, 16], [12, 13, 14], [10, 11, 9, 12]]],
    ['ING004', 'Inglês Técnico-Militar', 'anual', 90, [[14, 16], [15, 14], [13, 11, 15], [12, 10, 13]]],
  ]
  for (const [codigo, nome, periodo, horas, notas] of plano) {
    const u = await prisma.unidadeCurricular.create({ data: { turmaId: anterior.id, codigo, nome, periodo, horas, notasPublicadas: ['p1', 'p2', 'exame', 'recurso'] } })
    if (regente) await prisma.docencia.create({ data: { cadeiraId: u.id, docenteId: regente, papel: 'regente', horas } })
    await prisma.notaPauta.createMany({ data: notas.map(([p1, p2, exame = null, recurso = null], i) => ({ cadeiraId: u.id, estudanteId: estudantes[i], p1, p2, exame, recurso })).filter((l) => l.estudanteId) })
  }
  console.log('Ano anterior (percurso académico) criado.')
}

// fórum, datas das provas, feriado e um questionário publicado na EST101 (idempotente)
// capítulos da EST101 com resumo e materiais, como uma cadeira a sério no Moodle (idempotente)
async function semearCapitulos(est, autorId) {
  if (!est || (await prisma.secaoCadeira.count({ where: { cadeiraId: est.id } })) > 2) return
  const base = await prisma.secaoCadeira.count({ where: { cadeiraId: est.id } })
  const capitulos = [
    ['Capítulo 1 — Teoria da estratégia', 'Conceitos fundamentais: fins, modos e meios; os níveis da guerra; os clássicos (Sun Tzu, Clausewitz, Jomini).', [
      ['Sebenta do capítulo 1', 'ligacao', 'https://pt.wikipedia.org/wiki/Estrat%C3%A9gia_militar'],
      ['Clausewitz — Da Guerra (excertos)', 'ligacao', 'https://pt.wikipedia.org/wiki/Da_Guerra'],
    ]],
    ['Capítulo 2 — Planeamento de operações', 'O processo de planeamento: análise da missão, modalidades de ação, ordem de operações.', [
      ['Guia do processo de planeamento', 'ligacao', 'https://pt.wikipedia.org/wiki/Planejamento_militar'],
    ]],
    ['Capítulo 3 — Estratégia de defesa nacional', 'A defesa nacional de Angola e a cooperação regional na SADC.', [
      ['A SADC e a arquitetura de paz e segurança', 'ligacao', 'https://pt.wikipedia.org/wiki/Comunidade_para_o_Desenvolvimento_da_%C3%81frica_Austral'],
    ]],
    ['Capítulo 4 — Estudos de caso', 'Análise de campanhas: preparação do ensaio final.', []],
  ]
  for (const [i, [titulo, resumo, materiais]] of capitulos.entries()) {
    const s = await prisma.secaoCadeira.create({ data: { cadeiraId: est.id, titulo, resumo, ordem: base + i + 1 } })
    for (const [t, tipo, url] of materiais) await prisma.material.create({ data: { cadeiraId: est.id, secaoId: s.id, titulo: t, tipo, url, autorId } })
    if (i === 3) await prisma.trabalho.updateMany({ where: { cadeiraId: est.id }, data: { secaoId: s.id } })
    if (i === 0) await prisma.questionario.updateMany({ where: { cadeiraId: est.id }, data: { secaoId: s.id } })
  }
  // um capítulo ainda em preparação: o docente vê-o, os estudantes não
  await prisma.secaoCadeira.create({ data: { cadeiraId: est.id, titulo: 'Capítulo 5 — Revisões para o exame', resumo: 'Em preparação.', ordem: base + 5, visivel: false } })
  console.log('Capítulos de demonstração criados.')
}

async function semearRecursos(porCodigo, ana) {
  const est = porCodigo.EST101
  if (!est || (await prisma.questionario.count({ where: { cadeiraId: est.id } }))) return
  const regente = (await prisma.docencia.findFirst({ where: { cadeiraId: est.id, papel: 'regente' } }))?.docenteId
  const joao = await prisma.contaPortal.findUnique({ where: { email: `joao.fernandes@${dominio}` } })
  const dia = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

  if (joao && regente) {
    const t = await prisma.forumTopico.create({ data: { cadeiraId: est.id, autorId: joao.id, titulo: 'Ensaio: podemos usar fontes em inglês?', texto: 'Professor, as fontes da bibliografia complementar podem estar em inglês ou só em português?' } })
    await prisma.forumResposta.create({ data: { topicoId: t.id, autorId: regente, texto: 'Podem, desde que citem corretamente. Pelo menos metade das fontes deve ser lusófona.' } })
    if (ana) await prisma.forumResposta.create({ data: { topicoId: t.id, autorId: ana.id, texto: 'Deixei na biblioteca uma lista de revistas lusófonas que podem ajudar.' } })
    await prisma.forumTopico.create({ data: { cadeiraId: est.id, autorId: regente, titulo: 'Regras do fórum', texto: 'Usem este fórum para dúvidas da matéria. Respondo até 48 horas.', fixado: true } })
  }

  await prisma.eventoAcademico.createMany({ data: [
    { cadeiraId: est.id, tipo: 'p1', titulo: '1.ª Prova', data: dia(9), inicio: '08:00', fim: '10:00', local: 'Anfiteatro A' },
    { cadeiraId: est.id, tipo: 'p2', titulo: '2.ª Prova', data: dia(30), inicio: '08:00', fim: '10:00', local: 'Anfiteatro A' },
    { cadeiraId: porCodigo.LID102?.id ?? est.id, tipo: 'p1', titulo: '1.ª Prova', data: dia(12), inicio: '10:30', fim: '12:30', local: 'Sala 2.04' },
    { tipo: 'feriado', titulo: 'Dia da Independência Nacional', data: '2026-11-11' },
    { turmaId: est.turmaId, tipo: 'geral', titulo: 'Visita de estudo ao Estado-Maior General', data: dia(16), inicio: '09:00', local: 'Luanda' },
  ] })

  const q = await prisma.questionario.create({ data: {
    cadeiraId: est.id, titulo: 'Teste formativo: conceitos de estratégia', descricao: 'Três perguntas sobre a matéria das primeiras semanas. Não conta para a nota.',
    duracao: 15, tentativas: 2, publicado: true, fecha: new Date(Date.now() + 14 * 86_400_000),
  } })
  await prisma.pergunta.createMany({ data: [
    { questionarioId: q.id, ordem: 1, tipo: 'unica', enunciado: 'Quem escreveu "Da Guerra"?', opcoes: [{ texto: 'Sun Tzu', correta: false }, { texto: 'Carl von Clausewitz', correta: true }, { texto: 'Antoine-Henri Jomini', correta: false }], pontos: 2 },
    { questionarioId: q.id, ordem: 2, tipo: 'multipla', enunciado: 'Quais destes são níveis da guerra?', opcoes: [{ texto: 'Estratégico', correta: true }, { texto: 'Operacional', correta: true }, { texto: 'Administrativo', correta: false }, { texto: 'Tático', correta: true }], pontos: 2 },
    { questionarioId: q.id, ordem: 3, tipo: 'vf', enunciado: 'A SADC tem sede em Gaborone, no Botswana.', opcoes: [{ texto: 'Verdadeiro', correta: true }, { texto: 'Falso', correta: false }], pontos: 1 },
  ] })
  console.log('Fórum, calendário e questionário de demonstração criados.')
}

const existente = await prisma.turma.findFirst({ where: { nome: 'CEM 2026/2027 (demonstração)' } })
if (existente) {
  await semearPautas(existente.id)
  await semearExtras(existente)
  console.log('Os dados de demonstração já existem.')
  await c.fechar()
  process.exit(0)
}

const curso = (await prisma.item.findFirst({ where: { colecao: 'cursos' }, orderBy: { ordem: 'asc' } }))?.id
if (!curso) throw new Error('Não há cursos na base de dados: corra primeiro a API (carga inicial).')

const fichas = []
async function conta(tipo, nome, usuario, dados) {
  const email = `${usuario}@${dominio}`
  const existente = await prisma.contaPortal.findUnique({ where: { email } })
  if (existente) return existente
  const seq = await c.repositorios.contasPortal.proximaSequencia(tipo, ano)
  const inicial = senhaInicial()
  fichas.push(`${email}  ${inicial}`)
  return prisma.contaPortal.create({
    data: { tipo, numero: numeroConta(tipo, ano, seq), nome, email, senha: await c.cifra.cifrar(inicial), dados, deveMudarSenha: true },
  })
}

const miguel = await conta('docente', 'Cor. Miguel Santos', 'miguel.santos', { departamento: 'Departamento de Investigação' })
const ana = await conta('docente', 'Cor. Ana Baptista', 'ana.baptista', { departamento: 'Subdireção Académica' })
const estudantes = [
  await conta('estudante', 'Maj. João Fernandes', 'joao.fernandes', { posto: 'Major', ramo: 'Exército' }),
  await conta('estudante', 'Maj. Maria Costa', 'maria.costa', { posto: 'Major', ramo: 'Força Aérea Nacional' }),
  await conta('estudante', 'Cap.-Ten. Pedro Neto', 'pedro.neto', { posto: 'Capitão-Tenente', ramo: 'Marinha de Guerra Angolana' }),
  await conta('estudante', 'Ten.-Cor. Sofia Lima', 'sofia.lima', { posto: 'Tenente-Coronel', ramo: 'Exército' }),
]

const turma = await prisma.turma.create({ data: { curso, anoLetivo: '2026/2027', nome: 'CEM 2026/2027 (demonstração)' } })
for (const e of estudantes) await prisma.matricula.create({ data: { estudanteId: e.id, turmaId: turma.id } })

const cadeiras = {}
for (const [codigo, nome, docente, horas] of [
  ['EST101', 'Estratégia e Planeamento Militar', miguel, 90],
  ['LID102', 'Liderança e Gestão de Recursos', ana, 60],
  ['GEO103', 'Geopolítica e Relações Internacionais', miguel, 60],
  ['MET104', 'Metodologia de Investigação', ana, 45],
]) {
  cadeiras[codigo] = await prisma.unidadeCurricular.create({ data: { turmaId: turma.id, codigo, nome, horas, periodo: '1' } })
  await prisma.docencia.create({ data: { cadeiraId: cadeiras[codigo].id, docenteId: docente.id, papel: 'regente', horas } })
}

const horarios = [
  ['EST101', 1, '08:00', '10:00', 'Anfiteatro A'], ['EST101', 3, '08:00', '10:00', 'Anfiteatro A'],
  ['LID102', 1, '10:30', '12:30', 'Sala 2.04'], ['GEO103', 2, '08:00', '10:00', 'Sala 2.01'],
  ['GEO103', 4, '10:30', '12:30', 'Sala 2.01'], ['MET104', 5, '08:00', '10:00', 'Biblioteca'],
]
for (const [cod, diaSemana, inicio, fim, sala] of horarios) await prisma.horario.create({ data: { cadeiraId: cadeiras[cod].id, diaSemana, inicio, fim, sala } })

const capitulo = async (cadeira, titulo, ordem) => (await prisma.secaoCadeira.create({ data: { cadeiraId: cadeira.id, titulo, ordem } })).id
const apresentacao = await capitulo(cadeiras.EST101, 'Apresentação', 1)
const semana1 = await capitulo(cadeiras.EST101, 'Semana 1', 2)
await prisma.material.createMany({ data: [
  { cadeiraId: cadeiras.EST101.id, titulo: 'Programa da cadeira', secaoId: apresentacao, tipo: 'ligacao', url: 'https://cahuala.github.io/esgfaa/Cursos', autorId: miguel.id },
  { cadeiraId: cadeiras.EST101.id, titulo: 'Conferência: estratégia e defesa nacional', secaoId: semana1, tipo: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', descricao: 'Ver antes da aula de quarta-feira.', autorId: miguel.id },
  { cadeiraId: cadeiras.LID102.id, titulo: 'Leituras recomendadas', secaoId: await capitulo(cadeiras.LID102, 'Bibliografia', 1), tipo: 'ligacao', url: 'https://cahuala.github.io/esgfaa/Artigos', autorId: ana.id },
] })

await prisma.avisoCadeira.create({ data: { cadeiraId: cadeiras.EST101.id, titulo: 'Bem-vindos à cadeira', texto: 'A primeira aula é na segunda-feira, no Anfiteatro A. Tragam o programa lido.', autorId: miguel.id } })
await prisma.avisoGeral.create({ data: { titulo: 'Início do ano académico', texto: 'As aulas do 1.º semestre começam esta semana. Consultem o horário no portal.' } })

await semearPautas(turma.id)
await semearExtras(turma)

const prazo = new Date(Date.now() + 7 * 86_400_000)
prazo.setHours(23, 59, 0, 0)
await prisma.trabalho.create({ data: { cadeiraId: cadeiras.EST101.id, titulo: 'Ensaio: estratégia de defesa regional', enunciado: 'Ensaio de 2 000 a 3 000 palavras sobre a cooperação em defesa na África Austral.', prazo } })

console.log(`Demonstração criada: turma "${turma.nome}", 4 cadeiras, 2 docentes e 4 estudantes (@${dominio}).`)
console.log(`Palavras-passe iniciais (só agora; o portal obriga a mudá-las):\n  ${fichas.join('\n  ')}`)
await c.fechar()

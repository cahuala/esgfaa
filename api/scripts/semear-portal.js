// Dados de DEMONSTRAÇÃO do portal académico (só para desenvolvimento; não usar em produção).
//   npm run semear-portal
// Contas criadas com a palavra-passe inicial igual ao e-mail (o portal pede para a mudar).
import { criarConfig } from '../src/infraestrutura/config.js'
import { criarContentor } from '../src/contentor.js'
import { numeroConta } from '../src/dominio/academico/regras.js'

const config = criarConfig()
if (config.producao) {
  console.error('Recusado: estes dados são de demonstração e não devem ir para produção.')
  process.exit(1)
}
const c = criarContentor(config)
const { prisma } = c
const ano = new Date().getFullYear()
const dominio = config.dominioEmail || 'esgfaa.gov.ao'

if (await prisma.turma.findFirst({ where: { nome: 'CEM 2026/2027 (demonstração)' } })) {
  console.log('Os dados de demonstração já existem.')
  await c.fechar()
  process.exit(0)
}

const curso = (await prisma.item.findFirst({ where: { colecao: 'cursos' }, orderBy: { ordem: 'asc' } }))?.id
if (!curso) throw new Error('Não há cursos na base de dados: corra primeiro a API (carga inicial).')

async function conta(tipo, nome, usuario, dados) {
  const email = `${usuario}@${dominio}`
  const existente = await prisma.contaPortal.findUnique({ where: { email } })
  if (existente) return existente
  const seq = await c.repositorios.contasPortal.proximaSequencia(tipo, ano)
  return prisma.contaPortal.create({
    data: { tipo, numero: numeroConta(tipo, ano, seq), nome, email, senha: await c.cifra.cifrar(email), dados, deveMudarSenha: true },
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
  cadeiras[codigo] = await prisma.unidadeCurricular.create({ data: { turmaId: turma.id, codigo, nome, horas, semestre: 1, docenteId: docente.id } })
}

const horarios = [
  ['EST101', 1, '08:00', '10:00', 'Anfiteatro A'], ['EST101', 3, '08:00', '10:00', 'Anfiteatro A'],
  ['LID102', 1, '10:30', '12:30', 'Sala 2.04'], ['GEO103', 2, '08:00', '10:00', 'Sala 2.01'],
  ['GEO103', 4, '10:30', '12:30', 'Sala 2.01'], ['MET104', 5, '08:00', '10:00', 'Biblioteca'],
]
for (const [cod, diaSemana, inicio, fim, sala] of horarios) await prisma.horario.create({ data: { cadeiraId: cadeiras[cod].id, diaSemana, inicio, fim, sala } })

await prisma.material.createMany({ data: [
  { cadeiraId: cadeiras.EST101.id, titulo: 'Programa da cadeira', topico: 'Apresentação', tipo: 'ligacao', url: 'https://cahuala.github.io/esgfaa/Cursos', autorId: miguel.id },
  { cadeiraId: cadeiras.EST101.id, titulo: 'Conferência: estratégia e defesa nacional', topico: 'Semana 1', tipo: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', descricao: 'Ver antes da aula de quarta-feira.', autorId: miguel.id },
  { cadeiraId: cadeiras.LID102.id, titulo: 'Leituras recomendadas', topico: 'Bibliografia', tipo: 'ligacao', url: 'https://cahuala.github.io/esgfaa/Artigos', autorId: ana.id },
] })

await prisma.avisoCadeira.create({ data: { cadeiraId: cadeiras.EST101.id, titulo: 'Bem-vindos à cadeira', texto: 'A primeira aula é na segunda-feira, no Anfiteatro A. Tragam o programa lido.', autorId: miguel.id } })
await prisma.avisoGeral.create({ data: { titulo: 'Início do ano académico', texto: 'As aulas do 1.º semestre começam esta semana. Consultem o horário no portal.' } })

const teste = await prisma.avaliacao.create({ data: { cadeiraId: cadeiras.EST101.id, nome: 'Teste 1', tipo: 'teste', peso: 40, publicada: true } })
await prisma.avaliacao.create({ data: { cadeiraId: cadeiras.EST101.id, nome: 'Exame final', tipo: 'exame', peso: 60 } })
const notas = [15.5, 13, 16, 11.5]
for (const [i, e] of estudantes.entries()) await prisma.nota.create({ data: { avaliacaoId: teste.id, estudanteId: e.id, valor: notas[i] } })

const prazo = new Date(Date.now() + 7 * 86_400_000)
prazo.setHours(23, 59, 0, 0)
await prisma.trabalho.create({ data: { cadeiraId: cadeiras.EST101.id, titulo: 'Ensaio: estratégia de defesa regional', enunciado: 'Ensaio de 2 000 a 3 000 palavras sobre a cooperação em defesa na África Austral.', prazo } })

console.log(`Demonstração criada: turma "${turma.nome}", 4 cadeiras, 2 docentes e 4 estudantes (@${dominio}).`)
console.log('Palavra-passe inicial de cada conta: o próprio e-mail.')
await c.fechar()

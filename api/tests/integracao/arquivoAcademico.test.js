import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

/*
  O arquivo da Administração Escolar: as pautas assinadas dos anos anteriores entram como estão (a nota de cada
  cadeira, a média final e a classificação), pelos discentes que o Pessoal já enviou; o que está no sistema não muda.
*/
describe('Carregar o arquivo da Administração Escolar (pautas dos anos anteriores)', () => {
  let amb, adm
  const pauta = () => ({
    sigla: 'CSCD', edicao: 29, anoLetivo: '2023/2024', ficheiro: 'PAUTA GERAL «CSCD Parcial»',
    ucs: [{ codigo: 'CRPP', nome: 'Comunicação, Relações Públicas e Protocolo', bloco: 'Administração' }, { codigo: 'GP', nome: 'Gestão de Pessoas', bloco: 'Administração' }, { codigo: 'DOP', nome: 'Doutrina das Operações', bloco: 'Táctica' }, { codigo: 'TII', nome: 'Trabalho de Investigação Individual', bloco: '' }],
    estudantes: [
      { nip: 'ARQ001', nome: 'Coronel Arquivo Um', notas: { CRPP: 18, GP: 17.5, DOP: 16, TII: 17 }, final: 17.12, mencao: 'Bom' },
      // a pauta tem o NIP sem o «I» e os zeros (o Excel tirou-os): encontra a conta na mesma
      { nip: '1234', nome: 'Comissario Arquivo Dois', notas: { CRPP: 9, GP: 12, DOP: 11, TII: 10 }, final: 10.5, mencao: 'Regular' },
      { nip: 'ARQ999', nome: 'Sem Conta no Portal', notas: { CRPP: 15, GP: 15, DOP: 15, TII: 15 }, final: 15, mencao: 'Bom' },
    ],
  })
  before(async () => {
    amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } })
    adm = amb.com(await amb.entrar())
    const cursos = await amb.contentor.repositorios.conteudos.listar('cursos')
    if (!cursos.some((c) => c.dados?.sigla === 'CSCD')) await amb.contentor.repositorios.conteudos.semear([{ colecao: 'cursos', id: 'cscd-teste', dados: { nome: 'Curso Superior de Comando e Direcção', sigla: 'CSCD' }, ordem: 1, estado: 'publicado' }])
    const pessoas = [
      { ref: 'pessoal-701', tipo: 'estudante', nome: 'Coronel Arquivo Um', email: 'arquivo.um@esgfaa.gov.ao', ativo: false, dados: { nip: 'ARQ001', posto: 'Coronel', ramo: 'EXE' } },
      { ref: 'pessoal-702', tipo: 'estudante', nome: 'Comissario Arquivo Dois', email: 'arquivo.dois@esgfaa.gov.ao', ativo: false, dados: { nip: 'I001234', posto: 'Comissário', origem: 'policia' } },
    ]
    const corpo = JSON.stringify({ pessoas })
    const data = String(Math.floor(Date.now() / 1000))
    await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
  })
  after(() => amb.fechar())

  it('simula primeiro (não grava) e diz quem ainda não tem conta', async () => {
    const r = (await adm.post('/api/admin/academico/arquivo/importar').send({ turmas: [pauta()], simular: true }).expect(200)).body
    assert.deepEqual([r.simulado, r.turmas[0].estado, r.turmas[0].comConta, r.turmas[0].contasNovas], [true, 'por carregar', 2, ['Sem Conta no Portal (ARQ999)']])
    assert.equal(await amb.contentor.prisma.turma.count({ where: { anoLetivo: '2023/2024' } }), 0)
  })

  it('carrega a turma, as cadeiras, as notas e o resultado da pauta; a pauta final sai igual à do arquivo', async () => {
    const r = (await adm.post('/api/admin/academico/arquivo/importar').send({ turmas: [pauta()], simular: false }).expect(200)).body
    assert.equal(r.turmas[0].estado, 'carregada')
    const t = await amb.contentor.prisma.turma.findFirst({ where: { anoLetivo: '2023/2024', nome: '29.º Curso Superior de Comando e Direcção' } })
    assert.deepEqual([t.ativa, t.anoFinal], [false, true])
    const p = (await adm.get(`/api/admin/academico/turmas/${t.id}/pauta-final`).expect(200)).body
    const um = p.linhas.find((l) => l.estudante.nome === 'Coronel Arquivo Um')
    assert.deepEqual([um.final, um.mencao, um.ucs.GP, um.ucs.TII], [17.12, 'Bom', 17.5, 17])
    const dois = p.linhas.find((l) => l.estudante.nome === 'Comissario Arquivo Dois')
    assert.deepEqual([dois.final, dois.mencao, dois.ucs.CRPP], [10.5, 'Regular', 9])
    assert.deepEqual(p.blocos.map((b) => b.nome), ['Administração', 'Táctica', 'Unidades curriculares'].filter((x) => p.blocos.some((b) => b.nome === x)))
    // o ano lectivo fica configurado e as matrículas como concluídas
    assert.ok(await amb.contentor.prisma.anoLetivo.findUnique({ where: { id: '2023/2024' } }))
    assert.equal(await amb.contentor.prisma.matricula.count({ where: { turmaId: t.id, estado: 'concluida' } }), 3)
    // quem não tinha conta passou a ter (activa, com o e-mail de acesso), para entrar e ver as notas
    const nova = await amb.contentor.prisma.contaPortal.findFirst({ where: { nome: 'Sem Conta no Portal' } })
    assert.deepEqual([nova.ativo, nova.dados.nip ?? null, /@/.test(nova.email)], [true, 'ARQ999', true])
    assert.equal(p.linhas.find((l) => l.estudante.nome === 'Sem Conta no Portal')?.final, 15)
  })

  it('volta a correr sem repetir nada; uma turma com notas lançadas no sistema não se toca', async () => {
    const antes = await amb.contentor.prisma.notaAvaliacaoUc.count()
    await adm.post('/api/admin/academico/arquivo/importar').send({ turmas: [pauta()], simular: false }).expect(200)
    assert.equal(await amb.contentor.prisma.notaAvaliacaoUc.count(), antes)
    assert.equal(await amb.contentor.prisma.turma.count({ where: { anoLetivo: '2023/2024' } }), 1)
    // uma turma do mesmo curso e ano, criada no sistema e com matrículas: o arquivo não entra
    const outra = { ...pauta(), anoLetivo: '2024/2025', edicao: 30 }
    const conta = await amb.contentor.repositorios.contasPortal.porEmail('arquivo.um@esgfaa.gov.ao')
    const cursoId = (await amb.contentor.prisma.turma.findFirst({ where: { nome: '29.º Curso Superior de Comando e Direcção' } })).curso
    const t = await amb.contentor.prisma.turma.create({ data: { curso: cursoId, anoLetivo: '2024/2025', nome: 'Turma única' } })
    await amb.contentor.prisma.matricula.create({ data: { turmaId: t.id, estudanteId: conta.id } })
    const r = (await adm.post('/api/admin/academico/arquivo/importar').send({ turmas: [outra], simular: false }).expect(200)).body
    assert.equal(r.turmas[0].estado, 'já existe')
    assert.match(r.turmas[0].motivo, /Turma única/)
  })

  it('o Pessoal envia depois o discente a quem a Gestão criou a conta: reconhece-o pelo NIP (não há outra conta)', async () => {
    const antes = await amb.contentor.prisma.contaPortal.count()
    const corpo = JSON.stringify({ pessoas: [{ ref: 'pessoal-799', tipo: 'estudante', nome: 'Sem Conta no Portal', email: 'sem.portal@esgfaa.gov.ao', ativo: true, dados: { nip: 'ARQ999', posto: 'Major' } }] })
    const data = String(Math.floor(Date.now() / 1000))
    await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
    assert.equal(await amb.contentor.prisma.contaPortal.count(), antes)
    const c = await amb.contentor.prisma.contaPortal.findFirst({ where: { nome: 'Sem Conta no Portal' } })
    assert.equal(c.email, 'sem.portal@esgfaa.gov.ao')
  })

  it('um curso que não existe ou um ano fechado ficam de fora, com o motivo', async () => {
    await amb.contentor.prisma.anoLetivo.upsert({ where: { id: '2021/2022' }, create: { id: '2021/2022', inicio: new Date('2021-10-01'), fim: new Date('2022-07-31'), semestre1Inicio: new Date('2021-10-01'), semestre1Fim: new Date('2022-02-28'), semestre2Inicio: new Date('2022-03-01'), semestre2Fim: new Date('2022-07-31'), fechado: true }, update: { fechado: true } })
    const r = (await adm.post('/api/admin/academico/arquivo/importar').send({ turmas: [{ ...pauta(), sigla: 'XYZ' }, { ...pauta(), anoLetivo: '2021/2022', edicao: 27 }], simular: false }).expect(200)).body
    assert.deepEqual(r.turmas.map((t) => t.estado), ['sem curso', 'ano fechado'])
  })
})

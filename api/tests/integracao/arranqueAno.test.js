import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { criarAmbiente } from '../apoio/ambiente.js'
import { carregarInicial } from '../../scripts/carregar-inicial.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

/*
  Arranque do ano lectivo: as turmas com as cadeiras do plano, as matrículas, o departamento de cada cadeira e os
  docentes habituais (do catálogo das relações do corpo docente).
*/
describe('Arranque do ano lectivo (turmas, cadeiras, departamentos e docentes)', () => {
  let amb, adm
  const dados = () => ({
    anoLetivo: '2026/2027',
    cadeiras: [
      { nome: 'GESTÃO DE PESSOAS', departamento: 'Departamento de Administração', docentes: [{ nip: 'DOC001', nome: 'Coronel Docente Gestao', tipo: 'efectivo' }, { nip: '', nome: 'Civil Colaborador Gestao', tipo: 'colaborador' }] },
      { nome: 'Metodologia de Invest. Ciêntifica', departamento: 'Departamento de Investigação e Doutrina', docentes: [{ nip: 'DOC002', nome: 'Major Docente Metodologia', tipo: 'efectivo' }] },
      { nome: 'Estratégia', departamento: 'Departamento de Estratégia', docentes: [] },
    ],
    turmas: [{ sigla: 'CSCD', edicao: 32, modelo: 'cscd-2026', estudantes: [{ nip: 'EST001', nome: 'Coronel Estudante Um' }, { nip: 'EST999', nome: 'Sem Conta Ainda' }] }],
  })
  before(async () => {
    amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } })
    adm = amb.com(await amb.entrar())
    const cursos = await amb.contentor.repositorios.conteudos.listar('cursos')
    if (!cursos.some((c) => c.dados?.sigla === 'CSCD')) await amb.contentor.repositorios.conteudos.semear([{ colecao: 'cursos', id: 'cscd-teste', dados: { nome: 'Curso Superior de Comando e Direcção', sigla: 'CSCD' }, ordem: 1, estado: 'publicado' }])
    const pessoas = [
      { ref: 'pessoal-801', tipo: 'estudante', nome: 'Coronel Estudante Um', email: 'estudante.um@esgfaa.gov.ao', ativo: true, dados: { nip: 'EST001' } },
      { ref: 'pessoal-802', tipo: 'docente', nome: 'Coronel Docente Gestao', email: 'docente.gestao@esgfaa.gov.ao', ativo: true, dados: { nip: 'DOC001' } },
      { ref: 'pessoal-803', tipo: 'docente', nome: 'Civil Colaborador Gestao', email: 'colaborador.gestao@esgfaa.gov.ao', ativo: true, dados: {} },
    ]
    const corpo = JSON.stringify({ pessoas })
    const data = String(Math.floor(Date.now() / 1000))
    await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
  })
  after(() => amb.fechar())

  it('simula: as cadeiras do plano ligadas ao catálogo (departamento e docentes), quem não tem conta', async () => {
    const r = (await adm.post('/api/admin/academico/arquivo/arrancar').send({ ...dados(), simular: true }).expect(200)).body
    const t = r.turmas[0]
    assert.deepEqual([t.estado, t.comConta, t.contasNovas, t.turma], ['por criar', 1, ['Sem Conta Ainda (EST999)'], '32.º Curso Superior de Comando e Direcção (2026/2027)'])
    const gp = t.cadeiras.find((c) => c.codigo === 'GP')
    assert.deepEqual([gp.catalogo, gp.departamento, gp.docentes.sort()], ['GESTÃO DE PESSOAS', 'Departamento de Administração', ['Civil Colaborador Gestao', 'Coronel Docente Gestao']])
    const mic = t.cadeiras.find((c) => c.codigo === 'MIC')
    assert.deepEqual([mic.departamento, mic.docentesSemConta], ['Departamento de Investigação e Doutrina', ['Major Docente Metodologia']])
    // «Estratégia» sozinha não se liga a «Liderança Estratégica»
    assert.equal(t.cadeiras.find((c) => c.codigo === 'LE').catalogo, null)
    assert.equal(await amb.contentor.prisma.turma.count({ where: { anoLetivo: '2026/2027' } }), 0)
  })

  it('grava: a turma com as cadeiras do plano, a matrícula, os departamentos e os docentes; repetir não duplica', async () => {
    await adm.post('/api/admin/academico/arquivo/arrancar').send({ ...dados(), simular: false }).expect(200)
    const p = amb.contentor.prisma
    const t = await p.turma.findFirst({ where: { anoLetivo: '2026/2027', nome: '32.º Curso Superior de Comando e Direcção' } })
    assert.ok(t?.ativa)
    const ucs = await p.unidadeCurricular.findMany({ where: { turmaId: t.id }, include: { docentes: { include: { docente: true } } } })
    assert.ok(ucs.length >= 18, `${ucs.length} cadeiras`)
    const gp = ucs.find((u) => u.codigo === 'GP')
    assert.equal(gp.departamento, 'Departamento de Administração')
    assert.deepEqual(gp.docentes.map((d) => [d.docente.nome, d.papel]).sort(), [['Civil Colaborador Gestao', 'assistente'], ['Coronel Docente Gestao', 'regente']])
    assert.equal(await p.matricula.count({ where: { turmaId: t.id, estado: 'ativa' } }), 2)
    assert.ok(await p.planoCurso.findFirst({ where: { anoLetivo: '2026/2027' } }))
    await adm.post('/api/admin/academico/arquivo/arrancar').send({ ...dados(), simular: false }).expect(200)
    assert.equal(await p.unidadeCurricular.count({ where: { turmaId: t.id } }), ucs.length)
    assert.equal(await p.docencia.count({ where: { cadeiraId: gp.id } }), 2)
    // uma cadeira criada depois, à mão, recebe o departamento do catálogo
    const nova = (await adm.post(`/api/admin/academico/turmas/${t.id}/cadeiras`).send({ codigo: 'MIC2', nome: 'Metodologia da Investigação Científica II', periodo: '1', horas: 10 }).expect(201)).body
    assert.equal(nova.departamento, 'Departamento de Investigação e Doutrina')
  })

  it('na instalação: a pasta CARREGAR entra sozinha (arranque e pautas do arquivo); repetir não duplica', async () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'carregar-'))
    fs.writeFileSync(path.join(pasta, 'arranque-2026-2027.json'), JSON.stringify({ tipo: 'arranque-ano-lectivo', ...dados() }))
    fs.writeFileSync(path.join(pasta, 'gestao-pautas-do-arquivo.json'), JSON.stringify({ tipo: 'arquivo-administracao-escolar', turmas: [{
      sigla: 'CSCD', edicao: 31, anoLetivo: '2025/2026', nome: '31.º Curso Superior de Comando e Direcção',
      ucs: [{ codigo: 'GP', nome: 'Gestão de Pessoas', bloco: 'Administração' }, { codigo: 'TII', nome: 'Trabalho de Investigação Individual', bloco: '' }],
      estudantes: [{ nip: 'ARQ500', nome: 'Discente do Arquivo Sem Conta', posto: 'Coronel', ramo: 'EXE', notas: { GP: 16, TII: 17 }, final: 16.5, mencao: 'Bom' }],
    }], avisos: ['um aviso para conferir'] }))
    const r = (await carregarInicial(amb.contentor, pasta)).join('\n')
    assert.match(r, /31\.º Curso Superior de Comando e Direcção \(2025\/2026\): carregada/)
    assert.match(r, /1 conta\(s\) criada\(s\)/)
    assert.match(r, /um aviso para conferir/)
    const p = amb.contentor.prisma
    const t = await p.turma.findFirst({ where: { anoLetivo: '2025/2026' } })
    assert.equal(t.nome, '31.º Curso Superior de Comando e Direcção')
    const contas = await p.contaPortal.count()
    await carregarInicial(amb.contentor, pasta)
    assert.equal(await p.contaPortal.count(), contas)
    assert.equal(await p.turma.count({ where: { anoLetivo: '2025/2026' } }), 1)
  })
})

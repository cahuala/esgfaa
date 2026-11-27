import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

/*
  O Sistema de Gestão Escolar (SISTEMA=escolar): não regista ninguém (as pessoas registam-se no Sistema de Pessoal;
  aqui só se consultam as fichas) e, com DOIS_FATORES=nao, não usa a verificação em dois passos.
*/
describe('Sistema de Gestão Escolar: sem registo de pessoas e sem dois passos', () => {
  let amb
  before(async () => {
    amb = await criarAmbiente({ env: { SISTEMA: 'escolar', REPLICACAO_CHAVE: 'chave-da-replicacao-entre-os-sistemas-de-teste-32+', DOIS_FATORES: 'nao', DOIS_FATORES_PAPEIS: 'administrador,comandante' } })
  })
  after(() => amb.fechar())

  it('a sessão diz que é a Gestão Escolar, sem dois passos e sem «pessoal.registar»', async () => {
    const adm = amb.com(await amb.entrar())
    const eu = (await adm.get('/api/admin/eu').expect(200)).body
    assert.deepEqual([eu.sistema, eu.doisFatoresDisponivel, eu.deveAtivar2fa], ['escolar', false, false])
    assert.ok(eu.permissoes.includes('pessoal.ver'))
    assert.ok(!eu.permissoes.includes('pessoal.registar'))
    // o papel que exigiria os dois passos entra no resto do painel sem os ligar
    const cmdt = amb.com((await amb.criarUtilizador('comandante')).token)
    await cmdt.get('/api/admin/academico/turmas').expect(200)
    // não se regista ninguém aqui: nem uma pessoa, nem por Excel
    assert.equal((await adm.post('/api/admin/academico/contas').send({ tipo: 'estudante', nome: 'Pessoa Nova Teste', email: 'pessoa.nova@esgfaa.gov.ao' })).status, 403)
    assert.equal((await adm.post('/api/admin/academico/contas/importar').send({ tipo: 'estudante', linhas: [{ nome: 'Outra Pessoa', email: 'outra.pessoa@esgfaa.gov.ao' }], simular: true })).status, 403)
    // as fichas consultam-se
    await adm.get('/api/admin/academico/contas').expect(200)
  })
})

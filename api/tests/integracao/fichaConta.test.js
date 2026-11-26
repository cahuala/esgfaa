import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

// a ficha do estudante/docente na Administração Escolar: os dados que vêm do Pessoal (sem BI nem morada)
describe('Ficha do estudante e do docente na Administração Escolar', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } })
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('guarda os dados da ficha que vêm do Pessoal (também a origem e o posto equivalente) e mostra-os', async () => {
    const dados = { posto: 'Comissário', postoEquivalente: 'Brigadeiro', ramo: '', nip: 'I0001', departamento: 'Polícia Nacional', origem: 'policia', genero: 'M', dataNascimento: '1970-05-02', naturalidade: 'Cazenga', provincia: 'Luanda', nacionalidade: 'Angolana', habilitacao: 'Licenciatura', areaFormacao: 'Direito', funcaoActual: 'Comandante Provincial', bi: '001234567LA041', morada: 'Rua X' }
    const corpo = JSON.stringify({ pessoas: [{ ref: 'pessoal-90', tipo: 'estudante', nome: 'Comissario Ficha Teste', email: 'comissario.ficha@esgfaa.gov.ao', ativo: true, dados }] })
    const data = String(Math.floor(Date.now() / 1000))
    await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
    const conta = await amb.contentor.repositorios.contasPortal.porEmail('comissario.ficha@esgfaa.gov.ao')
    const f = (await adm.get(`/api/admin/academico/contas/${conta.id}/ficha`).expect(200)).body
    assert.deepEqual([f.dados.origem, f.dados.postoEquivalente, f.dados.dataNascimento, f.dados.funcaoActual, f.dados.habilitacao], ['policia', 'Brigadeiro', '1970-05-02', 'Comandante Provincial', 'Licenciatura'])
    // o que não é para o ensino não fica no portal
    assert.equal(f.dados.bi, undefined)
    assert.equal(f.dados.morada, undefined)
    assert.deepEqual(f.turmas, [])
    assert.equal((await adm.get('/api/admin/academico/contas/999999/ficha')).status, 404)
  })
})

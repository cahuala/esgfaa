import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

// o Pessoal envia o estudante com o curso de cada ano; a matrícula faz-a a Administração Escolar (o curso fica para a sugerir)
describe('Pessoal → Gestão Escolar: o curso de cada ano chega, a matrícula não é automática', () => {
  let amb
  const enviar = (pessoas) => {
    const corpo = JSON.stringify({ pessoas })
    const data = String(Math.floor(Date.now() / 1000))
    return amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
  }
  before(async () => { amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } }) })
  after(() => amb.fechar())

  it('ninguém fica matriculado sozinho; o curso de cada ano fica na conta para sugerir a matrícula', async () => {
    const p = amb.contentor.prisma
    await p.turma.create({ data: { curso: 'cscd', anoLetivo: '2026/2027', nome: '32.º Curso Superior de Comando e Direcção', ativa: true } })
    await enviar([
      { ref: 'pessoal-1', tipo: 'estudante', nome: 'Coronel Pedro Manuel Kiala', email: null, ativo: true, dados: { nip: '11112222' }, anos: [{ anoLetivo: '2026/2027', curso: '32.º Curso Superior de Comando e Direcção' }, { anoLetivo: '2025/2026', curso: '31.º Curso Superior de Comando e Direcção', concluido: true }] },
    ])
    const conta = await amb.contentor.repositorios.contasPortal.porNip('estudante', '11112222')
    assert.equal(await p.matricula.count({ where: { estudanteId: conta.id } }), 0)
    assert.deepEqual(conta.dados.anosPessoal, [{ anoLetivo: '2026/2027', curso: '32.º Curso Superior de Comando e Direcção' }, { anoLetivo: '2025/2026', curso: '31.º Curso Superior de Comando e Direcção', concluido: true }])
  })
})

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

// a matrícula sem voltas: o estudante que chega do Pessoal com o curso do ano fica logo na turma activa desse curso
describe('Pessoal → Gestão Escolar: a matrícula pelo curso de cada ano', () => {
  let amb
  const enviar = (pessoas) => {
    const corpo = JSON.stringify({ pessoas })
    const data = String(Math.floor(Date.now() / 1000))
    return amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
  }
  before(async () => { amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } }) })
  after(() => amb.fechar())

  it('pelo nome do curso, ou pela única turma desse ano com as mesmas palavras; nunca em dobro', async () => {
    const p = amb.contentor.prisma
    const cscd = await p.turma.create({ data: { curso: 'cscd', anoLetivo: '2026/2027', nome: '32.º Curso Superior de Comando e Direcção', ativa: true } })
    const coamp = await p.turma.create({ data: { curso: 'coamp', anoLetivo: '2026/2027', nome: '12.º Curso de Organização do Asseguramento Moral e Psicológico', ativa: true } })
    await p.turma.create({ data: { curso: 'cscd', anoLetivo: '2025/2026', nome: '31.º Curso Superior de Comando e Direcção', ativa: false } })
    await enviar([
      { ref: 'pessoal-1', tipo: 'estudante', nome: 'Coronel Pedro Manuel Kiala', email: null, ativo: true, dados: { nip: '11112222' }, anos: [{ anoLetivo: '2026/2027', curso: '32.º Curso Superior de Comando e Direcção' }, { anoLetivo: '2025/2026', curso: '31.º Curso Superior de Comando e Direcção', concluido: true }] },
      // a lista dizia «18.º» no COAMP: a turma reconhece-se pelas palavras do curso
      { ref: 'pessoal-2', tipo: 'estudante', nome: 'Major Ana Maria Tchissola', email: null, ativo: true, dados: { nip: '33334444' }, anos: [{ anoLetivo: '2026/2027', curso: '18.º Curso de Organização do Asseguramento Moral e Psicológico' }] },
      { ref: 'pessoal-3', tipo: 'estudante', nome: 'Capitão Rui Lopes Ndala', email: null, ativo: true, dados: { nip: '55556666' }, anos: [{ anoLetivo: '2026/2027', curso: 'Curso que não existe' }] },
    ])
    const mats = async (nip) => p.matricula.findMany({ where: { estudante: { numero: { not: '' } }, estudanteId: (await amb.contentor.repositorios.contasPortal.porNip('estudante', nip)).id }, include: { turma: true } })
    const m1 = await mats('11112222')
    assert.deepEqual(m1.map((m) => m.turma.id), [cscd.id]) // a turma do ano anterior não está activa: não se mexe
    assert.equal(m1[0].estado, 'ativa')
    assert.deepEqual((await mats('33334444')).map((m) => m.turma.id), [coamp.id])
    assert.equal((await mats('55556666')).length, 0)
    // reenviado (outra mudança no Pessoal): não matricula outra vez
    await enviar([{ ref: 'pessoal-1', tipo: 'estudante', nome: 'Coronel Pedro Manuel Kiala', email: null, ativo: true, dados: { nip: '11112222' }, anos: [{ anoLetivo: '2026/2027', curso: '32.º Curso Superior de Comando e Direcção' }] }])
    assert.equal((await mats('11112222')).length, 1)
  })
})

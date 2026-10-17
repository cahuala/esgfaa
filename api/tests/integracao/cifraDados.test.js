import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'
import { CifraDados, cifrarExistentes } from '../../src/infraestrutura/bd/cifraDados.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo) => crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')

describe('Portal: dados pessoais cifrados na base de dados (AES-256-GCM)', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } })
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('dados da conta (posto, NIP, telefone): cifrados na base, legíveis no portal', async () => {
    const corpo = JSON.stringify({ pessoas: [{ ref: 'pessoal-77', tipo: 'docente', nome: 'Coronel Mateus Kiala', email: 'mateus.kiala@esgfaa.gov.ao', ativo: true, dados: { posto: 'Coronel', ramo: 'EXE', nip: 'NIP7788', telefone: '+244 923 111 222' } }] })
    const data = String(Math.floor(Date.now() / 1000))
    await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
    const bruto = await amb.contentor.prismaBase.contaPortal.findUnique({ where: { email: 'mateus.kiala@esgfaa.gov.ao' } })
    assert.deepEqual(Object.keys(bruto.dados), ['c1'])
    assert.ok(!JSON.stringify(bruto.dados).includes('NIP7788') && !JSON.stringify(bruto.dados).includes('923'))
    assert.equal(bruto.nome, 'Coronel Mateus Kiala') // nome e e-mail ficam em claro (entrar, procurar)
    const conta = await amb.contentor.repositorios.contasPortal.porEmail('mateus.kiala@esgfaa.gov.ao')
    assert.deepEqual([conta.dados.nip, conta.dados.telefone], ['NIP7788', '+244 923 111 222'])
    const lista = (await adm.get('/api/admin/academico/contas?tipo=docente').expect(200)).body
    const l = (Array.isArray(lista) ? lista : lista.contas ?? lista.itens ?? []).find((x) => x.email === 'mateus.kiala@esgfaa.gov.ao')
    assert.equal(l?.dados?.posto ?? l?.posto, 'Coronel')
  })

  it('mensagens do formulário de contacto: telefone e mensagem cifrados; o painel lê-as', async () => {
    await amb.http().post('/api/publico/contactos').send({ nome: 'Joana Bumba', email: 'joana@exemplo.ao', telefone: '+244 912 345 678', assunto: 'Candidaturas', mensagem: 'Gostaria de saber as datas das candidaturas ao curso.', consentimento: true }).expect(201)
    const bruto = (await amb.contentor.prismaBase.mensagemContacto.findMany()).at(-1)
    assert.match(bruto.telefone, /^c1:/)
    assert.match(bruto.mensagem, /^c1:/)
    const l = (await adm.get('/api/admin/contactos').expect(200)).body
    const m = (Array.isArray(l) ? l : l.mensagens ?? []).find((x) => x.nome === 'Joana Bumba')
    assert.equal(m.mensagem, 'Gostaria de saber as datas das candidaturas ao curso.')
    assert.equal(m.telefone, '+244 912 345 678')
  })

  it('cifra os registos antigos em texto e não repete', async () => {
    const c = await amb.contentor.prismaBase.contaPortal.create({ data: { tipo: 'estudante', numero: 'E-ANTIGO', nome: 'Conta Antiga', email: 'antiga@esgfaa.gov.ao', senha: 'x', dados: { telefone: '+244 900 000 000' } } })
    assert.ok((await cifrarExistentes(amb.contentor.prismaBase, amb.contentor.cifraDados)) >= 1)
    const b = await amb.contentor.prismaBase.contaPortal.findUnique({ where: { id: c.id } })
    assert.ok(CifraDados.cifrado(b.dados))
    assert.equal((await amb.contentor.prisma.contaPortal.findUnique({ where: { id: c.id } })).dados.telefone, '+244 900 000 000')
    assert.equal(await cifrarExistentes(amb.contentor.prismaBase, amb.contentor.cifraDados), 0)
  })
})

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const assinar = (data, corpo, chave = CHAVE) => crypto.createHmac('sha256', chave).update(`${data}.${corpo}`).digest('hex')
const agora = () => String(Math.floor(Date.now() / 1000))

/*
  O Sistema de Gestão de Pessoal (rede interna) envia os docentes e estudantes; o portal cria ou atualiza
  as contas. Só aceita pedidos assinados com a chave partilhada e recentes.
*/
describe('Entrada do Sistema de Gestão de Pessoal', () => {
  let amb
  const enviar = (pessoas, { data = agora(), chave = CHAVE, corpo } = {}) => {
    const c = corpo ?? JSON.stringify({ pessoas })
    return amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, c, chave)).send(c)
  }
  before(async () => { amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } }) })
  after(() => amb.fechar())

  it('cria a conta do docente (entra com o e-mail como palavra-passe inicial), atualiza e desativa', async () => {
    const p = { ref: 'pessoal-1', tipo: 'docente', nome: 'Coronel António Kiala', email: 'kiala@esgfaa.gov.ao', ativo: true, dados: { posto: 'Coronel', ramo: 'EXE', nip: 'NIP1' } }
    const r = await enviar([p])
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.resultados[0].ok, true)
    const conta = await amb.contentor.repositorios.contasPortal.porEmail('kiala@esgfaa.gov.ao')
    assert.equal(conta.tipo, 'docente')
    assert.equal(conta.dados.posto, 'Coronel')
    assert.equal((await amb.http().post('/api/portal/entrar').send({ email: p.email, senha: p.email })).status, 200)

    await enviar([{ ...p, dados: { ...p.dados, posto: 'Brigadeiro' } }]).expect(200)
    assert.equal((await amb.contentor.repositorios.contasPortal.porEmail(p.email)).dados.posto, 'Brigadeiro')
    await enviar([{ ...p, ativo: false }]).expect(200)
    assert.equal((await amb.contentor.repositorios.contasPortal.porEmail(p.email)).ativo, false)
  })

  it('a fotografia vem do Pessoal: guarda-se, vê-se no painel e no portal, e apaga-se', async () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString('base64')
    const p = { ref: 'pessoal-70', tipo: 'estudante', nome: 'Major Foto de Teste', email: 'foto.teste@esgfaa.gov.ao', ativo: true, foto: { id: 'abc.jpg', dados: jpg } }
    const contaId = (await enviar([p]).expect(200)).body.resultados[0].contaId
    const adm = amb.com(await amb.entrar())
    const f = await adm.get(`/api/admin/academico/contas/${contaId}/foto`).expect(200)
    assert.equal(f.headers['content-type'], 'image/jpeg')
    assert.ok((await adm.get('/api/admin/academico/contas?tipo=estudante')).body.find((c) => c.id === contaId).temFoto)
    const portal = amb.com((await amb.http().post('/api/portal/entrar').send({ email: p.email, senha: p.email })).body.token)
    assert.equal((await portal.get('/api/portal/eu/foto')).status, 200)
    assert.equal((await enviar([{ ...p, foto: { id: 'x.jpg', dados: Buffer.from('não é imagem').toString('base64') } }])).body.resultados[0].ok, false)
    await enviar([{ ...p, foto: null }]).expect(200)
    assert.equal((await adm.get(`/api/admin/academico/contas/${contaId}/foto`)).status, 404)
  })

  it('mudança de e-mail: a conta é reconhecida pelo id e não se cria outra', async () => {
    const p = { ref: 'pessoal-50', tipo: 'docente', nome: 'Major Carlos Mendes Neto', email: 'c.mendes@esgfaa.gov.ao', ativo: true }
    const contaId = (await enviar([p]).expect(200)).body.resultados[0].contaId
    const r = await enviar([{ ...p, contaId, email: 'carlos.mendes@esgfaa.gov.ao' }]).expect(200)
    assert.equal(r.body.resultados[0].contaId, contaId)
    assert.equal(await amb.contentor.repositorios.contasPortal.porEmail('c.mendes@esgfaa.gov.ao'), null)
    assert.equal((await amb.contentor.repositorios.contasPortal.porEmail('carlos.mendes@esgfaa.gov.ao')).id, contaId)
  })

  it('e-mail de fora da Escola volta como erro dessa pessoa, sem parar as outras', async () => {
    const r = await enviar([
      { ref: 'pessoal-2', tipo: 'estudante', nome: 'Pessoa de Fora Qualquer', email: 'x@gmail.com', ativo: true },
      { ref: 'pessoal-3', tipo: 'estudante', nome: 'Capitão Pedro Neto Lopes', email: 'pedro.lopes@esgfaa.gov.ao', ativo: true },
    ]).expect(200)
    assert.deepEqual(r.body.resultados.map((x) => x.ok), [false, true])
  })

  it('recusa assinatura errada, pedido antigo (repetição) e corpo alterado', async () => {
    const p = [{ ref: 'pessoal-9', tipo: 'docente', nome: 'Docente Intruso Teste', email: 'intruso@esgfaa.gov.ao', ativo: true }]
    assert.equal((await enviar(p, { chave: 'outra-chave-qualquer-com-mais-de-32-caracteres' })).status, 401)
    assert.equal((await enviar(p, { data: String(Math.floor(Date.now() / 1000) - 600) })).status, 401)
    const data = agora()
    const original = JSON.stringify({ pessoas: p })
    const r = await amb.http().post('/api/integracao/pessoal/contas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, original)).send(original.replace('docente', 'estudante'))
    assert.equal(r.status, 401)
    assert.equal(await amb.contentor.repositorios.contasPortal.porEmail('intruso@esgfaa.gov.ao'), null)
  })

  it('sem chave configurada a entrada não existe', async () => {
    const outro = await criarAmbiente()
    try {
      assert.equal((await outro.http().post('/api/integracao/pessoal/contas').send({})).status, 404)
    } finally { await outro.fechar() }
  })

  it('quem assina os diplomas vem do Pessoal (quem ocupa o cargo); sem isso, o nome escrito no painel', async () => {
    const admin = amb.com(await amb.entrar())
    let d = (await admin.get('/api/admin/academico/documentos-academicos').expect(200)).body
    assert.equal(d.comandante.origem, 'manual')
    const corpo = JSON.stringify({ assinaturas: {
      comandante: { cargo: 'O COMANDANTE DA ESG', nome: 'Nome Fictício do Comandante', posto: 'General', origem: 'titular' },
      directorEnsino: { cargo: 'O DIRECTOR DE ENSINO', nome: '', posto: '', origem: 'manual' },
    } })
    const data = agora()
    // sem a assinatura do pedido, não entra
    assert.equal((await amb.http().post('/api/integracao/pessoal/assinaturas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', '0'.repeat(64)).send(corpo)).status, 401)
    await amb.http().post('/api/integracao/pessoal/assinaturas').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinar(data, corpo)).send(corpo).expect(200)
    d = (await admin.get('/api/admin/academico/documentos-academicos').expect(200)).body
    assert.deepEqual([d.comandante.nome, d.comandante.origem], ['Nome Fictício do Comandante', 'pessoal'])
    assert.equal(d.directorEnsino.origem, 'manual') // vago no Pessoal: escreve-se no painel
    // o nome do Pessoal não se sobrepõe pelo painel
    await admin.put('/api/admin/academico/documentos-academicos').send({ comandante: { cargo: 'X', nome: 'Outro', posto: 'Y', origem: 'pessoal' } }).expect(200)
    assert.equal((await admin.get('/api/admin/academico/documentos-academicos')).body.comandante.nome, 'Nome Fictício do Comandante')
  })
})

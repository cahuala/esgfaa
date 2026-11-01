import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

describe('registo do docente com os campos da ficha de cadastramento', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('guarda BI (emissão, validade, local), nascimento, sangue, contactos, incorporação e categoria', async () => {
    const corpo = {
      tipo: 'militar', vinculo: 'docente', nome: 'Domingos Teste Cadastro', ramo: 'EXE', posto: 'coronel', fps: 'QP', nip: 'NIP9901',
      bi: '001234567LA041', biEmitidoEm: '2023-04-14', biValidade: '2033-04-13', biLocalEmissao: 'Luanda', paisNascimento: 'Angola', provincia: 'Huíla', naturalidade: 'Lubango',
      grupoSanguineo: 'O+', telefone: '923000001', telefoneAlternativo: '955000002', emailPessoal: 'pessoal.teste@exemplo.ao', email: '', morada: 'Luanda',
      dataIngresso: '1999-04-29', tipoDocente: 'efectivo', categoriaDocente: 'Assistente', funcaoActual: 'Chefe de departamento',
    }
    const r = (await adm.post('/api/pessoas').send(corpo).expect(201)).body
    const p = (await adm.get(`/api/pessoas/${r.id}`).expect(200)).body
    for (const k of ['biLocalEmissao', 'paisNascimento', 'naturalidade', 'grupoSanguineo', 'telefoneAlternativo', 'emailPessoal', 'categoriaDocente', 'funcaoActual']) assert.equal(p[k], corpo[k], k)
    for (const k of ['biEmitidoEm', 'biValidade', 'dataIngresso']) assert.equal(String(p[k]).slice(0, 10), corpo[k], k)
    // o e-mail pessoal fica cifrado na base de dados
    const cru = await amb.contentor.bd.$queryRaw`SELECT email_pessoal FROM pessoas WHERE id = ${r.id}`
    assert.notEqual(cru[0].email_pessoal, corpo.emailPessoal)
  })

  it('as categorias do docente seguem o Decreto Presidencial n.º 191/18', async () => {
    const ref = (await adm.get('/api/referencias').expect(200)).body
    assert.deepEqual(ref.categoriasDocente, ['Assistente estagiário', 'Assistente', 'Professor auxiliar', 'Professor associado', 'Professor catedrático'])
    assert.ok(ref.categoriasDocenteContratado.includes('Professor visitante'))
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'docente', nome: 'Rosa Teste Cadastro', emailPessoal: 'nao-e-email' }).expect(400)
  })
})

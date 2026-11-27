import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { ID_ONLINE } from '../../src/infraestrutura/replicacao/motor.js'

/*
  Os sistemas separados, cada um com a sua base de dados: a Gestão Escolar e a Gestão do Site (internos) trocam
  com o servidor online (o site público e o Portal). Cada um envia o que é seu e só se aplica o que é de quem envia.
*/
const CHAVE = 'chave-da-replicacao-entre-os-sistemas-de-teste-32+'

// o fetch dos sistemas internos vai ter à API do servidor online (como pela rede)
const pelaRede = (online) => async (url, op) => {
  const caminho = new URL(url).pathname
  let pedido = online.http().post(caminho)
  for (const [k, v] of Object.entries(op.headers)) pedido = pedido.set(k, v)
  const r = await pedido.send(op.body)
  return { ok: r.status < 400, status: r.status, text: async () => r.text, json: async () => r.body }
}

describe('Sistemas separados: Gestão Escolar, Gestão do Site e servidor online', () => {
  let escolar, site, online, biblioteca
  const avisos = []
  const p = (amb) => amb.contentor.prisma
  before(async () => {
    online = await criarAmbiente({ env: { SISTEMA: 'online', REPLICACAO_CHAVE: CHAVE }, externos: { push: { chavePublica: 'x', enviar: async (s, n) => { avisos.push({ s: s.endpoint, ...n }); return 'ok' } } } })
    escolar = await criarAmbiente({ env: { SISTEMA: 'escolar', REPLICACAO_CHAVE: CHAVE, REPLICACAO_URL: 'https://portal.teste.ao' } })
    site = await criarAmbiente({ env: { SISTEMA: 'site', REPLICACAO_CHAVE: CHAVE, REPLICACAO_URL: 'https://portal.teste.ao' } })
    biblioteca = await criarAmbiente({ env: { SISTEMA: 'biblioteca', REPLICACAO_CHAVE: CHAVE, REPLICACAO_URL: 'https://portal.teste.ao' } })
    for (const a of [online, escolar, site, biblioteca]) await a.contentor.replicacao.preparar()
    biblioteca.contentor.replicacao.buscar = pelaRede(online)
    escolar.contentor.replicacao.buscar = pelaRede(online)
    site.contentor.replicacao.buscar = pelaRede(online)
  })
  after(async () => { for (const a of [online, escolar, site, biblioteca]) await a?.fechar() })

  it('cada instalação só serve o que é seu (o painel não está no servidor online)', async () => {
    assert.equal((await online.http().post('/api/admin/entrar').send({ email: 'x@y.ao', senha: 'z' })).status, 404)
    assert.equal((await escolar.http().get('/api/portal/eu')).status, 404)
    assert.equal((await online.http().get('/api/saude').expect(200)).body.sistema, 'online')
    // a troca exige a assinatura
    assert.equal((await online.http().post('/api/replicacao/trocar').set('Content-Type', 'application/json').set('X-Sistema', 'escolar').set('X-Data', String(Math.floor(Date.now() / 1000))).set('X-Assinatura', 'errada').send('{}')).status, 401)
  })

  it('a Gestão Escolar envia contas, turmas e matrículas; o que o portal muda volta, só nos campos dele', async () => {
    const conta = await p(escolar).contaPortal.create({ data: { tipo: 'estudante', numero: 'E2026-0001', nome: 'Estudante Replicado', email: 'estudante.replicado@esgfaa.gov.ao', senha: 'hash-inicial', dados: { nip: 'REP001', posto: 'Major' } } })
    const turma = await p(escolar).turma.create({ data: { curso: 'curso-x', anoLetivo: '2026/2027', nome: '32.º CSCD' } })
    await p(escolar).matricula.create({ data: { estudanteId: conta.id, turmaId: turma.id } })
    const t1 = await escolar.contentor.replicacao.trocar()
    assert.deepEqual(t1.erros, [])
    const noOnline = await p(online).contaPortal.findUnique({ where: { id: conta.id } })
    assert.deepEqual([noOnline.nome, noOnline.dados.nip], ['Estudante Replicado', 'REP001'])
    assert.equal(await p(online).matricula.count({ where: { estudanteId: conta.id, turmaId: turma.id } }), 1)
    // no portal: muda a palavra-passe (é do portal) e tenta mudar o nome (não é: não passa)
    await p(online).contaPortal.update({ where: { id: conta.id }, data: { senha: 'hash-novo', nome: 'Nome Mudado no Portal' } })
    await escolar.contentor.replicacao.trocar()
    const naGestao = await p(escolar).contaPortal.findUnique({ where: { id: conta.id } })
    assert.deepEqual([naGestao.senha, naGestao.nome], ['hash-novo', 'Estudante Replicado'])
    // a Gestão apaga a matrícula: apaga-se também no portal
    await p(escolar).matricula.deleteMany({ where: { estudanteId: conta.id } })
    await escolar.contentor.replicacao.trocar()
    assert.equal(await p(online).matricula.count({ where: { estudanteId: conta.id } }), 0)
  })

  it('o que nasce no portal chega à Gestão (numerado a partir de mil milhões); as notas: vale a mais recente', async () => {
    const turma = await p(escolar).turma.findFirst({ where: { nome: '32.º CSCD' } })
    const conta = await p(escolar).contaPortal.findFirst({ where: { numero: 'E2026-0001' } })
    const uc = await p(escolar).unidadeCurricular.create({ data: { turmaId: turma.id, codigo: 'GP', nome: 'Gestão de Pessoas' } })
    await escolar.contentor.replicacao.trocar()
    // o docente, no portal, cria a prova e lança a nota
    const prova = await p(online).avaliacaoUc.create({ data: { cadeiraId: uc.id, tipo: 'TAI', titulo: 'TAI 1' } })
    assert.ok(prova.id >= ID_ONLINE, `id ${prova.id}`)
    await p(online).notaAvaliacaoUc.create({ data: { avaliacaoId: prova.id, estudanteId: conta.id, nota: 14 } })
    await p(online).notificacao.create({ data: { contaId: conta.id, tipo: 'notas', titulo: 'Nota lançada' } })
    await escolar.contentor.replicacao.trocar()
    const nota = await p(escolar).notaAvaliacaoUc.findUnique({ where: { avaliacaoId_estudanteId: { avaliacaoId: prova.id, estudanteId: conta.id } } })
    assert.equal(Number(nota.nota), 14)
    assert.equal(await p(escolar).notificacao.count({ where: { contaId: conta.id } }), 1)
    // a Administração Escolar corrige (mais recente): vai para o portal; uma mudança antiga do portal não a desfaz
    await p(escolar).notaAvaliacaoUc.update({ where: { avaliacaoId_estudanteId: { avaliacaoId: prova.id, estudanteId: conta.id } }, data: { nota: 15 } })
    await escolar.contentor.replicacao.trocar()
    assert.equal(Number((await p(online).notaAvaliacaoUc.findFirst({ where: { avaliacaoId: prova.id } })).nota), 15)
    // a publicação (Comandante, na Gestão) chega ao portal; o título da prova (do docente) não se muda da Gestão
    await p(escolar).avaliacaoUc.update({ where: { id: prova.id }, data: { publicadaEm: new Date('2027-01-10T10:00:00Z'), titulo: 'Mudado na Gestão' } })
    await escolar.contentor.replicacao.trocar()
    const pr = await p(online).avaliacaoUc.findUnique({ where: { id: prova.id } })
    assert.deepEqual([pr.publicadaEm?.toISOString(), pr.titulo], ['2027-01-10T10:00:00.000Z', 'TAI 1'])
  })

  it('a Gestão do Site publica no site público; os cursos chegam também à Gestão Escolar; os comentários voltam', async () => {
    await p(site).item.create({ data: { colecao: 'cursos', id: 'curso-replicado', dados: { nome: 'Curso Replicado', sigla: 'CREP' }, ordem: 1, estado: 'publicado' } })
    await p(site).pagina.upsert({ where: { chave: 'inicio' }, create: { chave: 'inicio', dados: { titulo: 'Página do site' } }, update: { dados: { titulo: 'Página do site' } } })
    const t = await site.contentor.replicacao.trocar()
    assert.deepEqual(t.erros, [])
    assert.equal((await p(online).item.findUnique({ where: { colecao_id: { colecao: 'cursos', id: 'curso-replicado' } } }))?.dados?.sigla, 'CREP')
    await escolar.contentor.replicacao.trocar()
    assert.ok(await p(escolar).item.findUnique({ where: { colecao_id: { colecao: 'cursos', id: 'curso-replicado' } } }), 'o curso chegou à Gestão Escolar (pelo servidor online)')
    // um visitante comenta no site público: o comentário vai para a Gestão do Site (moderação), não para a Gestão Escolar
    const c = await p(online).comentario.create({ data: { colecao: 'cursos', itemId: 'curso-replicado', nome: 'Visitante', texto: 'Bom curso', ip: '1.2.3.4' } })
    await site.contentor.replicacao.trocar()
    await escolar.contentor.replicacao.trocar()
    assert.ok(await p(site).comentario.findUnique({ where: { id: c.id } }))
    assert.equal(await p(escolar).comentario.count(), 0)
    // a Gestão do Site aprova: o estado vai para o site público
    await p(site).comentario.update({ where: { id: c.id }, data: { estado: 'aprovado', revistoPor: 'Moderador' } })
    await site.contentor.replicacao.trocar()
    assert.equal((await p(online).comentario.findUnique({ where: { id: c.id } })).estado, 'aprovado')
  })

  it('os ficheiros do portal (materiais, entregas) chegam à Gestão com o conteúdo', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const rel = '2027/01/material-teste.pdf'
    const abs = online.contentor.privados.absoluto(rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, '%PDF-1.4 material de teste')
    await p(online).ficheiro.create({ data: { id: '0b6f1d1e-1111-4222-8333-444455556666', caminho: rel, nome: 'material.pdf', tipo: 'application/pdf', tamanho: 26 } })
    await escolar.contentor.replicacao.trocar()
    assert.ok(await p(escolar).ficheiro.findUnique({ where: { id: '0b6f1d1e-1111-4222-8333-444455556666' } }))
    assert.equal(fs.readFileSync(escolar.contentor.privados.absoluto(rel), 'utf8'), '%PDF-1.4 material de teste')
  })

  it('as imagens do site (uploads) chegam ao servidor online', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const f = path.join(site.contentor.config.pastaUploads, '2027', '01', 'capa.webp')
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, 'imagem-da-noticia')
    const t = await site.contentor.replicacao.trocar()
    assert.ok(t.ficheiros >= 1)
    assert.equal(fs.readFileSync(path.join(online.contentor.config.pastaUploads, '2027', '01', 'capa.webp'), 'utf8'), 'imagem-da-noticia')
    // na troca seguinte já não vai outra vez
    assert.equal((await site.contentor.replicacao.trocar()).ficheiros, 0)
  })

  it('a Biblioteca: o catálogo chega ao portal (os estudantes leem e reservam); as contas chegam à Biblioteca', async () => {
    const conta = await p(escolar).contaPortal.findFirst({ where: { numero: 'E2026-0001' } })
    // as contas dos estudantes chegam à Biblioteca (vindas da Gestão Escolar, pelo servidor online)
    await escolar.contentor.replicacao.trocar()
    await biblioteca.contentor.replicacao.trocar()
    assert.ok(await p(biblioteca).contaPortal.findUnique({ where: { id: conta.id } }), 'a conta chegou à Biblioteca')
    assert.equal(await p(biblioteca).turma.count(), 0, 'as turmas não vão para a Biblioteca')
    const obra = await p(biblioteca).obra.create({ data: { tipo: 'livro', titulo: 'Arte da Guerra', autores: ['Sun Tzu'] } })
    await p(biblioteca).exemplar.create({ data: { obraId: obra.id, codigo: 'T-0001' } })
    await biblioteca.contentor.replicacao.trocar()
    assert.equal((await p(online).obra.findUnique({ where: { id: obra.id } }))?.titulo, 'Arte da Guerra')
    // o estudante reserva no portal; a Biblioteca recebe e põe «pronta»; o portal vê
    const r = await p(online).reserva.create({ data: { obraId: obra.id, contaId: conta.id, criadaEm: new Date() } })
    await biblioteca.contentor.replicacao.trocar()
    assert.ok(await p(biblioteca).reserva.findUnique({ where: { id: r.id } }))
    await p(biblioteca).reserva.update({ where: { id: r.id }, data: { estado: 'pronta', prontaEm: new Date() } })
    await biblioteca.contentor.replicacao.trocar()
    assert.equal((await p(online).reserva.findUnique({ where: { id: r.id } })).estado, 'pronta')
    // a Gestão Escolar não recebe a biblioteca
    await escolar.contentor.replicacao.trocar()
    assert.equal(await p(escolar).obra.count(), 0)
    const eu = (await biblioteca.http().get('/api/admin/eu').set('Authorization', `Bearer ${(await biblioteca.criarUtilizador('comandante')).token}`).expect(200)).body
    assert.ok(eu.permissoes.includes('biblioteca.gerir') && !eu.permissoes.some((x) => x.startsWith('academico.')))
  })

  it('um aviso criado na Gestão Escolar vai para o telemóvel do estudante (as subscrições estão no portal)', async () => {
    const conta = await p(escolar).contaPortal.findFirst({ where: { numero: 'E2026-0001' } })
    await p(online).subscricaoPush.create({ data: { contaId: conta.id, endpoint: 'https://push.teste/aparelho-1', p256dh: 'p', auth: 'a' } })
    await p(escolar).notificacao.create({ data: { contaId: conta.id, tipo: 'notas', titulo: 'Notas publicadas: GP', texto: 'Já pode ver a nota.' } })
    await escolar.contentor.replicacao.trocar()
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(avisos.map((a) => [a.s, a.titulo]), [['https://push.teste/aparelho-1', 'Notas publicadas: GP']])
  })

  it('o painel de cada sistema só trata do que é seu (o Comandante vê tudo o que lá está)', async () => {
    const cmdtEscolar = await escolar.criarUtilizador('comandante')
    const eu = (await escolar.http().get('/api/admin/eu').set('Authorization', `Bearer ${cmdtEscolar.token}`).expect(200)).body
    assert.equal(eu.sistema, 'escolar')
    assert.ok(eu.permissoes.includes('academico.homologar') && eu.permissoes.includes('cursos.ver'))
    assert.ok(!eu.permissoes.includes('noticias.publicar') && !eu.permissoes.includes('publicacoes.aprovar'))
    const cmdtSite = await site.criarUtilizador('comandante')
    const doSite = (await site.http().get('/api/admin/eu').set('Authorization', `Bearer ${cmdtSite.token}`).expect(200)).body
    assert.ok(doSite.permissoes.includes('publicacoes.aprovar') && !doSite.permissoes.some((x) => x.startsWith('academico.')))
  })

  it('o centro de cibersegurança vê todos os sistemas (domínio, se respondem, servidor, segurança, trocas)', async () => {
    const cmdt = await escolar.criarUtilizador('comandante')
    const auth = { Authorization: `Bearer ${cmdt.token}` }
    // pela «rede»: o servidor online responde; o Pessoal (endereço sem ninguém) não
    escolar.contentor.servicos.monitorizacao.buscar = async (url, op = {}) => {
      if (!url.startsWith('https://portal.teste.ao')) throw Object.assign(new Error('ligação recusada'), { cause: { code: 'ECONNREFUSED' } })
      let pedido = online.http().get(new URL(url).pathname)
      for (const [k, v] of Object.entries(op.headers ?? {})) pedido = pedido.set(k, v)
      const r = await pedido
      return { ok: r.status < 400, status: r.status, json: async () => r.body }
    }
    await escolar.http().put('/api/admin/monitorizacao/sistemas').set(auth).send({ sistemas: [
      { nome: 'Sistema de Gestão Escolar', tipo: 'escolar', dominio: 'escolar.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3001' },
      { nome: 'Servidor online', tipo: 'online', dominio: 'portal.teste.ao', endereco: 'https://portal.teste.ao' },
      { nome: 'Sistema de Gestão de Pessoal', tipo: 'pessoal', dominio: 'esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:9' },
    ] }).expect(200)
    const m = (await escolar.http().get('/api/admin/monitorizacao').set(auth).expect(200)).body
    const [eu, on, pes] = m.sistemas
    assert.deepEqual([eu.ok, eu.local, eu.estado.sistema, eu.dominio], [true, true, 'escolar', 'escolar.esg.emfaa.gov.ao'])
    assert.ok(eu.estado.saude.memoria.total > 0 && eu.estado.baseDados.tamanho > 0)
    assert.deepEqual([on.ok, on.estado.sistema], [true, 'online'])
    assert.equal(pes.ok, false)
    assert.ok(m.alertas.some((x) => x.nivel === 'critico' && x.sistema === 'Sistema de Gestão de Pessoal'))
    // sem assinatura, o estado do servidor não se mostra a ninguém
    assert.equal((await online.http().get('/api/monitor/estado')).status, 401)
    // só quem tem a segurança vê
    const prof = await escolar.criarUtilizador('director_ensino')
    assert.equal((await escolar.http().get('/api/admin/monitorizacao').set('Authorization', `Bearer ${prof.token}`)).status, 403)
  })

  it('Sistema de Cibersegurança: só observa, vigia todos e mostra a comunicação e as actualizações', async () => {
    const ciber = await criarAmbiente({ env: { SISTEMA: 'ciberseguranca', REPLICACAO_CHAVE: CHAVE, REPLICACAO_URL: 'https://portal.teste.ao' } })
    try {
      assert.equal(ciber.contentor.replicacao, null)
      // pela «rede»: a Gestão Escolar e o servidor online respondem ao pedido assinado
      ciber.contentor.servicos.monitorizacao.buscar = async (url, op = {}) => {
        const amb = url.startsWith('https://portal.teste.ao') ? online : url.startsWith('http://127.0.0.1:3001') ? escolar : null
        if (!amb) throw Object.assign(new Error('ligação recusada'), { cause: { code: 'ECONNREFUSED' } })
        let pedido = amb.http().get(new URL(url).pathname)
        for (const [k, v] of Object.entries(op.headers ?? {})) pedido = pedido.set(k, v)
        const r = await pedido
        return { ok: r.status < 400, status: r.status, json: async () => r.body }
      }
      const u = await ciber.criarUtilizador('ciberseguranca')
      const auth = { Authorization: `Bearer ${u.token}` }
      const eu = (await ciber.http().get('/api/admin/eu').set(auth).expect(200)).body
      assert.equal(eu.sistema, 'ciberseguranca')
      assert.ok(eu.permissoes.every((x) => ['seguranca', 'utilizadores', 'papeis', 'atividades'].includes(x.split('.')[0])), eu.permissoes.join())
      await ciber.http().put('/api/admin/monitorizacao/sistemas').set(auth).send({ sistemas: [
        { nome: 'Sistema de Cibersegurança', tipo: 'ciberseguranca', dominio: 'ciberseguranca.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3005' },
        { nome: 'Sistema de Gestão Escolar', tipo: 'escolar', dominio: 'escolar.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3001' },
        { nome: 'Servidor online', tipo: 'online', dominio: 'portal.teste.ao', endereco: 'https://portal.teste.ao' },
        { nome: 'Sistema de Biblioteca', tipo: 'biblioteca', dominio: 'biblioteca.esg.emfaa.gov.ao', endereco: 'http://127.0.0.1:3004' },
      ] }).expect(200)
      const m = (await ciber.http().get('/api/admin/monitorizacao').set(auth).expect(200)).body
      assert.deepEqual(m.sistemas.map((x) => x.ok), [true, true, true, false])
      // a comunicação: as trocas que a Gestão Escolar e o servidor online registaram, de quem para quem e o quê
      assert.ok(m.trocas.some((t) => t.de === 'escolar' && t.para === 'online'), JSON.stringify(m.trocas.slice(0, 2)))
      assert.ok(m.trocas.some((t) => t.para === 'online' && Object.keys({ ...t.enviado, ...t.recebido }).length))
      assert.ok(m.mudancas.some((x) => x.n > 0))
      assert.ok(Array.isArray(m.actualizacoes) && Array.isArray(m.actividade))
      // a disponibilidade conta-se a cada verificação; a que deixou de responder fica no registo de actividades
      const id = m.sistemas[3].id
      assert.equal(m.disponibilidade[id].percentagem, 0)
      // só o painel: o site público e o Portal não são deste sistema
      assert.equal((await ciber.http().get('/api/portal/eu')).status, 404)
    } finally {
      await ciber.fechar()
    }
  })

  it('o estado da replicação diz até onde se trocou', async () => {
    const e = await escolar.contentor.replicacao.estado()
    assert.equal(e.pares[0].par, 'online')
    assert.equal(e.pares[0].ultimoErro, '')
  })
})

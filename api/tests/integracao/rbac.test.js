import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, noticia } from '../apoio/ambiente.js'

describe('permissões (RBAC) e utilizadores', () => {
  let amb, admin, chefe, redator, moderador, analista
  before(async () => {
    amb = await criarAmbiente()
    admin = await amb.entrar()
    chefe = await amb.criarUtilizador('editor_chefe')
    redator = await amb.criarUtilizador('redator')
    moderador = await amb.criarUtilizador('moderador')
    analista = await amb.criarUtilizador('analista')
  })
  after(() => amb.fechar())

  it('redator só cria rascunhos, mesmo que peça publicação', async () => {
    const r = await amb.com(redator.token).post('/api/admin/colecoes/noticias').send({ ...noticia({ titulo: 'Rascunho do redator' }), _estado: 'publicado' })
    assert.equal(r.status, 201)
    assert.equal(r.body._estado, 'rascunho')
  })

  it('redator não altera conteúdos já publicados', async () => {
    const pub = await amb.com(chefe.token).post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Publicada pelo chefe' }))
    await amb.aprovar('noticias', pub.body.slug)
    const r = await amb.com(redator.token).put(`/api/admin/colecoes/noticias/${pub.body.slug}`).send(noticia({ titulo: 'Alterada' }))
    assert.equal(r.status, 403)
    assert.match(r.body.erro, /já está publicado/)
  })

  it('editor-chefe envia os rascunhos ao Comandante, que os publica', async () => {
    const rasc = await amb.com(redator.token).post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Para publicar' }))
    const r = await amb.com(chefe.token).put(`/api/admin/colecoes/noticias/${rasc.body.slug}`).send({ ...rasc.body, _estado: 'publicado' })
    assert.equal(r.status, 200)
    assert.deepEqual([r.body._estado, r.body._aprovacao.estado], ['rascunho', 'pendente'])
    assert.equal((await amb.aprovar('noticias', rasc.body.slug))._estado, 'publicado')
    const log = await amb.contentor.repositorios.atividades.listar({ acao: 'aprovar_publicacao' })
    assert.equal(log.linhas[0].alvo_id, rasc.body.slug)
  })

  it('responsável de cibersegurança vê o centro de segurança e o registo de atividades, e nada mais', async () => {
    const ciber = amb.com((await amb.criarUtilizador('ciberseguranca')).token)
    assert.equal((await ciber.get('/api/admin/seguranca')).status, 200)
    assert.equal((await ciber.get('/api/admin/atividades')).status, 200)
    assert.equal((await ciber.get('/api/admin/utilizadores')).status, 403)
    assert.equal((await ciber.post('/api/admin/colecoes/noticias').send(noticia())).status, 403)
    assert.equal((await ciber.get('/api/admin/estatisticas')).status, 403)
  })

  it('moderador não cria conteúdos; analista só vê estatísticas', async () => {
    assert.equal((await amb.com(moderador.token).post('/api/admin/colecoes/noticias').send(noticia())).status, 403)
    assert.equal((await amb.com(analista.token).get('/api/admin/estatisticas')).status, 200)
    assert.equal((await amb.com(analista.token).get('/api/admin/utilizadores')).status, 403)
    assert.equal((await amb.com(analista.token).delete('/api/admin/colecoes/noticias/x')).status, 403)
    assert.equal((await amb.com(redator.token).get('/api/admin/atividades')).status, 403)
  })

  it('o painel só mostra o que cada papel pode ver', async () => {
    const r = await amb.com(analista.token).get('/api/admin/painel')
    assert.equal(r.status, 200)
    assert.ok('visitas' in r.body)
    assert.ok(!('cursos' in r.body.totais))
    assert.ok(!('ultimosComentarios' in r.body))
  })

  it('editor-chefe não cria administradores', async () => {
    const dados = { nome: 'Novo Admin', email: 'novo.admin@teste.ao', papel: 'administrador', senha: 'Segura2026xyz' }
    const r = await amb.com(chefe.token).post('/api/admin/utilizadores').send(dados)
    assert.ok([403].includes(r.status), String(r.status))
  })

  it('cria utilizadores com validação (e-mail, papel, palavra-passe, duplicados)', async () => {
    const base = { nome: 'Rita Gomes', email: 'rita@teste.ao', papel: 'redator', senha: 'Segura2026xyz' }
    assert.equal((await amb.com(admin).post('/api/admin/utilizadores').send({ ...base, email: 'invalido' })).status, 400)
    assert.equal((await amb.com(admin).post('/api/admin/utilizadores').send({ ...base, papel: 'inexistente' })).status, 400)
    assert.equal((await amb.com(admin).post('/api/admin/utilizadores').send({ ...base, senha: 'fraca12' })).status, 400)
    await amb.oComandante()
    const ok = await amb.com(admin).post('/api/admin/utilizadores').send(base)
    assert.equal(ok.status, 201)
    assert.ok(!('senha' in ok.body))
    assert.equal((await amb.com(admin).post('/api/admin/utilizadores').send({ ...base, email: 'RITA@teste.ao' })).status, 409)

    // a conta nova espera o Comandante: até lá não entra
    assert.equal(ok.body.ativo, false)
    assert.equal(ok.body.aprovacao.tipo, 'criar')
    const espera = await amb.http().post('/api/admin/entrar').send({ email: 'rita@teste.ao', senha: 'Segura2026xyz' })
    assert.equal(espera.status, 403)
    assert.match(espera.body.erro, /aprovação do Comandante/)
    // o administrador não a ativa por fora
    assert.equal((await amb.com(admin).put(`/api/admin/utilizadores/${ok.body.id}`).send({ ativo: true })).status, 400)
    await amb.aprovar('utilizadores', ok.body.id)

    // quem foi criado por outra pessoa tem de mudar a palavra-passe
    const t = await amb.entrar('rita@teste.ao', 'Segura2026xyz')
    assert.equal((await amb.com(t).get('/api/admin/eu')).body.deveMudarSenha, true)
  })

  it('mudar o papel (com o Comandante) termina as sessões da conta e aplica as novas permissões', async () => {
    const cmd = await amb.oComandante()
    const u = await amb.criarUtilizador('redator')
    assert.equal((await amb.com(u.token).get('/api/admin/eu')).status, 200)
    const r = await amb.com(admin).put(`/api/admin/utilizadores/${u.id}`).send({ papel: 'moderador' })
    assert.equal(r.status, 200)
    // fica pedido: o papel não muda até o Comandante aprovar
    assert.equal(r.body.papel, 'redator')
    assert.deepEqual([r.body.aprovacao.tipo, r.body.aprovacao.papel, r.body.aprovacao.de], ['papel', 'moderador', 'redator'])
    assert.equal((await amb.com(u.token).get('/api/admin/eu')).status, 200)
    const lista = (await amb.com(cmd.token).get('/api/admin/publicacoes')).body
    assert.ok(lista.some((x) => x.colecao === 'utilizadores' && x.id === String(u.id) && x.tipo === 'papel'))
    assert.equal((await amb.com(cmd.token).get('/api/admin/publicacoes/contagem')).body.contas >= 1, true)
    // o administrador não decide
    assert.equal((await amb.com(admin).post(`/api/admin/publicacoes/utilizadores/${u.id}/decisao`).send({ decisao: 'aprovar' })).status, 403)
    await amb.aprovar('utilizadores', u.id)
    assert.equal((await amb.com(admin).get('/api/admin/utilizadores')).body.find((x) => x.id === u.id).papel, 'moderador')
    assert.equal((await amb.com(u.token).get('/api/admin/eu')).status, 401)
  })

  it('o Comandante recusa: a conta nova não fica; o papel fica como estava', async () => {
    const cmd = await amb.oComandante()
    const nova = (await amb.com(admin).post('/api/admin/utilizadores').send({ nome: 'Conta Recusada', email: 'recusada@teste.ao', papel: 'redator', senha: 'Segura2026xyz' })).body
    const r = await amb.com(cmd.token).post(`/api/admin/publicacoes/utilizadores/${nova.id}/decisao`).send({ decisao: 'recusar', motivo: 'Não autorizado' })
    assert.equal(r.status, 200)
    assert.equal(r.body.apagada, true)
    assert.ok(!(await amb.com(admin).get('/api/admin/utilizadores')).body.some((x) => x.id === nova.id))
    const u = await amb.criarUtilizador('redator')
    await amb.com(admin).put(`/api/admin/utilizadores/${u.id}`).send({ papel: 'moderador' })
    await amb.com(cmd.token).post(`/api/admin/publicacoes/utilizadores/${u.id}/decisao`).send({ decisao: 'recusar' }).expect(200)
    const depois = (await amb.com(admin).get('/api/admin/utilizadores')).body.find((x) => x.id === u.id)
    assert.deepEqual([depois.papel, depois.aprovacao], ['redator', null])
  })

  it('desativar termina as sessões', async () => {
    const u = await amb.criarUtilizador('redator')
    await amb.com(admin).put(`/api/admin/utilizadores/${u.id}`).send({ ativo: false })
    assert.equal((await amb.com(u.token).get('/api/admin/eu')).status, 401)
  })

  it('protege o último administrador e a própria conta', async () => {
    const eu = (await amb.com(admin).get('/api/admin/eu')).body
    assert.equal((await amb.com(admin).put(`/api/admin/utilizadores/${eu.id}`).send({ ativo: false })).status, 400)
    assert.equal((await amb.com(admin).put(`/api/admin/utilizadores/${eu.id}`).send({ papel: 'redator' })).status, 400)
    assert.equal((await amb.com(admin).put('/api/admin/utilizadores/99999').send({ nome: 'X' })).status, 404)
  })

  it('papéis: criar, editar, impedir alterar o administrador e apagar em uso', async () => {
    const criado = await amb.com(admin).post('/api/admin/papeis').send({ nome: 'Revisor', descricao: 'Revê', permissoes: ['artigos.editar', 'inventada.x'] })
    assert.equal(criado.status, 201)
    assert.equal(criado.body.id, 'revisor')
    const lista = (await amb.com(admin).get('/api/admin/papeis')).body
    assert.deepEqual(lista.papeis.find((p) => p.id === 'revisor').permissoes, ['artigos.ver', 'artigos.editar'])
    assert.ok(Array.isArray(lista.recursos))

    assert.equal((await amb.com(admin).put('/api/admin/papeis/revisor').send({ permissoes: ['artigos.publicar'] })).status, 204)
    assert.equal((await amb.com(admin).put('/api/admin/papeis/administrador').send({ permissoes: [] })).status, 400)
    assert.equal((await amb.com(admin).delete('/api/admin/papeis/administrador')).status, 400)
    assert.equal((await amb.com(admin).delete('/api/admin/papeis/redator')).status, 400) // em uso
    assert.equal((await amb.com(chefe.token).post('/api/admin/papeis').send({ nome: 'X' })).status, 403)
    assert.equal((await amb.com(admin).delete('/api/admin/papeis/revisor')).status, 204)
  })

  it('alterar permissões de um papel tem efeito imediato', async () => {
    const u = await amb.criarUtilizador('analista')
    assert.equal((await amb.com(u.token).get('/api/admin/comentarios')).status, 403)
    await amb.com(admin).put('/api/admin/papeis/analista').send({ permissoes: ['estatisticas.ver', 'comentarios.ver'] })
    assert.equal((await amb.com(u.token).get('/api/admin/comentarios')).status, 200)
  })

  it('atividades: filtros, paginação e pesquisa segura', async () => {
    const r = await amb.com(admin).get('/api/admin/atividades?acao=entrar&porPagina=2&pagina=1')
    assert.equal(r.status, 200)
    assert.equal(r.body.linhas.length, 2)
    assert.ok(r.body.total >= 2)
    assert.ok(r.body.linhas.every((l) => l.acao === 'entrar'))
    // "%" na pesquisa é literal, não um curinga
    assert.equal((await amb.com(admin).get('/api/admin/atividades?q=%25')).body.total, 0)
    assert.equal((await amb.com(admin).get('/api/admin/atividades?porPagina=abc&pagina=-1')).status, 200)
  })

  it('exportar uma tabela (Excel ou PDF) fica no registo de atividades, com o filtro', async () => {
    const corpo = { tabela: 'Mensagens do site', formato: 'excel', linhas: 3, filtro: 'pesquisa: «Silva»' }
    assert.equal((await amb.http().post('/api/admin/exportacao').send(corpo)).status, 401)
    assert.equal((await amb.com(redator.token).post('/api/admin/exportacao').send({ ...corpo, formato: 'json' })).status, 400)
    assert.equal((await amb.com(redator.token).post('/api/admin/exportacao').send(corpo)).status, 204)
    const [r] = (await amb.contentor.repositorios.atividades.listar({ acao: 'exportar_tabela' })).linhas
    assert.equal(r.alvo_titulo, 'Mensagens do site')
    assert.match(r.detalhes, /Excel · 3 linha\(s\) · pesquisa: «Silva»/)
  })

  it('o Comandante vê tudo sem poder alterar; o Director de Ensino vê tudo do Ensino', async () => {
    const cmd = amb.com((await amb.criarUtilizador('comandante')).token)
    for (const url of ['/api/admin/utilizadores', '/api/admin/papeis', '/api/admin/atividades', '/api/admin/seguranca', '/api/admin/colecoes/noticias', '/api/admin/comentarios', '/api/admin/estatisticas', '/api/admin/biblioteca', '/api/admin/integridade', '/api/admin/academico/turmas', '/api/admin/academico/contas']) {
      assert.equal((await cmd.get(url)).status, 200, url)
    }
    assert.equal((await cmd.post('/api/admin/utilizadores').send({ nome: 'Nova Pessoa', email: 'nova.pessoa@teste.ao', papel: 'redator', senha: 'Senha-Muito-Segura-2026' })).status, 403)
    assert.equal((await cmd.post('/api/admin/academico/turmas').send({ curso: 'x', anoLetivo: '2026/2027', nome: 'T' })).status, 403)
    const dir = amb.com((await amb.criarUtilizador('director_ensino')).token)
    for (const url of ['/api/admin/academico/turmas', '/api/admin/colecoes/cursos', '/api/admin/integridade', '/api/admin/biblioteca', '/api/admin/academico/contas']) {
      assert.equal((await dir.get(url)).status, 200, url)
    }
    for (const url of ['/api/admin/utilizadores', '/api/admin/seguranca', '/api/admin/colecoes/noticias']) assert.equal((await dir.get(url)).status, 403, url)
  })
})

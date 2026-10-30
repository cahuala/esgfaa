import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'
import { assinar } from '../../src/aplicacao/sincronizacao.js'

// a Escola envia a proposta; o extracto que chega do escalão superior é registado e aplicado
async function porExtracto(adm, propostaId, tipo, numero, data) {
  const e = await adm.post('/api/extractos').field('tipo', tipo).field('numero', numero).field('data', data).field('propostaId', String(propostaId)).expect(201)
  return (await adm.post(`/api/extractos/${e.body.id}/aplicar`).expect(200)).body
}

describe('Sistema de Gestão de Pessoal', () => {
  let amb, adm
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
  })
  after(() => amb.fechar())

  it('só responde na rede interna', async () => {
    const r = await amb.http().get('/api/saude').set('X-Forwarded-For', '8.8.8.8')
    assert.equal(r.status, 200) // sem TRUST_PROXY o cabeçalho é ignorado: conta o IP real (127.0.0.1)
    const fora = await criarAmbiente({ env: { REDES_INTERNAS: '10.0.0.0/8', TRUST_PROXY: '1' } })
    try {
      const x = await fora.http().get('/api/saude').set('X-Forwarded-For', '41.63.0.10')
      assert.equal(x.status, 403)
      assert.equal(x.body.codigo, 'fora_da_rede')
      assert.equal((await fora.http().get('/api/saude').set('X-Forwarded-For', '10.1.2.3')).status, 200)
    } finally { await fora.fechar() }
  })

  it('sem sessão não dá nada; palavra-passe errada bloqueia a conta à 5.ª tentativa', async () => {
    assert.equal((await amb.http().get('/api/pessoas')).status, 401)
    await adm.post('/api/utilizadores').send({ nome: 'Operador Teste', email: 'joao.op@pessoal.ao', papel: 'operador', senha: 'Operador2026x' }).expect(201)
    for (let i = 0; i < 5; i++) assert.equal((await amb.http().post('/api/entrar').send({ email: 'joao.op@pessoal.ao', senha: 'errada' })).status, 401)
    assert.equal((await amb.http().post('/api/entrar').send({ email: 'joao.op@pessoal.ao', senha: 'Operador2026x' })).status, 423)
  })

  it('o utilizador novo tem de mudar a palavra-passe; a consulta não edita', async () => {
    await adm.post('/api/utilizadores').send({ nome: 'Consulta Teste', email: 'ver@pessoal.ao', papel: 'consulta', senha: 'Consulta2026x' }).expect(201)
    const t = await amb.entrar('ver@pessoal.ao', 'Consulta2026x')
    assert.equal((await amb.com(t).get('/api/pessoas')).body.codigo, 'mudar_senha')
    const m = await amb.com(t).post('/api/mudar-senha').send({ atual: 'Consulta2026x', nova: 'NovaSenha2026y' }).expect(200)
    const c = amb.com(m.body.token)
    assert.equal((await c.get('/api/pessoas')).status, 200)
    assert.equal((await c.post('/api/pessoas').send(militar())).status, 403)
  })

  it('o Comandante e o Chefe de Pessoal veem tudo (utilizadores, auditoria, livro de expediente); o Comandante não altera', async () => {
    const conta = async (email, papel) => {
      await adm.post('/api/utilizadores').send({ nome: `${papel} Teste`, email, papel, senha: 'Inicial2026x' }).expect(201)
      const t = await amb.entrar(email, 'Inicial2026x')
      return amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: 'Inicial2026x', nova: 'Segura2026xyz' }).expect(200)).body.token)
    }
    const cmd = await conta('cmd@pessoal.ao', 'comandante')
    const chefe = await conta('chefe@pessoal.ao', 'chefe')
    for (const x of [cmd, chefe]) {
      assert.equal((await x.get('/api/utilizadores')).status, 200)
      assert.equal((await x.get('/api/auditoria')).status, 200)
      assert.equal((await x.get('/api/expediente?caixa=todos')).status, 200)
      assert.equal((await x.get('/api/pessoas')).status, 200)
    }
    assert.equal((await cmd.post('/api/pessoas').send(militar())).status, 403)
    assert.equal((await cmd.post('/api/utilizadores').send({ nome: 'Nova Conta Teste', email: 'nova.conta@pessoal.ao', papel: 'consulta', senha: 'Inicial2026x' })).status, 403)
    assert.equal((await chefe.post('/api/utilizadores').send({ nome: 'Nova Conta Teste', email: 'nova.conta@pessoal.ao', papel: 'consulta', senha: 'Inicial2026x' })).status, 403) // contas: só o administrador
    // a consulta comum continua sem ver a administração
    const v = await conta('so.ver@pessoal.ao', 'consulta')
    assert.equal((await v.get('/api/auditoria')).status, 403)
  })

  it('ficha do militar com os campos da lei; NIP repetido é recusado', async () => {
    const r = await adm.post('/api/pessoas').send(militar({ nip: 'NIP0001', ramo: 'MGA', posto: 'coronel', quadroEspecial: 'AN', dataNascimento: '1970-05-20' })).expect(201)
    assert.equal(r.body.postoNome, 'Capitão-de-Mar-e-Guerra')
    assert.equal(r.body.categoria, 'oficial_superior')
    assert.equal(r.body.dataReserva, '2029-05-20')
    const d = await adm.post('/api/pessoas').send(militar({ nip: 'NIP0001', nome: 'Outro Militar Qualquer' }))
    assert.equal(d.status, 409)
    assert.match(d.body.erro, /NIP/)
    assert.equal((await adm.post('/api/pessoas').send(militar({ posto: 'soldado' }))).status, 400) // posto do SMO no QP
  })

  it('promoção: proposta enviada, extracto recebido — a ficha muda e o histórico fica registado', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0002' })).expect(201)).body
    await adm.post(`/api/pessoas/${p.id}/cursos`).send({ chave: 'promocao_oficial_superior', nome: 'CPOS 2024', aproveitamento: true, fim: '2024-07-30' }).expect(201)
    const eleg = (await adm.get('/api/carreira/elegiveis').expect(200)).body.find((x) => x.id === p.id)
    assert.equal(eleg.elegivel, true)
    assert.equal(eleg.proposto, 'Major')

    const pr = (await adm.post('/api/propostas').send({ tipo: 'promocao', titulo: 'Promoções de Outubro', itens: [{ pessoaId: p.id }] }).expect(201)).body
    assert.equal(pr.itens[0].postoPropostoNome, 'Major')
    assert.equal(pr.itens[0].modalidade, 'escolha')
    // a mesma pessoa não entra em duas propostas abertas
    assert.equal((await adm.post('/api/propostas').send({ tipo: 'promocao', titulo: 'Outra', itens: [{ pessoaId: p.id }] })).status, 400)
    await adm.post(`/api/propostas/${pr.id}/submeter`).expect(200)
    assert.equal((await adm.get(`/api/propostas/${pr.id}`)).body.estado, 'enviada')
    // o ofício de envio digitalizado fica nos documentos da proposta (abre-se e retira-se)
    const oficio = (await adm.post(`/api/propostas/${pr.id}/anexos`).field('titulo', 'Ofício de envio n.º 12/RPQ/2026').attach('ficheiro', Buffer.from('%PDF-1.4 ofício'), 'oficio.pdf').expect(201)).body
    const anexos = (await adm.get(`/api/propostas/${pr.id}`)).body.anexos
    assert.deepEqual(anexos.map((a) => [a.titulo, a.mime, 'ficheiro' in a]), [['Ofício de envio n.º 12/RPQ/2026', 'application/pdf', false]])
    assert.match((await adm.get(`/api/propostas/anexos/${oficio.id}/ficheiro`).expect(200)).headers['content-type'], /pdf/)
    assert.equal((await adm.post(`/api/propostas/${pr.id}/anexos`).attach('ficheiro', Buffer.from('texto'), 'x.txt')).status, 400)
    await adm.delete(`/api/propostas/anexos/${oficio.id}`).expect(204)
    assert.equal((await adm.get(`/api/propostas/${pr.id}`)).body.anexos.length, 0)
    await porExtracto(adm, pr.id, 'promocao', '45/CEMG/2026', '2026-10-15')
    assert.equal((await adm.get(`/api/propostas/${pr.id}`)).body.estado, 'concluida')
    const f = (await adm.get(`/api/pessoas/${p.id}`).expect(200)).body
    assert.equal(f.posto, 'major')
    assert.equal(f.dataAntiguidadePosto, '2026-10-15')
    const ev = f.eventos.find((e) => e.tipo === 'promocao')
    assert.equal(ev.documento, 'Extracto n.º 45/CEMG/2026')
    assert.equal(ev.postoAnteriorNome, 'Capitão')
  })

  it('pesquisa avançada: texto, cursos, tempo no posto, ingresso, aniversários, cargo acima do posto e quem está hoje de licença', async () => {
    const a = (await adm.post('/api/pessoas').send(militar({ nome: 'Zacarias Pesquisa Lunda', nip: 'NIPPESQ1', dataNascimento: '1980-03-05', dataIngresso: '2001-01-10' })).expect(201)).body
    const b = (await adm.post('/api/pessoas').send(militar({ nome: 'Yolanda Pesquisa Bié', nip: 'NIPPESQ2', posto: 'tenente', dataIngresso: '2015-06-01', dataAntiguidadePosto: '2024-01-01' })).expect(201)).body
    await adm.post(`/api/pessoas/${a.id}/cursos`).send({ nome: 'Curso de Estado-Maior Conjunto', aproveitamento: true, fim: '2020-07-01' }).expect(201)
    const ids = async (q) => (await adm.get('/api/pessoas').query(q).expect(200)).body.map((p) => p.id).filter((id) => [a.id, b.id].includes(id))
    assert.deepEqual(await ids({ q: 'pesquisa lunda' }), [a.id])
    assert.deepEqual(await ids({ q: 'pesquisa', curso: 'estado-maior' }), [a.id])
    assert.deepEqual(await ids({ q: 'pesquisa', semCurso: 'estado-maior' }), [b.id])
    assert.deepEqual(await ids({ q: 'pesquisa', ingressoDe: '2010' }), [b.id])
    assert.deepEqual(await ids({ q: 'pesquisa', tempoMin: '5' }), [a.id])
    assert.deepEqual(await ids({ q: 'pesquisa', mesNascimento: '3' }), [a.id])
    // a tenente num cargo de Major
    const u = (await adm.post('/api/unidades').send({ nome: 'Unidade da pesquisa' }).expect(201)).body
    const c = (await adm.post('/api/cargos').send({ nome: 'Chefe da Unidade da pesquisa', unidadeId: u.id, funcao: 'direccao_chefia', tipo: 'militar', postoRequerido: 'major', vagas: 1 }).expect(201)).body
    await amb.contentor.base.pessoa.update({ where: { id: b.id }, data: { unidadeId: u.id, cargoId: c.id } })
    assert.deepEqual(await ids({ q: 'pesquisa', cargoAcima: '1' }), [b.id])
    assert.deepEqual(await ids({ q: 'pesquisa', funcaoCargo: 'direccao_chefia' }), [b.id])
    // hoje: ausente (falta em curso) e presente
    await adm.post('/api/ausencias').send({ pessoaId: a.id, tipo: 'hospital', inicio: '2026-10-16', fim: null }).expect(201)
    assert.deepEqual(await ids({ q: 'pesquisa', hoje: 'ausente' }), [a.id])
    assert.deepEqual(await ids({ q: 'pesquisa', hoje: 'presente' }), [b.id])
  })

  it('quem não cumpre a lei não segue para o escalão superior (sem tempo no posto só avisa)', async () => {
    const aviso = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0903', dataAntiguidadePosto: '2024-01-01' })).expect(201)).body
    const pa = (await adm.post('/api/propostas').send({ tipo: 'promocao', titulo: 'Sem tempo', itens: [{ pessoaId: aviso.id }] }).expect(201)).body
    assert.equal(pa.naoCumprem, 0)
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0003', processoPendente: true })).expect(201)).body
    const pr = (await adm.post('/api/propostas').send({ tipo: 'promocao', titulo: 'Processo pendente', itens: [{ pessoaId: p.id }] }).expect(201)).body
    assert.equal(pr.naoCumprem, 1)
    const s = await adm.post(`/api/propostas/${pr.id}/submeter`)
    assert.equal(s.status, 400)
    assert.match(s.body.erro, /Não cumprem/)
  })

  it('nomeação para cargo do quadro orgânico e graduação; o cargo ocupado não aceita outro', async () => {
    const un = (await adm.post('/api/unidades').send({ nome: 'Departamento de Ensino', sigla: 'DE' }).expect(201)).body
    const cargo = (await adm.post('/api/cargos').send({ nome: 'Chefe do Departamento de Ensino', unidadeId: un.id, funcao: 'direccao_chefia', postoRequerido: 'capitao', vagas: 1 }).expect(201)).body
    const a = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0004' })).expect(201)).body
    const b = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0005', nome: 'Bernardo José Tchipa' })).expect(201)).body
    const pr = (await adm.post('/api/propostas').send({ tipo: 'nomeacao', titulo: 'Chefia do DE', itens: [{ pessoaId: a.id, cargoId: cargo.id, inicio: '2026-10-20' }] }).expect(201)).body
    await adm.post(`/api/propostas/${pr.id}/submeter`).expect(200)
    await porExtracto(adm, pr.id, 'nomeacao', '12/2026', '2026-10-18')
    const f = (await adm.get(`/api/pessoas/${a.id}`)).body
    assert.equal(f.cargoId, cargo.id)
    assert.equal(f.unidadeId, un.id)
    const c = (await adm.get('/api/cargos')).body.find((x) => x.id === cargo.id)
    assert.deepEqual([c.ocupados, c.livres], [1, 0])
    const pr2 = (await adm.post('/api/propostas').send({ tipo: 'nomeacao', titulo: 'Outro', itens: [{ pessoaId: b.id, cargoId: cargo.id }] }).expect(201)).body
    assert.equal(pr2.naoCumprem, 1)

    const g = (await adm.post('/api/propostas').send({ tipo: 'graduacao', titulo: 'Graduação', itens: [{ pessoaId: b.id, postoProposto: 'major', inicio: '2026-11-01', justificacao: 'Cargo de Major sem militar desse posto' }] }).expect(201)).body
    await adm.post(`/api/propostas/${g.id}/submeter`).expect(200)
    await porExtracto(adm, g.id, 'graduacao', '3/2026', '2026-10-30')
    const fb = (await adm.get(`/api/pessoas/${b.id}`)).body
    assert.equal(fb.graduacoes[0].postoNome, 'Major')
    assert.equal(fb.graduacoes[0].ativa, true)
  })

  it('licenças: a lei é aplicada antes de gravar', async () => {
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0006' })).expect(201)).body
    const v = (await adm.post('/api/licencas/verificar').send({ pessoaId: p.id, tipo: 'doenca', inicio: '2026-11-01', fim: '2026-12-31' }).expect(200)).body
    assert.equal(v.possivel, false)
    assert.equal((await adm.post('/api/licencas').send({ pessoaId: p.id, tipo: 'doenca', inicio: '2026-11-01', fim: '2026-12-31' })).status, 400)
    await adm.post('/api/licencas').send({ pessoaId: p.id, tipo: 'ferias', inicio: '2026-10-10', fim: '2026-10-25' }).expect(201)
    // sobrepõe-se às férias
    assert.equal((await adm.post('/api/licencas').send({ pessoaId: p.id, tipo: 'luto', inicio: '2026-10-20', fim: '2026-10-22' })).status, 400)
    const l = (await adm.get('/api/licencas?estado=em_curso')).body
    assert.ok(l.some((x) => x.pessoaId === p.id))
  })

  it('as propostas e as listas vão pelo posto e, no mesmo posto, pela ordem da unidade na orgânica', async () => {
    const dir = (await adm.post('/api/unidades').send({ nome: 'Comando da Escola', ordem: 0 }).expect(201)).body
    const sg = (await adm.post('/api/unidades').send({ nome: 'Serviços Gerais', ordem: 5 }).expect(201)).body
    const gab = (await adm.post('/api/unidades').send({ nome: 'Gabinete do Comandante', paiId: dir.id, ordem: 1 }).expect(201)).body
    const novo = async (nome, posto, unidadeId, antig = '2019-09-01') => (await adm.post('/api/pessoas').send(militar({ nome, posto, unidadeId, dataAntiguidadePosto: antig })).expect(201)).body
    // criados de propósito fora de ordem
    const a = await novo('Tenente-Coronel Serviços', 'tenente_coronel', sg.id)
    const b = await novo('Capitão Comando', 'capitao', dir.id)
    const c = await novo('Tenente-Coronel Gabinete', 'tenente_coronel', gab.id)
    const d = await novo('Tenente-Coronel Comando', 'tenente_coronel', dir.id, '2021-01-01')
    const pr = (await adm.post('/api/propostas').send({ tipo: 'graduacao', titulo: 'Ordem', itens: [] }).expect(201)).body
    for (const x of [a, b, c, d]) await adm.post(`/api/propostas/${pr.id}/itens`).send({ pessoaId: x.id, postoProposto: x.posto === 'capitao' ? 'major' : 'coronel', justificacao: 'Teste de ordem' })
    const l = (await adm.get(`/api/propostas/${pr.id}`).expect(200)).body.itens
    // o Comando (e o seu Gabinete) antes dos Serviços Gerais; o capitão depois de todos os tenentes-coronéis
    assert.deepEqual(l.map((i) => i.nome), ['Tenente-Coronel Comando', 'Tenente-Coronel Gabinete', 'Tenente-Coronel Serviços', 'Capitão Comando'])
    // a mesma ordem na lista do pessoal (e o número «hierarquia» que as tabelas usam)
    const todos = (await adm.get(`/api/pessoas?tipo=militar`).expect(200)).body.filter((p) => [a, b, c, d].some((x) => x.id === p.id))
    assert.deepEqual(todos.map((p) => p.nome), ['Tenente-Coronel Comando', 'Tenente-Coronel Gabinete', 'Tenente-Coronel Serviços', 'Capitão Comando'])
    assert.ok(todos.every((p, i) => i === 0 || p.hierarquia > todos[i - 1].hierarquia))
  })

  it('civil: progressão na carreira por proposta', async () => {
    const c = (await adm.post('/api/pessoas').send({ tipo: 'civil', nome: 'Maria da Conceição Lopes', numeroAgente: 'AG1001', genero: 'F', carreiraCivil: 'tecnico_superior', categoriaCivil: 'Técnico Superior de 2.ª Classe', dataAdmissao: '2018-03-01', dataCategoria: '2022-03-01' }).expect(201)).body
    assert.equal(c.proximaCategoria, 'Técnico Superior de 1.ª Classe')
    const pr = (await adm.post('/api/propostas').send({ tipo: 'progressao', titulo: 'Progressões', itens: [{ pessoaId: c.id }] }).expect(201)).body
    await adm.post(`/api/propostas/${pr.id}/submeter`).expect(200)
    await porExtracto(adm, pr.id, 'progressao', '9/2026', '2026-10-16')
    assert.equal((await adm.get(`/api/pessoas/${c.id}`)).body.categoriaCivil, 'Técnico Superior de 1.ª Classe')
    // a promoção é só para militares
    assert.equal((await adm.post('/api/propostas').send({ tipo: 'promocao', titulo: 'X', itens: [{ pessoaId: c.id }] })).status, 400)
  })

  it('o painel guarda os números uns segundos, mas actualiza-se logo depois de uma gravação', async () => {
    const antes = (await adm.get('/api/painel').expect(200)).body.totais
    assert.deepEqual((await adm.get('/api/painel').expect(200)).body.totais, antes) // o mesmo cálculo
    await adm.post('/api/pessoas').send(militar({ nip: 'PAINEL01', nome: 'Militar do Painel' })).expect(201)
    const depois = (await adm.get('/api/painel').expect(200)).body.totais
    assert.equal(depois.militares, antes.militares + 1)
  })

  it('painel com os gráficos (cada um com o filtro da lista) e filtros da lista', async () => {
    const r = (await adm.get('/api/painel').expect(200)).body
    assert.ok(r.totais.militares >= 5)
    assert.ok(r.totais.civis >= 1)
    const mga = r.graficos.ramo.find((g) => g.chave === 'MGA')
    assert.deepEqual(mga.filtro, { tipo: 'militar', ramo: 'MGA' })
    const l = (await adm.get('/api/pessoas').query(mga.filtro)).body
    assert.equal(l.length, mga.valor)
    assert.ok((await adm.get('/api/pessoas?grupo=oficiais')).body.every((p) => p.grupo === 'oficiais'))
    assert.ok(r.graficos.movimentos.series.find((s) => s.tipo === 'promocao').valores.at(-1) >= 1)
  })

  it('auditoria: ver uma ficha e exportar ficam registados', async () => {
    await adm.post('/api/auditoria/exportacao').send({ tabela: 'Pessoal militar', formato: 'excel', linhas: 6 }).expect(204)
    const a = (await adm.get('/api/auditoria')).body
    assert.ok(a.some((x) => x.acao === 'exportar' && x.alvo === 'Pessoal militar'))
    assert.ok(a.some((x) => x.acao === 'ver_ficha'))
  })
})

describe('Envio para o Portal Académico', () => {
  it('só docentes e estudantes, com assinatura; quem sai vai como inativo', async () => {
    const pedidos = []
    const assinaturas = []
    const enviar = async (url, op) => {
      const corpo = JSON.parse(op.body)
      // quem assina os diplomas vai à parte (só quando muda)
      if (url.endsWith('/assinaturas')) { assinaturas.push(corpo.assinaturas); return { ok: true, status: 200, json: async () => ({ ok: true }) } }
      pedidos.push({ url, op })
      return { ok: true, status: 200, json: async () => ({ resultados: corpo.pessoas.map((p, i) => ({ ref: p.ref, ok: true, contaId: 100 + i })) }) }
    }
    const chave = 'chave-partilhada-com-o-portal-de-32-caracteres-ou-mais'
    const amb = await criarAmbiente({ env: { PORTAL_API_URL: 'http://portal.interno:3001', INTEGRACAO_CHAVE: chave }, enviar })
    try {
      const adm = amb.com(await amb.entrar())
      const d = (await adm.post('/api/pessoas').send(militar({ nip: 'NIP0100', vinculo: 'docente', email: 'kiala@esgfaa.gov.ao' })).expect(201)).body
      await adm.post('/api/pessoas').send(militar({ nip: 'NIP0101', email: 'func@esgfaa.gov.ao' })).expect(201) // funcionário: não vai
      const r = await amb.contentor.servicos.sincronizacao.enviarPendentes()
      assert.deepEqual([r.enviados, r.erros], [1, 0])
      const { url, op } = pedidos[0]
      assert.equal(url, 'http://portal.interno:3001/api/integracao/pessoal/contas')
      assert.equal(op.headers['X-Pessoal-Assinatura'], assinar(chave, op.headers['X-Pessoal-Data'], op.body))
      const enviado = JSON.parse(op.body).pessoas[0]
      assert.deepEqual([enviado.tipo, enviado.email, enviado.ativo, enviado.dados.posto], ['docente', 'kiala@esgfaa.gov.ao', true, 'Capitão'])
      assert.equal(enviado.dataNascimento, undefined) // o resto da ficha não sai
      assert.equal(enviado.foto, undefined) // sem fotografia, não vai nada
      // a fotografia vai quando muda, e só uma vez
      const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)])
      await adm.put(`/api/pessoas/${d.id}/foto`).attach('foto', jpg, 'f.jpg').expect(200)
      await amb.contentor.servicos.sincronizacao.enviarPendentes()
      const comFoto = JSON.parse(pedidos.at(-1).op.body).pessoas[0]
      assert.equal(Buffer.from(comFoto.foto.dados, 'base64').length, jpg.length)
      await adm.put(`/api/pessoas/${d.id}`).send({ telefone: '+244 923 111 222' }).expect(200)
      await amb.contentor.servicos.sincronizacao.enviarPendentes()
      assert.equal(JSON.parse(pedidos.at(-1).op.body).pessoas[0].foto, undefined)
      await adm.put(`/api/pessoas/${d.id}`).send({ ativo: false }).expect(200)
      await amb.contentor.servicos.sincronizacao.enviarPendentes()
      assert.equal(JSON.parse(pedidos.at(-1).op.body).pessoas[0].ativo, false)
      // as assinaturas foram uma só vez (não mudaram) e com o cargo do Comandante
      assert.equal(assinaturas.length, 1)
      assert.equal(assinaturas[0].comandante.cargo, 'O COMANDANTE DA ESG')
    } finally { await amb.fechar() }
  })
})

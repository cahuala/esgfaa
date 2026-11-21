import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { criarAmbiente } from '../apoio/ambiente.js'

const CHAVE = 'chave-partilhada-com-o-pessoal-de-32-caracteres-ou-mais'
const NOVA = 'Nova-senha-2026-forte'

/*
  Com APROVACAO_COMANDANTE=sim (como na Escola): o Ensino põe os docentes nas cadeiras e envia a lista; só com
  a aprovação do Comandante o docente tem a cadeira e a conta (que recebe por e-mail). As notas também só chegam
  aos estudantes quando o Comandante aprova a publicação.
*/
describe('Aprovações do Comandante: distribuição dos docentes e publicação de notas', () => {
  let amb, ensino, comandante, cadeira, turma
  const contas = {}
  const entrarPortal = (email, senha) => amb.http().post('/api/portal/entrar').send({ email, senha })
  let tokenProf, tokenAna
  const portal = (t) => amb.com(t)
  const decidir = (colecao, id, corpo) => comandante.post(`/api/admin/publicacoes/${colecao}/${id}/decisao`).send(corpo)
  const correio = () => amb.contentor.servicos.administracaoEscolar.aprovacoes.correio

  before(async () => {
    amb = await criarAmbiente({ env: { APROVACAO_COMANDANTE: 'sim' } })
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    ensino = amb.com((await amb.criarUtilizador('administrador')).token)
    comandante = amb.com((await amb.oComandante()).token)
    turma = (await ensino.post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    contas.prof = (await ensino.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    contas.ana = (await amb.registarEMatricular(ensino, turma.id, { nome: 'Estudante Ana Teste', email: 'ana@esgfaa.gov.ao' })).body
    cadeira = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    const t = (await entrarPortal('ana@esgfaa.gov.ao', amb.senhaInicial('ana@esgfaa.gov.ao'))).body.token
    tokenAna = (await amb.com(t).put('/api/portal/eu/senha').send({ atual: amb.senhaInicial('ana@esgfaa.gov.ao'), nova: NOVA })).body.token
  })
  after(() => amb.fechar())

  it('o docente posto na cadeira fica proposto: sem acesso e sem entrar no portal', async () => {
    const c = (await ensino.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente', horas: 30 }] })).body
    assert.deepEqual([c.docentes.length, c.docentesPropostos.map((d) => d.nome)], [0, ['Docente Prof Teste']])
    const r = await entrarPortal('prof@esgfaa.gov.ao', amb.senhaInicial('prof@esgfaa.gov.ao'))
    assert.equal(r.status, 403)
    assert.match(r.body.erro, /aprovação do Comandante/)
    const al = (await ensino.get('/api/admin/academico/alocacao')).body
    assert.deepEqual(al.turmas.find((t) => t.id === turma.id).propostos, 1)
  })

  it('o Ensino envia a lista; o Comandante devolve com motivo e depois aprova: o docente recebe a conta por e-mail', async () => {
    assert.equal((await ensino.post(`/api/admin/academico/turmas/${turma.id}/distribuicao`)).status, 200)
    assert.equal((await ensino.post(`/api/admin/academico/turmas/${turma.id}/distribuicao`)).status, 409)
    // o Ensino não decide
    assert.equal((await ensino.post(`/api/admin/publicacoes/distribuicao_docente/${turma.id}/decisao`).send({ decisao: 'aprovar' })).status, 403)
    const lista = (await comandante.get('/api/admin/publicacoes')).body
    const p = lista.find((x) => x.colecao === 'distribuicao_docente')
    assert.match(p.resumo, /EST101 Estratégia: Docente Prof Teste \(regente, 30 h\) — NOVO/)
    assert.equal((await decidir('distribuicao_docente', turma.id, { decisao: 'recusar' })).status, 400)
    assert.equal((await decidir('distribuicao_docente', turma.id, { decisao: 'recusar', motivo: 'Falta o assistente.' })).status, 200)
    const al = (await ensino.get('/api/admin/academico/alocacao')).body.turmas.find((t) => t.id === turma.id)
    assert.deepEqual([al.distribuicao.estado, al.distribuicao.motivo], ['devolvida', 'Falta o assistente.'])
    // reenviada e aprovada
    await ensino.post(`/api/admin/academico/turmas/${turma.id}/distribuicao`).expect(200)
    const r = (await decidir('distribuicao_docente', turma.id, { decisao: 'aprovar' })).body
    assert.deepEqual([r.docentes, r.contasNovas, r.emails], [1, 1, 1])
    const email = correio().enviados.find((m) => m.para === 'prof@esgfaa.gov.ao')
    const senha = /Palavra-passe inicial: (\S+)/.exec(email.texto)[1]
    const e = await entrarPortal('prof@esgfaa.gov.ao', senha)
    assert.equal(e.status, 200)
    tokenProf = (await amb.com(e.body.token).put('/api/portal/eu/senha').send({ atual: senha, nova: NOVA })).body.token
    assert.ok((await portal(tokenProf).get('/api/portal/cadeiras')).body.some((c) => c.id === cadeira.id))
    assert.equal((await comandante.get('/api/admin/publicacoes')).body.filter((x) => x.colecao === 'distribuicao_docente').length, 0)
  })

  it('as notas só chegam aos estudantes com a aprovação do Comandante; recusada, o docente vê o motivo', async () => {
    await portal(tokenProf).put(`/api/portal/cadeiras/${cadeira.id}/pauta`).send({ linhas: [{ estudanteId: contas.ana.id, p1: 14 }] }).expect(200)
    const pedido = (await portal(tokenProf).put(`/api/portal/cadeiras/${cadeira.id}/pauta/publicacao`).send({ publicadas: ['p1'] })).body
    assert.equal(pedido.cadeira.publicacaoPedida.estado, 'pendente')
    const notaAna = async () => (await portal(tokenAna).get('/api/portal/notas')).body.find((x) => x.cadeira.id === cadeira.id)?.p1 ?? null
    assert.equal(await notaAna(), null)
    const p = (await comandante.get('/api/admin/publicacoes')).body.find((x) => x.colecao === 'publicacao_notas')
    assert.equal(p.id, `uc-${cadeira.id}`)
    assert.match(p.resumo, /1\.ª Prova: 1 nota\(s\), média 14,0, 1 positiva\(s\)/)
    await decidir('publicacao_notas', p.id, { decisao: 'recusar', motivo: 'Confirme a nota da Ana.' }).expect(200)
    assert.equal(await notaAna(), null)
    const depois = (await portal(tokenProf).get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    assert.deepEqual([depois.cadeira.publicacaoPedida.estado, depois.cadeira.publicacaoPedida.motivo], ['recusada', 'Confirme a nota da Ana.'])
    // pede de novo e o Comandante aprova
    await portal(tokenProf).put(`/api/portal/cadeiras/${cadeira.id}/pauta/publicacao`).send({ publicadas: ['p1'] }).expect(200)
    await decidir('publicacao_notas', `uc-${cadeira.id}`, { decisao: 'aprovar' }).expect(200)
    assert.equal(await notaAna(), 14)
    const fim = (await portal(tokenProf).get(`/api/portal/cadeiras/${cadeira.id}/pauta`)).body
    assert.deepEqual([fim.cadeira.publicacaoPedida, fim.publicadas], [null, ['p1']])
  })

  it('um docente novo volta a precisar da aprovação; mudar as horas de um aprovado não lhe tira a cadeira', async () => {
    const outra = (await ensino.post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'TAC101', nome: 'Táctica' })).body
    const prof2 = (await ensino.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Dois Teste', email: 'prof2@esgfaa.gov.ao' })).body
    const c = (await ensino.put(`/api/admin/academico/cadeiras/${outra.id}/docentes`).send({ docentes: [{ docenteId: prof2.id, papel: 'regente' }] })).body
    assert.deepEqual([c.docentes.length, c.docentesPropostos.length], [0, 1])
    const h = (await ensino.put(`/api/admin/academico/cadeiras/${cadeira.id}/docentes`).send({ docentes: [{ docenteId: contas.prof.id, papel: 'regente', horas: 40 }] })).body
    assert.deepEqual([h.docentes.length, h.docentesPropostos.length, h.docentes[0].horas], [1, 0, 40])
  })
})

describe('O Pessoal pergunta o que espera pelo Comandante (pedido assinado)', () => {
  let amb
  before(async () => { amb = await criarAmbiente({ env: { APROVACAO_COMANDANTE: 'sim', INTEGRACAO_CHAVE: CHAVE, PAINEL_URL: 'https://esg.exemplo.ao/painel/' } }) })
  after(() => amb.fechar())

  it('só os números e o endereço do painel; sem assinatura, recusado', async () => {
    const data = String(Math.floor(Date.now() / 1000))
    const assinatura = crypto.createHmac('sha256', CHAVE).update(`${data}.{}`).digest('hex')
    const n = (await amb.http().post('/api/integracao/pessoal/pendentes-comandante').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinatura).send('{}').expect(200)).body
    assert.deepEqual(Object.keys(n).sort(), ['alteracoesNotas', 'avisos', 'comentarios', 'contasPainel', 'distribuicoes', 'docentesPorVerificar', 'homologacoes', 'inqueritos', 'notas', 'painel', 'site'])
    assert.deepEqual([n.distribuicoes, n.notas, n.painel], [0, 0, 'https://esg.exemplo.ao/painel/'])
    assert.equal((await amb.http().post('/api/integracao/pessoal/pendentes-comandante').set('Content-Type', 'application/json').send('{}')).status, 401)
  })
})

describe('Conta única do Comandante: a do Sistema de Gestão de Pessoal vale no painel', () => {
  let amb
  const enviar = (contas) => {
    const corpo = JSON.stringify({ contas })
    const data = String(Math.floor(Date.now() / 1000))
    const assinatura = crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')
    return amb.http().post('/api/integracao/pessoal/comandante').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinatura).send(corpo)
  }
  const entrar = (email, senha) => amb.http().post('/api/admin/entrar').send({ email, senha })
  before(async () => { amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } }) })
  after(() => amb.fechar())

  it('chega do Pessoal (palavra-passe já cifrada), entra no painel como Comandante e só se muda no Pessoal', async () => {
    const hash = await amb.contentor.cifra.cifrar('Comandante-Pessoal-2026')
    const r = (await enviar([{ email: 'cmdt@esgfaa.gov.ao', nome: 'Comandante da Escola', senha: hash }]).expect(200)).body
    assert.deepEqual(r.resultados, [{ email: 'cmdt@esgfaa.gov.ao', ok: true, criada: true }])
    const e = await entrar('cmdt@esgfaa.gov.ao', 'Comandante-Pessoal-2026')
    assert.equal(e.status, 200, e.body.erro)
    assert.deepEqual([e.body.utilizador.papel, e.body.utilizador.geridaPeloPessoal], ['comandante', true])
    const cmdt = amb.com(e.body.token)
    // no painel não se muda a palavra-passe nem a conta
    const m = await cmdt.put('/api/admin/eu/senha').send({ atual: 'Comandante-Pessoal-2026', nova: 'Outra-senha-2026-x' })
    assert.equal(m.status, 400)
    assert.match(m.body.erro, /Sistema de Gestão de Pessoal/)
    const admin = amb.com(await amb.entrar())
    assert.equal((await admin.put(`/api/admin/utilizadores/${e.body.utilizador.id}`).send({ ativo: false })).status, 400)
    // mudou a palavra-passe no Pessoal: a antiga deixa de servir no painel
    await enviar([{ email: 'cmdt@esgfaa.gov.ao', nome: 'Comandante da Escola', senha: await amb.contentor.cifra.cifrar('Nova-do-Pessoal-2026') }]).expect(200)
    assert.equal((await entrar('cmdt@esgfaa.gov.ao', 'Comandante-Pessoal-2026')).status, 401)
    assert.equal((await entrar('cmdt@esgfaa.gov.ao', 'Nova-do-Pessoal-2026')).status, 200)
    // uma conta do painel com outro papel não passa a ser a do Comandante
    const outra = (await enviar([{ email: 'cmdt@esgfaa.gov.ao', nome: 'Comandante da Escola' }, { email: (await amb.criarUtilizador('editor_chefe')).email, nome: 'Outro' }]).expect(200)).body
    assert.equal(outra.resultados[1].ok, false)
    // deixou de ser Comandante no Pessoal: deixa de entrar no painel
    await enviar([]).expect(200)
    assert.equal((await entrar('cmdt@esgfaa.gov.ao', 'Nova-do-Pessoal-2026')).status, 403)
  })
})

describe('Civis da Direcção de Ensino: conta no painel, vinda do Pessoal, com o BI', () => {
  let amb
  const BI = '001111111LA011'
  const imp = (bi) => crypto.createHmac('sha256', CHAVE).update(`bi:${bi}`).digest('hex')
  const enviar = (contas) => {
    const corpo = JSON.stringify({ contas })
    const data = String(Math.floor(Date.now() / 1000))
    const assinatura = crypto.createHmac('sha256', CHAVE).update(`${data}.${corpo}`).digest('hex')
    return amb.http().post('/api/integracao/pessoal/contas-ensino').set('Content-Type', 'application/json').set('X-Pessoal-Data', data).set('X-Pessoal-Assinatura', assinatura).send(corpo)
  }
  const entrar = (email, senha) => amb.http().post('/api/admin/entrar').send({ email, senha })
  before(async () => { amb = await criarAmbiente({ env: { INTEGRACAO_CHAVE: CHAVE } }) })
  after(() => amb.fechar())

  it('entra com o BI (palavra-passe inicial = BI, muda-a logo), papel Administração Escolar; quem sai é desactivado', async () => {
    const conta = { ref: 'pessoal-41', nome: 'Joana Civil Ensino', bi: imp(BI), senha: await amb.contentor.cifra.cifrar(BI) }
    assert.deepEqual((await enviar([conta]).expect(200)).body.resultados, [{ ref: 'pessoal-41', ok: true, criada: true }])
    const e = await entrar(BI.toLowerCase(), BI)
    assert.equal(e.status, 200, e.body.erro)
    assert.deepEqual([e.body.utilizador.papel, e.body.utilizador.email], ['secretaria', 'pessoal-41@pessoal.interno'])
    const eu = amb.com(e.body.token)
    assert.equal((await eu.get('/api/admin/eu')).body.deveMudarSenha, true)
    assert.match((await eu.put('/api/admin/eu/senha').send({ atual: BI, nova: BI })).body.erro, /BI/)
    await eu.put('/api/admin/eu/senha').send({ atual: BI, nova: 'Kalunga-Forte-2026x!' }).expect(200)
    // reenviar a mesma pessoa não muda a palavra-passe
    await enviar([{ ...conta, senha: await amb.contentor.cifra.cifrar(BI) }]).expect(200)
    assert.equal((await entrar(BI, 'Kalunga-Forte-2026x!')).status, 200)
    // uma entrada falhada com o BI não o deixa em claro no registo
    await entrar('009999999LA099', 'errada')
    const reg = await amb.contentor.prismaBase.atividade.findMany({ where: { acao: 'falha_entrada' } })
    assert.ok(reg.length && reg.every((x) => !JSON.stringify(x.detalhes).includes('009999999')))
    // saiu da Direcção de Ensino
    await enviar([]).expect(200)
    assert.equal((await entrar(BI, 'Kalunga-Forte-2026x!')).status, 403)
  })

  it('chefes militares (Director de Ensino): entram com o NIP, com o papel do cargo; o NIP não pode ficar como palavra-passe', async () => {
    const NIP = '10576093'
    const impNip = (n) => crypto.createHmac('sha256', CHAVE).update(`nip:${n}`).digest('hex')
    const conta = { ref: 'pessoal-77', nome: 'Director Ensino Teste', bi: impNip(NIP), papel: 'director_ensino', senha: await amb.contentor.cifra.cifrar(NIP) }
    assert.equal((await enviar([conta]).expect(200)).body.resultados[0].criada, true)
    const e = await entrar(NIP, NIP)
    assert.equal(e.status, 200, e.body.erro)
    assert.equal(e.body.utilizador.papel, 'director_ensino')
    const eu = amb.com(e.body.token)
    assert.match((await eu.put('/api/admin/eu/senha').send({ atual: NIP, nova: NIP })).body.erro, /NIP/)
    // mudou de cargo para a Repartição de Administração Escolar: o papel acompanha
    await enviar([{ ...conta, papel: 'secretaria' }]).expect(200)
    assert.equal((await entrar(NIP, NIP)).body.utilizador.papel, 'secretaria')
    // o NIP não fica em claro no registo das entradas falhadas
    await entrar('99887766', 'errada')
    const reg = await amb.contentor.prismaBase.atividade.findMany({ where: { acao: 'falha_entrada' } })
    assert.ok(reg.every((x) => !JSON.stringify(x.detalhes).includes('99887766')))
  })
})

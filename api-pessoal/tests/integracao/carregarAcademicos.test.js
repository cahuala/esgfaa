import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'
import { carregarAcademicos } from '../../scripts/carregar-relacoes.js'

/*
  Carga das listas de docentes e estudantes (corpo docente, discentes do ano lectivo e finalistas dos anos
  anteriores): não duplica quem já tem ficha (pelo NIP ou pelo nome), não muda os dados que lá estão (só
  acrescenta a função de docente/estudante, o que estava em branco e os cursos) e corre uma só vez.
*/
describe('Carregar os docentes e os estudantes das listas', () => {
  let amb, adm, s, efectivo, homonimo
  const u = { email: 'carregamento', nome: 'Carregamento', papel: 'administrador' }
  const lista = () => ({
    versao: 'teste-1',
    pessoas: [
      // o efectivo que também é docente e está num curso deste ano (NIP mal escrito numa das listas)
      { nome: 'Coronel Docente Efectivo', tipo: 'militar', posto: 'coronel', ramo: 'EXE', fps: 'QP', nip: 'NIPAC9', outrosNips: ['NIPAC1'], habilitacao: 'mestrado', areaFormacao: 'Direito', docente: { tipo: 'efectivo' }, estudante: { curso: '32.º Curso Superior de Comando e Direcção', anoLetivo: '2026/2027' }, cursos: [{ nome: '32.º Curso Superior de Comando e Direcção (2026/2027)', fim: null, aproveitamento: null }], anos: [{ anoLetivo: '2026/2027', papel: 'docente', curso: 'Táctica Geral', tipoDocente: 'efectivo' }, { anoLetivo: '2025/2026', papel: 'docente', curso: 'Táctica Geral', tipoDocente: 'efectivo' }, { anoLetivo: '2026/2027', papel: 'estudante', curso: '32.º Curso Superior de Comando e Direcção' }] },
      // docente colaborador que não tem ficha
      { nome: 'Brigadeiro Colaborador de Fora', tipo: 'militar', posto: 'brigadeiro', ramo: 'FAN', fps: 'QP', nip: 'NIPAC2', docente: { tipo: 'colaborador' }, observacoes: 'Cadeira: Ética', anos: [{ anoLetivo: '2026/2027', papel: 'docente', curso: 'Ética', tipoDocente: 'colaborador' }] },
      // estudante deste ano (Polícia Nacional: ficha civil, com o número da polícia)
      { nome: 'Superintendente Estudante Policia', tipo: 'civil', numeroAgente: 'I0001', unidadeOrigem: 'Polícia Nacional', postoExterno: 'Superintendente', anos: [{ anoLetivo: '2026/2027', papel: 'estudante', curso: '18.º Curso' }], estudante: { curso: '18.º Curso', anoLetivo: '2026/2027' }, cursos: [{ nome: '18.º Curso (2026/2027)' }] },
      // finalista de anos anteriores: fica como saído, com o curso concluído (condição de promoção)
      { nome: 'Major Finalista Antigo', tipo: 'militar', posto: 'major', ramo: 'MGA', fps: 'QP', nip: 'NIPAC3', ultimoFim: '2023-08-11', anos: [{ anoLetivo: '2022/2023', papel: 'estudante', curso: '19.º Curso de Promoção a Oficial Superior', concluido: true }], cursos: [{ nome: '19.º Curso de Promoção a Oficial Superior (2022/2023)', fim: '2023-08-11', aproveitamento: true }] },
      // o mesmo nome de quem já existe, outro NIP e outro posto, num curso antigo: não se cria (para conferir)
      { nome: 'Capitão Mesmo Nome', tipo: 'militar', posto: 'coronel', ramo: 'FAN', fps: 'QP', nip: 'NIPAC4', ultimoFim: '2022-08-29', cursos: [{ nome: '27.º Curso (2022)', fim: '2022-08-29', aproveitamento: true }] },
      // ... mas na lista deste ano (outro posto ao mesmo tempo) são duas pessoas: entra
      { nome: 'Capitão Mesmo Nome', tipo: 'militar', posto: 'major', ramo: 'FAN', fps: 'QP', nip: 'NIPAC6', estudante: { curso: '18.º Curso', anoLetivo: '2026/2027' } },
      // o NIP de outra pessoa (nome nada parecido): não se mexe
      { nome: 'Fulano Totalmente Diferente', tipo: 'militar', posto: 'major', ramo: 'EXE', fps: 'QP', nip: 'NIPAC1', estudante: { curso: 'x', anoLetivo: '2026/2027' } },
    ],
  })

  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    s = amb.contentor.servicos
    efectivo = (await adm.post('/api/pessoas').send(militar({ nome: 'Coronel Docente Efectivo', nip: 'NIPAC1', posto: 'coronel', habilitacao: 'licenciatura' })).expect(201)).body
    homonimo = (await adm.post('/api/pessoas').send(militar({ nome: 'Capitão Mesmo Nome', nip: 'NIPAC5', posto: 'capitao' })).expect(201)).body
  })
  after(() => amb.fechar())

  it('junta-se a quem já existe, cria quem falta e manda conferir o que é duvidoso', async () => {
    const antes = await amb.contentor.bd.pessoa.count()
    const r = (await carregarAcademicos(amb.contentor, lista(), u)).join('\n')
    // novas: o colaborador, o estudante da polícia, o homónimo deste ano e o finalista (os dois duvidosos não entram)
    assert.equal(await amb.contentor.bd.pessoa.count(), antes + 4, r)
    assert.match(r, /4 ficha\(s\) nova\(s\) \(3 na Escola.*1 finalistas/)
    assert.match(r, /Capitão Mesmo Nome \(NIPAC6\): há outra ficha com o mesmo nome/)
    assert.match(r, /Capitão Mesmo Nome \(NIPAC4\): já há uma ficha com este nome/)
    assert.match(r, /Fulano Totalmente Diferente \(NIPAC1\): no sistema esse número é de Coronel Docente Efectivo/)

    // o efectivo: passa a docente (sem despacho) e estudante; os dados que tinha não mudam
    const e = await amb.contentor.bd.pessoa.findUnique({ where: { id: efectivo.id }, include: { cursos: true } })
    assert.deepEqual([e.vinculo, e.outrosVinculos.sort(), e.tipoDocente, e.docentePendente, e.habilitacao, e.nip], ['funcionario', ['docente', 'estudante'], 'efectivo', false, 'licenciatura', 'NIPAC1'])
    assert.deepEqual(e.cursos.map((c) => c.nome), ['32.º Curso Superior de Comando e Direcção (2026/2027)'])
    assert.equal(await amb.contentor.bd.pedidoDespacho.count(), 0)
    const h = await amb.contentor.bd.pessoa.findUnique({ where: { id: homonimo.id } })
    assert.deepEqual(h.outrosVinculos, [])

    // o colaborador entra como docente, na Escola, sem esperar despacho; o finalista como saído («Fim do curso»)
    const c = await amb.contentor.bd.pessoa.findFirst({ where: { nip: 'NIPAC2' } })
    assert.deepEqual([c.vinculo, c.tipoDocente, c.ativo, c.docentePendente, c.observacoes], ['docente', 'colaborador', true, false, 'Cadeira: Ética'])
    const f = await amb.contentor.bd.pessoa.findFirst({ where: { nip: 'NIPAC3' }, include: { cursos: true } })
    assert.deepEqual([f.vinculo, f.ativo, f.motivoSaida, f.dataSaidaEscola.toISOString().slice(0, 10)], ['estudante', false, 'Fim do curso', '2023-08-11'])
    assert.deepEqual(f.cursos.map((k) => [k.tipo, k.chave, k.aproveitamento, k.local]), [['promocao', 'promocao_oficial_superior', true, 'Escola Superior de Guerra']])
    const pol = await amb.contentor.bd.pessoa.findFirst({ where: { numeroAgente: 'I0001' } })
    assert.deepEqual([pol.tipo, pol.vinculo, pol.ativo, pol.unidadeOrigem], ['civil', 'estudante', true, 'Polícia Nacional'])
  })

  it('não contam no efectivo da Escola: só aparecem quando se pedem (vínculo) ou na pesquisa', async () => {
    const nomes = (l) => l.map((p) => p.nome)
    const todos = nomes((await adm.get('/api/pessoas').expect(200)).body)
    assert.ok(todos.includes('Coronel Docente Efectivo'))
    assert.ok(!todos.includes('Brigadeiro Colaborador de Fora') && !todos.includes('Superintendente Estudante Policia'))
    assert.ok(nomes((await adm.get('/api/pessoas?vinculo=docente').expect(200)).body).includes('Brigadeiro Colaborador de Fora'))
    assert.ok(nomes((await adm.get('/api/pessoas?vinculo=estudante').expect(200)).body).includes('Superintendente Estudante Policia'))
    assert.ok(nomes((await adm.get('/api/pessoas?q=colaborador').expect(200)).body).includes('Brigadeiro Colaborador de Fora'))
    // nem nas promoções, na antiguidade e na reserva
    assert.ok(!nomes(await s.pessoas.antiguidade(u)).includes('Brigadeiro Colaborador de Fora'))
    const painel = (await adm.get('/api/painel').expect(200)).body.totais
    assert.equal(painel.total, 2)
    assert.deepEqual([painel.docentes, painel.estudantes], [2, 3])
  })

  it('cada ano lectivo em separado: as listas do ano e quantos de onde vieram', async () => {
    const nomes = async (q) => (await adm.get(`/api/academicos?${q}`).expect(200)).body.pessoas.map((p) => p.nome).sort()
    assert.deepEqual(await nomes('tipo=docente&anoLetivo=2026/2027'), ['Brigadeiro Colaborador de Fora', 'Coronel Docente Efectivo'])
    assert.deepEqual(await nomes('tipo=docente&anoLetivo=2025/2026'), ['Coronel Docente Efectivo'])
    // o finalista de 2022/2023 já saiu, mas está na lista desse ano
    assert.deepEqual(await nomes('tipo=estudante&anoLetivo=2022/2023'), ['Major Finalista Antigo'])
    const pol = (await adm.get('/api/academicos?tipo=estudante&anoLetivo=2026/2027').expect(200)).body.pessoas.find((p) => p.numeroAgente === 'I0001')
    assert.deepEqual([pol.origem, pol.postoExterno, pol.anos.map((a) => a.curso)], ['policia', 'Superintendente', ['18.º Curso']])
    const resumo = (await adm.get('/api/academicos/resumo').expect(200)).body
    assert.deepEqual(resumo.map((a) => a.anoLetivo), ['2026/2027', '2025/2026', '2022/2023'])
    const [a27, a26] = resumo
    assert.deepEqual([a27.estudantes.total, a27.estudantes.militares, a27.estudantes.EXE, a27.estudantes.policia], [2, 1, 1, 1])
    assert.deepEqual([a27.docentes.total, a27.docentes.efectivos, a27.docentes.colaboradores, a27.docentes.novos, a27.docentes.FAN], [2, 1, 1, 1, 1])
    assert.equal(a26.docentes.total, 1)
    assert.equal(resumo[2].estudantes.concluiram, 1)
    // marcar à mão um ano lectivo na ficha (e tirá-lo)
    const x = (await adm.post(`/api/pessoas/${efectivo.id}/anos-academicos`).send({ anoLetivo: '2024/2025', papel: 'docente', curso: 'Topografia' }).expect(201)).body
    assert.equal((await adm.post(`/api/pessoas/${efectivo.id}/anos-academicos`).send({ anoLetivo: '2024/2026', papel: 'docente' })).status, 400)
    assert.ok((await adm.get(`/api/pessoas/${efectivo.id}`).expect(200)).body.anosAcademicos.some((a) => a.anoLetivo === '2024/2025'))
    await adm.delete(`/api/pessoas/${efectivo.id}/anos-academicos/${x.id}`).expect(204)
  })

  it('Polícia Nacional e estrangeiros: só os postos dessa força; o ramo por confirmar confirma-se ao gravar', async () => {
    const civil = { tipo: 'civil', vinculo: 'estudante', nome: 'Estudante Policia Novo', unidadeOrigem: 'Polícia Nacional' }
    const mau = await adm.post('/api/pessoas').send({ ...civil, postoExterno: 'Coronel' })
    assert.equal(mau.status, 400)
    assert.match(mau.body.erro, /não existe em Polícia Nacional/)
    await adm.post('/api/pessoas').send({ ...civil, postoExterno: 'Superintendente-Chefe' }).expect(201)
    await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'estudante', nome: 'Capitao Zambiano Teste', nacionalidade: 'Zambiana', paisNascimento: 'Zâmbia', unidadeOrigem: 'Zambian Army', postoExterno: 'Captain' }).expect(201)
    assert.equal((await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'estudante', nome: 'Outro Zambiano Teste', unidadeOrigem: 'Zambian Army', postoExterno: 'Capitão' })).status, 400)
    const ref = (await adm.get('/api/referencias').expect(200)).body
    assert.ok(ref.postosPolicia.some((x) => x.nome === 'Subcomissário') && ref.orgaosFaa.some((o) => o.sigla === 'USP') && ref.paises['Moçambique'])
    // ramo por confirmar: some quando se grava o ramo na ficha
    const f = await amb.contentor.bd.pessoa.create({ data: { tipo: 'militar', nome: 'Major Sem Ramo Teste', nip: 'NIPRAMO1', posto: 'major', ramo: 'EXE', fps: 'QP', vinculo: 'estudante', ramoPorConfirmar: true } })
    await adm.put(`/api/pessoas/${f.id}`).send({ ramo: 'FAN' }).expect(200)
    assert.equal((await amb.contentor.bd.pessoa.findUnique({ where: { id: f.id } })).ramoPorConfirmar, false)
  })

  it('corre uma só vez: o que se mudar à mão depois não volta', async () => {
    const pessoas = await amb.contentor.bd.pessoa.count()
    const cursos = await amb.contentor.bd.curso.count()
    const r = (await carregarAcademicos(amb.contentor, lista(), u)).join('\n')
    assert.match(r, /já tinham sido carregados/)
    assert.equal(await amb.contentor.bd.pessoa.count(), pessoas)
    assert.equal(await amb.contentor.bd.curso.count(), cursos)
    // outra versão das listas: os mesmos não se repetem (quem já existe fica como está)
    const r2 = (await carregarAcademicos(amb.contentor, { ...lista(), versao: 'teste-2' }, u)).join('\n')
    assert.match(r2, /0 ficha\(s\) nova\(s\)/)
    assert.equal(await amb.contentor.bd.pessoa.count(), pessoas)
    assert.equal(await amb.contentor.bd.curso.count(), cursos)
  })
})

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, militar } from '../apoio/ambiente.js'

const PDF = Buffer.from('%PDF-1.4\n% extracto de teste\n')

describe('Importação, BI, domiciliares, processos e extractos', () => {
  let amb, adm, unidade
  const pedidosBi = []
  before(async () => {
    amb = await criarAmbiente({
      env: { BI_API_KEY: 'chave-de-teste' },
      enviarBi: async (url, op) => {
        pedidosBi.push({ url, op })
        return { json: async () => (url.includes('000000000LA000') ? { code: 404, message: 'BI não encontrado' } : { code: 200, data: { first_name: 'JOÃO MANUEL', last_name: 'DOS SANTOS KIALA', birth_date: '1980-05-12', gender_name: 'Masculino', father_first_name: 'PEDRO', father_last_name: 'KIALA', mother_first_name: 'ANA', mother_last_name: 'SANTOS', marital_status_name: 'Casado', birth_province_name: 'Huíla', birth_municipality_name: 'Lubango', residence_neighbor: 'Talatona', residence_province_name: 'Luanda' } }) }
      },
    })
    adm = amb.com(await amb.entrar())
    unidade = (await adm.post('/api/unidades').send({ nome: 'Departamento de Ensino', sigla: 'DE' }).expect(201)).body
    await adm.post('/api/cargos').send({ nome: 'Professor de Estratégia', unidadeId: unidade.id, funcao: 'execucao', postoRequerido: 'coronel', vagas: 1 }).expect(201)
  })
  after(() => amb.fechar())

  it('Excel: simula, cria com correspondência exacta e bloqueia o que não corresponde; depois actualiza por NIP', async () => {
    const linhas = [
      { nip: 'IMP001', nome: 'CARLOS ALBERTO DA SILVA NETO', ramo: 'Marinha', posto: 'Capitão-de-Mar-e-Guerra', fps: 'QP', unidade: 'DE', cargo: 'Professor de Estratégia', dataNascimento: '12/03/1975', genero: 'Masculino' },
      { nip: 'IMP002', nome: 'Rosa Maria Kalunga', ramo: 'EXE', posto: 'Cap.', fps: 'QP', genero: 'F', dataNascimento: '30500' },
      { nip: 'IMP003', nome: 'Posto Errado Qualquer', ramo: 'EXE', posto: 'Capitão-Mor', fps: 'QP' },
      { nip: 'IMP004', nome: 'Cargo Cheio Fulano', ramo: 'EXE', posto: 'coronel', fps: 'QP', unidade: 'DE', cargo: 'Professor de Estratégia' },
    ]
    const s = (await adm.post('/api/pessoas/importar').send({ modo: 'novos', linhas, simular: true }).expect(200)).body
    assert.deepEqual(s.linhas.map((l) => l.acao), ['criar', 'criar', 'erro', 'erro'])
    assert.match(s.linhas[2].erro, /Posto sem correspondência/)
    assert.match(s.linhas[3].erro, /não tem lugar livre/)
    assert.equal((await adm.get('/api/pessoas?ramo=MGA')).body.length, 0) // a simulação não grava
    await adm.post('/api/pessoas/importar').send({ modo: 'novos', linhas: linhas.slice(0, 2), simular: false }).expect(200)
    const c = (await adm.get('/api/pessoas?ramo=MGA')).body[0]
    assert.equal(c.nome, 'Carlos Alberto da Silva Neto') // nomes em Primeira Letra Maiúscula, partículas em minúscula
    assert.equal(c.posto, 'coronel')
    assert.equal(c.cargoNome, 'Professor de Estratégia')
    const r = (await adm.get('/api/pessoas?genero=F')).body.find((x) => x.nip === 'IMP002')
    assert.equal(r.dataNascimento, '1983-07-03') // n.º de série do Excel
    const a = (await adm.post('/api/pessoas/importar').send({ modo: 'actualizar', simular: false, linhas: [{ nip: 'IMP002', telefone: '+244 923 000 000' }, { nip: 'NAOEXISTE', telefone: '1' }] }).expect(200)).body
    assert.deepEqual(a.linhas.map((l) => l.acao), ['actualizado', 'erro'])
  })

  it('BI: consulta a API do Estado e devolve os dados para a ficha', async () => {
    const b = (await adm.get('/api/bi/001234567LA041').expect(200)).body
    assert.equal(b.nome, 'João Manuel dos Santos Kiala')
    assert.deepEqual([b.dataNascimento, b.genero, b.estadoCivil, b.provincia, b.pai], ['1980-05-12', 'M', 'casado', 'Huíla', 'Pedro Kiala'])
    assert.equal(pedidosBi[0].op.headers.Authorization, 'Basic chave-de-teste')
    assert.equal((await adm.get('/api/bi/000000000LA000')).status, 404)
    assert.equal((await adm.get('/api/bi/abc')).status, 400)
  })

  it('domiciliares: só para oficiais superiores e generais, dentro do limite do posto, e não contam como civis', async () => {
    const major = (await adm.post('/api/pessoas').send(militar({ nip: 'DOM001', posto: 'major' })).expect(201)).body
    const cap = (await adm.post('/api/pessoas').send(militar({ nip: 'DOM002' })).expect(201)).body
    const dom = (extra) => ({ tipo: 'civil', vinculo: 'domiciliar', nome: 'Domingas Ventura Bumba', genero: 'F', ...extra })
    await adm.post('/api/pessoas').send(dom({ militarAlocadoId: major.id, numeroAgente: 'D1' })).expect(201)
    const r = await adm.post('/api/pessoas').send(dom({ militarAlocadoId: major.id, numeroAgente: 'D2' }))
    assert.equal(r.status, 400)
    assert.match(r.body.erro, /limite do posto/) // Major: 1
    assert.equal((await adm.post('/api/pessoas').send(dom({ militarAlocadoId: cap.id, numeroAgente: 'D3' }))).status, 400) // Capitão não tem
    assert.ok(!(await adm.get('/api/pessoas?tipo=civil')).body.some((p) => p.vinculo === 'domiciliar'))
    assert.equal((await adm.get('/api/pessoas?vinculo=domiciliar')).body.length, 1)
    const d = (await adm.get('/api/domiciliares')).body.find((x) => x.id === major.id)
    assert.deepEqual([d.limite, d.alocados, d.livres], [1, 1, 0])
    assert.equal((await adm.get('/api/painel')).body.totais.domiciliares, 1)
    // categorias do SIGP: a domiciliar fica «Trabalhador Domiciliar»; um civil importado com «Técnico Médio» fica na 1.ª classe
    const d1 = (await adm.get('/api/pessoas?vinculo=domiciliar')).body[0]
    assert.deepEqual([d1.carreiraCivil, d1.categoriaCivil], ['trabalhador_domiciliar', 'Trabalhador Domiciliar'])
    await adm.post('/api/pessoas/importar').send({ modo: 'novos', simular: false, linhas: [{ numeroAgente: 'CIV900', tipo: 'civil', nome: 'Teresa Mbala Sapalo', categoria: undefined, carreiraCivil: 'Técnico Médio' }] }).expect(200)
    const civ = (await adm.get('/api/pessoas?tipo=civil')).body.find((x) => x.numeroAgente === 'CIV900')
    assert.deepEqual([civ.carreiraCivil, civ.categoriaCivil, civ.remuneracao.vencimentoBase], ['tecnico_medio', 'Técnico Médio de 3.ª Classe', 320000])
  })

  it('extracto: encontra os militares pelo NIP no texto, aplica, anexa ao processo e o processo fica numerado', async () => {
    const a = (await adm.post('/api/pessoas').send(militar({ nip: '554433', nome: 'Afonso Bumba Kangamba', posto: 'major' })).expect(201)).body
    const b = (await adm.post('/api/pessoas').send(militar({ nip: '998877', nome: 'Simão Hossi Capitango', posto: 'major' })).expect(201)).body
    const texto = 'EXTRACTO DA ORDEM N.º 7/CEMG/2026 — São promovidos ao posto de Tenente-Coronel: NIP 554433 Major Afonso Bumba Kangamba; Major SIMAO HOSSI CAPITANGO.'
    const e = (await adm.post('/api/extractos').field('tipo', 'promocao').field('numero', '7/CEMG/2026').field('data', '2026-10-10').field('texto', texto).attach('ficheiro', PDF, 'extracto.pdf').expect(201)).body
    assert.deepEqual(e.itens.map((i) => [i.pessoaId, i.encontradoPor, i.postoNovo]).sort((x, y) => x[0] - y[0]), [[a.id, 'nip', 'tenente_coronel'], [b.id, 'nome', 'tenente_coronel']])
    await adm.post(`/api/extractos/${e.id}/aplicar`).expect(200)
    const f = (await adm.get(`/api/pessoas/${a.id}`)).body
    assert.equal(f.posto, 'tenente_coronel')
    assert.equal(f.documentos[0].tipo, 'extracto_promocao')
    const ficheiro = await adm.get(`/api/documentos/${f.documentos[0].id}/ficheiro`).expect(200)
    assert.equal(ficheiro.headers['content-type'], 'application/pdf')
    // aplicado não se aplica outra vez
    assert.equal((await adm.post(`/api/extractos/${e.id}/aplicar`)).status, 400)
    const pi = (await adm.put(`/api/processos/${a.id}`).send({ estante: 'E2', prateleira: 'P4', posicao: '17' }).expect(200)).body
    assert.match(pi.numero, /^PI-\d{5}$/)
    const cat = (await adm.get('/api/processos')).body.find((x) => x.id === a.id)
    assert.deepEqual([cat.numero, cat.localizacao], [pi.numero, 'E2 › P4 › 17'])
    assert.deepEqual([cat.estante, cat.prateleira, cat.posicao], ['E2', 'P4', '17'])
    // na estante, cada posição tem uma só pasta
    const dup = await adm.put(`/api/processos/${b.id}`).send({ estante: 'E2', prateleira: 'P4', posicao: '17' })
    assert.equal(dup.status, 409)
    assert.match(dup.body.erro, new RegExp(pi.numero))
    assert.ok(cat.emFalta.includes('Cópia do BI digitalizada'))
    // ficheiro que não é PDF/imagem é recusado
    assert.equal((await adm.post(`/api/pessoas/${a.id}/documentos`).field('tipo', 'bi').attach('ficheiro', Buffer.from('<html>'), 'bi.html')).status, 400)
    await adm.post(`/api/pessoas/${a.id}/documentos`).field('tipo', 'bi').attach('ficheiro', PDF, 'bi.pdf').expect(201)
    assert.ok(!(await adm.get('/api/processos')).body.find((x) => x.id === a.id).emFalta.includes('Cópia do BI digitalizada'))
  })

  it('nomeação para cargo ocupado: só segue se o ocupante entrar na mesma proposta para outro cargo (como no SIGP)', async () => {
    const c1 = (await adm.post('/api/cargos').send({ nome: 'Chefe de Secção A', unidadeId: unidade.id, funcao: 'direccao_chefia', postoRequerido: 'major', vagas: 1 }).expect(201)).body
    const c2 = (await adm.post('/api/cargos').send({ nome: 'Chefe de Secção B', unidadeId: unidade.id, funcao: 'direccao_chefia', postoRequerido: 'major', vagas: 1 }).expect(201)).body
    const ocupante = (await adm.post('/api/pessoas').send(militar({ nip: 'OC001', posto: 'major', cargoId: c1.id, unidadeId: unidade.id })).expect(201)).body
    const novo = (await adm.post('/api/pessoas').send(militar({ nip: 'OC002', posto: 'major' })).expect(201)).body
    const pr = (await adm.post('/api/propostas').send({ tipo: 'nomeacao', titulo: 'Rotação de chefias', itens: [{ pessoaId: novo.id, cargoId: c1.id }] }).expect(201)).body
    const cond = pr.itens[0].verificacao.condicoes.find((c) => c.id === 'vagas')
    assert.equal(cond.estado, 'falta')
    assert.match(cond.detalhe, /tem de entrar nesta proposta/)
    assert.equal((await adm.post(`/api/propostas/${pr.id}/submeter`).send({})).status, 400)
    // o ocupante entra para o outro cargo: o primeiro fica livre e ambos cumprem
    const r = (await adm.post(`/api/propostas/${pr.id}/itens`).send({ pessoaId: ocupante.id, cargoId: c2.id }).expect(201)).body
    assert.equal(r.naoCumprem, 0)
    await adm.post(`/api/propostas/${pr.id}/submeter`).send({}).expect(200)
  })

  it('orgânica: árvore com o previsto e o existente por categoria', async () => {
    const o = (await adm.get('/api/organica').expect(200)).body
    const de = o.escola.filhos.find((x) => x.id === unidade.id)
    assert.ok(de.lugares >= 1 && de.previsto.oficial_superior >= 1 && de.existente.oficial_superior >= 1)
    // a orgânica é uma árvore: a secção conta na unidade-mãe e o filtro da unidade inclui as subunidades
    const seccao = (await adm.post('/api/unidades').send({ nome: 'Secção de Estratégia', sigla: 'SEE', tipo: 'seccao', paiId: unidade.id }).expect(201)).body
    const p = (await adm.post('/api/pessoas').send(militar({ nip: 'SEC001', unidadeId: seccao.id })).expect(201)).body
    assert.ok((await adm.get(`/api/pessoas?unidadeId=${unidade.id}`)).body.some((x) => x.id === p.id))
    assert.equal((await adm.put(`/api/unidades/${unidade.id}`).send({ nome: unidade.nome, paiId: seccao.id })).status, 400) // sem voltas na árvore
    const o2 = (await adm.get('/api/organica')).body.escola.filhos.find((x) => x.id === unidade.id)
    assert.equal(o2.filhos[0].tipoNome, 'Secção')
    assert.ok(o2.pessoas >= de.pessoas + 1)
    const det = (await adm.get(`/api/organica/${unidade.id}`)).body
    assert.equal(det.cargos.find((c) => c.nome === 'Professor de Estratégia').ocupantes[0].nome, 'Carlos Alberto da Silva Neto')
  })
})

describe('Expediente, mensagens e contas de utente', () => {
  let amb, adm, ensino, logistica, ana, rui
  before(async () => {
    amb = await criarAmbiente()
    adm = amb.com(await amb.entrar())
    ensino = (await adm.post('/api/unidades').send({ nome: 'Departamento de Ensino' }).expect(201)).body
    logistica = (await adm.post('/api/unidades').send({ nome: 'Repartição de Logística' }).expect(201)).body
    await adm.post('/api/pessoas').send(militar({ nip: 'U001', nome: 'Ana Luísa Kalunga', unidadeId: ensino.id })).expect(201)
    await adm.post('/api/pessoas').send(militar({ nip: 'U002', nome: 'Rui Manuel Sapalo', unidadeId: logistica.id })).expect(201)
    const contas = (await adm.post('/api/utilizadores/contas-pessoas').send({}).expect(200)).body
    const entrar = async (nip) => {
      const c = contas.find((x) => x.identificacao === nip)
      const t = await amb.entrar(nip, c.senha) // entra-se com o NIP
      const nova = `Segura${nip.length}xyz2026`
      return amb.com((await amb.com(t).post('/api/mudar-senha').send({ atual: c.senha, nova }).expect(200)).body.token)
    }
    ana = await entrar('U001')
    rui = await entrar('U002')
  })
  after(() => amb.fechar())

  it('o utente não vê as fichas dos outros, mas vê a sua', async () => {
    assert.equal((await ana.get('/api/pessoas')).status, 403)
    const eu = (await ana.get('/api/eu')).body
    assert.equal(eu.unidadeNome, 'Departamento de Ensino')
    assert.equal((await ana.get(`/api/pessoas/${eu.pessoaId}`)).status, 200)
  })

  it('documento com original físico: envia, recebe, entrega e confirma o papel, encaminha e arquiva', async () => {
    const d = (await ana.post('/api/expediente').field('dados', JSON.stringify({ tipo: 'requerimento', assunto: 'Pedido de material didáctico', destinos: [logistica.id], temFisico: true, portador: 'Sold. Bumba' })).attach('anexos', PDF, 'pedido.pdf').expect(201)).body
    assert.match(d.protocolo, /^EXP-\d{4}-0001$/)
    assert.equal((await rui.get('/api/avisos')).body.porReceber, 1)
    assert.equal((await rui.get('/api/expediente?caixa=por_receber')).body[0].id, d.id)
    // ainda não recebido: não se encaminha
    assert.equal((await rui.post(`/api/expediente/${d.id}/encaminhar`).send({ destinos: [ensino.id] })).status, 400)
    await rui.post(`/api/expediente/${d.id}/receber`).send({}).expect(200)
    const m = (await ana.get(`/api/expediente/${d.id}`)).body.movimentos[0]
    await ana.post(`/api/expediente/${d.id}/movimentos/${m.id}/entregue`).send({ portador: 'Sold. Bumba' }).expect(200)
    const recebido = (await rui.post(`/api/expediente/${d.id}/receber`).send({ fisico: true }).expect(200)).body
    assert.equal(recebido.movimentos[0].fisico, 'recebido')
    assert.equal((await rui.get(`/api/anexos/${recebido.anexos[0].id}`)).status, 200)
    await rui.post(`/api/expediente/${d.id}/encaminhar`).send({ destinos: [ensino.id], nota: 'Para confirmar as quantidades' }).expect(200)
    await ana.post(`/api/expediente/${d.id}/receber`).send({}).expect(200)
    await ana.post(`/api/expediente/${d.id}/arquivar`).expect(200)
    assert.equal((await ana.get('/api/expediente?caixa=arquivo')).body.length, 1)
  })

  it('quem não está no percurso não vê o documento', async () => {
    const outra = (await adm.post('/api/unidades').send({ nome: 'Secretaria Geral' }).expect(201)).body
    const d = (await ana.post('/api/expediente').field('dados', JSON.stringify({ assunto: 'Assunto reservado', classificacao: 'confidencial', destinos: [outra.id] })).expect(201)).body
    assert.equal((await rui.get(`/api/expediente/${d.id}`)).status, 403)
  })

  it('mensagens: conversa directa, por ler, conversa da unidade só para quem lá está', async () => {
    const contactos = (await ana.get('/api/mensagens/contactos')).body
    const ruiId = contactos.find((c) => c.nome.includes('Rui')).id
    const c = (await ana.post('/api/mensagens/directa').send({ utilizadorId: ruiId }).expect(200)).body
    await ana.post(`/api/mensagens/conversas/${c.id}`).field('texto', 'Bom dia, camarada.').expect(201)
    assert.equal((await rui.get('/api/avisos')).body.mensagens, 1)
    const l = (await rui.get(`/api/mensagens/conversas/${c.id}`)).body
    assert.equal(l.mensagens[0].texto, 'Bom dia, camarada.')
    assert.equal((await rui.get('/api/avisos')).body.mensagens, 0)
    const daAna = (await ana.get('/api/mensagens/conversas')).body
    assert.deepEqual(daAna.slice(0, 2).map((x) => x.tipo), ['geral', 'unidade'])
    const unidadeAna = daAna.find((x) => x.tipo === 'unidade')
    assert.equal((await rui.get(`/api/mensagens/conversas/${unidadeAna.id}`)).status, 403)
    const geral = daAna.find((x) => x.tipo === 'geral')
    await ana.post(`/api/mensagens/conversas/${geral.id}`).field('texto', 'Aviso a todos').expect(201)
    assert.equal((await rui.get(`/api/mensagens/conversas/${geral.id}`)).body.mensagens.at(-1).texto, 'Aviso a todos')
  })
})

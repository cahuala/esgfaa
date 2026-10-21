/*
  Documentos da Repartição de Pessoal e Quadros (menu «Documentos»): cada um constrói-se com os dados do
  sistema e sai em PDF (com o brasão e a assinatura do Chefe da Repartição) ou em Excel.
  Um documento é { titulo, subtitulo, seccoes: [{ titulo, colunas, linhas, totais }], orientacao, nota }.
  ctx = { pessoas, ref, arvore, base (unidade escolhida ou null), propostos, licencas, domiciliares }.
*/

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pt = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : '')
const militar = (p) => p.tipo === 'militar'

// militares do mais graduado e mais antigo para o mais moderno; depois os civis pela categoria
// a ordem hierárquica que o servidor calcula (posto, unidade na orgânica, função, antiguidade, nome): «hierarquia»
export const porHierarquia = (a, b) => (a.hierarquia && b.hierarquia ? a.hierarquia - b.hierarquia : (b.grau ?? -1) - (a.grau ?? -1) || String(a.nome).localeCompare(String(b.nome), 'pt'))
  || (b.nivelCategoria ?? 0) - (a.nivelCategoria ?? 0)
  || String(a.dataAntiguidadePosto ?? a.dataCategoria ?? '9').localeCompare(String(b.dataAntiguidadePosto ?? b.dataCategoria ?? '9'))
  || a.nome.localeCompare(b.nome, 'pt')

function colunas(ctx) {
  return {
    n: { titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 10 },
    posto: { titulo: 'Posto / categoria', valor: (p) => (militar(p) ? p.postoNome : p.categoriaCivil || p.carreiraNome || 'Civil') },
    nome: { titulo: 'Nome', valor: (p) => p.nome },
    id: { titulo: 'NIP / N.º agente', valor: (p) => p.nip || p.numeroAgente || '' },
    ramo: { titulo: 'Ramo', valor: (p) => p.ramo || '—', alinhar: 'center' },
    unidade: { titulo: 'Unidade', valor: (p) => (p.unidadeId ? ctx.arvore.caminho(p.unidadeId) : '') || p.unidadeNome || '—' },
    cargo: { titulo: 'Cargo', valor: (p) => p.cargoNome || '' },
    situacao: { titulo: 'Situação', valor: (p) => (militar(p) ? (p.situacao === 'activo' ? p.efectividadeNome || 'Activo' : p.situacaoNome) : '') },
    estado: { titulo: 'Estado', valor: (p) => (militar(p) ? p.estadoNome || 'Ao serviço' : '') },
    genero: { titulo: 'Género', valor: (p) => p.generoNome, alinhar: 'center' },
    idade: { titulo: 'Idade', valor: (p) => p.idade ?? '', alinhar: 'center' },
    nascimento: { titulo: 'Nascimento', valor: (p) => p.dataNascimento, data: true },
    vinculo: { titulo: 'Vínculo', valor: (p) => p.vinculoNome },
    habilitacao: { titulo: 'Habilitações', valor: (p) => [p.habilitacaoNome, p.areaFormacao].filter(Boolean).join(' — ') },
    telefone: { titulo: 'Telefone', valor: (p) => p.telefone || '' },
    email: { titulo: 'E-mail', valor: (p) => p.email || '' },
    antiguidade: { titulo: 'Antiguidade no posto', valor: (p) => p.dataAntiguidadePosto, data: true },
    naturalidade: { titulo: 'Naturalidade', valor: (p) => [p.naturalidade, p.provincia].filter(Boolean).join(', ') },
  }
}

// agrupa numa secção por valor, pela ordem dada; cada secção já ordenada pela hierarquia
function seccoesPor(lista, chave, ordem, cols, { titulo = (k) => k, vazias = false } = {}) {
  const m = new Map(ordem.map((k) => [k, []]))
  for (const p of lista) {
    const k = chave(p)
    if (k === null || k === undefined) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(p)
  }
  return [...m].filter(([, l]) => vazias || l.length).map(([k, l]) => ({ titulo: titulo(k), colunas: cols, linhas: [...l].sort(porHierarquia) }))
}

const subtituloBase = (ctx, extra) => [ctx.base ? ctx.arvore.caminho(ctx.base) : 'Toda a Escola', extra].filter(Boolean).join(' · ')

// contagens por categoria (mapas numéricos)
const CATS = [['oficial_general', 'Of. Gen.'], ['oficial_superior', 'Of. Sup.'], ['oficial_capitao', 'Cap.'], ['oficial_subalterno', 'Subalt.'], ['sargento', 'Sarg.'], ['praca', 'Praças']]
function linhaContagem(rotulo, l) {
  const mil = l.filter(militar)
  const civ = l.length - mil.length
  return [rotulo, ...CATS.map(([c]) => mil.filter((p) => p.categoria === c).length), mil.length, civ, l.length]
}
const colsContagem = (primeira) => [primeira, ...CATS.map(([, t]) => t), 'Total militares', 'Civis', 'Total'].map((t, i) => ({ titulo: t, valor: (l) => l[i], alinhar: i ? 'center' : 'left' }))
const somar = (linhas) => ['TOTAL', ...linhas[0]?.slice(1).map((_, k) => linhas.reduce((n, l) => n + l[k + 1], 0)) ?? []]

function mapaEfectividade(ctx) {
  const { arvore, pessoas, ref } = ctx
  const raiz = ctx.base ? arvore.porId.get(ctx.base) : null
  const filhos = (raiz ? arvore.lista.filter((u) => u.paiId === raiz.id) : arvore.lista.filter((u) => u.nivel === 1))
  const usados = new Set()
  const unidades = filhos.map((u) => {
    const ids = arvore.descendentes(u.id)
    const l = pessoas.filter((p) => ids.has(p.unidadeId))
    l.forEach((p) => usados.add(p.id))
    return linhaContagem(`${u.sigla ? `${u.sigla} — ` : ''}${u.nome}`, l)
  })
  const restantes = pessoas.filter((p) => !usados.has(p.id))
  if (restantes.length) unidades.push(linhaContagem(raiz ? `${raiz.sigla || raiz.nome} (na própria unidade)` : 'Sem unidade atribuída', restantes))
  const mil = pessoas.filter(militar)
  const ramos = Object.entries(ref.ramos).map(([k, v]) => linhaContagem(v.nome, mil.filter((p) => p.ramo === k)))
  // situação em árvore (Lei n.º 13/18): cada nível com o recuo
  const colsSit = ['Situação (Lei n.º 13/18)', 'Artigo', 'Oficiais', 'Sargentos', 'Praças', 'Total'].map((t, i) => ({ titulo: t, valor: (l) => l[i], alinhar: i > 1 ? 'center' : 'left' }))
  const contaSit = (rotulo, artigo, l) => [rotulo, artigo, l.filter((p) => p.grupo === 'oficiais').length, l.filter((p) => p.grupo === 'sargentos').length, l.filter((p) => p.grupo === 'pracas').length, l.length]
  const sit = []
  for (const s of ref.arvoreSituacoes) {
    const ls = mil.filter((p) => p.situacao === s.id)
    sit.push(contaSit(s.nome, s.artigo, ls))
    for (const g of s.filhos) {
      const lg = ls.filter((p) => g.filhos.some((f) => f.id === p.efectividade))
      sit.push(contaSit(`    ${g.nome}`, g.artigo, lg))
      for (const f of g.filhos) sit.push(contaSit(`        ${f.nome}`, f.artigo, lg.filter((p) => p.efectividade === f.id)))
    }
  }
  const est = [['ao_servico', 'Ao serviço'], ...Object.entries(ref.estados)].map(([k, v]) => contaSit(v, '', mil.filter((p) => (p.estado || 'ao_servico') === k))).filter((l) => l[5] > 0 || l[0] === 'Ao serviço').map(([r, , ...n]) => [r, ...n])
  const colsEst = ['Estado', 'Oficiais', 'Sargentos', 'Praças', 'Total'].map((t, i) => ({ titulo: t, valor: (l) => l[i], alinhar: i ? 'center' : 'left' }))
  const generos = [['M', 'Masculino'], ['F', 'Feminino']].map(([k, v]) => linhaContagem(v, pessoas.filter((p) => p.genero === k)))
  return {
    titulo: 'Mapa de efectividade', subtitulo: subtituloBase(ctx), orientacao: 'landscape', semTotal: false,
    seccoes: [
      { titulo: 'Efectivo por unidade', colunas: colsContagem('Unidade'), linhas: unidades, totais: somar(unidades), contar: false },
      { titulo: 'Militares por ramo', colunas: colsContagem('Ramo'), linhas: ramos, totais: somar(ramos), contar: false },
      { titulo: 'Militares por situação', colunas: colsSit, linhas: sit, contar: false },
      { titulo: 'Militares por estado', colunas: colsEst, linhas: est, totais: ['TOTAL', ...[1, 2, 3, 4].map((k) => est.reduce((n, l) => n + l[k], 0))], contar: false },
      { titulo: 'Efectivo por género', colunas: colsContagem('Género'), linhas: generos, totais: somar(generos), contar: false },
    ],
    nota: `Efectivo total: ${pessoas.length} (${mil.length} militares e ${pessoas.length - mil.length} civis). Of. Gen. = oficiais generais; Of. Sup. = oficiais superiores; Cap. = capitães; Subalt. = oficiais subalternos.`,
  }
}

function listaEfectividade(ctx, { quem = 'todos' }) {
  const C = colunas(ctx)
  const l = ctx.pessoas.filter((p) => quem === 'todos' || p.tipo === quem)
  const ordem = ctx.arvore.lista.map((u) => u.id)
  const s = seccoesPor(l, (p) => p.unidadeId ?? 0, [...ordem, 0], [C.n, C.posto, C.nome, C.id, C.ramo, C.cargo, C.situacao, C.estado], { titulo: (k) => (k ? ctx.arvore.caminho(k) : 'Sem unidade atribuída') })
  return { titulo: 'Lista nominal de efectividade', subtitulo: subtituloBase(ctx, { militar: 'Militares', civil: 'Civis' }[quem]), orientacao: 'landscape', seccoes: s }
}

function porSituacao(ctx) {
  const C = colunas(ctx)
  const cols = [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.estado]
  const mil = ctx.pessoas.filter(militar)
  const seccoes = []
  for (const s of ctx.ref.arvoreSituacoes) {
    if (!s.filhos.length) seccoes.push({ titulo: `${s.nome} (${s.artigo})`, colunas: cols, linhas: mil.filter((p) => p.situacao === s.id).sort(porHierarquia) })
    for (const g of s.filhos) for (const f of g.filhos) seccoes.push({ titulo: `${s.nome} › ${g.nome} › ${f.nome} (${f.artigo})`, colunas: cols, linhas: mil.filter((p) => p.situacao === s.id && p.efectividade === f.id).sort(porHierarquia) })
  }
  return { titulo: 'Militares por situação (Lei n.º 13/18)', subtitulo: subtituloBase(ctx), seccoes, orientacao: 'landscape' }
}

function porEstado(ctx, { todos = false }) {
  const C = colunas(ctx)
  const mil = ctx.pessoas.filter((p) => militar(p) && (todos || p.estado))
  const ordem = [...Object.keys(ctx.ref.estados), ...(todos ? ['ao_servico'] : [])]
  return {
    titulo: 'Militares por estado', subtitulo: subtituloBase(ctx, todos ? '' : 'Destacados, em missão, em formação…'), orientacao: 'landscape',
    seccoes: seccoesPor(mil, (p) => p.estado || 'ao_servico', ordem, [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.cargo], { titulo: (k) => ctx.ref.estados[k] ?? 'Ao serviço' }),
  }
}

function porGenero(ctx, { quem = 'todos' }) {
  const C = colunas(ctx)
  const l = ctx.pessoas.filter((p) => quem === 'todos' || p.tipo === quem)
  const contar = (g) => ['oficiais', 'sargentos', 'pracas'].map((x) => l.filter((p) => p.genero === g && p.grupo === x).length)
  const resumo = [['Masculino', 'M'], ['Feminino', 'F']].map(([r, g]) => { const c = contar(g); const civ = l.filter((p) => p.genero === g && !militar(p)).length; return [r, ...c, civ, c.reduce((a, b) => a + b, 0) + civ] })
  const colsResumo = ['Género', 'Oficiais', 'Sargentos', 'Praças', 'Civis', 'Total'].map((t, i) => ({ titulo: t, valor: (x) => x[i], alinhar: i ? 'center' : 'left' }))
  return {
    titulo: 'Pessoal por género', subtitulo: subtituloBase(ctx, { militar: 'Militares', civil: 'Civis' }[quem]), orientacao: 'landscape',
    seccoes: [
      { titulo: 'Resumo', colunas: colsResumo, linhas: resumo, totais: ['TOTAL', ...resumo[0].slice(1).map((_, k) => resumo[0][k + 1] + resumo[1][k + 1])], contar: false },
      ...seccoesPor(l, (p) => p.genero || '?', ['F', 'M', '?'], [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.cargo, C.idade], { titulo: (k) => ({ F: 'Feminino', M: 'Masculino' }[k] ?? 'Género por indicar') }),
    ],
  }
}

function porPosto(ctx, { ramo = '' }) {
  const C = colunas(ctx)
  const mil = ctx.pessoas.filter((p) => militar(p) && (!ramo || p.ramo === ramo))
  const postos = (ctx.ref.postos[ramo || 'EXE'] ?? []).slice().sort((a, b) => b.grau - a.grau)
  return {
    titulo: 'Militares por posto', subtitulo: subtituloBase(ctx, ramo ? ctx.ref.ramos[ramo].nome : 'Os três ramos'), orientacao: 'landscape',
    seccoes: seccoesPor(mil, (p) => p.posto, postos.map((p) => p.id), [C.n, C.nome, C.id, C.ramo, C.antiguidade, C.unidade, C.cargo], { titulo: (k) => mil.find((p) => p.posto === k)?.postoNome ?? k }),
  }
}

// lista agrupada por um campo simples
const agrupada = (titulo, chave, ordem, nome, cols, filtro = () => true) => (ctx) => {
  const C = colunas(ctx)
  const l = ctx.pessoas.filter(filtro)
  return { titulo, subtitulo: subtituloBase(ctx), orientacao: 'landscape', seccoes: seccoesPor(l, chave, ordem(ctx), cols(C), { titulo: (k) => nome(ctx, k) }) }
}

const FAIXAS = [['18-29', 'Menos de 30 anos'], ['30-39', '30 a 39 anos'], ['40-49', '40 a 49 anos'], ['50-59', '50 a 59 anos'], ['60-200', '60 anos ou mais']]
const faixa = (p) => FAIXAS.find(([k]) => { const [a, b] = k.split('-').map(Number); return p.idade !== null && p.idade >= a && p.idade <= b })?.[0] ?? null

function propostos(ctx, { tipo, estado = '' }) {
  const C = colunas(ctx)
  const ref = ctx.ref
  const l = ctx.propostos.filter((i) => i.tipo === tipo).sort(porHierarquia)
  const idn = { titulo: 'NIP / N.º agente', valor: (i) => i.nip || i.numeroAgente || '' }
  const atual = { titulo: 'Posto / categoria', valor: (i) => i.postoAtualNome || i.categoriaAtual || '' }
  const prop = { titulo: 'Proposta', valor: (i) => `N.º ${i.propostaId}`, alinhar: 'center' }
  const cumpre = { titulo: 'Lei', valor: (i) => (i.cumpre ? 'Cumpre' : 'Não cumpre'), alinhar: 'center' }
  const especificas = {
    promocao: [{ titulo: 'Posto proposto', valor: (i) => i.postoPropostoNome }],
    graduacao: [{ titulo: 'Graduado em', valor: (i) => i.postoPropostoNome }, { titulo: 'Período', valor: (i) => [pt(i.inicio), pt(i.fim)].filter(Boolean).join(' a ') }],
    nomeacao: [{ titulo: 'Cargo actual', valor: (i) => i.cargoAtualNome }, { titulo: 'Cargo proposto', valor: (i) => i.cargoPropostoNome }],
    exoneracao: [{ titulo: 'Cargo de que é exonerado', valor: (i) => i.cargoAtualNome }],
    progressao: [{ titulo: 'Categoria proposta', valor: (i) => i.categoriaProposta }],
    curso: [{ titulo: 'Curso', valor: (i) => i.curso }, { titulo: 'Período', valor: (i) => [pt(i.inicio), pt(i.fim)].filter(Boolean).join(' a ') }],
  }[tipo] ?? []
  const cols = [C.n, atual, { titulo: 'Nome', valor: (i) => i.nome }, idn, { titulo: 'Unidade', valor: (i) => i.unidadeNome }, ...especificas, prop, cumpre]
  // uma secção por proposta (cada uma tem o seu título e estado)
  const porProposta = [...new Map(l.map((i) => [i.propostaId, i])).values()]
  return {
    titulo: `Pessoal proposto — ${ref.tiposProposta[tipo]?.nome ?? tipo}`, subtitulo: estado ? ref.estadosProposta[estado] : 'Propostas em preparação e enviadas', orientacao: 'landscape',
    seccoes: porProposta.map((pr) => ({ titulo: `Proposta n.º ${pr.propostaId} — ${pr.titulo} (${pr.estadoNome})`, colunas: cols, linhas: l.filter((i) => i.propostaId === pr.propostaId) })),
  }
}

function licencas(ctx) {
  const C = colunas(ctx)
  const cols = [C.n, { titulo: 'Posto / categoria', valor: (x) => x.postoNome }, { titulo: 'Nome', valor: (x) => x.nome }, { titulo: 'NIP / N.º agente', valor: (x) => x.identificacao }, { titulo: 'Início', valor: (x) => x.inicio, data: true }, { titulo: 'Fim', valor: (x) => x.fim, data: true }, { titulo: 'Dias', valor: (x) => x.dias ?? '', alinhar: 'center' }]
  const ids = new Set(ctx.pessoas.map((p) => p.id))
  const l = ctx.licencas.filter((x) => ids.has(x.pessoaId))
  return { titulo: 'Licenças em curso', subtitulo: subtituloBase(ctx), seccoes: seccoesPor(l, (x) => x.tipoNome, [], cols).map((s) => ({ ...s, linhas: s.linhas })) }
}

function aniversariantes(ctx, { mes }) {
  const C = colunas(ctx)
  const m = Number(mes)
  const l = ctx.pessoas.filter((p) => p.dataNascimento && Number(p.dataNascimento.slice(5, 7)) === m).sort((a, b) => a.dataNascimento.slice(8).localeCompare(b.dataNascimento.slice(8)))
  return { titulo: `Aniversariantes de ${MESES[m - 1]}`, subtitulo: subtituloBase(ctx), seccoes: [{ colunas: [{ titulo: 'Dia', valor: (p) => p.dataNascimento.slice(8, 10), alinhar: 'center' }, C.posto, C.nome, C.unidade, { titulo: 'Faz', valor: (p) => `${new Date().getFullYear() - Number(p.dataNascimento.slice(0, 4))} anos`, alinhar: 'center' }, C.telefone], linhas: l }], assinatura: false }
}

function reservaReforma(ctx, { ano }) {
  const C = colunas(ctx)
  const mil = ctx.pessoas.filter(militar)
  const cols = (campo) => [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.idade, { titulo: 'Data prevista', valor: (p) => p[campo], data: true }]
  const noAno = (campo) => mil.filter((p) => p[campo] && p[campo].slice(0, 4) <= ano && (p[campo].slice(0, 4) === ano || p[campo] < new Date().toISOString().slice(0, 10))).sort((a, b) => a[campo].localeCompare(b[campo]))
  return {
    titulo: `Passagem à reserva e à reforma — ${ano}`, subtitulo: subtituloBase(ctx, 'Pelos limites de idade e de tempo da Lei n.º 13/18 (inclui os atrasados)'), orientacao: 'landscape',
    seccoes: [{ titulo: 'Passagem à reserva', colunas: cols('dataReserva'), linhas: noAno('dataReserva') }, { titulo: 'Passagem à reforma', colunas: cols('dataReforma'), linhas: noAno('dataReforma') }],
  }
}

function simples(titulo, filtro, cols, { ordem = porHierarquia, assinatura, extra } = {}) {
  return (ctx, o) => {
    const C = colunas(ctx)
    return { titulo, subtitulo: subtituloBase(ctx, extra), orientacao: 'landscape', assinatura, seccoes: [{ colunas: cols(C), linhas: ctx.pessoas.filter((p) => filtro(p, o)).sort(ordem) }] }
  }
}

const QUEM = { campo: 'quem', rotulo: 'Pessoal', opcoes: [['todos', 'Militares e civis'], ['militar', 'Só militares'], ['civil', 'Só civis']] }

/*
  Catálogo: grupo, título, o que tem, as opções (com valores iniciais) e o que precisa de carregar.
*/
export const DOCUMENTOS = [
  // ---------- efectividade ----------
  { id: 'mapa-efectividade', grupo: 'efectividade', titulo: 'Mapa de efectividade', icone: 'fa-table', descricao: 'Efectivo por unidade e categoria, por ramo, por situação (em árvore, Lei n.º 13/18), por estado e por género, com totais.', fazer: mapaEfectividade },
  { id: 'lista-efectividade', grupo: 'efectividade', titulo: 'Lista nominal de efectividade', icone: 'fa-list-ol', descricao: 'Todos, unidade a unidade (pela orgânica), do mais graduado e antigo ao mais moderno, com cargo, situação e estado.', opcoes: [QUEM], fazer: listaEfectividade },
  { id: 'situacao', grupo: 'efectividade', titulo: 'Militares por situação', icone: 'fa-sitemap', descricao: 'Activo em efectividade (comissão normal, inactividade temporária), fora de efectividade (comissão especial, licenças), reserva e reforma.', fazer: porSituacao },
  { id: 'estado', grupo: 'efectividade', titulo: 'Militares por estado', icone: 'fa-route', descricao: 'Destacados, em missão, em formação, em substituição, a cargo da Direcção, suspensos, aguardando colocação…', opcoes: [{ campo: 'todos', rotulo: 'Incluir', opcoes: [['', 'Só quem tem estado'], ['1', 'Também os que estão ao serviço']] }], fazer: (c, o) => porEstado(c, { todos: Boolean(o.todos) }) },
  { id: 'licencas', grupo: 'efectividade', titulo: 'Licenças em curso', icone: 'fa-plane-departure', descricao: 'Quem está de licença hoje, por tipo de licença.', precisa: 'licencas', fazer: licencas },

  // ---------- propostas ----------
  ...['promocao', 'nomeacao', 'curso', 'graduacao', 'exoneracao', 'progressao'].map((tipo) => ({
    id: `propostos-${tipo}`, grupo: 'propostas', tipo,
    titulo: { promocao: 'Militares propostos para promoção', nomeacao: 'Pessoal proposto para nomeação', curso: 'Pessoal proposto para cursos', graduacao: 'Militares propostos para graduação', exoneracao: 'Pessoal proposto para exoneração', progressao: 'Civis propostos para progressão' }[tipo],
    icone: { promocao: 'fa-chevron-up', nomeacao: 'fa-user-tag', curso: 'fa-graduation-cap', graduacao: 'fa-star-half-alt', exoneracao: 'fa-user-minus', progressao: 'fa-briefcase' }[tipo],
    descricao: { promocao: 'Posto actual e proposto, proposta e se cumpre as condições da lei.', nomeacao: 'Cargo actual e cargo proposto, por proposta.', curso: 'Curso e período de cada um, por proposta.', graduacao: 'Posto da graduação e período.', exoneracao: 'Cargo de que é exonerado.', progressao: 'Categoria actual e proposta.' }[tipo],
    opcoes: [{ campo: 'estado', rotulo: 'Propostas', opcoes: [['', 'Em preparação e enviadas'], ['rascunho', 'Só em preparação'], ['enviada', 'Só enviadas'], ['concluida', 'Concluídas']] }],
    precisa: 'propostos', fazer: (c, o) => propostos(c, { tipo, estado: o.estado }),
  })),
  { id: 'elegiveis', grupo: 'propostas', titulo: 'Militares em condições de promoção', icone: 'fa-medal', descricao: 'Quem cumpre hoje as condições da Lei n.º 13/18 para o posto seguinte, por posto.', fazer: (ctx) => {
    const C = colunas(ctx)
    const l = ctx.pessoas.filter((p) => militar(p) && p.elegivelPromocao)
    return { titulo: 'Militares em condições de promoção', subtitulo: subtituloBase(ctx), orientacao: 'landscape', seccoes: seccoesPor(l, (p) => p.posto, [...new Set(l.slice().sort(porHierarquia).map((p) => p.posto))], [C.n, C.nome, C.id, C.ramo, C.antiguidade, { titulo: 'Posto seguinte', valor: (p) => p.proximoPostoNome }, C.unidade], { titulo: (k) => l.find((p) => p.posto === k)?.postoNome ?? k }) }
  } },

  // ---------- listas ----------
  { id: 'genero', grupo: 'listas', titulo: 'Pessoal por género', icone: 'fa-venus-mars', descricao: 'Resumo por categoria e a lista das mulheres e dos homens.', opcoes: [QUEM], fazer: porGenero },
  { id: 'posto', grupo: 'listas', titulo: 'Militares por posto', icone: 'fa-star', descricao: 'Um grupo por posto, do mais alto ao mais baixo, por antiguidade.', opcoes: [{ campo: 'ramo', rotulo: 'Ramo', opcoes: [['', 'Os três ramos'], ['EXE', 'Exército'], ['FAN', 'Força Aérea'], ['MGA', 'Marinha']] }], fazer: porPosto },
  { id: 'ramo', grupo: 'listas', titulo: 'Militares por ramo', icone: 'fa-shield-alt', descricao: 'Exército, Força Aérea Nacional e Marinha de Guerra.', fazer: agrupada('Militares por ramo', (p) => (militar(p) ? p.ramo : null), (c) => Object.keys(c.ref.ramos), (c, k) => c.ref.ramos[k]?.nome ?? k, (C) => [C.n, C.posto, C.nome, C.id, C.unidade, C.cargo]) },
  { id: 'fps', grupo: 'listas', titulo: 'Por forma de prestação de serviço', icone: 'fa-id-badge', descricao: 'Quadro Permanente, contrato, serviço militar obrigatório e reserva.', fazer: agrupada('Militares por forma de prestação de serviço', (p) => (militar(p) ? p.fps : null), (c) => Object.keys(c.ref.formasServico), (c, k) => c.ref.formasServico[k]?.nome ?? k, (C) => [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade]) },
  { id: 'categoria', grupo: 'listas', titulo: 'Militares por categoria', icone: 'fa-layer-group', descricao: 'Oficiais generais, superiores, capitães, subalternos, sargentos e praças.', fazer: agrupada('Militares por categoria', (p) => (militar(p) ? p.categoria : null), (c) => Object.keys(c.ref.categorias), (c, k) => c.ref.categorias[k]?.nome ?? k, (C) => [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.cargo]) },
  { id: 'civis', grupo: 'listas', titulo: 'Pessoal civil por categoria', icone: 'fa-briefcase', descricao: 'Técnicos superiores, técnicos médios, administrativos, auxiliares e docentes civis.', fazer: agrupada('Pessoal civil por categoria', (p) => (militar(p) ? null : p.carreiraNome || 'Sem categoria'), (c) => Object.values(c.ref.carreirasCivis).sort((a, b) => b.nivel - a.nivel).map((x) => x.nome), (c, k) => k, (C) => [C.n, { ...C.posto, titulo: 'Classe' }, C.nome, C.id, C.unidade, C.cargo, C.habilitacao]) },
  { id: 'lista-civis', grupo: 'listas', titulo: 'Lista geral do pessoal civil', icone: 'fa-id-card-alt', descricao: 'O modelo da Escola: N.º de agente, INSS, nome, categoria, nascimento, admissão e habilitações.', fazer: (ctx) => {
    const l = ctx.pessoas.filter((p) => p.tipo === 'civil' && p.vinculo !== 'domiciliar').sort(porHierarquia)
    const M = (v) => String(v ?? '').toLocaleUpperCase('pt')
    return { titulo: 'Lista geral do pessoal civil da ESG/EMGFAA', orientacao: 'landscape', seccoes: [{ colunas: [
      { titulo: 'N/O', valor: (_, i) => String(i + 1).padStart(2, '0'), alinhar: 'center', largura: 10 }, { titulo: 'Desp. Nº', valor: () => '', largura: 16 }, { titulo: 'Nº Agente', valor: (p) => p.numeroAgente, largura: 18 }, { titulo: 'Nº INSS', valor: (p) => p.inss, largura: 20 },
      { titulo: 'Nome', valor: (p) => M(p.nome) }, { titulo: 'Nascimento', valor: (p) => p.dataNascimento, data: true }, { titulo: 'Categoria', valor: (p) => M(p.categoriaCivil || p.carreiraNome) },
      { titulo: 'Admissão', valor: (p) => p.dataAdmissao, data: true }, { titulo: 'Habilitações literárias', valor: (p) => M(p.habilitacaoNome), largura: 32 },
    ], linhas: l }] }
  } },
  { id: 'docentes', grupo: 'listas', titulo: 'Corpo docente', icone: 'fa-chalkboard-teacher', descricao: 'Efectivos e colaboradores, militares e civis, com a categoria e as habilitações.', fazer: (ctx) => {
    const doc = ctx.pessoas.filter((p) => p.docente ?? p.vinculo === 'docente').sort(porHierarquia)
    const C = colunas(ctx)
    const cols = [C.n, C.posto, C.nome, C.id, { titulo: 'Militar / civil', valor: (p) => (militar(p) ? `Militar (${p.ramo})` : 'Civil'), alinhar: 'center' }, { titulo: 'Categoria do docente', valor: (p) => p.categoriaDocente || '' }, C.habilitacao, { titulo: 'Função ou cargo', valor: (p) => p.funcaoActual || p.cargoNome || '' }, C.telefone]
    const grupo = (t) => doc.filter((p) => (t ? p.tipoDocente === t : !p.tipoDocente))
    return { titulo: 'Corpo docente da Escola Superior de Guerra', subtitulo: subtituloBase(ctx), orientacao: 'landscape', seccoes: [{ titulo: 'Docentes efectivos', colunas: cols, linhas: grupo('efectivo') }, { titulo: 'Docentes colaboradores', colunas: cols, linhas: grupo('colaborador') }, { titulo: 'Tipo de docente por indicar', colunas: cols, linhas: grupo(null) }] }
  } },
  { id: 'estudantes', grupo: 'listas', titulo: 'Estudantes (cursantes)', icone: 'fa-user-graduate', descricao: 'Militares e civis a frequentar cursos da Escola.', fazer: simples('Estudantes', (p) => p.discente ?? p.vinculo === 'estudante', (C) => [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade]) },
  { id: 'habilitacao', grupo: 'listas', titulo: 'Por habilitações literárias', icone: 'fa-certificate', descricao: 'Do doutoramento ao ensino de base.', fazer: agrupada('Pessoal por habilitações literárias', (p) => p.habilitacao || 'nenhuma', (c) => [...Object.keys(c.ref.habilitacoes).reverse(), 'nenhuma'], (c, k) => c.ref.habilitacoes[k] ?? 'Por indicar', (C) => [C.n, C.posto, C.nome, C.id, { titulo: 'Área de formação', valor: (p) => p.areaFormacao }, C.unidade]) },
  { id: 'provincia', grupo: 'listas', titulo: 'Por província de naturalidade', icone: 'fa-map-marker-alt', descricao: 'Pessoal agrupado pela província onde nasceu.', fazer: agrupada('Pessoal por província de naturalidade', (p) => p.provincia || 'Por indicar', (c) => [...c.ref.provincias, 'Por indicar'], (c, k) => k, (C) => [C.n, C.posto, C.nome, C.id, C.naturalidade, C.unidade]) },
  { id: 'idade', grupo: 'listas', titulo: 'Por faixa etária', icone: 'fa-birthday-cake', descricao: 'Menos de 30, 30 a 39, 40 a 49, 50 a 59 e 60 anos ou mais.', fazer: agrupada('Pessoal por faixa etária', faixa, () => FAIXAS.map(([k]) => k), (c, k) => FAIXAS.find(([x]) => x === k)[1], (C) => [C.n, C.posto, C.nome, C.id, C.nascimento, C.idade, C.unidade]) },
  { id: 'aniversarios', grupo: 'listas', titulo: 'Aniversariantes do mês', icone: 'fa-gift', descricao: 'Por dia, com a idade que fazem e o telefone.', opcoes: [{ campo: 'mes', rotulo: 'Mês', opcoes: MESES.map((m, i) => [String(i + 1), m]), inicial: String(new Date().getMonth() + 1) }], fazer: aniversariantes },
  { id: 'reserva', grupo: 'listas', titulo: 'Passagem à reserva e à reforma', icone: 'fa-hourglass-half', descricao: 'Militares que atingem os limites no ano escolhido (e os que já passaram do prazo).', opcoes: [{ campo: 'ano', rotulo: 'Ano', opcoes: [0, 1, 2, 3].map((k) => { const a = String(new Date().getFullYear() + k); return [a, a] }), inicial: String(new Date().getFullYear()) }], fazer: reservaReforma },
  { id: 'graduados', grupo: 'listas', titulo: 'Militares graduados', icone: 'fa-star-half-alt', descricao: 'Militares com graduação em vigor.', fazer: (ctx) => {
    const C = colunas(ctx)
    const nomePosto = (p, id) => (ctx.ref.postos[p.ramo] ?? ctx.ref.postos.EXE).find((x) => x.id === id)?.nome ?? id
    return { titulo: 'Militares graduados', subtitulo: subtituloBase(ctx), orientacao: 'landscape', seccoes: [{ colunas: [C.n, C.posto, C.nome, C.id, { titulo: 'Graduado em', valor: (p) => p.graduacoes.map((g) => nomePosto(p, g.posto)).join(', ') }, C.unidade], linhas: ctx.pessoas.filter((p) => militar(p) && p.graduacoes?.length > 0).sort(porHierarquia) }] }
  } },
  { id: 'sem-cargo', grupo: 'listas', titulo: 'Pessoal sem cargo', icone: 'fa-chair', descricao: 'Quem não ocupa nenhum cargo da orgânica.', opcoes: [QUEM], fazer: simples('Pessoal sem cargo', (p, o) => !p.cargoId && (o.quem === 'todos' || !o.quem || p.tipo === o.quem), (C) => [C.n, C.posto, C.nome, C.id, C.ramo, C.unidade, C.vinculo]) },
  { id: 'domiciliares', grupo: 'listas', titulo: 'Empregados domiciliares', icone: 'fa-house-user', descricao: 'Por oficial a quem estão afectos.', precisa: 'domiciliares', fazer: (ctx) => {
    const C = colunas(ctx)
    const l = ctx.domiciliares
    return { titulo: 'Empregados domiciliares', subtitulo: subtituloBase(ctx), seccoes: seccoesPor(l, (p) => p.militarAlocadoNome || 'Sem oficial indicado', [], [C.n, C.nome, C.id, { titulo: 'BI', valor: (p) => p.bi || '' }, { titulo: 'Admissão', valor: (p) => p.dataAdmissao, data: true }, C.telefone]).map((s) => ({ ...s, linhas: s.linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt')) })) }
  } },
  { id: 'contactos', grupo: 'listas', titulo: 'Lista de contactos', icone: 'fa-address-book', descricao: 'Telefone e e-mail, por unidade.', fazer: (ctx) => {
    const C = colunas(ctx)
    return { titulo: 'Lista de contactos', subtitulo: subtituloBase(ctx), assinatura: false, orientacao: 'landscape', seccoes: seccoesPor(ctx.pessoas, (p) => p.unidadeId ?? 0, [...ctx.arvore.lista.map((u) => u.id), 0], [C.n, C.posto, C.nome, C.cargo, C.telefone, C.email], { titulo: (k) => (k ? ctx.arvore.caminho(k) : 'Sem unidade atribuída') }) }
  } },
]

export const GRUPOS_DOCUMENTOS = {
  efectividade: { titulo: 'Efectividade', icone: 'fa-table', texto: 'Mapas e listas do efectivo da Escola: por unidade, situação (Lei n.º 13/18) e estado.' },
  propostas: { titulo: 'Propostas', icone: 'fa-file-signature', texto: 'Pessoal proposto para promoção, nomeação, cursos, graduação, exoneração e progressão.' },
  listas: { titulo: 'Listas', icone: 'fa-list', texto: 'Listas por género, posto, ramo, categoria, habilitações, idade, província e outras.' },
}

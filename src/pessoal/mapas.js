/*
  Mapas de Controlo Estatístico da DPQ (Mod. 2 a 5) e as Ausências temporárias e definitivas, como os
  modelos em papel: as linhas são as unidades da orgânica (e os agregados), as colunas os graus militares.
  Cada mapa sai como um documento de relatorios.js ({ titulo, subtitulo, modelo, seccoes }) com o
  cabeçalho em vários andares (cabeca) e os títulos das colunas ao alto.
*/
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const militar = (p) => p.tipo === 'militar'
const de = (...postos) => (p) => militar(p) && postos.includes(p.posto)
const ou = (...fs) => (p) => fs.some((f) => f(p))
const qp = (p) => p.fps === 'QP'
const smo = (p) => p.fps === 'SMO'

// ---------- período (um mês) ----------
export const OPCAO_MES = (() => {
  const h = new Date()
  const meses = Array.from({ length: 12 }, (_, k) => { const d = new Date(h.getFullYear(), h.getMonth() - k, 1); return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, `${MESES[d.getMonth()]} de ${d.getFullYear()}`] })
  return { campo: 'mes', rotulo: 'Período', opcoes: meses, inicial: meses[0][0] }
})()
function periodo(mes) {
  const [a, m] = (mes || OPCAO_MES.inicial).split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  const hoje = new Date()
  const fim = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() : ultimo
  const iso = (d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { inicio: iso(1), fim: iso(fim), texto: `Referente ao período de 01 de ${MESES[m - 1]} à ${String(fim).padStart(2, '0')} de ${MESES[m - 1]} de ${a}` }
}

// ---------- colunas em árvore: { t, filhos } ou folha { t, f(p) } / { t, v(linha) } ----------
const folhas = (nos) => nos.flatMap((n) => (n.filhos ? folhas(n.filhos) : [n]))
const fundura = (nos) => Math.max(...nos.map((n) => (n.filhos ? 1 + fundura(n.filhos) : 1)))
function cabeca(nos, { primeira = 'N/O', segunda = 'DESIGNAÇÃO', topo, numerar, alto = 22, semN }) {
  const arvore = topo ? [{ t: topo, filhos: nos }] : nos
  const andares = fundura(arvore)
  const linhas = Array.from({ length: andares }, () => [])
  if (!semN) linhas[0].push({ content: primeira, rowSpan: andares, styles: { cellWidth: 8 } })
  linhas[0].push({ content: segunda, rowSpan: andares })
  const andar = (lista, k) => {
    for (const n of lista) {
      if (n.filhos) { linhas[k].push({ content: n.t, colSpan: folhas(n.filhos).length }); andar(n.filhos, k + 1) } else linhas[k].push({ content: n.t, rowSpan: andares - k, vertical: true, alto: k === andares - 1 ? alto : 0 })
    }
  }
  andar(arvore, 0)
  const k0 = semN ? 1 : 2
  if (numerar) linhas.push([...Array.from({ length: k0 }, (_, i) => String(i + 1)), ...folhas(nos).map((_, i) => String(i + k0 + 1))].map((c) => ({ content: c, styles: { fontStyle: 'normal', fontSize: 5.5 } })))
  return linhas
}
// as colunas do corpo (e do Excel, com o caminho no título)
function colunasDe(nos, rotulo, semN) {
  const caminhos = []
  const andar = (lista, pre) => { for (const n of lista) { if (n.filhos) andar(n.filhos, [...pre, n.t]); else caminhos.push([...pre, n.t].join(' — ')) } }
  andar(nos, [])
  return [
    ...(semN ? [] : [{ titulo: 'N/O', valor: (l) => l.n ?? '', alinhar: 'center', largura: 8 }]),
    { titulo: rotulo, valor: (l) => l.rotulo },
    ...caminhos.map((titulo, i) => ({ titulo, valor: (l) => l.valores?.[i] ?? '', alinhar: 'center' })),
  ]
}
const contar = (nos, l) => folhas(nos).map((c) => l.filter(c.f).length)
const numerarLinhas = (linhas) => { let n = 0; return linhas.map((l) => (l.faixa ? l : { ...l, n: String(++n).padStart(2, '0') })) }

// ---------- linhas: as unidades da orgânica e os agregados ----------
const colaborador = (p) => (p.docente ?? p.vinculo === 'docente') && p.tipoDocente === 'colaborador'
const estrangeiro = (re) => (p) => colaborador(p) && re.test(p.nacionalidade || '')
const angolano = (p) => !/russ|portug/i.test(p.nacionalidade || '')
const nada = () => false
const AGREGADOS_MOD2 = [
  ['Pessoal à espera de nomeação (destac.)', (p) => p.estado === 'aguardando_colocacao'],
  ['Professores colaboradores (militares)', (p) => militar(p) && colaborador(p) && angolano(p) && p.situacao === 'activo'],
  ['Professores colaboradores (ref.)', (p) => militar(p) && colaborador(p) && angolano(p) && p.situacao !== 'activo'],
  ['Professores colaboradores (civis)', (p) => !militar(p) && colaborador(p) && angolano(p)],
  ['Orientadores', nada],
  ['Professores russos', estrangeiro(/russ/i)],
  ['Professores portugueses', estrangeiro(/portug/i)],
  ['Colaboradores do Centro Médico', nada],
  ['Empresa Frimei', nada],
  ['Empresa 5A e Proterco', nada],
  ['Em regime de destacamento', (p) => p.estado === 'destacado'],
]
const AGREGADOS_MOD3 = [
  ['Pessoal à espera de nomeação', (p) => p.estado === 'aguardando_colocacao'],
  ['Professores angolanos — colaboradores', (p) => colaborador(p) && angolano(p)],
  ['Professores russos', estrangeiro(/russ/i)],
  ['Professores portugueses', estrangeiro(/portug/i)],
  ['Colaboradores do Centro Médico', nada],
  ['Empresa Frimei', nada],
  ['Empresa 5A e Proteco', nada],
  ['Em regime de destacamento', (p) => p.estado === 'destacado'],
]
// cada pessoa entra numa só linha: no primeiro agregado em que cabe; senão, na unidade onde está colocada
function repartir(ctx, agregados = []) {
  const { arvore } = ctx
  const pessoas = ctx.pessoas.filter((p) => p.vinculo !== 'estudante')
  const raiz = ctx.base ? arvore.porId.get(ctx.base) : null
  const unidades = raiz ? arvore.lista.filter((u) => u.paiId === raiz.id) : arvore.lista.filter((u) => u.nivel === 1)
  const ag = agregados.map(([rotulo]) => ({ rotulo, l: [] }))
  const resto = []
  for (const p of pessoas) { const k = agregados.findIndex(([, f]) => f(p)); if (k >= 0) ag[k].l.push(p); else resto.push(p) }
  const usados = new Set()
  const linhas = unidades.map((u) => {
    const ids = arvore.descendentes(u.id)
    const l = resto.filter((p) => ids.has(p.unidadeId))
    l.forEach((p) => usados.add(p.id))
    return { rotulo: u.nome, l, unidade: u }
  })
  const sem = resto.filter((p) => !usados.has(p.id))
  if (sem.length) linhas.push({ rotulo: raiz ? `${raiz.nome} (na própria unidade)` : 'Sem unidade atribuída', l: sem, unidade: raiz })
  return { linhas, agregados: ag }
}

// ---------- graus militares (as colunas dos Mod. 3, 4 e 5) ----------
const OG = ['general', 'general_exercito', 'tenente_general', 'brigadeiro']
const OS = ['coronel', 'tenente_coronel', 'major']
const SUB = ['tenente', 'subtenente', 'aspirante']
const SARG = ['sargento_maior', 'sargento_chefe', 'sargento_ajudante', 'primeiro_sargento', 'segundo_sargento', 'subsargento']
const PRACAS = ['primeiro_cabo', 'segundo_cabo', 'soldado']
const oficiais = de(...OG, ...OS, 'capitao', ...SUB)
// o General (e o General de Exército) só aparece quando há algum: os Mod. 3 e 5 não têm a coluna
const generais = (ctx) => ctx.pessoas.some(de('general', 'general_exercito'))
function grausSimples(comGeneral) {
  return [
    { t: 'Oficiais generais', filhos: [...(comGeneral ? [{ t: 'General', f: de('general', 'general_exercito') }] : []), { t: 'Tte-General', f: de('tenente_general') }, { t: 'Brigadeiro', f: de('brigadeiro') }, { t: 'Soma', f: de(...OG) }] },
    { t: 'Oficiais superiores', filhos: [{ t: 'Coronel', f: de('coronel') }, { t: 'Tte-Coronel', f: de('tenente_coronel') }, { t: 'Major', f: de('major') }, { t: 'Soma', f: de(...OS) }] },
    { t: 'Capitão', f: de('capitao') },
    { t: 'Of. subalternos', filhos: [{ t: 'Tenente', f: de('tenente') }, { t: 'Sub-Tenente', f: de('subtenente') }, { t: 'Aspirante', f: de('aspirante') }, { t: 'Soma', f: de(...SUB) }] },
    { t: 'Total oficiais', f: oficiais },
    { t: 'Sargentos', filhos: [{ t: 'Sgt. Maior', f: de('sargento_maior') }, { t: 'Sgt. Chefe', f: de('sargento_chefe') }, { t: 'Sgt. Ajudante', f: de('sargento_ajudante') }, { t: '1.º Sargento', f: de('primeiro_sargento') }, { t: '2.º Sargento', f: de('segundo_sargento') }, { t: 'Sub-Sargento', f: de('subsargento') }, { t: 'T. Sargentos', f: de(...SARG) }] },
    { t: 'Praças', filhos: [{ t: '1.º Cabo', f: de('primeiro_cabo') }, { t: '2.º Cabo', f: de('segundo_cabo') }, { t: 'Soldado', f: de('soldado') }, { t: 'Total praças', f: de(...PRACAS) }] },
    { t: 'Total geral', f: militar },
  ]
}
// Mod. 3: tenentes, subtenentes, 2.º sargentos, cabos e soldados divididos pela forma de prestação de serviço
function grausMod3(comGeneral) {
  return [
    { t: 'Ofic. gener.', filhos: [...(comGeneral ? [{ t: 'General', f: de('general', 'general_exercito') }] : []), { t: 'Tte-General', f: de('tenente_general') }, { t: 'Brigadeiro', f: de('brigadeiro') }, { t: 'Soma', f: de(...OG) }] },
    { t: 'Ofic. superiores', filhos: [{ t: 'Coronel', f: de('coronel') }, { t: 'Tte-Coronel', f: de('tenente_coronel') }, { t: 'Major', f: de('major') }, { t: 'Soma', f: de(...OS) }] },
    { t: 'Capitão', f: de('capitao') },
    { t: 'Ofic. subalternos', filhos: [
      { t: 'Tenente', filhos: [{ t: 'QP', f: (p) => de('tenente')(p) && qp(p) }, { t: 'SMC', f: (p) => de('tenente')(p) && !qp(p) }] },
      { t: 'Sub-Tte', filhos: [{ t: 'QP', f: (p) => de('subtenente')(p) && qp(p) }, { t: 'SMC', f: (p) => de('subtenente')(p) && !qp(p) }] },
      { t: 'Aspirante', f: de('aspirante') }, { t: 'Soma', f: de(...SUB) },
    ] },
    { t: 'Total oficiais', f: oficiais },
    { t: 'Sargentos', filhos: [
      { t: 'Sgt-Maior', f: de('sargento_maior') }, { t: 'Sgt-Chefe', f: de('sargento_chefe') }, { t: 'Sgt-Ajudante', f: de('sargento_ajudante') }, { t: '1.º Sargento', f: de('primeiro_sargento') },
      { t: '2.º Sgt', filhos: [{ t: 'QP', f: (p) => de('segundo_sargento')(p) && qp(p) }, { t: 'SMC', f: (p) => de('segundo_sargento')(p) && !qp(p) }] },
      { t: 'Sub-Sargento', f: de('subsargento') }, { t: 'T. Sargentos', f: de(...SARG) },
    ] },
    { t: 'Praças', filhos: [
      { t: '1.º Cabo', f: de('primeiro_cabo') },
      { t: '2.º Cabo', filhos: [{ t: 'SMC', f: (p) => de('segundo_cabo')(p) && !smo(p) }, { t: 'SMO', f: (p) => de('segundo_cabo')(p) && smo(p) }] },
      { t: 'Soldados', filhos: [{ t: 'SMC', f: (p) => de('soldado')(p) && !smo(p) }, { t: 'SMO', f: (p) => de('soldado')(p) && smo(p) }] },
      { t: 'T. Praças', f: de(...PRACAS) },
    ] },
    { t: 'Total geral', f: militar },
  ]
}

const somaLinhas = (linhas) => linhas[0]?.valores.map((_, i) => linhas.reduce((n, l) => n + (Number(l.valores[i]) || 0), 0)) ?? []
const percent = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '')

// ---------- Mod. 2: orgânica, real, físico e diferença ----------
const AUSENTES = ['em_missao', 'em_formacao', 'suspensao_funcoes', 'desaparecido_servico']
function mod2(ctx, o) {
  const per = periodo(o.mes)
  const deLicenca = new Set((ctx.licencas ?? []).filter((x) => x.inicio <= per.fim && x.fim >= per.fim).map((x) => x.pessoaId))
  // ausentes no último dia do período: faltas, sem justificação, hospital, detidos (o fim vazio ainda dura)
  const ausentes = new Set((ctx.ausencias ?? []).filter((x) => x.inicio <= per.fim && (!x.fim || x.fim >= per.fim)).map((x) => x.pessoaId))
  const presente = (p) => !deLicenca.has(p.id) && !ausentes.has(p.id) && !AUSENTES.includes(p.estado)
  const g = (l) => { const m = l.filter(militar); return [m.filter(oficiais).length, m.filter(de(...SARG)).length, m.filter(de('primeiro_cabo', 'segundo_cabo')).length, m.filter(de('soldado')).length, m.length, l.length - m.length] }
  const valores = (org, real, fis) => {
    const [o1, o2, o3, o4, ot, oc] = org
    const [r1, r2, r3, r4, rt, rc] = g(real)
    const [f1, f2, f3, f4, ft, fc] = g(fis)
    return [o1, o2, o3, o4, ot, oc, ot + oc, r1, r2, r3, r4, rt, percent(rt, ot), rc, f1, f2, f3, f4, ft, percent(ft, rt), fc, o1 - r1, o2 - r2, o3 - r3, o4 - r4, ot - rt, percent(ot - rt, ot), oc - rc]
  }
  const organica = (u) => { const x = u?.previstoGraus; return x ? [x.oficiais, x.sargentos, x.cabos, x.soldados, x.oficiais + x.sargentos + x.cabos + x.soldados, x.civil] : [0, 0, 0, 0, 0, 0] }
  const { linhas, agregados } = repartir(ctx, AGREGADOS_MOD2)
  const un = linhas.map((x) => ({ rotulo: x.rotulo.toUpperCase(), valores: valores(organica(x.unidade), x.l, x.l.filter(presente)) }))
  const ag = agregados.map((x) => ({ rotulo: x.rotulo.toUpperCase(), valores: valores([0, 0, 0, 0, 0, 0], x.l, x.l.filter(presente)) }))
  // as percentagens dos totais calculam-se outra vez (não se somam)
  const total = (ls, rotulo) => { const v = somaLinhas(ls); for (const [i, a, b] of [[12, 11, 4], [19, 18, 11], [26, 25, 4]]) v[i] = percent(v[a], v[b]); return { rotulo, valores: v, negrito: true } }
  const sub = total(un, 'SUB-TOTAL')
  const geral = total([...un, ...ag], 'TOTAL-GERAL')
  const bloco = (t) => [{ t: 'Oficiais', v: 0 }, { t: 'Sargentos', v: 0 }, { t: 'Praças', filhos: [{ t: 'Cabos' }, { t: 'Soldados' }] }, { t: 'Total' }, ...t.map((x) => ({ t: x }))]
  const nos = [{ t: 'Orgânica', filhos: bloco(['Civil', 'Total']) }, { t: 'Real', filhos: bloco(['%', 'Civil']) }, { t: 'Físico', filhos: bloco(['%', 'Civil']) }, { t: 'Diferença', filhos: bloco(['%', 'Civil']) }]
  return {
    titulo: 'Mapa de controlo estatístico por graus militares do(a) ESG/EMG', subtitulo: per.texto, orientacao: 'landscape', modelo: { numero: 'MOD.2/DPQ' },
    seccoes: [{ colunas: colunasDe(nos, 'Designação'), cabeca: cabeca(nos, { alto: 15 }), letra: 6.2, linhas: numerarLinhas([...un, sub, { rotulo: 'AGREGADOS', valores: [], negrito: true }, ...ag, geral]), contar: false }],
    nota: 'Orgânica: os lugares dos cargos da orgânica. Real: o efectivo colocado. Físico: o real menos quem, no fim do período, está de licença, com falta, no hospital, detido, ou em missão, formação, suspenso ou desaparecido. Diferença: orgânica menos real.',
  }
}

// ---------- Mod. 3: por graus militares ----------
function mod3(ctx, o) {
  const per = periodo(o.mes)
  const nos = grausMod3(generais(ctx))
  const { linhas, agregados } = repartir(ctx, AGREGADOS_MOD3)
  const un = linhas.map((x) => ({ rotulo: x.rotulo.toUpperCase(), valores: contar(nos, x.l) }))
  const ag = agregados.map((x) => ({ rotulo: x.rotulo.toUpperCase(), valores: contar(nos, x.l) }))
  return {
    titulo: 'Mapa de controlo estatístico por graus militares do(a) ESG/EMG', subtitulo: per.texto, orientacao: 'landscape', modelo: { numero: 'MOD.3/DPQ' },
    seccoes: [{ colunas: colunasDe(nos, 'Designação das sub-unidades'), cabeca: cabeca(nos, { segunda: 'DESIGNAÇÃO DAS SUB-UNIDADES', topo: 'CATEGORIAS', numerar: true }), letra: 6.2, linhas: numerarLinhas([...un, { rotulo: 'SUB-TOTAL', valores: somaLinhas(un), negrito: true }, ...ag, { rotulo: 'TOTAL GERAL', valores: somaLinhas([...un, ...ag]), negrito: true }]), contar: false }],
  }
}

// ---------- Mod. 4: por especialidades (o quadro especial de cada um), por ramo ----------
const ESPECIALIDADES = {
  EXE: [['Administração', ['AM']], ['Artilharia Terrestre', ['ART']], ['Defesa Anti-Aérea', ['DAA']], ['Defesa Contra A.E. Massas', ['NBQ']], ['Engenharia Militar', ['ENG']], ['Infantaria', ['INF']], ['Justiça', ['JM']], ['Logística', ['LG']], ['Músicos', ['MUS']], ['Serviços de Saúde', ['SM']], ['Serviços Material', ['ArmTec']], ['Serviços Técnicos', ['ST']], ['Telecomunicações', ['TEL']], ['Tropas Blindadas', ['TQ']], ['Educação Patriótica', ['EP']]],
  FAN: [['Administração Aeronáutica', ['ADMAER']], ['Aviação', ['AV']], ['Defesa Antiaérea', ['DAA']], ['Defesa Contra A.E. Massas', ['NBQ']], ['Engenharia Aeronáutica', ['ENGAE']], ['Infantaria', ['INF', 'PQ']], ['Justiça', ['JM']], ['Logística Aeronáutica', ['LG']], ['Marinha', []], ['Músicos', ['MUS']], ['Serviços de Saúde', ['SM']], ['Serviços Material', ['ArmTec']], ['Serviços Técnicos FAN', ['ST']], ['Telecomunicações', ['TEL']], ['Tropas Radiotécnicos', ['TRT']], ['Educação Patriótica', ['EP']]],
  MGA: [['Administração Naval', ['AN']], ['Engenharia Naval', ['EN']], ['Fuzileiros Navais', ['FZ']], ['Infantaria', ['INF']], ['Justiça', ['JM']], ['Logística Naval', ['LG']], ['Máquina Navais', ['MQ']], ['Marinha', ['M', 'MS']], ['Médicos Navais', []], ['Músicos', ['MUS']], ['Mísseis', ['MIS']], ['Serviços Técnicos Navais', ['ST']], ['Serviços de Saúde', ['SM']], ['Telecomunicações', ['TEL']], ['Torpedo e Minas', ['TM']], ['Radaristas', ['R', 'MRT']], ['Educação Patriótica', ['EP']]],
}
const RAMOS_MOD4 = [['EXE', 'Exército'], ['FAN', 'Força Aérea'], ['MGA', 'Marinha de Guerra']]
function mod4(ctx, o) {
  const per = periodo(o.mes)
  const nos = grausSimples(true)
  const mil = ctx.pessoas.filter((p) => militar(p) && p.vinculo !== 'estudante')
  const linhas = []
  const subtotais = []
  for (const [ramo, nome] of RAMOS_MOD4) {
    const doRamo = mil.filter((p) => p.ramo === ramo)
    const conhecidas = new Set(ESPECIALIDADES[ramo].flatMap(([, s]) => s))
    linhas.push({ faixa: nome.toUpperCase() })
    const ls = ESPECIALIDADES[ramo].map(([rotulo, siglas]) => ({ rotulo, valores: contar(nos, doRamo.filter((p) => siglas.includes(p.quadroEspecial))) }))
    // quem tem outro quadro (ou nenhum) não se perde: fica numa linha à parte
    const outros = doRamo.filter((p) => !conhecidas.has(p.quadroEspecial))
    if (outros.length) ls.push({ rotulo: 'Outras / por indicar', valores: contar(nos, outros) })
    const st = { rotulo: 'Sub-Total', valores: somaLinhas(ls), negrito: true }
    subtotais.push(st)
    linhas.push(...ls, st)
  }
  linhas.push({ rotulo: 'TOTAL', valores: somaLinhas(subtotais), negrito: true })
  return {
    titulo: 'Informe do pessoal por especialidades', subtitulo: `dos militares do(a) ESG/EMG, ${per.texto.replace('Referente ao', 'relativo ao')}`, orientacao: 'landscape', modelo: { numero: 'MOD.4/DPQ' },
    seccoes: [{ colunas: colunasDe(nos, 'Especialidades'), cabeca: cabeca(nos, { segunda: 'ESPECIALIDADES', topo: 'CATEGORIAS', numerar: true }), letra: 6.2, linhas: numerarLinhas(linhas), contar: false }],
  }
}

// ---------- Mod. 5: por habilitações literárias ----------
const NIVEIS = [['Não declarados', (p) => !p.habilitacao], ['Sem instrução', (p) => p.habilitacao === 'sem_instrucao'], ['Primária', (p) => p.habilitacao === 'primaria'], ['1.º Ciclo', (p) => ['primeiro_ciclo', 'base'].includes(p.habilitacao)], ['2.º Ciclo', (p) => p.habilitacao === 'segundo_ciclo'], ['Técnico médio', (p) => p.habilitacao === 'medio'], ['Bacharelato', (p) => p.habilitacao === 'bacharelato'], ['Licenciado', (p) => p.habilitacao === 'licenciatura'], ['Pós graduação', (p) => p.habilitacao === 'pos_graduacao'], ['Mestrado', (p) => p.habilitacao === 'mestrado'], ['Doutorado', (p) => p.habilitacao === 'doutoramento']]
function mod5(ctx, o) {
  const per = periodo(o.mes)
  const nos = grausSimples(generais(ctx))
  const mil = ctx.pessoas.filter((p) => militar(p) && p.vinculo !== 'estudante')
  const ls = NIVEIS.map(([rotulo, f]) => ({ rotulo: rotulo.toUpperCase(), valores: contar(nos, mil.filter(f)) }))
  return {
    titulo: 'Mapa de controlo estatístico por habilitações literárias do(a) ESG/EMG', subtitulo: per.texto, orientacao: 'landscape', modelo: { numero: 'MOD.5/DPQ' },
    seccoes: [{ colunas: colunasDe(nos, 'Níveis'), cabeca: cabeca(nos, { segunda: 'NÍVEIS', topo: 'POR HABILITAÇÕES LITERÁRIAS' }), letra: 6.4, linhas: numerarLinhas([...ls, { rotulo: 'TOTAL GERAL', valores: somaLinhas(ls), negrito: true }]), contar: false }],
    nota: '«Ensino de base» (fichas antigas, sem o pormenor) conta no 1.º Ciclo.',
  }
}

// ---------- I — Ausências temporárias e definitivas ----------
const DISPENSAS = ['casamento', 'bodas', 'luto', 'nascimento_filho', 'parto', 'merito']
function ausencias(ctx, o) {
  const per = periodo(o.mes)
  const lic = (ctx.licencas ?? []).filter((x) => x.inicio <= per.fim && x.fim >= per.inicio)
  const comLicenca = (tipos) => { const s = new Set(lic.filter((x) => tipos.includes(x.tipo)).map((x) => x.pessoaId)); return (p) => s.has(p.id) }
  const saiu = (re) => (p) => { const d = String(p.dataSaidaEscola ?? '').slice(0, 10); return !p.ativo && d >= per.inicio && d <= per.fim && re.test(p.motivoSaida || '') }
  // faltas, ausências sem justificação, baixas hospitalares e detenções registadas (fim vazio = ainda dura)
  const aus = (ctx.ausencias ?? []).filter((x) => x.inicio <= per.fim && (!x.fim || x.fim >= per.inicio))
  const comAusencia = (tipo) => { const s = new Set(aus.filter((x) => x.tipo === tipo).map((x) => x.pessoaId)); return (p) => s.has(p.id) }
  const morto = /falec|óbito|obito|morte|morreu/i
  const condenado = /conden/i
  const COLS = [
    ['Faltas', comAusencia('falta'), true], ['Hospital', comAusencia('hospital')], ['M/Serviço', (p) => p.estado === 'em_missao'], ['Férias', comLicenca(['ferias'])], ['Dispensas', comLicenca(DISPENSAS)],
    ['Doentes', comLicenca(['doenca'])], ['Aus/S.Just.', ou(comAusencia('sem_justificacao'), saiu(/deser/i))], ['Detidos', comAusencia('detido')], ['Curso', ou((p) => p.estado === 'em_formacao', comLicenca(['estudos']))],
    ['Transferidos', saiu(/transfer/i)], ['Mortos', saiu(morto)], ['Condenado', saiu(condenado)],
  ]
  const graus = [['Oficiais', oficiais], ['Sargentos', de(...SARG)], ['Cabos', de('primeiro_cabo', 'segundo_cabo')], ['Soldados', de('soldado')]]
  const nos = COLS.map(([t, f, comTotal]) => ({ t, filhos: [...graus.map(([g, fg]) => ({ t: g, f: (p) => fg(p) && f(p) })), ...(comTotal ? [{ t: 'Total', f: (p) => militar(p) && f(p) }] : [])] }))
  const todos = [...ctx.pessoas, ...(ctx.saidas ?? [])]
  const { linhas } = repartir({ ...ctx, pessoas: todos.filter(militar) })
  const ls = linhas.map((x) => ({ rotulo: x.rotulo.toUpperCase(), valores: contar(nos, x.l) }))
  return {
    titulo: 'I — Ausências temporárias e definitivas', subtitulo: per.texto, orientacao: 'landscape', modelo: { numero: 'MOD.2/DPQ' },
    seccoes: [{ colunas: colunasDe(nos, 'Designação'), cabeca: cabeca(nos, { numerar: true, alto: 13 }), letra: 5.6, linhas: numerarLinhas([...ls, { rotulo: 'TOTAL GERAL', valores: somaLinhas(ls), negrito: true }]), contar: false }],
    nota: 'Do sistema: faltas, ausências sem justificação, hospital e detidos (Faltas e ausências), missão e formação (estado do militar), férias, dispensas (casamento, luto, nascimento, parto, mérito), doença e estudos (Licenças) e as saídas da Escola no período (transferência, falecimento, condenação, deserção — pelo motivo da saída). Conta quem esteve nessa situação em algum dia do período.',
  }
}

// ---------- por idade e por tempo de serviço militar (em anos) ----------
const anosAte = (iso, fim) => { if (!iso) return null; const n = new Date(String(iso).slice(0, 10)); const f = new Date(fim); let a = f.getFullYear() - n.getFullYear(); if (f.getMonth() < n.getMonth() || (f.getMonth() === n.getMonth() && f.getDate() < n.getDate())) a--; return a }
function grausIdade(tempo) {
  return [
    { t: 'Of. generais', filhos: [...(tempo ? [{ t: 'Gen. Ex.', f: de('general_exercito') }] : []), { t: 'Gen.', f: de(...(tempo ? ['general'] : ['general', 'general_exercito'])) }, { t: 'T.Gen.', f: de('tenente_general') }, { t: 'Brig.', f: de('brigadeiro') }, { t: 'Total', f: de(...OG) }] },
    { t: 'Of. superiores', filhos: [{ t: 'Cor.', f: de('coronel') }, { t: 'T.Cor.', f: de('tenente_coronel') }, { t: 'Major', f: de('major') }, { t: 'Total', f: de(...OS) }] },
    { t: 'Capitão', f: de('capitao') },
    { t: 'Of. subalternos', filhos: [{ t: 'Tenente', f: de('tenente') }, { t: 'Subtte', f: de('subtenente') }, { t: 'Asp.', f: de('aspirante') }, { t: 'Total', f: de(...SUB) }] },
    { t: 'T.Oficiais', f: oficiais },
    { t: 'Sargentos', filhos: [{ t: 'Sgt.Maior', f: de('sargento_maior') }, { t: 'Sgt.Chefe', f: de('sargento_chefe') }, { t: 'Sgt.Ajud.', f: de('sargento_ajudante') }, { t: '1.º Sgt', f: de('primeiro_sargento') }, { t: '2.º Sgt', f: de('segundo_sargento') }, { t: 'Sub.Sgt', f: de('subsargento') }, { t: 'Total', f: de(...SARG) }] },
    { t: 'Praças', filhos: [{ t: '1.º Cabo', f: de('primeiro_cabo') }, { t: '2.º Cabo', f: de('segundo_cabo') }, { t: 'Soldado', f: de('soldado') }, { t: 'Total', f: de(...PRACAS) }] },
    { t: 'Cadetes', f: nada }, { t: 'Recrutas', f: nada },
    { t: 'Total geral', f: militar },
  ]
}
// faixas [rótulo, de, até]; quem não tem a data vai para «Não declarados» (no tempo de serviço) ou fica de fora
const FAIXAS_IDADE = [['Menos de 20', 0, 19], ['20 - 24', 20, 24], ['25 - 29', 25, 29], ['30 - 34', 30, 34], ['35 - 39', 35, 39], ['40 - 44', 40, 44], ['45 - 49', 45, 49], ['50 - 54', 50, 54], ['55 - 59', 55, 59], ['60 - 64', 60, 64], ['65 - e mais', 65, 200]]
const FAIXAS_TEMPO = [['0 - 3', 0, 3], ['4 - 7', 4, 7], ['8 - 11', 8, 11], ['12 - 15', 12, 15], ['16 - 19', 16, 19], ['20 - 23', 20, 23], ['24 - 27', 24, 27], ['28 - 31', 28, 31], ['32 - 35', 32, 35], ['36 - 39', 36, 39], ['40 e mais', 40, 200]]
function idadeTempo(ctx, o) {
  const per = periodo(o.mes)
  const mil = ctx.pessoas.filter((p) => militar(p) && p.vinculo !== 'estudante')
  const quadro = (titulo, primeira, faixas, anos, semData) => {
    const nos = grausIdade(titulo !== 'Por idade')
    const ls = faixas.map(([rotulo, a, b]) => ({ rotulo, valores: contar(nos, mil.filter((p) => { const x = anos(p); return x !== null && x >= a && x <= b })) }))
      .filter((l, i) => i > 0 || faixas[0][0] !== 'Menos de 20' || l.valores.at(-1) > 0)
    if (semData) ls.unshift({ rotulo: semData, valores: contar(nos, mil.filter((p) => anos(p) === null)) })
    return { titulo, colunas: colunasDe(nos, primeira, true), cabeca: cabeca(nos, { segunda: primeira.toUpperCase(), numerar: titulo === 'Por idade', alto: 11, semN: true }), letra: 5.6, linhas: [...ls, { rotulo: 'TOTAL', valores: somaLinhas(ls), negrito: true }], contar: false }
  }
  return {
    titulo: 'Efectivo militar por idade e por tempo de serviço', subtitulo: per.texto, orientacao: 'landscape', modelo: { numero: '', semTitulo: true },
    seccoes: [
      quadro('Por idade', 'Faixas etárias', FAIXAS_IDADE, (p) => anosAte(p.dataNascimento, per.fim)),
      quadro('Por tempo de serviço militar em anos', 'Tempo de serviço', FAIXAS_TEMPO, (p) => anosAte(p.dataIngresso, per.fim), 'Não declarados'),
    ],
  }
}

export const MAPAS = [
  { id: 'mod2', grupo: 'mapas', titulo: 'Mapa de controlo estatístico (Mod. 2)', icone: 'fa-table', descricao: 'Por unidade e agregados: a orgânica, o efectivo real, o físico e a diferença (oficiais, sargentos, cabos, soldados e civis).', opcoes: [OPCAO_MES], precisa: ['licencas', 'ausencias'], fazer: mod2 },
  { id: 'ausencias', grupo: 'mapas', titulo: 'Ausências temporárias e definitivas', icone: 'fa-user-clock', descricao: 'Por unidade: faltas, missão de serviço, férias, dispensas, doentes, curso, transferidos, mortos e condenados, por categoria.', opcoes: [OPCAO_MES], precisa: ['licencas', 'ausencias'], fazer: ausencias },
  { id: 'mod3', grupo: 'mapas', titulo: 'Mapa por graus militares (Mod. 3)', icone: 'fa-star', descricao: 'Por unidade e agregados, posto a posto (QP e SMC, SMC e SMO), com as somas.', opcoes: [OPCAO_MES], fazer: mod3 },
  { id: 'mod4', grupo: 'mapas', titulo: 'Informe por especialidades (Mod. 4)', icone: 'fa-shield-alt', descricao: 'Exército, Força Aérea e Marinha de Guerra: cada especialidade (quadro especial), posto a posto.', opcoes: [OPCAO_MES], fazer: mod4 },
  { id: 'idade', grupo: 'mapas', titulo: 'Por idade e tempo de serviço', icone: 'fa-hourglass-half', descricao: 'Os militares por faixa etária (20-24 … 65 e mais) e por anos de serviço militar (0-3 … 40 e mais), posto a posto, contados no fim do período (nascimento e incorporação).', opcoes: [OPCAO_MES], fazer: idadeTempo },
  { id: 'mod5', grupo: 'mapas', titulo: 'Mapa por habilitações literárias (Mod. 5)', icone: 'fa-certificate', descricao: 'Dos não declarados ao doutorado, posto a posto.', opcoes: [OPCAO_MES], fazer: mod5 },
]

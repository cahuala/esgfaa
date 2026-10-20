import { emblema } from '../documentos'
import { M, TAM, cabecalho, dataExtenso, kwanzas, kwanzasPorExtenso, marcaDagua, novaPagina, paragrafo, referencia } from './base'

/*
  Declarações e guias de marcha, desenhadas como os modelos da ESG (Times 14, dados em maiúsculas).
  Declarações: de efectividade (militar, discente), de salário (militar) e de serviço (civil, empregada(o)
  domiciliar); numeradas por ano («Nº402/26»), válidas por 90 dias, com a marca-d'água da ESG.
*/
const militar = (p) => p.tipo === 'militar'
const ano2 = (ano) => String(ano).slice(-2)
// margens das declarações (o texto fica numa coluna mais estreita, como no modelo)
const X = 28
const W = 210 - 2 * X

// «o Senhor(a), NIP: 101056813 – TENENTE – CARLOS HENRIQUES SEBASTIÃO JORGE,»
export function identificacao(p) {
  if (militar(p)) return ['o Senhor(a), NIP: ', { b: M(p.nip) }, ' – ', { b: M(p.postoNome) }, ' – ', { b: `${M(p.nome)},` }]
  return ['o Senhor(a), ', { b: `${M(p.nome)},` }]
}

const vencimento = (o, palavra = 'o vencimento mensal') => (o.valor ? [`, auferindo ${palavra} de `, { b: `${kwanzas(o.valor)} KZ (${kwanzasPorExtenso(o.valor)})` }] : [])

// «DECLARAÇÃO DE EFECTIVIDADE Nº402/26»: como no modelo, «RA» e o número em itálico
function tituloDeclaracao(doc, nome, numero, y) {
  const partes = [['DECLA', 'bold'], ['RA', 'bolditalic'], [`ÇÃO DE ${nome} `, 'bold'], [numero, 'bolditalic']]
  doc.setFontSize(TAM)
  const largura = partes.reduce((s, [t, f]) => s + doc.setFont('times', f).getTextWidth(t), 0)
  let x = 105 - largura / 2
  for (const [t, f] of partes) { doc.setFont('times', f).text(t, x, y); x += doc.getTextWidth(t) }
  doc.setFont('times', 'normal')
}

export function declaracao(d, p, o, quem) {
  const { doc } = d
  novaPagina(d)
  marcaDagua(d, 105, 192, 92, 0.06)
  let y = cabecalho(d)
  const nomes = { efectividade: 'EFECTIVIDADE', salario: 'SALÁRIO', servico: 'SERVIÇO' }
  tituloDeclaracao(doc, nomes[o.tipo], `Nº${String(o.numero ?? '').padStart(3, '0')}/${ano2(o.ano ?? new Date().getFullYear())}`, y + 9)
  y += 24
  const domiciliar = p.vinculo === 'domiciliar'
  let corpo
  if (domiciliar) {
    const o2 = p.militarAlocado
    corpo = ['Para os devidos efeitos e fins achados convenientes, declara-se que ', ...identificacao(p), ' é empregada(o) domiciliar do Senhor(a), NIP: ', { b: M(o2?.nip ?? '') }, ' – ', { b: M(o2?.postoNome ?? '') }, ' – ', { b: `${M(o2?.nome ?? '')},` }, ' encontra-se em efectivo serviço nas ', { b: 'FORÇAS ARMADAS ANGOLANAS' }, ', na Escola Superior de Guerra/EMG/FAA', ...vencimento(o, 'o salário mensal'), '.']
  } else {
    const discente = (p.discente || p.vinculo === 'estudante') && o.curso ? [', Como Discente do ', o.curso, ' na Escola Superior de Guerra/EMG/FAA'] : [', na Escola Superior de Guerra/EMG/FAA']
    corpo = ['Para os devidos efeitos e fins achados convenientes, declara-se que ', ...identificacao(p), ' encontra-se em efectivo serviço nas ', { b: 'FORÇAS ARMADAS ANGOLANAS' }, ...discente, ...vencimento(o), '.']
  }
  y = paragrafo(d, corpo, y, { x: X, w: W })
  y += 7
  const local = militar(p) && !domiciliar ? 'nesta Unidade Militar' : 'neste Estabelecimento de Ensino Militar'
  y = paragrafo(d, [`Por ser verdade e me ter sido solicitado, mandei passar a presente declaração que por mim vai assinada e autenticada, com o carimbo a óleo em uso ${local}.`], y, { x: X, w: W })
  if (o.finalidade) {
    y += 6
    doc.setFont('times', 'bold').setFontSize(TAM).text('OBS:', X + 12, y)
    const w = doc.getTextWidth('OBS: ')
    y = paragrafo(d, [`A presente destina-se para ${o.finalidade.replace(/\.$/, '')}.`], y, { x: X + 12 + w, w: W - 12 - w, recuo: 0 })
  }
  // validade (o modelo usa letra sem serifa nesta caixa)
  y += 9
  const v = 'Válida por um período de (90) Noventa Dias'
  doc.setFont('helvetica', 'bold').setFontSize(11)
  const vw = doc.getTextWidth(v) + 8
  doc.setLineWidth(0.4).rect(105 - vw / 2, y - 5.2, vw, 7.8).text(v, 105, y, { align: 'center' })
  y += 18
  // «ESG em Luanda, 24 de Junho de 2026.» (civis: «Escola Superior de Guerra em Luanda, …»)
  const quemEmite = militar(p) && !domiciliar ? 'ESG' : 'Escola Superior de Guerra'
  const resto = ` em ${quem.local || 'Luanda'}, ${dataExtenso(o.data)}.`
  doc.setFont('times', 'bold').setFontSize(TAM)
  const w1 = doc.getTextWidth(quemEmite)
  const w2 = doc.setFont('times', 'normal').getTextWidth(resto)
  doc.setFont('times', 'bold').text(quemEmite, 105 - (w1 + w2) / 2, y)
  doc.setFont('times', 'normal').text(resto, 105 - (w1 + w2) / 2 + w1, y)
  y += 15
  const c = quem.comandante ?? {}
  doc.setFont('times', 'bold').text(M(c.cargo || 'O COMANDANTE DA ESG'), 105, y, { align: 'center' })
  if (c.nome) doc.text(M(c.nome), 105, y + 13, { align: 'center' })
  if (c.posto) doc.text(`**${M(c.posto)}**`, 105, y + 19.5, { align: 'center' })
  doc.setFont('times', 'normal')
}

/*
  Guias de marcha individual (como os modelos): férias e férias adicionais (art. 32.º da Lei n.º 13/18),
  dispensa (militar, civil, discente) e apresentação noutra unidade. Num quadro até ao fundo da folha, com
  o emblema das FAA por cima e a marca-d'água da ESG. o = { tipo, dias, inicio, motivo, provincia, destino, referencia }.
*/
function designacao(p) {
  const a = p.genero === 'F' ? 'A' : 'O'
  const o = p.genero === 'F' ? 'a' : 'o'
  if (p.vinculo === 'estudante') return [`${a} Discente`, o, 'à Instituição']
  if (!militar(p)) return [`${a} ${p.genero === 'F' ? 'funcionária' : 'funcionário'}`, o, 'à Unidade']
  if (p.categoria === 'oficial_general') return [`${a} Oficial General`, o, 'à Unidade']
  if (p.categoria === 'oficial_superior') return [`${a} Oficial Superior`, o, 'à Unidade']
  return [`${a} Militar`, o, 'à Unidade']
}

// «Sr. – 2º SARGENTO – EXE – QP – INF – 100253568 – NOME – SERRALHEIRO DA SECÇÃO …/ESG/EMGFAA.»
export function linhaPessoa(p) {
  const sr = p.genero === 'F' ? 'Srª.' : 'Sr.'
  // o discente: «DISCENTE DO 31º CURSO SUPERIOR DE COMANDO E DIRECÇÃO» (o curso em curso, ou a unidade do curso)
  const curso = p.vinculo === 'estudante' ? (p.cursos ?? []).find((c) => !c.fim)?.nome || p.unidadeNome : ''
  const funcao = curso ? `DISCENTE DO ${curso}` : [p.cargoNome, p.unidadeNome && `DA ${p.unidadeNome}`].filter(Boolean).join(' ')
  if (militar(p)) return [`${sr} – `, { b: [M(p.postoNome), p.ramo, p.fps, p.quadroEspecial, p.nip].filter(Boolean).map(M).join(' – ') }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || 'EFECTIVO')}/ESG/EMGFAA.` }]
  return [`${sr} – `, { b: 'CIVIL' }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || p.categoriaCivil || 'FUNCIONÁRIO')} DA ESCOLA SUPERIOR DE GUERRA/EMGFAA.` }]
}

export function guiaMarcha(d, p, o, quem) {
  const { doc } = d
  novaPagina(d)
  marcaDagua(d, 105, 150, 150, 0.1)
  emblema(doc, d.brasao, 105, 9, 18)
  const x0 = 18
  const w = 174
  const topo = 30
  // cabeçalho em três colunas
  const col = [70, 55, 49]
  doc.setLineWidth(0.35).rect(x0, topo, w, 26)
  doc.line(x0 + col[0], topo, x0 + col[0], topo + 26).line(x0 + col[0] + col[1], topo, x0 + col[0] + col[1], topo + 26)
  doc.setFont('times', 'normal').setFontSize(11)
  doc.text('FORÇAS ARMADAS ANGOLANAS', x0 + col[0] / 2, topo + 10, { align: 'center' }).text('ESTADO-MAIOR GENERAL', x0 + col[0] / 2, topo + 19, { align: 'center' })
  doc.text('GUIA DE MARCHA', x0 + col[0] + col[1] / 2, topo + 10, { align: 'center' }).text('INDIVIDUAL', x0 + col[0] + col[1] / 2, topo + 19, { align: 'center' })
  doc.text('UEO - ESG', x0 + col[0] + col[1] + col[2] / 2, topo + 8, { align: 'center' })
  doc.setFontSize(TAM)
  let y = topo + 35
  const ano = new Date(o.inicio || Date.now()).getFullYear()
  const discenteOuCivil = !militar(p) || p.vinculo === 'estudante'
  const lei = `Ao abrigo do estabelecido no Artigo 32º da Lei 13/018, de 29 de Outubro, Lei das Carreiras dos Militares, e em conformidade com o Plano de Férias para os Efectivos da UEO, em Comissão Normal de Serviço no EMG, superiormente aprovado para o ano de ${ano};`
  const intro = {
    ferias: militar(p) ? [lei] : [`Em conformidade com o Plano de Férias para os Efectivos da Escola Superior de Guerra, superiormente aprovado para o ano de ${ano};`],
    licenca: [lei],
    dispensa: [discenteOuCivil ? 'Em conformidade com o despacho de Sua Excelência Comandante da ESG;' : 'Em conformidade com o despacho do General Comandante da Escola Superior de Guerra;'],
    apresentacao: ['Em conformidade com o ', { b: o.referencia || 'despacho do General Comandante da Escola Superior de Guerra' }, ';'],
  }[o.tipo]
  const fim = {
    ferias: 'A fim de Gozar Férias',
    licenca: 'A fim de Gozar Licença Disciplinar',
    dispensa: `A fim de Tratar ${o.motivo || 'Assuntos Pessoais'}${o.provincia ? ` na Província de ${o.provincia}` : ''}`,
    apresentacao: `A fim de Apresentar-se à ${o.destino || ''}${o.fundamento ? `, ${o.fundamento}` : ''}`,
  }[o.tipo]
  const marcha = {
    ferias: militar(p) ? 'Marcha do Estado Maior General das FAA em Luanda' : 'Marcha da Escola Superior de Guerra/EMGFAA em Luanda',
    licenca: 'Marcha do Estado Maior General das FAA em Luanda',
    dispensa: discenteOuCivil ? 'Marcha da Escola Superior de Guerra/EMGFAA em Luanda' : 'Marcha desta Instituição de Ensino Superior Militar.',
    apresentacao: 'Marcha desta Instituição de Ensino Superior Militar',
  }[o.tipo]
  const xi = x0 + 3
  const wi = w - 6
  y = paragrafo(d, intro, y, { x: xi, w: wi, recuo: 0 })
  y += 3
  y = paragrafo(d, [marcha], y, { x: xi, w: wi, recuo: 0, justificar: false })
  y += 4
  // «A fim de Gozar Férias ________» (a linha vai até ao fim do quadro)
  y = paragrafo(d, [fim], y, { x: xi, w: wi, recuo: 0, justificar: false })
  doc.setFont('times', 'normal').setFontSize(TAM)
  const ult = doc.splitTextToSize(fim, wi).at(-1)
  const xf = xi + doc.getTextWidth(ult) + 2
  if (xf < xi + wi - 6) doc.setLineWidth(0.2).line(xf, y - 6.6 + 0.8, xi + wi, y - 6.6 + 0.8)
  y += 4
  y = paragrafo(d, linhaPessoa(p), y, { x: xi, w: wi, recuo: 0 })
  y += 3
  y = paragrafo(d, ['Utilizando as seguintes vias: Todas vias possíveis'], y, { x: xi, w: wi, recuo: 0, justificar: false })
  doc.setLineWidth(0.3).line(x0 + 2, y - 1, x0 + w - 2, y - 1)
  y += 8
  doc.setFont('times', 'normal').setFontSize(TAM - 1).text('OUTRAS INDICAÇÕES', xi, y).setFontSize(TAM)
  y += 7
  const [quemE, o2, regresso] = designacao(p)
  const dias = String(o.dias || (o.tipo === 'ferias' ? 30 : o.tipo === 'licenca' ? 15 : 5)).padStart(2, '0')
  const inicio = dataExtenso(o.inicio)
  const estado = {
    ferias: `encontra-se em gozo de férias, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    licenca: `encontra-se em gozo de licença disciplinar, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    dispensa: `encontra-se dispensad${o2}, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    apresentacao: `segue apresentar-se à ${o.destino || ''}, por um período de ${dias} dias.`,
  }[o.tipo]
  y = paragrafo(d, [o.tipo === 'apresentacao' ? `${quemE}, ${estado}` : `${quemE} acima mencionad${o2} ${estado}`], y, { x: xi, w: wi, recuo: 0 })
  doc.setLineWidth(0.3).line(x0 + 2, y - 1, x0 + w - 2, y - 1)
  // data e assinatura (como no modelo, sem negrito)
  y += 20
  const c = quem.comandante ?? {}
  doc.setFont('times', 'normal').setFontSize(TAM)
  doc.text(`${M(quem.local || 'Luanda')}, ${M(dataExtenso(o.data))}`, 105, y, { align: 'center' })
  doc.text(M(c.cargo || 'O COMANDANTE DA ESG'), 105, y + 14, { align: 'center' })
  if (c.nome) doc.text(M(c.nome), 105, y + 28, { align: 'center' })
  if (c.posto) doc.text(`**${M(c.posto)}**`, 105, y + 35, { align: 'center' })
  const fundo = Math.max(y + 48, 268)
  doc.setLineWidth(0.35).rect(x0, topo, w, fundo - topo)
  referencia(d, 'RPQ/ESG/CP3 OP.MG', x0, fundo + 6)
}

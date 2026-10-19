import { LARGURA, M, MARGEM, TAM, assinatura, cabecalho, dataExtenso, kwanzas, kwanzasPorExtenso, novaPagina, paragrafo } from './base'

/*
  Declarações (modelos da ESG): de efectividade (militar, discente), de salário (militar) e de serviço
  (civil, empregada(o) domiciliar). Numeradas por ano («N.º 402/26»), válidas por 90 dias.
*/
const militar = (p) => p.tipo === 'militar'
const ano2 = (ano) => String(ano).slice(-2)

// «o Senhor(a), NIP: 101056813 – TENENTE – CARLOS HENRIQUES SEBASTIÃO JORGE,»
export function identificacao(p) {
  if (militar(p)) return ['o Senhor(a), NIP: ', { b: M(p.nip) }, ' – ', { b: M(p.postoNome) }, ' – ', { b: `${M(p.nome)},` }]
  return ['o Senhor(a), ', { b: `${M(p.nome)},` }]
}

const vencimento = (o, palavra = 'o vencimento mensal') => (o.valor ? [`, auferindo ${palavra} de `, { b: `${kwanzas(o.valor)} KZ (${kwanzasPorExtenso(o.valor)})` }] : [])

export function declaracao(d, p, o, quem) {
  const { doc } = d
  let y = novaPagina(d)
  y = cabecalho(d, undefined, y)
  const nomes = { efectividade: 'DECLARAÇÃO DE EFECTIVIDADE', salario: 'DECLARAÇÃO DE SALÁRIO', servico: 'DECLARAÇÃO DE SERVIÇO' }
  const t = `${nomes[o.tipo]} Nº${String(o.numero ?? '').padStart(3, '0')}/${ano2(o.ano ?? new Date().getFullYear())}`
  doc.setFont('times', 'bold').setFontSize(TAM + 1).text(t, 105, y + 4, { align: 'center' })
  y += 18
  const domiciliar = p.vinculo === 'domiciliar'
  let corpo
  if (domiciliar) {
    const o2 = p.militarAlocado
    corpo = ['Para os devidos efeitos e fins achados convenientes, declara-se que ', ...identificacao(p), ` é ${p.genero === 'M' ? 'empregado' : 'empregada'} domiciliar do Senhor(a), NIP: `, { b: M(o2?.nip ?? '') }, ' – ', { b: M(o2?.postoNome ?? '') }, ' – ', { b: M(o2?.nome ?? '') }, ', encontra-se em efectivo serviço nas ', { b: 'FORÇAS ARMADAS ANGOLANAS' }, ', na Escola Superior de Guerra/EMG/FAA', ...vencimento(o, 'o salário mensal'), '.']
  } else {
    const discente = p.vinculo === 'estudante' && o.curso ? [', Como Discente do ', { b: M(o.curso) }, ' na Escola Superior de Guerra/EMG/FAA'] : [', na Escola Superior de Guerra/EMG/FAA']
    corpo = ['Para os devidos efeitos e fins achados convenientes, declara-se que ', ...identificacao(p), ' encontra-se em efectivo serviço nas ', { b: 'FORÇAS ARMADAS ANGOLANAS' }, ...discente, ...vencimento(o), '.']
  }
  y = paragrafo(d, corpo, y)
  y += 4
  const local = militar(p) && !domiciliar ? 'nesta Unidade Militar' : 'neste Estabelecimento de Ensino Militar'
  y = paragrafo(d, [`Por ser verdade e me ter sido solicitado, mandei passar a presente declaração que por mim vai assinada e autenticada, com o carimbo a óleo em uso ${local}.`], y)
  if (o.finalidade) {
    y += 4
    doc.setFont('times', 'bold').text('OBS:', MARGEM + 12, y)
    const w = doc.getTextWidth('OBS: ')
    y = paragrafo(d, [`A presente destina-se para ${o.finalidade.replace(/\.$/, '')}.`], y, { x: MARGEM + 12 + w, w: LARGURA - 12 - w, recuo: 0 })
  }
  // validade
  y += 8
  const v = 'Válida por um período de (90) Noventa Dias'
  doc.setFont('times', 'bold').setFontSize(TAM - 1)
  const vw = doc.getTextWidth(v) + 8
  doc.setLineWidth(0.4).rect(105 - vw / 2, y - 5.5, vw, 8.5).text(v, 105, y, { align: 'center' })
  doc.setFont('times', 'normal').setFontSize(TAM)
  y += 18
  assinatura(d, y, quem.comandante, { local: quem.local })
}

/*
  Guias de marcha individual: férias (art. 32.º da Lei n.º 13/18), licença disciplinar, dispensa (militar,
  civil, discente) e apresentação (noutra unidade). o = { tipo, dias, inicio, motivo, provincia, destino, referencia }.
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
  const funcao = [p.cargoNome, p.unidadeNome && `DA ${p.unidadeNome}`].filter(Boolean).join(' ')
  if (militar(p)) return [`${sr} – `, { b: [M(p.postoNome), p.ramo, p.fps, p.quadroEspecial, p.nip].filter(Boolean).map(M).join(' – ') }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || 'EFECTIVO')}/ESG/EMGFAA.` }]
  return [`${sr} – `, { b: 'CIVIL' }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || p.categoriaCivil || 'FUNCIONÁRIO')} DA ESCOLA SUPERIOR DE GUERRA/EMGFAA.` }]
}

export function guiaMarcha(d, p, o, quem) {
  const { doc } = d
  let y = novaPagina(d)
  if (d.brasao) doc.addImage(d.brasao, 'PNG', 95, y - 4, 20, 20)
  y += 20
  // cabeçalho em três colunas, dentro da moldura
  const x0 = MARGEM
  const w = LARGURA
  const topo = y
  const col = [w * 0.42, w * 0.3, w * 0.28]
  doc.setLineWidth(0.35).rect(x0, topo, w, 16)
  doc.line(x0 + col[0], topo, x0 + col[0], topo + 16).line(x0 + col[0] + col[1], topo, x0 + col[0] + col[1], topo + 16)
  doc.setFont('times', 'bold').setFontSize(TAM - 2)
  doc.text('FORÇAS ARMADAS ANGOLANAS', x0 + col[0] / 2, topo + 6.5, { align: 'center' }).text('ESTADO-MAIOR GENERAL', x0 + col[0] / 2, topo + 12.5, { align: 'center' })
  doc.text('GUIA DE MARCHA', x0 + col[0] + col[1] / 2, topo + 6.5, { align: 'center' }).text('INDIVIDUAL', x0 + col[0] + col[1] / 2, topo + 12.5, { align: 'center' })
  doc.text('UEO - ESG', x0 + col[0] + col[1] + col[2] / 2, topo + 6.5, { align: 'center' })
  doc.setFont('times', 'normal').setFontSize(TAM)
  y = topo + 25
  const ano = new Date(o.inicio || Date.now()).getFullYear()
  const lei = `Ao abrigo do estabelecido no Artigo 32º da Lei 13/18, de 29 de Outubro, Lei das Carreiras dos Militares, e em conformidade com o Plano de Férias para os Efectivos da UEO, superiormente aprovado para o ano de ${ano};`
  const intro = {
    ferias: militar(p) ? lei : `Em conformidade com o Plano de Férias dos Efectivos da Escola Superior de Guerra, superiormente aprovado para o ano de ${ano};`,
    licenca: lei,
    dispensa: 'Em conformidade com o despacho do General Comandante da Escola Superior de Guerra;',
    apresentacao: `Em conformidade com o ${o.referencia || 'despacho do General Comandante da Escola Superior de Guerra'};`,
  }[o.tipo]
  const fim = {
    ferias: 'Gozar Férias',
    licenca: 'Gozar Licença Disciplinar',
    dispensa: `Tratar ${o.motivo || 'Assuntos Pessoais'}${o.provincia ? ` na Província de ${o.provincia}` : ''}`,
    apresentacao: `Apresentar-se ${o.destino ? `à ${o.destino}` : ''}${o.fundamento ? `, ${o.fundamento}` : ''}`,
  }[o.tipo]
  const marcha = o.tipo === 'dispensa' || o.tipo === 'apresentacao' ? 'Marcha desta Instituição de Ensino Superior Militar.' : 'Marcha da Escola Superior de Guerra/EMGFAA em Luanda.'
  const xi = x0 + 3
  const wi = w - 6
  y = paragrafo(d, [intro], y, { x: xi, w: wi, recuo: 0 })
  y += 3
  y = paragrafo(d, [marcha], y, { x: xi, w: wi, recuo: 0 })
  y += 3
  y = paragrafo(d, [`A fim de ${fim}`], y, { x: xi, w: wi, recuo: 0, justificar: false })
  y += 3
  y = paragrafo(d, linhaPessoa(p), y, { x: xi, w: wi, recuo: 0 })
  y += 3
  y = paragrafo(d, ['Utilizando as seguintes vias: Todas vias possíveis'], y, { x: xi, w: wi, recuo: 0 })
  doc.setLineWidth(0.3).line(x0, y - 2, x0 + w, y - 2)
  y += 6
  doc.setFont('times', 'bold').text('OUTRAS INDICAÇÕES', xi, y)
  doc.setFont('times', 'normal')
  y += 8
  const [quemE, o2, regresso] = designacao(p)
  const dias = String(o.dias || (o.tipo === 'ferias' ? 30 : o.tipo === 'licenca' ? 15 : 5)).padStart(2, '0')
  const inicio = dataExtenso(o.inicio)
  const estado = {
    ferias: `encontra-se em gozo de férias, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    licenca: `encontra-se em gozo de licença disciplinar, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    dispensa: `encontra-se dispensad${o2}, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    apresentacao: `segue apresentar-se ${o.destino ? `à ${o.destino}` : ''}, por um período de ${dias} dias.`,
  }[o.tipo]
  y = paragrafo(d, [o.tipo === 'apresentacao' ? `${quemE}, ${estado}` : `${quemE} acima mencionad${o2} ${estado}`], y, { x: xi, w: wi, recuo: 0 })
  doc.setLineWidth(0.3).line(x0, y - 2, x0 + w, y - 2)
  y += 14
  const fimY = assinatura(d, y, quem.comandante, { local: quem.local, data: o.data, maiusculas: true })
  doc.setLineWidth(0.35).rect(x0, topo, w, fimY - topo)
}

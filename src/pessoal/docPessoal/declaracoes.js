import { emblema } from '../documentos'
import { M, TAM, cabecalho, dataExtenso, kwanzas, kwanzasPorExtenso, marcaDagua, novaPagina, paragrafo, referencia } from './base'

/*
  Declarações e guias de marcha, desenhadas como os modelos da ESG (Times 14, dados em maiúsculas).
  Declarações: de efectividade (militar, discente), de salário (militar) e de serviço (civil, empregada(o)
  domiciliar); numeradas por ano («Nº402/26»), válidas por 90 dias, com a marca-d'água das FAA.
*/
const militar = (p) => p.tipo === 'militar'
const ano2 = (ano) => String(ano).slice(-2)
// margens das declarações, medidas no modelo: 36 mm à esquerda e 28 mm à direita; 1.ª linha recuada 15 mm
const X = 36
const W = 210 - X - 28
const RECUO = 15

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
  y = paragrafo(d, corpo, y, { x: X, w: W, recuo: RECUO })
  y += 7
  const local = militar(p) && !domiciliar ? 'nesta Unidade Militar' : 'neste Estabelecimento de Ensino Militar'
  y = paragrafo(d, [`Por ser verdade e me ter sido solicitado, mandei passar a presente declaração que por mim vai assinada e autenticada, com o carimbo a óleo em uso ${local}.`], y, { x: X, w: W, recuo: RECUO })
  // a finalidade vai na OBS (a efectividade e o rendimento simples não a têm)
  // (os espaços daqui para baixo são os do modelo)
  const obs = o.finalidade && !o.semObs
  if (obs) {
    y += 11
    doc.setFont('times', 'bold').setFontSize(TAM).text('OBS:', X + RECUO, y)
    const w = doc.getTextWidth('OBS: ')
    y = paragrafo(d, [`A presente destina-se para ${o.finalidade.replace(/\.$/, '')}.`], y, { x: X + RECUO + w, w: W - RECUO - w, recuo: 0 })
  }
  // validade (o modelo usa letra sem serifa nesta caixa)
  y += obs ? 18 : 24
  const v = 'Válida por um período de (90) Noventa Dias'
  doc.setFont('helvetica', 'bold').setFontSize(11)
  const vw = doc.getTextWidth(v) + 8
  doc.setLineWidth(0.4).rect(105 - vw / 2, y - 5.2, vw, 7.8).text(v, 105, y, { align: 'center' })
  y += 21
  // «ESG em Luanda, 24 de Junho de 2026.» (civis: «Escola Superior de Guerra em Luanda, …»)
  const quemEmite = militar(p) && !domiciliar ? 'ESG' : 'Escola Superior de Guerra'
  const resto = ` em ${quem.local || 'Luanda'}, ${dataExtenso(o.data)}.`
  doc.setFont('times', 'bold').setFontSize(TAM)
  const w1 = doc.getTextWidth(quemEmite)
  const w2 = doc.setFont('times', 'normal').getTextWidth(resto)
  doc.setFont('times', 'bold').text(quemEmite, 105 - (w1 + w2) / 2, y)
  doc.setFont('times', 'normal').text(resto, 105 - (w1 + w2) / 2 + w1, y)
  y += 17
  const c = quem.comandante ?? {}
  doc.setFont('times', 'bold').text(M(c.cargo || 'O COMANDANTE DA ESG'), 105, y, { align: 'center' })
  if (c.nome) doc.text(M(c.nome), 105, y + 13, { align: 'center' })
  if (c.posto) doc.text(`**${M(c.posto)}**`, 105, y + 19.5, { align: 'center' })
  doc.setFont('times', 'normal')
}

/*
  Guias de marcha individual (como os modelos): férias e férias adicionais (art. 32.º da Lei n.º 13/18),
  dispensa (militar, civil, discente) e apresentação noutra unidade. Num quadro até ao fundo da folha, com
  o emblema das FAA por cima e outro, grande e claro, ao fundo. o = { tipo, dias, inicio, motivo, provincia, destino, referencia }.
*/
function designacao(p, variante) {
  const a = p.genero === 'F' ? 'A' : 'O'
  const o = p.genero === 'F' ? 'a' : 'o'
  if (variante === 'discente' || (!variante && p.vinculo === 'estudante')) return [`${a} Discente`, o, 'à Instituição']
  if (!militar(p)) return [`${a} ${p.genero === 'F' ? 'funcionária' : 'funcionário'}`, o, 'à Unidade']
  if (p.categoria === 'oficial_general') return [`${a} Oficial General`, o, 'à Unidade']
  if (p.categoria === 'oficial_superior') return [`${a} Oficial Superior`, o, 'à Unidade']
  return [`${a} Militar`, o, 'à Unidade']
}

// «DA Repartição», mas «DO Centro Médico», «DO Gabinete»… (pela primeira palavra da unidade)
const MASCULINOS = /^(centro|comando|gabinete|departamento|sector|serviço|núcleo|pelotão|batalhão|grupo|estado|posto|curso|corpo|conselho|destacamento|esquadrão|hospital|instituto|arquivo|parque|depósito)(?=\s|$)/i
const daUnidade = (u) => (MASCULINOS.test(u.trim()) ? 'DO' : 'DA')

// «Sr. – 2º SARGENTO – EXE – QP – INF – 100253568 – NOME – SERRALHEIRO DA SECÇÃO …/ESG/EMGFAA.»
export function linhaPessoa(p, cursoDiscente) {
  const sr = p.genero === 'F' ? 'Srª.' : 'Sr.'
  // o discente: «DISCENTE DO 31º CURSO SUPERIOR DE COMANDO E DIRECÇÃO» (o curso em curso, ou a unidade do curso)
  const curso = cursoDiscente || (p.vinculo === 'estudante' ? (p.cursos ?? []).find((c) => !c.fim)?.nome || p.unidadeNome : '')
  const funcao = curso ? `DISCENTE DO ${curso}` : [p.cargoNome, p.unidadeNome && `${daUnidade(p.unidadeNome)} ${p.unidadeNome}`].filter(Boolean).join(' ')
  // nas guias o posto vai abreviado («1.º SARG.», «TEN.-COR.»)
  if (militar(p)) return [`${sr} – `, { b: [M(p.postoAbreviatura || p.postoNome), p.ramo, p.fps, p.quadroEspecial, p.nip].filter(Boolean).map(M).join(' – ') }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || 'EFECTIVO')}/ESG/EMGFAA.` }]
  return [`${sr} – `, { b: 'CIVIL' }, ' – ', { b: M(p.nome) }, ' – ', { b: `${M(funcao || p.categoriaCivil || 'FUNCIONÁRIO')} DA ESCOLA SUPERIOR DE GUERRA/EMGFAA.` }]
}

export function guiaMarcha(d, p, o, quem) {
  const { doc } = d
  novaPagina(d)
  // o emblema e a marca-d'água ao centro do quadro (como no modelo)
  marcaDagua(d, 110, 150, 150, 0.1)
  emblema(doc, d.brasao, 111, 9, 16)
  // medidas tiradas do modelo digitalizado (mm): quadro de 19 a 200, cabeçalho de 26 a 56; letra do corpo 15
  const x0 = 19
  const w = 181
  const topo = 26
  const alto = 30
  const T = TAM + 1
  const L = 6.4 // entre linhas
  // cabeçalho em três colunas
  const col = [69, 57, 55]
  doc.setLineWidth(0.35).rect(x0, topo, w, alto)
  doc.line(x0 + col[0], topo, x0 + col[0], topo + alto).line(x0 + col[0] + col[1], topo, x0 + col[0] + col[1], topo + alto)
  doc.setFont('times', 'normal').setFontSize(11)
  doc.text('FORÇAS ARMADAS ANGOLANAS', x0 + col[0] / 2, topo + 15, { align: 'center' }).text('ESTADO-MAIOR GENERAL', x0 + col[0] / 2, topo + 25, { align: 'center' })
  doc.text('GUIA DE MARCHA', x0 + col[0] + col[1] / 2, topo + 14, { align: 'center' }).text('INDIVIDUAL', x0 + col[0] + col[1] / 2, topo + 23.5, { align: 'center' })
  doc.text('UEO - ESG', x0 + col[0] + col[1] + col[2] / 2, topo + 12.5, { align: 'center' })
  doc.setFontSize(T)
  let y = topo + alto + 4.5
  const ano = new Date(o.inicio || Date.now()).getFullYear()
  // a dispensa tem três modelos: militar, civil e discente (por defeito, o de quem é)
  const variante = o.variante || (p.vinculo === 'estudante' ? 'discente' : militar(p) ? 'militar' : 'civil')
  const discenteOuCivil = variante !== 'militar'
  const lei = `Ao abrigo do estabelecido no Artigo 32º da Lei 13/018, de 29 de Outubro, Lei das Carreiras dos Militares, e em conformidade com o Plano de Férias para os Efectivos da UEO, em Comissão Normal de Serviço no EMG, superiormente aprovado para o ano de ${ano};`
  const intro = {
    ferias: militar(p) ? [lei] : [`Em conformidade com o Plano de Férias para os Efectivos da Escola Superior de Guerra, superiormente aprovado para o ano de ${ano};`],
    licenca: [lei],
    dispensa: [{ militar: 'Em conformidade com o despacho do General Comandante da Escola Superior de Guerra;', civil: 'Em conformidade com o despacho de Sua Excelência Comandante da ESG;', discente: 'Em conformidade com o Despacho de Sua Excelência Comandante da ESG;' }[variante]],
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
  y = paragrafo(d, intro, y, { x: xi, w: wi, recuo: 0, tam: T, entre: L })
  y += 4
  y = paragrafo(d, [marcha], y, { x: xi, w: wi, recuo: 0, justificar: false, tam: T, entre: L })
  y += 8
  // «A fim de Gozar Férias ________» (a linha vai até ao fim do quadro)
  y = paragrafo(d, [fim], y, { x: xi, w: wi, recuo: 0, justificar: false, tam: T, entre: L })
  doc.setFont('times', 'normal').setFontSize(T)
  const ult = doc.splitTextToSize(fim, wi).at(-1)
  const xf = xi + doc.getTextWidth(ult) + 2
  if (xf < xi + wi - 6) doc.setLineWidth(0.2).line(xf, y - L + 0.8, xi + wi, y - L + 0.8)
  y += 6
  y = paragrafo(d, linhaPessoa(p, variante === 'discente' && o.tipo === 'dispensa' ? o.curso : ''), y, { x: xi, w: wi, recuo: 0, tam: T, entre: L })
  y += 4.6
  y = paragrafo(d, ['Utilizando as seguintes vias: Todas vias possíveis'], y, { x: xi, w: wi, recuo: 0, justificar: false, tam: T, entre: L })
  doc.setLineWidth(0.3).line(x0 + 2, y + 2, x0 + w - 2, y + 2)
  y += 12.9
  doc.setFont('times', 'normal').setFontSize(T).text('OUTRAS INDICAÇÕES', xi, y)
  y += 10
  const [quemE, o2, regresso] = designacao(p, o.tipo === 'dispensa' ? variante : undefined)
  const dias = String(o.dias || (o.tipo === 'ferias' ? 30 : o.tipo === 'licenca' ? 15 : 5)).padStart(2, '0')
  const inicio = dataExtenso(o.inicio)
  const estado = {
    ferias: `encontra-se em gozo de férias, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    licenca: `encontra-se em gozo de licença disciplinar, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    dispensa: `encontra-se dispensad${o2}, por um período de ${dias} dias, a partir do dia ${inicio}, fim dos quais deverá regressar ${regresso}.`,
    apresentacao: `segue apresentar-se à ${o.sigla || o.destino || ''}, por um período de ${dias} dias.`,
  }[o.tipo]
  y = paragrafo(d, [o.tipo === 'apresentacao' ? `${quemE}, ${estado}` : `${quemE} acima mencionad${o2} ${estado}`], y, { x: xi, w: wi, recuo: 0, tam: T, entre: L })
  doc.setLineWidth(0.3).line(x0 + 2, y + 1, x0 + w - 2, y + 1)
  // data e assinatura (como no modelo, sem negrito)
  y += 22
  const c = quem.comandante ?? {}
  const meio = x0 + w / 2
  doc.setFont('times', 'normal').setFontSize(T)
  doc.text(`${M(quem.local || 'Luanda')}, ${M(dataExtenso(o.data))}`, meio, y, { align: 'center' })
  doc.text(M(c.cargo || 'O COMANDANTE DA ESG'), meio, y + 14.7, { align: 'center' })
  if (c.nome) doc.text(M(c.nome), meio, y + 25.8, { align: 'center' })
  if (c.posto) doc.text(`**${M(c.posto)}**`, meio, y + 34.2, { align: 'center' })
  const fundo = Math.max(y + 53, 269)
  doc.setLineWidth(0.35).rect(x0, topo, w, fundo - topo)
  doc.setFontSize(TAM)
  referencia(d, 'RPQ/ESG/CP3 OP.MG', x0, fundo + 13)
}

/*
  Declarações para os bancos (os modelos do SIGP, com o cabeçalho e a assinatura da ESG): crédito pessoal e
  adiantamento salarial (BFA), BPC Salário e crédito bancário (BPC). o.banco = 'bfa_credito' | 'bfa_adiantamento' |
  'bpc_salario' | 'bpc_credito'. Militares: «Posto-NIP Nome … efectivo do Quadro Permanente das FAA»; civis:
  «Nome … efectivo do Quadro das FAA com a categoria de …».
*/
const BANCOS = {
  bfa_credito: { banco: 'BANCO DE FOMENTO ANGOLA', sigla: 'BFA', finalidade: 'ao Crédito Pessoal ao abrigo do protocolo celebrado entre as FAA e o BFA' },
  bfa_adiantamento: { banco: 'BANCO DE FOMENTO ANGOLA', sigla: 'BFA', finalidade: 'ao Adiantamento Salarial ao abrigo do protocolo celebrado entre as FAA e o BFA' },
  bpc_salario: { banco: 'BANCO DE POUPANÇA E CRÉDITO', sigla: 'BPC', finalidade: 'ao BPC Salário ao abrigo do protocolo celebrado entre as FAA e o BPC' },
  bpc_credito: { banco: 'BANCO DE POUPANÇA E CRÉDITO', sigla: 'BPC', finalidade: 'ao Crédito Bancário ao abrigo do protocolo celebrado entre as FAA e o BPC' },
}
export function declaracaoBanco(d, p, o, quem) {
  const { doc } = d
  const b = BANCOS[o.banco]
  novaPagina(d)
  marcaDagua(d, 105, 192, 92, 0.06)
  let y = cabecalho(d)
  // «AO / BANCO DE FOMENTO ANGOLA / LUANDA», à direita, sem passar a margem direita (28 mm)
  doc.setFont('times', 'bold').setFontSize(TAM)
  const xb = Math.min(128, 210 - 28 - doc.getTextWidth(b.banco))
  doc.text('AO', xb, y + 4).text(b.banco, xb, y + 10.5).text('LUANDA', xb, y + 17)
  y += 24
  doc.setFont('times', 'bolditalic').text(`Nº${String(o.numero ?? '').padStart(3, '0')}/${ano2(o.ano ?? new Date().getFullYear())}/RPQ/ESG/EMGFAA`, X, y)
  y += 9
  const mil = militar(p)
  const nasc = p.dataNascimento ? dataExtenso(p.dataNascimento) : '___/___/______'
  const sal = o.valor ? `${kwanzas(o.valor)}` : '____________'
  const quemE = mil
    ? ['o (a) Senhor(a) ', { b: `${M(p.postoNome)} – ${M(p.nip)} – ${M(p.nome)}` }]
    : ['o (a) Senhor(a) ', { b: M(p.nome) }]
  const efectivo = mil
    ? [`, é efectivo do ${p.fpsNome || 'Quadro Permanente'} das `, { b: 'FORÇAS ARMADAS ANGOLANAS' }, ', em serviço na Escola Superior de Guerra/EMG/FAA,']
    : [', é efectivo do Quadro das ', { b: 'FORÇAS ARMADAS ANGOLANAS' }, ', em serviço na Escola Superior de Guerra/EMG/FAA, com a categoria de ', { b: M(p.categoriaCivil || p.carreiraNome || '') }, ',']
  const bpc = b.sigla === 'BPC'
  const iban = { b: M(p.iban || '____________________________') }
  const corpo = [[`Com finalidade de habilitar-se ${b.finalidade}, declara-se que `, ...quemE, `, nascido(a) aos ${nasc}, filho(a) de `, { b: M(p.pai || '__________') }, ' e de ', { b: M(p.mae || '__________') }, ...efectivo, ' e aufere um salário líquido mensal de ', { b: `${sal} kwanzas` },
    bpc ? ' sem interrupção, estando elegível para, ao abrigo do protocolo assinado entre o BPC, S.A. e a nossa instituição, aceder ao crédito de vencimentos mediante a vossa análise de risco individual e procedimentos a cumprir de forma obrigatória.' : '.'],
  bpc
    ? ['Compromete-se também a nossa instituição a manter o salário domiciliado junto da vossa instituição, depositado na Conta/IBAN ', iban, ' e, na eventualidade de qualquer alteração relevante da relação jurídico-contratual com o funcionário, informar o Banco de modo a mitigar o risco de incumprimento de responsabilidades junto da vossa instituição.']
    : ['Conforme as instruções irrevogáveis recebidas do interessado, a partir desta data, os seus vencimentos serão mensalmente depositados na conta/IBAN nº ', iban, ' aberta no BFA, enquanto o mesmo se mantiver como membro das FAA. Reconhece-se que, apenas com autorização expressa do BFA, esta instrução poderá ser alterada ou cancelada.'],
  ['Por ter sido solicitada, mandei passar a presente declaração que vai por mim assinada e autenticada com o carimbo a óleo em uso nesta Instituição.']]
  // o texto e a assinatura têm de caber na folha: com nomes e IBAN compridos, a letra desce até 12
  const ALTURA_FIM = 7 + 14 + 12 + 19.5 + 4
  let tam = TAM
  let entre = 6.6
  for (const t of [TAM, 13.5, 13, 12.5, 12]) {
    tam = t
    entre = 6.6 * (t / TAM)
    doc.setFont('times', 'normal').setFontSize(t)
    const linhas = corpo.reduce((n, partes) => n + doc.splitTextToSize(partes.map((x) => (typeof x === 'string' ? x : x.b)).join(''), W - 12).length, 0)
    if (y + linhas * entre * 1.04 + 6 + ALTURA_FIM <= 287) break
  }
  const op = { x: X, w: W, tam, entre }
  y = paragrafo(d, corpo[0], y, op)
  y += 3
  y = paragrafo(d, corpo[1], y, op)
  y += 3
  y = paragrafo(d, corpo[2], y, op)
  y += 7
  const v = 'VÁLIDO POR UM PERÍODO DE 90 DIAS'
  doc.setFont('helvetica', 'bold').setFontSize(11)
  const vw = doc.getTextWidth(v) + 8
  doc.setLineWidth(0.4).rect(105 - vw / 2, y - 5.2, vw, 7.8).text(v, 105, y, { align: 'center' })
  y += 14
  const resto = ` em ${quem.local || 'Luanda'}, ${dataExtenso(o.data)}.`
  doc.setFont('times', 'bold').setFontSize(TAM)
  const w1 = doc.getTextWidth('ESG')
  const w2 = doc.setFont('times', 'normal').getTextWidth(resto)
  doc.setFont('times', 'bold').text('ESG', 105 - (w1 + w2) / 2, y)
  doc.setFont('times', 'normal').text(resto, 105 - (w1 + w2) / 2 + w1, y)
  y += 12
  const c = quem.comandante ?? {}
  doc.setFont('times', 'bold').text(M(c.cargo || 'O COMANDANTE DA ESG'), 105, y, { align: 'center' })
  if (c.nome) doc.text(M(c.nome), 105, y + 13, { align: 'center' })
  if (c.posto) doc.text(`**${M(c.posto)}**`, 105, y + 19.5, { align: 'center' })
  doc.setFont('times', 'normal')
}

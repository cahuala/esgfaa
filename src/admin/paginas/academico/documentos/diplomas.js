import { paragrafo } from '../../../../utils/pdfParagrafo'

/*
  Certificados e diplomas dos cursos (modelos da Escola). Só para quem concluiu o curso.
  Certificados (A4 ao alto, moldura, insígnia da República e emblema da ESG, a faixa «CERTIFICADO»):
  - «tabela»: Curso de Estratégia e Arte Operativa — disciplinas, tipo de avaliação, notas e classificação;
  - «lista»: Curso Superior de Comando e Direcção, CoaMP, Estado-Maior Conjunto — disciplinas e valores em
    duas colunas.
  Diplomas:
  - «atesta» (para todos os cursos): A4 deitado, «Atesta-se que o Senhor … frequentou …»;
  - «outorga» (cursos dos oficiais generais): A4 ao alto, decorado — «A Escola Superior de Guerra outorga o
    presente diploma ao …».
  c = resposta da emissão do certificado (estudante, curso, média, percurso, código);
  o = { edicao, inicio, fim, anoLetivo, directorEnsino, comandante, modeloCertificado, modeloDiploma }.
*/
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const dataLonga = (iso) => { if (!iso) return '___ de __________ de ____'; const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}` }
const num = (v) => Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const valores = (v) => `${num(v)} Valores`
const M = (t) => String(t ?? '').toLocaleUpperCase('pt')

// o modelo de cada curso (pelo nome), se a turma não disser outro
export const modelosDoCurso = (curso = '') => {
  const generais = /estrat[ée]gia\s+e\s+arte\s+operativa|oficia(l|is)\s+generais/i.test(curso)
  return { certificado: generais ? 'tabela' : 'lista', diploma: generais ? 'outorga' : 'atesta' }
}
export const MODELOS_CERTIFICADO = { tabela: 'Com tipo de avaliação e classificação (Estratégia e Arte Operativa)', lista: 'Disciplinas e valores em duas colunas (Comando e Direcção, CoaMP, Estado-Maior Conjunto)' }
export const MODELOS_DIPLOMA = { atesta: '«Atesta-se que…» (todos os cursos)', outorga: '«A ESG outorga o presente diploma…» (cursos dos oficiais generais)' }

async function novo() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  return { doc, paginas: 0 }
}

function folha(d, orientacao) {
  const { doc } = d
  if (d.paginas++ > 0) doc.addPage('a4', orientacao)
  else if (orientacao === 'landscape') { doc.addPage('a4', 'landscape'); doc.deletePage(1) }
  doc.setTextColor(0).setDrawColor(0)
  return { W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight() }
}

// o nome sem a abreviatura do posto que às vezes vem colada («Cap.-Ten. Pedro Neto»)
const nomeLimpo = (e) => (e.dados?.posto ? e.nome.replace(/^(\S+\.\s+)+/, '') : e.nome)
const antesDoNome = (e) => [e.dados?.nip ? `NIP ${e.dados.nip}` : null, e.dados?.posto].filter(Boolean).join(' – ')
const curso = (c, o) => `${o.edicao ? `${o.edicao} ` : ''}${c.curso}`
const codigo = (doc, c, W, y) => doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(120).text(`Código de verificação: ${c.codigo}`, W / 2, y, { align: 'center' }).setTextColor(0)

// as disciplinas feitas (o melhor resultado de cada uma) e o trabalho de fim de curso
function disciplinas(c) {
  const melhor = new Map()
  for (const l of [...(c.percurso?.anos ?? []).flatMap((a) => a.disciplinas), ...(c.percurso?.inscricoes ?? [])]) {
    if (l.situacao !== 'aprovado' && l.situacao !== 'dispensado') continue
    const atual = melhor.get(l.cadeira.codigo)
    if (!atual || Number(l.final) >= Number(atual.final)) melhor.set(l.cadeira.codigo, l)
  }
  const tipo = (l) => (l.situacao === 'dispensado' ? 'Prova' : l.recurso !== null && l.recurso !== undefined ? 'Recurso' : 'Exame')
  const r = [...melhor.values()].map((x) => ({ nome: x.cadeira.nome, tipo: tipo(x), nota: x.final, classificacao: x.classificacao ?? '' }))
  if (c.percurso?.tfc?.nota !== null && c.percurso?.tfc?.nota !== undefined) r.push({ nome: 'Trabalho de Investigação Individual', tipo: 'Defesa', nota: c.percurso.tfc.nota, classificacao: c.percurso.tfc.classificacao ?? '' })
  return r
}

/*
  Os fundos são as digitalizações dos modelos da Escola (a moldura, a insígnia, o emblema, o cabeçalho e a
  faixa), sem o texto que muda; por cima escreve-se o texto nas posições do modelo, na letra cursiva (Z003, a
  cópia livre da Zapf Chancery, parecida com a Monotype Corsiva do modelo) e as assinaturas em Bookman.
*/
async function prepararModelo(d, fundo) {
  if (!d.fundos) d.fundos = {}
  if (!d.letras) {
    const [{ default: corsiva }, { default: bookman }] = await Promise.all([import('../../../../assets/fontes/Z003-MediumItalic.ttf?url'), import('../../../../assets/fontes/URWBookman-Demi.ttf?url')])
    const [c, bk] = await Promise.all([base64(corsiva), base64(bookman)])
    d.doc.addFileToVFS('Z003.ttf', c)
    d.doc.addFont('Z003.ttf', 'Corsiva', 'normal')
    d.doc.addFileToVFS('Bookman.ttf', bk)
    d.doc.addFont('Bookman.ttf', 'Bookman', 'normal')
    d.letras = true
  }
  if (!d.fundos[fundo]) {
    const urls = { tabela: () => import('../../../../assets/certificado-tabela.jpg'), lista: () => import('../../../../assets/certificado-lista.jpg'), atesta: () => import('../../../../assets/diploma-todos.jpg') }
    const { default: url } = await urls[fundo]()
    d.fundos[fundo] = `data:image/jpeg;base64,${await base64(url)}`
  }
}
const corsiva = (doc, tam) => doc.setFont('Corsiva', 'normal').setFontSize(tam)
const negrito = (doc, t, x, y, op = {}) => doc.text(t, x, y, { ...op, renderingMode: 'fillThenStroke' })
function assinaturasModelo(doc, o, y, xs, tam = 11.5) {
  doc.setLineWidth(0.12)
  ;[o.directorEnsino, o.comandante].forEach((q, i) => {
    doc.setFont('Bookman', 'normal').setFontSize(tam).text(M(q?.cargo || (i ? 'O COMANDANTE DA ESG' : 'O DIRECTOR DE ENSINO')), xs[i], y, { align: 'center' })
    if (q?.nome) doc.text(M(q.nome), xs[i], y + 11.5, { align: 'center' })
    if (q?.posto) doc.text(i ? `**${M(q.posto)}**` : `*${M(q.posto)}*`, xs[i], y + 16.7, { align: 'center' })
  })
}
const textoCertificado = (c, o, virgula) => ['Para os devidos efeitos, certifica-se que o Senhor ', `${antesDoNome(c.estudante)} – `, { b: nomeLimpo(c.estudante) }, ` concluiu o ${curso(c, o)}${virgula} no Ano Académico ${o.anoLetivo}, de ${dataLonga(o.inicio)} ${virgula ? 'à' : 'a'} ${dataLonga(o.fim)}, com a Média Final de ${valores(c.media)}, conforme consta nos arquivos da Direcção de Ensino${virgula} desta Instituição.`]

// ---------- certificado com tipo de avaliação e classificação (Estratégia e Arte Operativa) ----------
function certificadoTabela(d, c, o) {
  const { doc } = d
  const { W } = folha(d, 'portrait')
  doc.addImage(d.fundos.tabela, 'JPEG', 0, 0, 210, 297)
  doc.setTextColor(25, 25, 30).setLineWidth(0.12)
  paragrafo(doc, textoCertificado(c, o, ','), 104.6, { x: 29.4, w: 162.5, recuo: 0, entre: 5.4, tam: 12.6, familia: 'Corsiva', negritoFalso: true })
  corsiva(doc, 10.5)
  negrito(doc, 'DISCIPLINAS', 61.8, 131.2, { align: 'center' })
  negrito(doc, ['TIPO DE', 'AVALIAÇÃO'], 124.3, 128.2, { align: 'center', lineHeightFactor: 1.15 })
  negrito(doc, 'NOTAS', 153.1, 128.2, { align: 'center' })
  negrito(doc, ['CLASSIFI-', 'CAÇÃO'], 180.4, 128.2, { align: 'center', lineHeightFactor: 1.15 })
  const l = disciplinas(c)
  const y0 = 139.6
  const passo = Math.min(7.5, (201 - y0) / Math.max(1, l.length))
  corsiva(doc, l.length > 14 ? 11 : 12.4)
  l.forEach((x, i) => {
    const y = y0 + i * passo
    doc.text(doc.splitTextToSize(x.nome, 88)[0], 29.7, y)
    doc.text(x.tipo, 124.3, y, { align: 'center' }).text(valores(x.nota), 151.6, y, { align: 'center' }).text(x.classificacao, 180.4, y, { align: 'center' })
  })
  corsiva(doc, 12.4)
  negrito(doc, 'Média Final', 29.7, 209.2)
  negrito(doc, valores(c.media), 151.6, 209.2, { align: 'center' })
  negrito(doc, c.percurso?.conclusao?.classificacaoFinal ?? '', 180.4, 209.2, { align: 'center' })
  corsiva(doc, 12.6).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, 111.3, 218.8, { align: 'center' })
  assinaturasModelo(doc, o, 241.5, [63, 158.3])
  doc.setTextColor(0)
  codigo(doc, c, W, 271)
}

// ---------- certificado com as disciplinas e os valores em duas colunas (Comando e Direcção, CoaMP, EM Conjunto) ----------
function certificadoLista(d, c, o) {
  const { doc } = d
  const { W } = folha(d, 'portrait')
  doc.addImage(d.fundos.lista, 'JPEG', 0, 0, 210, 297)
  doc.setTextColor(25, 25, 30).setLineWidth(0.12)
  paragrafo(doc, textoCertificado(c, o, ''), 108.5, { x: 29.4, w: 156.8, recuo: 0, entre: 5.85, tam: 14, familia: 'Corsiva', negritoFalso: true })
  const l = disciplinas(c)
  const metade = Math.ceil(l.length / 2)
  const passo = Math.min(7.68, (222 - 157.4) / Math.max(1, metade))
  for (const [x0, x1, ls] of [[27.4, 108.8, l.slice(0, metade)], [115.1, 191.4, l.slice(metade)]]) {
    corsiva(doc, 13.5)
    negrito(doc, 'Disciplinas', x0, 149.3)
    negrito(doc, 'valores', x1, 149.3, { align: 'right' })
    corsiva(doc, metade > 9 ? 10.8 : 11.6)
    ls.forEach((x, i) => {
      const y = 157.4 + i * passo
      const v = num(x.nota)
      const nome = doc.splitTextToSize(x.nome, x1 - x0 - 16)[0]
      const wn = doc.getTextWidth(nome)
      const pontos = Math.max(3, Math.floor((x1 - x0 - wn - doc.getTextWidth(v) - 1.2) / doc.getTextWidth('.')))
      doc.text(nome, x0, y).text('.'.repeat(pontos), x0 + wn + 0.5, y).text(v, x1, y, { align: 'right' })
    })
  }
  corsiva(doc, 14).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, 110.3, 228.4, { align: 'center' })
  assinaturasModelo(doc, o, 241.8, [54.7, 156], 10.5)
  doc.setTextColor(0)
  codigo(doc, c, W, 271)
}

// ---------- diploma «Atesta-se que…» (todos os cursos), A4 deitado ----------
function diplomaAtesta(d, c, o) {
  const { doc } = d
  const { W } = folha(d, 'landscape')
  doc.addImage(d.fundos.atesta, 'JPEG', 0, 0, 297, 210)
  doc.setTextColor(25, 25, 30).setLineWidth(0.12)
  const classif = M(c.percurso?.conclusao?.classificacaoFinal || '')
  paragrafo(doc, [`Atesta-se que o Senhor ${antesDoNome(c.estudante).replace(/ – /g, '–')}–${nomeLimpo(c.estudante)}, frequentou no Ano Académico ${o.anoLetivo}, de ${dataLonga(o.inicio)} a ${dataLonga(o.fim)} o ${curso(c, o)}, tendo obtido a Classificação Final de `, { b: `${classif}.` }],
    104.5, { x: 33.6, w: 216, recuo: 0, entre: 8, tam: 17.5, familia: 'Corsiva', negritoFalso: true })
  corsiva(doc, 17.5).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, 144.9, 139.1, { align: 'center' })
  ;[o.directorEnsino, o.comandante].forEach((q, i) => {
    const x = i ? 210.5 : 79.4
    doc.setFont('Bookman', 'normal').setFontSize(12.5).text(M(q?.cargo || (i ? 'O COMANDANTE DA ESG' : 'O DIRECTOR DE ENSINO')), x, 163.4, { align: 'center' })
    if (q?.nome) doc.text(M(q.nome), x, 174.6, { align: 'center' })
    if (q?.posto) doc.text(i ? `**${M(q.posto)}**` : `*${M(q.posto)}*`, x, 180.7, { align: 'center' })
  })
  doc.setTextColor(0)
  codigo(doc, c, W, 202)
}

// ---------- diploma «A ESG outorga o presente diploma…» (cursos dos oficiais generais) ----------
/*
  O fundo é o próprio diploma da Escola digitalizado (fitas, selo, arabescos, emblema, «DIPLOMA» e os textos
  fixos), sem o que muda de pessoa para pessoa; por cima escreve-se o nome (em letra manuscrita, como no
  original), o curso, a classificação, as datas e o rótulo do Director. As posições são as do original.
*/
async function base64(url) {
  const r = await fetch(url)
  const bytes = new Uint8Array(await r.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
async function prepararGenerais(d) {
  if (d.fundoGenerais) return
  const [{ default: fundo }, { default: letra }] = await Promise.all([import('../../../../assets/diploma-generais.jpg'), import('../../../../assets/fontes/GreatVibes-Regular.ttf?url')])
  const [f, l] = await Promise.all([base64(fundo), base64(letra)])
  d.fundoGenerais = `data:image/jpeg;base64,${f}`
  d.doc.addFileToVFS('GreatVibes-Regular.ttf', l)
  d.doc.addFont('GreatVibes-Regular.ttf', 'GreatVibes', 'normal')
}
function diplomaOutorga(d, c, o) {
  const { doc } = d
  folha(d, 'portrait')
  doc.addImage(d.fundoGenerais, 'JPEG', 0, 0, 210, 297)
  const cx = 123.2
  const tinta = [35, 30, 28]
  doc.setTextColor(...tinta)
  // o posto e o nome, em letra manuscrita
  const nome = [c.estudante.dados?.posto, nomeLimpo(c.estudante)].filter(Boolean).join(' ')
  let t = 40
  doc.setFont('GreatVibes', 'normal')
  while (t > 22 && doc.setFontSize(t).getTextWidth(nome) > 140) t -= 1
  doc.text(nome, cx, 154, { align: 'center' })
  doc.setFont('times', 'normal').setFontSize(13.3).text('PELA CONCLUSÃO DO', cx, 168.9, { align: 'center' })
  const curs = M(curso(c, o)).replace(/(\d+)\.?º/, '$1º')
  let tc = 17.5
  while (tc > 11 && doc.setFontSize(tc).getTextWidth(curs) > 150) tc -= 0.5
  doc.text(curs, cx, 178.9, { align: 'center' })
  const classif = M(c.percurso?.conclusao?.classificacaoFinal || '')
  // como no original: a classificação numa linha e as datas na seguinte
  doc.setFontSize(12.5).text(`COM A CLASSIFICAÇÃO DE ${classif}, QUE DECORREU DE`, cx, 186.1, { align: 'center' }).text(`${M(dataLonga(o.inicio))} À ${M(dataLonga(o.fim))}.`, cx, 191.8, { align: 'center' })
  doc.setFontSize(13).text(`LUANDA, ${M(dataLonga(o.fim))}`, cx, 203.7, { align: 'center' })
  // o rótulo e a linha do Director (o Comandante já está no fundo)
  doc.setFontSize(10.6).text('O DIRECTOR DOS A. ACADÉMICOS', 70, 227.5, { align: 'center' })
  doc.setDrawColor(70).setLineWidth(0.3).line(40.8, 242.8, 97.5, 242.8).setDrawColor(0)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal').setFontSize(5.5).setTextColor(120).text(`Código de verificação: ${c.codigo}`, cx, 293, { align: 'center' }).setTextColor(0)
}

// documentos: ['certificado', 'diploma']; um PDF para o estudante, com os modelos do curso (ou os da turma)
export async function gerarDiplomas(c, o, documentos) {
  const d = await novo()
  const m = { ...modelosDoCurso(c.curso), ...(o.modeloCertificado ? { certificado: o.modeloCertificado } : {}), ...(o.modeloDiploma ? { diploma: o.modeloDiploma } : {}) }
  // primeiro os fundos e as letras; depois as páginas
  if (documentos.includes('certificado')) await prepararModelo(d, m.certificado)
  if (documentos.includes('diploma') && m.diploma === 'atesta') await prepararModelo(d, 'atesta')
  if (documentos.includes('diploma') && m.diploma === 'outorga') await prepararGenerais(d)
  if (documentos.includes('certificado')) (m.certificado === 'tabela' ? certificadoTabela : certificadoLista)(d, c, o)
  if (documentos.includes('diploma')) (m.diploma === 'outorga' ? diplomaOutorga : diplomaAtesta)(d, c, o)
  const nome = c.estudante.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()
  d.doc.save(`${nome}-${documentos.join('-')}.pdf`)
}

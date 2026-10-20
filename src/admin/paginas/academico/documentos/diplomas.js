import Insignia from '../../../../assets/insignia-angola.png'
import Logo from '../../../../assets/Logo.png'
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
const OURO = [176, 141, 52]
const OURO_CLARO = [236, 213, 140]
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

async function imagem(url, max = 420) {
  return new Promise((ok) => {
    const i = new Image()
    i.onload = () => {
      const k = Math.min(1, max / Math.max(i.width, i.height))
      const c = document.createElement('canvas')
      c.width = Math.round(i.width * k)
      c.height = Math.round(i.height * k)
      c.getContext('2d').drawImage(i, 0, 0, c.width, c.height)
      ok({ src: c.toDataURL('image/png'), proporcao: i.width / i.height })
    }
    i.onerror = () => ok(null)
    i.src = url
  })
}

async function novo() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const [insignia, logo] = await Promise.all([imagem(Insignia), imagem(Logo)])
  return { doc, insignia, logo, paginas: 0 }
}

function folha(d, orientacao) {
  const { doc } = d
  if (d.paginas++ > 0) doc.addPage('a4', orientacao)
  else if (orientacao === 'landscape') { doc.addPage('a4', 'landscape'); doc.deletePage(1) }
  doc.setTextColor(0).setDrawColor(0)
  return { W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight() }
}
const img = (doc, i, cx, y, h) => { if (i) doc.addImage(i.src, 'PNG', cx - (h * i.proporcao) / 2, y, h * i.proporcao, h) }
const moldura = (doc, W, H, m = 13) => doc.setDrawColor(150, 160, 90).setLineWidth(0.9).rect(m, m, W - 2 * m, H - 2 * m).setLineWidth(0.3).rect(m + 1.6, m + 1.6, W - 2 * m - 3.2, H - 2 * m - 3.2).setDrawColor(0)

// moldura, a insígnia, o emblema e as quatro linhas do cabeçalho (certificados)
function cabecalhoOficial(d, W, H, y0 = 20) {
  const { doc } = d
  moldura(doc, W, H)
  img(doc, d.insignia, 35, y0, 25)
  img(doc, d.logo, W - 35, y0, 25)
  doc.setFont('helvetica', 'normal').setFontSize(13)
  ;['REPÚBLICA DE ANGOLA', 'FORÇAS ARMADAS ANGOLANAS', 'ESTADO-MAIOR GENERAL'].forEach((l, i) => doc.text(l, W / 2, y0 + 7 + i * 5.6, { align: 'center' }))
  doc.setFont('times', 'bold').setFontSize(13.5).text('ESCOLA SUPERIOR DE GUERRA', W / 2, y0 + 24, { align: 'center' })
}

// faixa dourada (rolo de pergaminho) com o título; as pontas em V para os lados
function faixa(d, titulo, cx, y, w, { tam = 22, espacado = false } = {}) {
  const { doc } = d
  const x = cx - w / 2
  const a = 15
  doc.setDrawColor(120, 95, 30).setLineWidth(0.3)
  for (const s of [-1, 1]) {
    const xi = s < 0 ? x + 4 : x + w - 4
    const xp = s < 0 ? x - 26 : x + w + 26
    const xm = s < 0 ? x - 14 : x + w + 14
    // a ponta: um rectângulo com o recorte em V do lado de fora, mais baixa que o rolo
    const t = y + 4
    const b = y + a + 8
    doc.setFillColor(...OURO).lines([[xp - xi, 0], [xm - xp, (b - t) / 2], [xp - xm, (b - t) / 2], [xi - xp, 0]], xi, t, [1, 1], 'FD', true)
    // a dobra (mais escura) junto ao rolo
    doc.setFillColor(140, 110, 40).triangle(xi, b, xi + s * 9, b, xi + s * 9, b - 4, 'F')
  }
  doc.setFillColor(...OURO_CLARO).roundedRect(x, y - 3, w, a, 2.5, 2.5, 'FD')
  doc.setFillColor(214, 184, 100).rect(x + 1, y + a - 7, w - 2, 5, 'F')
  doc.setFont('times', 'bolditalic').setFontSize(tam).setTextColor(70, 55, 25)
  doc.text(espacado ? titulo.split('').join(' ') : titulo, cx, y + a / 2 + 2, { align: 'center' })
  doc.setTextColor(0).setDrawColor(0)
}

function assinaturas(doc, q1, q2, y, xs, tam = 10.5) {
  ;[q1, q2].forEach((q, i) => {
    doc.setFont('helvetica', 'bold').setFontSize(tam).text(M(q?.cargo || (i ? 'O COMANDANTE DA ESG' : 'O DIRECTOR DE ENSINO')), xs[i], y, { align: 'center' })
    doc.setFont('courier', 'bold').setFontSize(tam + 0.5)
    if (q?.nome) doc.text(M(q.nome), xs[i], y + 12, { align: 'center' })
    if (q?.posto) doc.text(i ? `**${M(q.posto)}**` : `*${M(q.posto)}*`, xs[i], y + 17, { align: 'center' })
  })
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
const textoCertificado = (c, o, sep) => [`Para os devidos efeitos, certifica-se que o Senhor ${antesDoNome(c.estudante)} – `, { b: nomeLimpo(c.estudante) }, ` concluiu o ${curso(c, o)}${sep} no Ano Académico ${o.anoLetivo}, de ${dataLonga(o.inicio)} a ${dataLonga(o.fim)}, com a Média Final de ${valores(c.media)}, conforme consta nos arquivos da Direcção de Ensino desta Instituição.`]

// ---------- certificado com tipo de avaliação e classificação (Estratégia e Arte Operativa) ----------
function certificadoTabela(d, c, o) {
  const { doc } = d
  const { W, H } = folha(d, 'portrait')
  cabecalhoOficial(d, W, H)
  faixa(d, 'CERTIFICADO', W / 2, 62, 112)
  let y = paragrafo(doc, textoCertificado(c, o, ','), 92, { x: 22, w: W - 44, recuo: 0, entre: 5.8, tam: 11.5, estilo: 'italic' })
  const l = disciplinas(c)
  y += 5
  const cols = [24, 131, 160, 184]
  doc.setFont('times', 'bolditalic').setFontSize(9.5)
  doc.text('DISCIPLINAS', 70, y + 3, { align: 'center' })
  doc.text(['TIPO DE', 'AVALIAÇÃO'], cols[1], y, { align: 'center' }).text('NOTAS', cols[2], y, { align: 'center' }).text(['CLASSIFI-', 'CAÇÃO'], cols[3], y, { align: 'center' })
  y += 10
  const passo = Math.min(6.2, (H - 95 - y) / Math.max(1, l.length))
  doc.setFont('times', 'italic').setFontSize(l.length > 16 ? 9.5 : 10.5)
  for (const x of l) {
    doc.text(doc.splitTextToSize(x.nome, 102)[0], cols[0], y)
    doc.text(x.tipo, cols[1], y, { align: 'center' }).text(valores(x.nota), cols[2], y, { align: 'center' }).text(x.classificacao, cols[3], y, { align: 'center' })
    y += passo
  }
  y += 5
  doc.setFont('times', 'bolditalic').setFontSize(10.5).text('Média Final', cols[0], y).text(valores(c.media), cols[2], y, { align: 'center' }).text(c.percurso?.conclusao?.classificacaoFinal ?? '', cols[3], y, { align: 'center' })
  doc.setFont('times', 'italic').setFontSize(11.5).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, W / 2, H - 70, { align: 'center' })
  assinaturas(doc, o.directorEnsino, o.comandante, H - 50, [62, W - 62])
  codigo(doc, c, W, H - 16)
}

// ---------- certificado com as disciplinas e os valores em duas colunas (Comando e Direcção, CoaMP, EM Conjunto) ----------
function certificadoLista(d, c, o) {
  const { doc } = d
  const { W, H } = folha(d, 'portrait')
  cabecalhoOficial(d, W, H)
  faixa(d, 'CERTIFICADO', W / 2, 62, 112)
  let y = paragrafo(doc, textoCertificado(c, o, ''), 98, { x: 22, w: W - 44, recuo: 0, entre: 6.6, tam: 12.5, estilo: 'italic' })
  const l = disciplinas(c)
  const metade = Math.ceil(l.length / 2)
  y += 9
  const passo = Math.min(8.6, (H - 92 - y) / Math.max(1, metade))
  for (const [x0, x1, ls] of [[22, 103, l.slice(0, metade)], [109, 191, l.slice(metade)]]) {
    doc.setFont('times', 'bolditalic').setFontSize(11).text('Disciplinas', x0, y).text('valores', x1, y, { align: 'right' })
    let yy = y + 8
    doc.setFont('times', 'italic').setFontSize(l.length > 20 ? 9.5 : 10.5)
    for (const x of ls) {
      const v = num(x.nota)
      const nome = doc.splitTextToSize(x.nome, x1 - x0 - 20)[0]
      const wn = doc.getTextWidth(nome)
      const pontos = Math.max(3, Math.floor((x1 - x0 - wn - doc.getTextWidth(v) - 1.5) / doc.getTextWidth('.')))
      doc.text(nome, x0, yy).text('.'.repeat(pontos), x0 + wn + 0.6, yy).text(v, x1, yy, { align: 'right' })
      yy += passo
    }
  }
  doc.setFont('times', 'italic').setFontSize(12.5).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, W / 2, H - 76, { align: 'center' })
  assinaturas(doc, o.directorEnsino, o.comandante, H - 60, [62, W - 62], 9.5)
  codigo(doc, c, W, H - 16)
}

// ---------- diploma «Atesta-se que…» (todos os cursos), A4 deitado ----------
function diplomaAtesta(d, c, o) {
  const { doc } = d
  const { W, H } = folha(d, 'landscape')
  moldura(doc, W, H, 12)
  img(doc, d.insignia, 48, 22, 26)
  img(doc, d.logo, W - 48, 20, 28)
  doc.setFont('helvetica', 'normal').setFontSize(12.5)
  ;['REPÚBLICA DE ANGOLA', 'FORÇAS ARMADAS ANGOLANAS', 'ESTADO-MAIOR GENERAL'].forEach((l, i) => doc.text(l, W / 2, 26 + i * 5.4, { align: 'center' }))
  doc.setFont('times', 'bold').setFontSize(13).text('ESCOLA SUPERIOR DE GUERRA', W / 2, 42.5, { align: 'center' })
  faixa(d, 'DIPLOMA', W / 2, 52, 118, { tam: 30, espacado: true })
  const classif = M(c.percurso?.conclusao?.classificacaoFinal || '')
  paragrafo(doc, [`Atesta-se que o Senhor ${antesDoNome(c.estudante).replace(/ – /g, '–')}–${nomeLimpo(c.estudante)}, frequentou no Ano Académico ${o.anoLetivo}, de ${dataLonga(o.inicio)} a ${dataLonga(o.fim)} o ${curso(c, o)}, tendo obtido a Classificação Final de `, { b: `${classif}.` }],
    90, { x: 34, w: W - 68, recuo: 0, entre: 8.2, tam: 15.5, estilo: 'italic' })
  doc.setFont('times', 'italic').setFontSize(14).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, W / 2, 136, { align: 'center' })
  assinaturas(doc, o.directorEnsino, o.comandante, 156, [72, W - 82], 11)
  codigo(doc, c, W, H - 15)
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
  if (documentos.includes('certificado')) (m.certificado === 'tabela' ? certificadoTabela : certificadoLista)(d, c, o)
  if (documentos.includes('diploma') && m.diploma === 'outorga') await prepararGenerais(d)
  if (documentos.includes('diploma')) (m.diploma === 'outorga' ? diplomaOutorga : diplomaAtesta)(d, c, o)
  const nome = c.estudante.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()
  d.doc.save(`${nome}-${documentos.join('-')}.pdf`)
}

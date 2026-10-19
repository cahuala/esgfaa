import Insignia from '../../../../assets/insignia-angola.png'
import Logo from '../../../../assets/Logo.png'
import { paragrafo } from '../../../../utils/pdfParagrafo'

/*
  Certificado e diploma do curso (modelos da Escola), em A4 deitado: moldura dourada, insígnia da República
  à esquerda e emblema da ESG à direita, a faixa com o título, o texto e as duas assinaturas (Director de
  Ensino e Comandante). Só para quem concluiu o curso (todas as cadeiras e o trabalho de fim de curso).
  c = resposta da emissão do certificado (estudante, curso, média, percurso, código); o = { edicao, inicio, fim,
  directorEnsino, comandante }.
*/
const W = 297
const H = 210
const OURO = [176, 141, 52]
const OURO_CLARO = [236, 213, 140]
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const dataLonga = (iso) => { if (!iso) return '___ de __________ de ____'; const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}` }
const valores = (v) => `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Valores`

async function imagem(url, max = 360) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      ok({ src: c.toDataURL('image/png'), proporcao: img.width / img.height })
    }
    img.onerror = () => ok(null)
    img.src = url
  })
}

async function novo() {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const [insignia, logo] = await Promise.all([imagem(Insignia), imagem(Logo)])
  return { doc, insignia, logo, paginas: 0 }
}

function pagina(d) {
  if (d.paginas++ > 0) d.doc.addPage('a4', 'landscape')
  const { doc } = d
  // moldura dupla dourada
  doc.setDrawColor(...OURO).setLineWidth(1.6).rect(8, 8, W - 16, H - 16)
  doc.setLineWidth(0.4).rect(11, 11, W - 22, H - 22)
  doc.setDrawColor(0).setTextColor(0)
  const img = (i, cx, y, h) => { if (i) doc.addImage(i.src, 'PNG', cx - (h * i.proporcao) / 2, y, h * i.proporcao, h) }
  img(d.insignia, 40, 16, 28)
  img(d.logo, W - 40, 16, 28)
  doc.setFont('times', 'normal').setFontSize(14)
  ;['REPÚBLICA DE ANGOLA', 'FORÇAS ARMADAS ANGOLANAS', 'ESTADO-MAIOR GENERAL'].forEach((l, i) => doc.text(l, W / 2, 22 + i * 6, { align: 'center' }))
  doc.setFont('times', 'bold').text('ESCOLA SUPERIOR DE GUERRA', W / 2, 40, { align: 'center' })
}

// faixa dourada com o título («CERTIFICADO», «DIPLOMA»)
function faixa(d, titulo, y) {
  const { doc } = d
  const w = 120
  const x = W / 2 - w / 2
  doc.setFillColor(...OURO).triangle(x - 22, y + 3, x, y - 3, x, y + 13, 'F').triangle(x + w + 22, y + 3, x + w, y - 3, x + w, y + 13, 'F')
  doc.setFillColor(...OURO_CLARO).setDrawColor(...OURO).setLineWidth(0.6).rect(x, y - 4, w, 16, 'FD')
  doc.setFont('times', 'bolditalic').setFontSize(24).setTextColor(90, 60, 10).text(titulo, W / 2, y + 7, { align: 'center', charSpace: 1 })
  doc.setTextColor(0).setDrawColor(0)
}

function assinaturas(d, y, o) {
  const { doc } = d
  const col = [W / 2 - 75, W / 2 + 75]
  ;[o.directorEnsino, o.comandante].forEach((q, i) => {
    doc.setFont('times', 'bold').setFontSize(13).text(q?.cargo || '', col[i], y, { align: 'center' })
    doc.setDrawColor(120).setLineWidth(0.2).line(col[i] - 40, y + 13, col[i] + 40, y + 13).setDrawColor(0)
    if (q?.nome) doc.text(q.nome.toLocaleUpperCase('pt'), col[i], y + 19, { align: 'center' })
    if (q?.posto) doc.text(`${i === 0 ? '*' : '**'}${q.posto.toLocaleUpperCase('pt')}${i === 0 ? '*' : '**'}`, col[i], y + 25, { align: 'center' })
  })
}

// «o Senhor NIP 50772995 – Brigadeiro – Carlos António André»
// (sem a abreviatura do posto que às vezes vem no nome: «Cap.-Ten. Pedro Neto»)
const quem = (e) => [e.dados?.nip ? `NIP ${e.dados.nip}` : null, e.dados?.posto, e.dados?.posto ? e.nome.replace(/^(\S+\.\s+)+/, '') : e.nome].filter(Boolean).join(' – ')
const periodo = (o) => `no Ano Académico ${o.anoLetivo}, de ${dataLonga(o.inicio)} a ${dataLonga(o.fim)}`
const curso = (c, o) => `${o.edicao ? `${o.edicao} ` : ''}${c.curso}`

// tipo de avaliação de cada cadeira, como no modelo: prova (dispensa), exame, recurso; o TFC é «Defesa»
const tipo = (l) => (l.situacao === 'dispensado' ? 'Prova' : l.recurso !== null && l.recurso !== undefined ? 'Recurso' : 'Exame')

function certificado(d, c, o) {
  const { doc } = d
  pagina(d)
  faixa(d, 'CERTIFICADO', 50)
  const e = c.estudante
  let y = paragrafo(doc, [
    'Para os devidos efeitos, certifica-se que o Senhor ', { b: quem(e) }, ' concluiu o ', { b: curso(c, o) }, `, ${periodo(o)}, com a Média Final de `, { b: valores(c.media) },
    ', conforme consta nos arquivos da Direcção de Ensino, desta Instituição.',
  ], 76, { x: 26, w: W - 52, recuo: 10, entre: 6.4, tam: 13, estilo: 'italic' })
  // disciplinas (todas as aprovadas do percurso) e o trabalho de fim de curso
  const melhor = new Map()
  for (const l of [...(c.percurso?.anos ?? []).flatMap((a) => a.disciplinas), ...(c.percurso?.inscricoes ?? [])]) {
    if (l.situacao !== 'aprovado' && l.situacao !== 'dispensado') continue
    const atual = melhor.get(l.cadeira.codigo)
    if (!atual || Number(l.final) >= Number(atual.final)) melhor.set(l.cadeira.codigo, l)
  }
  const linhas = [...melhor.values()].map((l) => [l.cadeira.nome, tipo(l), valores(l.final), l.classificacao ?? ''])
  if (c.percurso?.tfc?.nota !== null && c.percurso?.tfc?.nota !== undefined) linhas.push(['Trabalho de Investigação Individual', 'Defesa', valores(c.percurso.tfc.nota), c.percurso.tfc.classificacao ?? ''])
  y += 3
  const cols = [26, 170, 205, 245]
  const tam = linhas.length > 14 ? 9.5 : 11
  const passo = Math.min(5.6, (H - 62 - y) / (linhas.length + 2))
  doc.setFont('times', 'bolditalic').setFontSize(tam)
  ;['DISCIPLINAS', 'TIPO DE AVALIAÇÃO', 'NOTAS', 'CLASSIFICAÇÃO'].forEach((t, i) => doc.text(t, cols[i] + (i ? 10 : 0), y, { align: i ? 'center' : 'left' }))
  y += passo + 1
  doc.setFont('times', 'italic')
  for (const l of linhas) {
    l.forEach((t, i) => doc.text(String(t), cols[i] + (i ? 10 : 0), y, { align: i ? 'center' : 'left', maxWidth: i ? 40 : 140 }))
    y += passo
  }
  doc.setFont('times', 'bolditalic').text('Média Final', cols[0], y + 2).text(valores(c.media), cols[2] + 10, y + 2, { align: 'center' }).text(c.percurso?.conclusao?.classificacaoFinal ?? '', cols[3] + 10, y + 2, { align: 'center' })
  doc.setFont('times', 'italic').setFontSize(12).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, W / 2, H - 52, { align: 'center' })
  assinaturas(d, H - 44, o)
  doc.setFont('times', 'normal').setFontSize(7).setTextColor(110).text(`Código de verificação: ${c.codigo} — ${window.location.origin}/portal/#/verificar/${c.codigo}`, W / 2, H - 13, { align: 'center' }).setTextColor(0)
}

function diploma(d, c, o) {
  const { doc } = d
  pagina(d)
  faixa(d, 'DIPLOMA', 56)
  const e = c.estudante
  const classif = (c.percurso?.conclusao?.classificacaoFinal || '').toLocaleUpperCase('pt')
  paragrafo(doc, [
    'Atesta-se que o Senhor ', { b: quem(e) }, `, frequentou ${periodo(o)} o `, { b: curso(c, o) }, ', tendo obtido a Classificação Final de ', { b: `${classif}.` },
  ], 92, { x: 34, w: W - 68, recuo: 0, entre: 9, tam: 17, estilo: 'italic', justificar: false, centrar: true })
  doc.setFont('times', 'italic').setFontSize(13).text(`ESG/EMGFAA, em Luanda, ${dataLonga(o.fim)}`, W / 2, H - 50, { align: 'center' })
  assinaturas(d, H - 40, o)
  doc.setFont('times', 'normal').setFontSize(7).setTextColor(110).text(`Código de verificação: ${c.codigo}`, W / 2, H - 13, { align: 'center' }).setTextColor(0)
}

// documentos: ['certificado', 'diploma']; um PDF para o estudante
export async function gerarDiplomas(c, o, documentos) {
  const d = await novo()
  if (documentos.includes('certificado')) certificado(d, c, o)
  if (documentos.includes('diploma')) diploma(d, c, o)
  const nome = c.estudante.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()
  d.doc.save(`${nome}-${documentos.join('-')}.pdf`)
}

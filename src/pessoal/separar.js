import { carregarPdfjs } from '../leitor/pdfjs'

/*
  Processo individual digital: ler os documentos que se arrastam (um, vários ou uma pasta), reconhecer o tipo
  (BI, extractos, louvores…) e separar um PDF com vários documentos num ficheiro por documento.
  O texto vem do próprio PDF ou, nas digitalizações, do OCR em português (tesseract.js, servido pela aplicação em
  ocr/, sem internet). Só se lê o cimo de cada página (o título do documento), que chega para o reconhecer.
  Tudo corre no navegador; o servidor só recebe as partes já separadas.
*/

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ')

// pelo texto da página (sem acentos, maiúsculas); a ordem conta: o primeiro que bater
const REGRAS = [
  ['bi', /BILHETE DE IDENTIDADE|IDENTITY CARD|CARTAO DE IDENTIDADE/],
  ['louvor', /\bLOUVOR|\bLOUVO\b|\bLOUVA|CONDECORA|MEDALHA|REFERENCIA ELOGIOSA|REFERE ELOGIOSAMENTE/],
  ['punicao', /\bPUNICAO|\bPUNIDO|REPREENSAO|PRISAO DISCIPLINAR|DETENCAO DISCIPLINAR/],
  ['extracto', /EXTRACTO|EXTRATO/],
  ['diploma', /\bDIPLOMA\b/],
  ['certificado', /CERTIFICADO|CERTIFICA-SE|CERTIFICA SE/],
  ['saude', /INSPEC?CAO MEDICA|JUNTA MEDICA|JUNTA DE SAUDE|ATESTADO MEDICO|BOLETIM DE SAUDE/],
  ['contrato', /\bCONTRATO\b/],
  ['declaracao', /\bDECLARACAO\b|DECLARA-SE|DECLARA PARA OS DEVIDOS/],
  ['extracto', /ORDEM DE SERVICO|ORDEM DO DIA|ORDEM DA DIRECCAO|\bDESPACHO N/],
]
// o assunto do extracto
const EXTRACTOS = [
  ['extracto_promocao', /PROMOV|PROMOCAO/], ['extracto_graduacao', /GRADUAD|GRADUACAO/], ['extracto_exoneracao', /EXONER/],
  ['extracto_reserva', /PASSAGEM A RESERVA|PASSA A RESERVA|\bRESERVA\b/], ['extracto_reforma', /\bREFORMA/], ['extracto_progressao', /PROGRESS/],
  ['extracto_curso', /CURSO/], ['extracto_nomeacao', /NOMEAD|NOMEIA|NOMEACAO/],
]
// pelo nome do ficheiro (ou da pasta), quando o texto não chega
const NOMES = [
  ['bi', /(^|[^A-Z])(BI|B\.I)([^A-Z]|$)|BILHETE|IDENTIDADE/], ['foto', /\bFOTO/], ['louvor', /LOUVOR|CONDECORA|MEDALHA/], ['punicao', /PUNI/],
  ['extracto', /EXTRA(C)?TO|ORDEM/], ['diploma', /DIPLOMA/], ['certificado', /CERTIFICADO|HABILITA/], ['saude', /INSPEC|MEDIC|SAUDE/],
  ['contrato', /CONTRATO/], ['declaracao', /DECLARA/],
]

function assuntoDoExtracto(t) {
  return EXTRACTOS.find(([, re]) => re.test(t))?.[0] ?? 'extracto'
}

// o tipo de um texto (página ou nome), só entre os tipos em uso; null = não se reconhece
export function tipoDoTexto(texto, tipos, regras = REGRAS) {
  const t = sem(texto)
  const r = regras.find(([, re]) => re.test(t))?.[0]
  if (!r) return null
  const k = r === 'extracto' ? assuntoDoExtracto(t) : r
  if (tipos[k]) return k
  return tipos[r] ? r : tipos.outro ? 'outro' : null
}

// o caminho do ficheiro dentro da pasta largada ou escolhida («Processos/123456/bi.pdf»), ou só o nome
export const caminhoDe = (f) => f.caminho || f.webkitRelativePath || f.name

export const tipoDoNome = (nome, tipos) => tipoDoTexto(String(nome).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), tipos, NOMES)

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
// a data do documento (a última do texto: a da assinatura), em aaaa-mm-dd; '' se não houver
export function dataDoTexto(texto) {
  const t = sem(texto)
  const datas = [
    ...[...t.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)].map((m) => [m.index, +m[3], +m[2], +m[1]]),
    ...[...t.matchAll(/\b(\d{1,2}) DE ([A-Z]+) DE (\d{4})\b/g)].map((m) => [m.index, +m[3], MESES.indexOf(m[2]) + 1, +m[1]]),
  ].filter(([, a, m, d]) => a >= 1950 && a <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31).sort((x, y) => x[0] - y[0])
  const u = datas.at(-1)
  return u ? `${u[1]}-${String(u[2]).padStart(2, '0')}-${String(u[3]).padStart(2, '0')}` : ''
}

/*
  As partes de um ficheiro: uma página reconhecida com um tipo diferente do documento anterior começa um
  documento novo; uma página sem tipo (o verso do BI, a 2.ª folha do extracto) continua o anterior, e
  também a que só diz «extracto» depois de um extracto com assunto («Continuação do extracto…»).
*/
const continua = (tipo, atual) => !tipo || tipo === atual || (tipo === 'extracto' && atual.startsWith('extracto'))
export function partesDasPaginas(paginas, tipoNome) {
  const partes = []
  paginas.forEach((p, i) => {
    const atual = partes.at(-1)
    if (!atual || !continua(p.tipo, atual.tipo)) partes.push({ inicio: i, tipo: p.tipo || tipoNome || 'outro' })
  })
  return partes
}

// ---------- OCR (carregado só quando é preciso, uma vez) ----------
let leitor = null
function ocr() {
  if (!leitor) {
    const base = new URL('ocr/', document.baseURI).href
    leitor = import('tesseract.js').then(({ createWorker, OEM }) => createWorker('por', OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`, corePath: base, langPath: base.replace(/\/$/, ''), workerBlobURL: false, gzip: true,
    })).catch((e) => { leitor = null; throw e })
  }
  return leitor
}

export async function terminarOcr() {
  if (!leitor) return
  const l = leitor
  leitor = null
  try { (await l).terminate() } catch { /* já terminado */ }
}

// o texto do cimo de uma imagem (canvas) pelo OCR
// sem OCR (não carregou, falhou a página): continua sem texto, reconhece-se pelo nome do ficheiro
async function lerCimo(canvas) {
  try { return await lerCimoOcr(canvas) } catch (e) {
    console.warn('OCR:', e)
    return ''
  }
}

async function lerCimoOcr(canvas) {
  const w = await ocr()
  // o cimo da página numa imagem própria, sobre branco (a transparência confunde o OCR)
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = Math.round(canvas.height * 0.45)
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(canvas, 0, 0)
  const png = await new Promise((ok) => c.toBlob(ok, 'image/png'))
  const { data } = await w.recognize(png)
  return data.text ?? ''
}

function miniatura(canvas) {
  const m = document.createElement('canvas')
  const escala = 140 / canvas.width
  m.width = 140
  m.height = Math.round(canvas.height * escala)
  m.getContext('2d').drawImage(canvas, 0, 0, m.width, m.height)
  return m.toDataURL('image/jpeg', 0.6)
}

const ePdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
const eImagem = (f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)
export const aceite = (f) => ePdf(f) || eImagem(f) || /\.(docx|xlsx)$/i.test(f.name)

/*
  Ler um ficheiro: { paginas: [{ miniatura, texto, tipo }], partes, tipoNome, data }.
  aoProgresso(página, total) a cada página lida.
*/
export async function analisar(ficheiro, tipos, aoProgresso) {
  const tipoNome = tipoDoNome(caminhoDe(ficheiro), tipos)
  if (!ePdf(ficheiro) && !eImagem(ficheiro)) return { paginas: [], tipoNome, partes: [{ inicio: 0, tipo: tipoNome || 'outro' }], data: '' }
  const paginas = []
  if (eImagem(ficheiro)) {
    const img = await createImageBitmap(ficheiro)
    const escala = Math.min(1, 1800 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala)
    c.height = Math.round(img.height * escala)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const texto = await lerCimo(c)
    // uma imagem quase sem texto é uma fotografia
    const tipo = tipoDoTexto(texto, tipos) || (texto.replace(/\W/g, '').length < 15 && tipos.foto ? 'foto' : null)
    paginas.push({ miniatura: miniatura(c), texto, tipo })
    aoProgresso?.(1, 1)
  } else {
    const pdfjs = await carregarPdfjs()
    const tarefa = pdfjs.getDocument({ data: new Uint8Array(await ficheiro.arrayBuffer()) })
    const doc = await tarefa.promise
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i)
      const proprio = (await pagina.getTextContent()).items.map((x) => x.str).join(' ')
      const vp = pagina.getViewport({ scale: 1 })
      const escala = Math.min(2.2, 1700 / vp.width)
      const c = document.createElement('canvas')
      const v = pagina.getViewport({ scale: escala })
      c.width = Math.round(v.width)
      c.height = Math.round(v.height)
      await pagina.render({ canvasContext: c.getContext('2d'), viewport: v }).promise
      // com texto próprio não é preciso o OCR (é o texto exacto); digitalização: OCR do cimo
      const texto = proprio.replace(/\s/g, '').length > 40 ? proprio : await lerCimo(c)
      paginas.push({ miniatura: miniatura(c), texto, tipo: tipoDoTexto(texto, tipos) })
      pagina.cleanup()
      aoProgresso?.(i, doc.numPages)
    }
    await tarefa.destroy()
  }
  return { paginas, tipoNome, partes: partesDasPaginas(paginas, tipoNome) }
}

// as páginas [de, ate[ de um PDF como um ficheiro novo
export async function cortarPdf(ficheiro, de, ate) {
  const { PDFDocument } = await import('pdf-lib')
  const origem = await PDFDocument.load(await ficheiro.arrayBuffer(), { ignoreEncryption: true })
  const novo = await PDFDocument.create()
  const paginas = await novo.copyPages(origem, Array.from({ length: ate - de }, (_, i) => de + i))
  for (const p of paginas) novo.addPage(p)
  const base = ficheiro.name.replace(/\.pdf$/i, '')
  return new File([await novo.save()], `${base} (pág. ${de + 1}${ate - de > 1 ? `-${ate}` : ''}).pdf`, { type: 'application/pdf' })
}

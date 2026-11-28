/*
  A exportação para o Excel dos documentos (como os ficheiros do arquivo da Repartição de Administração Escolar): um
  .xlsx verdadeiro, com o título a negrito em Century Gothic, o cabeçalho das tabelas a cinzento com bordas grossas e
  os dados em Times New Roman com bordas finas. Uma linha marcada como cabecalho (cabecalho(['…'])) é cabeçalho mesmo
  sem começar por «Nº» (ex.: os dias do horário mensal). Uma linha { folha: 'Nome' } começa outra folha (ex.: uma por curso,
  como a relação nominal dos discentes). linhas: [[célula, …], …]; uma linha vazia é uma linha em branco.
  Cada folha leva, como as pautas do arquivo, o emblema da ESG no canto superior esquerdo e, nos documentos que o
  Comandante aprova (opcoes.aprovado), o «APROVADO / O COMANDANTE / nome / posto» no canto superior direito.
*/
import EmblemaEsg from '../../../../assets/emblema-esg-excel.png'
import { api } from '../../../api'

// o emblema para as folhas (uma vez por sessão)
let pedidoEmblema = null
const conteudoEmblema = () => (pedidoEmblema ??= fetch(EmblemaEsg).then((r) => r.arrayBuffer()).catch(() => { pedidoEmblema = null; return null }))
export async function emblemaExcel({ row = 1, column = 1, altura = 72 } = {}) {
  const content = await conteudoEmblema()
  return content ? { content, contentType: 'image/png', width: Math.round((altura * 180) / 148), height: altura, dpi: 96, anchor: { row, column }, offsetX: 4, offsetY: 4, title: 'Escola Superior de Guerra' } : null
}
// quem ocupa hoje o cargo de Comandante (vem do Sistema de Pessoal)
let pedidoQuem = null
export const comandanteDaEscola = () => (pedidoQuem ??= api('/academico/documentos-academicos').then((q) => q?.comandante ?? null).catch(() => { pedidoQuem = null; return null }))
// as linhas do «APROVADO» (cargo, linha para assinar, nome, posto), em maiúsculas como no arquivo
export const linhasAprovado = (c) => ['APROVADO', (c?.cargo || 'O Comandante da ESG').toUpperCase(), '______________________________', (c?.nome || '').toUpperCase(), c?.posto ? `***${c.posto.toUpperCase()}***` : '']
// marca uma linha como cabeçalho da tabela
export const cabecalho = (l) => Object.assign([...l], { cabecalho: true })
export const decimal = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','))

// o cabeçalho de uma tabela: começa por «Nº», «N/O», «N.º», «NIP», «Sigla»… e não tem números
const CABECALHO = /^(n\.?\s*º|n\/o|nº ord|nip|sigla|data|dia|disciplina|nome|posto|curso|cadeira|designação|tempo|n\.º de ordem)(?![a-zà-ú])/i
const ehCabecalho = (l) => l.cabecalho === true || (l.length > 1 && CABECALHO.test(String(l[0] ?? '').trim()) && l.every((c) => !/^-?\d+([.,]\d+)?$/.test(String(c ?? '').trim())))
// «16,25» (vírgula decimal) passa a número com duas casas; os NIP e os números de ordem ficam como texto
const numero = (v) => (typeof v === 'string' && /^-?\d+,\d+$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : null)

function folhas(linhas) {
  const lista = []
  let atual = null
  for (const l of linhas) {
    if (l && !Array.isArray(l) && l.folha) { atual = { nome: String(l.folha).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), linhas: [] }; lista.push(atual); continue }
    if (!atual) { atual = { nome: 'Folha1', linhas: [] }; lista.push(atual) }
    atual.linhas.push(Array.isArray(l) ? l : [])
  }
  return lista.filter((f) => f.linhas.length)
}

function estilizar(f) {
  const largura = Math.max(1, ...f.linhas.map((l) => l.length))
  const borda = (tipo) => ({ borderStyle: tipo, borderColor: '#000000' })
  let naTabela = false
  const dados = f.linhas.map((l) => {
    if (!l.length || l.every((c) => c === '' || c === null || c === undefined)) { naTabela = false; return [] }
    if (ehCabecalho(l)) {
      naTabela = true
      return l.map((c) => ({ value: String(c ?? ''), fontFamily: 'Century Gothic', fontSize: 12, fontWeight: 'bold', align: 'center', alignVertical: 'center', wrap: true, backgroundColor: '#C0C0C0', ...borda('medium') }))
    }
    if (!naTabela && l.filter((c) => c !== '' && c !== null && c !== undefined).length === 1) {
      // um título (o da escola, o do curso, o do mapa): a negrito e centrado na largura da tabela
      const texto = String(l.find((c) => c !== '' && c !== null && c !== undefined))
      return [{ value: texto, fontFamily: 'Century Gothic', fontSize: 14, fontWeight: 'bold', align: 'center', ...(largura > 1 ? { columnSpan: largura } : {}) }, ...Array(Math.max(0, largura - 1)).fill(null)]
    }
    return l.map((c) => {
      const n = typeof c === 'number' ? c : numero(c)
      return n !== null && n !== undefined
        ? { value: n, type: Number, format: Number.isInteger(n) && typeof c === 'number' ? '0' : '0.00', fontFamily: 'Times New Roman', fontSize: 12, align: 'center', ...(naTabela ? borda('thin') : {}) }
        : { value: String(c ?? ''), fontFamily: 'Times New Roman', fontSize: 12, wrap: true, ...(naTabela ? borda('thin') : {}) }
    })
  })
  // as larguras pelas células mais compridas (como nos ficheiros do arquivo: o nome largo, o número estreito)
  const larguras = Array.from({ length: largura }, (_, k) => ({ width: Math.min(60, Math.max(6, ...f.linhas.filter((l) => l.length > 1).map((l) => String(l[k] ?? '').length + 2))) }))
  return { dados, larguras }
}

// as 5 linhas do topo de cada folha: o espaço do emblema e, à direita, o «APROVADO» do Comandante
const TOPO = 5
function topo(largura, aprovado) {
  const linhas = Array.from({ length: TOPO }, () => [])
  if (!aprovado) return linhas
  const col = Math.max(3, largura - 3)
  linhasAprovado(aprovado).forEach((t, i) => {
    const celula = { value: t, fontFamily: 'Arial', fontSize: i === 0 ? 12 : 11, fontWeight: i === 3 ? undefined : 'bold', align: 'center', ...(largura - col > 1 ? { columnSpan: largura - col } : {}) }
    linhas[i] = [...Array(col).fill(null), celula, ...Array(Math.max(0, largura - col - 1)).fill(null)]
  })
  return linhas
}

/*
  opcoes.aprovado: true (o Comandante de hoje, do Sistema de Pessoal) ou { cargo, nome, posto } — os documentos que
  ele aprova (a pauta final, a distribuição do serviço docente).
*/
export async function descarregarExcel(nome, linhas, opcoes = {}) {
  const { default: escrever } = await import('write-excel-file/browser')
  const aprovado = opcoes.aprovado === true ? ((await comandanteDaEscola()) ?? {}) : opcoes.aprovado || null
  const imagem = await emblemaExcel()
  const fs = folhas(linhas).map((f) => {
    const e = estilizar(f)
    return { ...f, dados: [...topo(e.larguras.length, aprovado), ...e.dados], larguras: e.larguras }
  })
  const ficheiro = `${String(nome).replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`
  const imagens = imagem ? [imagem] : undefined
  if (fs.length === 1) return escrever(fs[0].dados, { sheet: fs[0].nome, columns: fs[0].larguras, images: imagens }).toFile(ficheiro)
  return escrever(fs.map((f) => ({ data: f.dados, sheet: f.nome, columns: f.larguras, images: imagens }))).toFile(ficheiro)
}

// o nome antigo (as páginas chamam-no assim): agora sai um Excel verdadeiro, não um CSV
export function descarregarCsv(nome, linhas, opcoes) {
  descarregarExcel(nome, linhas, opcoes).catch((e) => window.alert(`Não foi possível criar o Excel: ${e.message}`))
}

export const dataPt = (v) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v).toLocaleDateString('pt-PT') : '')
export const valor = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))

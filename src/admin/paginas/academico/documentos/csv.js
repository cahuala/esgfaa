/*
  A exportação para o Excel dos documentos (como os ficheiros do arquivo da Repartição de Administração Escolar): um
  .xlsx verdadeiro, com o título a negrito em Century Gothic, o cabeçalho das tabelas a cinzento com bordas grossas e
  os dados em Times New Roman com bordas finas. Uma linha marcada como cabecalho (cabecalho(['…'])) é cabeçalho mesmo
  sem começar por «Nº» (ex.: os dias do horário mensal). Uma linha { folha: 'Nome' } começa outra folha (ex.: uma por curso,
  como a relação nominal dos discentes). linhas: [[célula, …], …]; uma linha vazia é uma linha em branco.
*/
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

export async function descarregarExcel(nome, linhas) {
  const { default: escrever } = await import('write-excel-file/browser')
  const fs = folhas(linhas).map((f) => ({ ...f, ...estilizar(f) }))
  const ficheiro = `${String(nome).replace(/[\\/:*?"<>|]+/g, '-')}.xlsx`
  if (fs.length === 1) return escrever(fs[0].dados, { sheet: fs[0].nome, columns: fs[0].larguras }).toFile(ficheiro)
  return escrever(fs.map((f) => ({ data: f.dados, sheet: f.nome, columns: f.larguras }))).toFile(ficheiro)
}

// o nome antigo (as páginas chamam-no assim): agora sai um Excel verdadeiro, não um CSV
export function descarregarCsv(nome, linhas) {
  descarregarExcel(nome, linhas).catch((e) => window.alert(`Não foi possível criar o Excel: ${e.message}`))
}

export const dataPt = (v) => (v ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v).toLocaleDateString('pt-PT') : '')
export const valor = (v) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 }))

/*
  Leitura de folhas de estudantes no navegador, sem bibliotecas: CSV (separador ";" ou ",",
  como o Excel em português grava) e XLSX (um ZIP com XML: lê-se a primeira folha).
*/

// CSV com aspas ("a;b" e "" dentro de aspas); devolve uma lista de linhas (listas de células)
export function lerCsv(texto) {
  const t = String(texto).replace(/^\uFEFF/, '')
  const primeira = t.split(/\r?\n/, 1)[0] || ''
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ','
  const linhas = []
  let linha = []
  let celula = ''
  let aspas = false
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { celula += '"'; i += 1 } else if (c === '"') aspas = false
      else celula += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(celula); celula = '' } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i += 1
      linha.push(celula)
      linhas.push(linha)
      linha = []
      celula = ''
    } else celula += c
  }
  if (celula || linha.length) { linha.push(celula); linhas.push(linha) }
  return linhas.filter((l) => l.some((x) => x.trim()))
}

// ---------- XLSX ----------

async function inflar(dados) {
  const fluxo = new Response(dados).body.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(fluxo).arrayBuffer())
}

// ficheiros de um ZIP pelo diretório central: { nome: Uint8Array }
async function abrirZip(buffer, querer) {
  const b = new Uint8Array(buffer)
  const v = new DataView(buffer)
  let fim = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i -= 1) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break }
  if (fim < 0) throw new Error('O ficheiro não é um Excel (.xlsx) válido.')
  const total = v.getUint16(fim + 10, true)
  let p = v.getUint32(fim + 16, true)
  const r = {}
  const dec = new TextDecoder()
  for (let k = 0; k < total; k += 1) {
    if (v.getUint32(p, true) !== 0x02014b50) break
    const metodo = v.getUint16(p + 10, true)
    const tamanho = v.getUint32(p + 20, true)
    const nNome = v.getUint16(p + 28, true)
    const nExtra = v.getUint16(p + 30, true)
    const nComent = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nome = dec.decode(b.subarray(p + 46, p + 46 + nNome))
    p += 46 + nNome + nExtra + nComent
    if (!querer(nome)) continue
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const bruto = b.subarray(inicio, inicio + tamanho)
    r[nome] = metodo === 0 ? bruto : metodo === 8 ? await inflar(bruto) : null
  }
  return r
}

// "B3" -> 1 (coluna, a contar de 0)
const coluna = (ref) => [...ref.replace(/\d+$/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1

export async function lerXlsx(buffer) {
  const zip = await abrirZip(buffer, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  const dec = new TextDecoder()
  const xml = (bytes) => new DOMParser().parseFromString(dec.decode(bytes), 'application/xml')
  const folhas = Object.keys(zip).filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  if (!folhas.length) throw new Error('O Excel não tem nenhuma folha.')
  const partilhadas = zip['xl/sharedStrings.xml']
    ? [...xml(zip['xl/sharedStrings.xml']).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''))
    : []
  const linhas = []
  for (const row of xml(zip[folhas[0]]).getElementsByTagName('row')) {
    const l = []
    for (const c of row.getElementsByTagName('c')) {
      const tipo = c.getAttribute('t')
      const valor = c.getElementsByTagName('v')[0]?.textContent ?? ''
      const texto = tipo === 's' ? partilhadas[Number(valor)] ?? ''
        : tipo === 'inlineStr' ? [...c.getElementsByTagName('t')].map((t) => t.textContent).join('')
          : valor
      l[coluna(c.getAttribute('r') || 'A1')] = texto
    }
    linhas.push(Array.from(l, (x) => x ?? ''))
  }
  return linhas.filter((l) => l.some((x) => String(x).trim()))
}

// ---------- colunas ----------

const sem = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const CAMPOS = {
  nome: /^(nome( completo)?|estudante|aluno|formando)$/,
  email: /^(e-?mail|correio( eletronico)?|email institucional)$/,
  posto: /^(posto|patente|graduacao)$/,
  ramo: /^ramo$/,
  nip: /^(nip|n\.?º? ?ip|numero de identificacao)$/,
  telefone: /^(telefone|telemovel|contacto|tel\.?)$/,
}

/*
  Primeira linha = cabeçalho. Reconhece as colunas pelos nomes (com ou sem acentos).
  Devolve { linhas: [{ nome, email, … }], colunas: { campo: índice }, faltam: [campos obrigatórios em falta] }.
*/
export function mapearColunas(tabela) {
  const [cabecalho = [], ...resto] = tabela
  const colunas = {}
  cabecalho.forEach((h, i) => {
    const campo = Object.keys(CAMPOS).find((k) => CAMPOS[k].test(sem(h)))
    if (campo && colunas[campo] === undefined) colunas[campo] = i
  })
  const faltam = ['nome', 'email'].filter((k) => colunas[k] === undefined)
  const linhas = resto.map((l) => Object.fromEntries(Object.entries(colunas).map(([k, i]) => [k, String(l[i] ?? '').trim()])))
  return { linhas, colunas, faltam }
}

export async function lerFolha(ficheiro) {
  if (/\.xlsx$/i.test(ficheiro.name)) return mapearColunas(await lerXlsx(await ficheiro.arrayBuffer()))
  if (/\.(csv|txt)$/i.test(ficheiro.name)) return mapearColunas(lerCsv(await ficheiro.text()))
  throw new Error('Use um ficheiro Excel (.xlsx) ou CSV. Os .xls antigos: grave primeiro como .xlsx.')
}

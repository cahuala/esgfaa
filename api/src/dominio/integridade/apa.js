import { REFERENCIAS, sem } from './semelhanca.js'

/*
  Normas APA (7.ª edição) num trabalho académico: confere as citações no texto e a lista de referências.
  - citações: (Apelido, ano), (Apelido & Apelido, ano), (Apelido et al., ano), Apelido (ano), com página
    nas citações diretas (Apelido, ano, p. 12);
  - cada citação tem de estar na lista de referências (mesmo apelido e ano) e cada referência tem de ser
    citada no texto;
  - referências: Apelido, I. (ano). Título. Editora. — por ordem alfabética, com "&" antes do último autor
    e DOI no formato https://doi.org/…
  O resultado é uma lista de problemas para o docente rever (a ferramenta não reescreve nada).
*/

const ANO = String.raw`(?:1[5-9]|20)\d\d[a-z]?|s\.\s?d\.|n\.\s?d\.`
const APELIDO = String.raw`[A-ZÀ-Ý][\p{L}'’-]+`
// cabeçalhos da lista de referências e o que vem depois dela
export const CABECALHO_REFERENCIAS = REFERENCIAS
const FIM_REFERENCIAS = /^(ap[eê]ndices?|anexos?|gloss[aá]rio|bibliografia(\s+consultada)?|[ÍI]ndice|cronograma|_{5,}|(o|a)\s+(co-?)?(orientador|orientadora|chefe|director|directora|coordenador|coordenadora|autor|autora)\b)/i

// início e fim da lista de referências (a última que aparece depois de 40 % do texto)
export function seccaoReferencias(texto) {
  const t = String(texto ?? '')
  let inicio = -1
  let cabecalho = ''
  for (const m of t.matchAll(CABECALHO_REFERENCIAS)) {
    if (m.index > t.length * 0.4) {
      inicio = m.index + m[0].length
      cabecalho = m[0].trim()
      break
    }
  }
  if (inicio < 0) return null
  let fim = t.length
  const re = /\n+([^\n]+)/g
  re.lastIndex = inicio
  for (let m; (m = re.exec(t));) {
    if (m[1].trim().length < 90 && FIM_REFERENCIAS.test(m[1].trim())) {
      fim = m.index
      break
    }
  }
  return { inicio, fim, cabecalho, inicioCabecalho: inicio - cabecalho.length }
}

const palavrasAutor = (s) => s.split(/\s*(?:,|&|\be\b|\band\b|\by\b)\s*/).map((x) => x.trim()).filter(Boolean)

// apelidos de uma entrada de referência: os que vêm antes das iniciais ("Gil, A. C.")
function apelidosDaReferencia(autores) {
  const r = [...autores.matchAll(new RegExp(String.raw`(${APELIDO}(?:\s+(?:de|da|do|dos|das|van|von|del|di)?\s*${APELIDO})*),\s+(?:[A-ZÀ-Ý]\.)`, 'gu'))].map((m) => m[1].trim().split(/\s+/).pop())
  if (r.length) return r
  // autor institucional: "Organização Mundial da Saúde." ou "AFAN."
  return [autores.replace(/[.\s]+$/, '').replace(/\s*\[[^\]]*\]/, '').trim()]
}

export function lerReferencias(texto, seccao = seccaoReferencias(texto)) {
  if (!seccao) return []
  const r = []
  let p = seccao.inicio
  for (const linha of texto.slice(seccao.inicio, seccao.fim).split('\n')) {
    const i = texto.indexOf(linha, p)
    p = i + linha.length
    const l = linha.trim()
    if (l.length < 12 || /^(fonte|tabela|figura|quadro)\b/i.test(l)) continue
    const onde = { texto: l, inicio: i, fim: i + linha.length, citada: false }
    const m = l.match(new RegExp(String.raw`^(.+?)\s*\((${ANO})(?:,\s*[^)]{1,40})?\)\.?`, 'u'))
    if (m) {
      const autores = m[1]
      const iniciais = new RegExp(String.raw`${APELIDO},\s+[A-ZÀ-Ý]\.`, 'u').test(autores)
      r.push({ ...onde, norma: 'apa', autores, apelidos: apelidosDaReferencia(autores), grupo: iniciais ? '' : autores.replace(/[.\s]+$/, ''), sigla: autores.match(/\[([^\]]+)\]/)?.[1] ?? '', ano: normAno(m[2]) })
      continue
    }
    // sem "(ano)": norma ABNT ("APELIDO, Nome. Título. Local: Editora, 2019.") ou outra coisa
    const anos = l.match(/\b(1[5-9]|20)\d\d\b/g)
    if (!anos) continue // não é uma referência (assinaturas, notas…)
    const pessoas = [...l.matchAll(/(?:^|;\s*)([A-ZÀ-Ý][A-ZÀ-ÝЀ-ӿ'’ -]{1,40}),\s/gu)].map((x) => x[1].trim().split(/\s+/).pop())
    const inst = l.match(/^([A-ZÀ-Ý][A-ZÀ-Ý ]{3,}?)\s*(?:\(([A-Z]{2,})\))?\.\s/u)
    const abnt = pessoas.length > 0 || Boolean(inst)
    r.push({ ...onde, norma: abnt ? 'abnt' : 'outra', autores: l.split(/\.\s/)[0], apelidos: pessoas, grupo: inst?.[1] ?? '', sigla: inst?.[2] ?? '', ano: anos.at(-1) })
  }
  return r
}

const normAno = (a) => (/d\./.test(a) ? 's.d.' : a)

/*
  Citações no texto (antes da lista de referências):
  - entre parênteses: "(Gil, 2019)", "(Bardin, 2011; Gil, 2019, p. 27)", "(ver Yin, 2018)";
  - narrativas: "Gil (2019)", "Laudon e Laudon (2022, p. 14)", "Kavanagh et al. (2015)".
*/
export function lerCitacoes(texto, ate = texto.length) {
  const t = texto.slice(0, ate)
  const r = []
  const parentese = new RegExp(String.raw`\(([^()\n]{2,400}?(?:${ANO})[^()\n]{0,60})\)`, 'gu')
  for (const m of t.matchAll(parentese)) {
    let pos = m.index + 1
    for (const parte of m[1].split(';')) {
      const s = parte.trim()
      const i = texto.indexOf(s, pos)
      pos = i + s.length
      const c = new RegExp(String.raw`^(?:(?:ver|cf\.|cit\.\s+por|citado\s+por|apud|e\.\s?g\.,?|como)\s+)?(.+?)\s*,\s*(${ANO})(?:\s*,\s*(.+))?$`, 'iu').exec(s)
      if (!c || !/^\p{Lu}/u.test(c[1]) || /\b(lei|decreto|n\.º|artigo|art\.)\b/i.test(c[1]) || c[1].length > 160) continue
      r.push({ tipo: 'parentese', texto: s, autores: c[1].trim(), ano: normAno(c[2]), local: c[3]?.trim() ?? '', inicio: i, fim: i + s.length, grupo: m[0], inicioGrupo: m.index, fimGrupo: m.index + m[0].length })
    }
  }
  const narrativa = new RegExp(String.raw`(${APELIDO}(?:\s+et\s+al\.?|\s+(?:&|e|and)\s+${APELIDO}|,\s+${APELIDO}){0,4})\s+\((${ANO})(?:\s*,\s*([^)]{1,30}))?\)`, 'gu')
  for (const m of t.matchAll(narrativa)) {
    if (r.some((x) => m.index >= x.inicioGrupo && m.index < x.fimGrupo)) continue
    const a = m[1].replace(/^(Segundo|Para|Conforme|Como|De acordo com|Según|Selon|According to)\s+/u, '')
    if (/^(Fonte|Tabela|Figura|Quadro|Gráfico|Elaboração|Lei|Decreto|Catumbela|Luanda)\b/u.test(a)) continue
    r.push({ tipo: 'narrativa', texto: m[0], autores: a, ano: normAno(m[2]), local: m[3]?.trim() ?? '', inicio: m.index, fim: m.index + m[0].length })
  }
  return r.sort((x, y) => x.inicio - y.inicio)
}

// citações diretas: entre aspas, com 8 palavras ou mais (as curtas são termos, não citações)
const ASPAS = /«([^»]{1,4000})»|“([^”]{1,4000})”|"([^"\n]{1,4000})"/g
export function lerCitacoesDiretas(texto, ate = texto.length) {
  const r = []
  for (const m of texto.slice(0, ate).matchAll(ASPAS)) {
    const dentro = m[1] ?? m[2] ?? m[3]
    const palavras = dentro.split(/\s+/).filter(Boolean).length
    if (palavras < 8) continue
    r.push({ texto: dentro, palavras, inicio: m.index, fim: m.index + m[0].length })
  }
  return r
}

const PAGINA = /\b(p{1,2}\.|par\.|§|cap\.|pág\.)\s*\d/i

function primeiroApelido(autores) {
  const s = autores.replace(/\[[^\]]*\]/g, '').replace(/\bet\.?\s*al\.?/i, '').trim()
  return palavrasAutor(s)[0]?.split(/\s+/).pop() ?? ''
}

function nAutores(autores) {
  if (/\bet\.?\s*al/i.test(autores)) return 3
  return palavrasAutor(autores.replace(/\[[^\]]*\]/g, '')).length
}

const mesmo = (a, b) => sem(a).replace(/[^a-z0-9]/g, '') === sem(b).replace(/[^a-z0-9]/g, '')

// a referência que corresponde à citação (apelido do 1.º autor, ou o autor institucional, e o ano)
function correspondente(c, refs) {
  const ap = primeiroApelido(c.autores)
  const nome = c.autores.replace(/\s*\[[^\]]*\]/, '').trim()
  const candidatas = refs.filter((r) => (r.apelidos[0] && mesmo(r.apelidos[0], ap)) || (r.grupo && (mesmo(r.grupo, nome) || (r.sigla && mesmo(r.sigla, nome)))) || (r.sigla && mesmo(r.sigla, ap)))
  const exata = candidatas.find((r) => r.ano === c.ano)
  // apelido parecido com o mesmo ano (gralha: "Kauark" / "Kuark")
  const parecida = exata || candidatas.length ? null : refs.find((r) => r.ano === c.ano && r.apelidos[0] && distancia(sem(r.apelidos[0]), sem(ap)) <= 2 && ap.length >= 4)
  return { ref: exata ?? null, outroAno: exata ? null : candidatas[0] ?? null, parecida }
}

function distancia(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let ant = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1))
      ant = t
    }
  }
  return d[b.length]
}

function problema(lista, gravidade, regra, mensagem, { texto, inicio = null, fim = null, sugestao = '', detalhe = '' }) {
  lista.push({ gravidade, regra, mensagem, texto, inicio, fim, sugestao, detalhe })
}

export function verificarApa(textoOriginal) {
  const texto = String(textoOriginal ?? '')
  const seccao = seccaoReferencias(texto)
  const refs = lerReferencias(texto, seccao)
  const ate = seccao ? seccao.inicioCabecalho : texto.length
  const citacoes = lerCitacoes(texto, ate)
  const diretas = lerCitacoesDiretas(texto, ate)
  const problemas = []

  if (!seccao) problema(problemas, 'erro', 'referencias', 'Não foi encontrada a lista de referências (título «Referências» ou «Referências bibliográficas»).', { texto: '' })

  // ---------- citações no texto ----------
  for (const c of citacoes) {
    const onde = { texto: c.texto, inicio: c.inicio, fim: c.fim }
    const a = c.autores
    if (/\bet\.\s*al/i.test(a) || /\bet\s+al(?!\.)/i.test(a)) problema(problemas, 'erro', 'et-al', 'Escreve-se «et al.» (sem ponto depois de «et», com ponto depois de «al»).', { ...onde, sugestao: a.replace(/\bet\.?\s*al\.?/i, 'et al.') })
    if (/,(?=\S)/.test(c.texto) && !/\d,\d/.test(c.texto)) problema(problemas, 'aviso', 'espacos', 'Falta um espaço depois da vírgula.', { ...onde, sugestao: c.texto.replace(/,(?=\S)/g, ', ') })
    if (/\s,/.test(c.texto)) problema(problemas, 'aviso', 'espacos', 'Há um espaço antes da vírgula.', { ...onde, sugestao: c.texto.replace(/\s+,/g, ',') })
    const maiusculas = a.replace(/\[[^\]]*\]/g, '').match(/\b[A-ZÀ-Ý]{4,}\b/g) ?? []
    const siglaDeRef = (w) => refs.some((r) => r.texto.includes(w))
    if (maiusculas.some((w) => !siglaDeRef(w))) problema(problemas, 'erro', 'maiusculas', 'Em APA o apelido escreve-se só com a inicial maiúscula (a citação em maiúsculas é da norma ABNT).', { ...onde, sugestao: c.texto.replace(/\b([A-ZÀ-Ý])([A-ZÀ-Ý]{3,})\b/g, (_, x, y) => x + y.toLowerCase()) })
    if (c.tipo === 'parentese' && /\s(e|and|y)\s/.test(a)) problema(problemas, 'aviso', 'e-comercial', 'Dentro de parênteses os autores ligam-se com «&».', { ...onde, sugestao: c.texto.replace(/\s(e|and|y)\s/, ' & ') })
    if (c.tipo === 'narrativa' && /&/.test(a)) problema(problemas, 'aviso', 'e-comercial', 'Na citação narrativa (fora de parênteses) escreve-se «e», não «&».', { ...onde, sugestao: c.texto.replace('&', 'e') })
    if (!/\bet\.?\s*al/i.test(a) && nAutores(a) >= 3) problema(problemas, 'aviso', 'tres-autores', 'Com três ou mais autores cita-se só o primeiro seguido de «et al.» (APA 7.ª ed.).', { ...onde, sugestao: `${primeiroApelido(a)} et al., ${c.ano}` })
    if (c.local && !PAGINA.test(c.local)) problema(problemas, 'aviso', 'pagina', 'A página indica-se com «p.» (uma página) ou «pp.» (várias).', onde)
    if (!seccao) continue
    const { ref, outroAno, parecida } = correspondente(c, refs)
    if (ref) ref.citada = true
    else if (parecida) {
      parecida.citada = true
      problema(problemas, 'erro', 'apelido', 'O apelido não coincide com o da lista de referências.', { ...onde, detalhe: `na lista: ${parecida.apelidos[0]}`, sugestao: `${parecida.apelidos[0]}${nAutores(c.autores) >= 3 ? ' et al.' : ''}, ${c.ano}` })
    }
    else if (outroAno) {
      outroAno.citada = true
      problema(problemas, 'erro', 'ano', 'O ano não coincide com o da lista de referências.', { ...onde, detalhe: `na lista: ${outroAno.ano ?? 's.d.'}`, sugestao: `${c.autores}, ${outroAno.ano}` })
    } else problema(problemas, 'erro', 'sem-referencia', 'Citação sem a referência correspondente na lista de referências (ou o apelido está escrito de outra forma).', onde)
  }

  // ---------- citações diretas ----------
  for (const d of diretas) {
    const depois = citacoes.find((c) => c.inicio >= d.fim && c.inicio - d.fim <= 120)
    const antes = [...citacoes].reverse().find((c) => c.fim <= d.inicio && d.inicio - c.fim <= 200)
    const onde = { texto: d.texto.length > 160 ? `${d.texto.slice(0, 157)}…` : d.texto, inicio: d.inicio, fim: d.fim }
    // título do próprio trabalho entre aspas não é citação
    if (sem(texto.slice(0, 1500)).includes(sem(d.texto.slice(0, 60)))) continue
    const pag = (depois && PAGINA.test(depois.local)) || (antes && PAGINA.test(antes.local)) || PAGINA.test(texto.slice(d.fim, d.fim + 40))
    if (!depois && !antes) {
      problema(problemas, 'erro', 'citacao-direta', 'Citação direta (entre aspas) sem autor e ano.', onde)
    } else if (!pag) problema(problemas, 'erro', 'citacao-direta', 'Citação direta sem o número da página (por exemplo: Gil, 2019, p. 27).', onde)
    if (d.palavras >= 40) problema(problemas, 'aviso', 'citacao-bloco', 'Citações com 40 palavras ou mais vão em bloco (parágrafo recuado), sem aspas.', onde)
  }

  // ---------- lista de referências ----------
  const nAbnt = refs.filter((r) => r.norma === 'abnt').length
  const abnt = nAbnt > 0 && nAbnt >= refs.length / 2
  if (abnt) problema(problemas, 'erro', 'norma', 'A lista de referências segue a norma ABNT (APELIDO, Nome. Título. Local: Editora, ano.), não a APA. Em APA: Apelido, I. (ano). Título (ed.). Editora.', { detalhe: `${nAbnt} / ${refs.length}`, texto: refs.find((r) => r.norma === 'abnt').texto, sugestao: 'Apelido, I. N. (2019). Título da obra (2.ª ed.). Editora.' })
  else for (const r of refs.filter((x) => x.norma === 'abnt')) problema(problemas, 'erro', 'referencia-ano', 'Referência em formato ABNT — APA: Apelido, I. (ano). Título. Editora.', { texto: r.texto, inicio: r.inicio, fim: r.fim })
  let anterior = null
  const vistas = new Set()
  for (const r of refs) {
    const onde = { texto: r.texto.length > 220 ? `${r.texto.slice(0, 217)}…` : r.texto, inicio: r.inicio, fim: r.fim }
    if (r.norma !== 'apa') {
      if (!abnt) problema(problemas, 'erro', 'referencia-ano', 'Referência sem o ano entre parênteses depois dos autores — APA: Apelido, I. (ano). Título. Editora.', onde)
      if (seccao && !r.citada) problema(problemas, 'aviso', 'nao-citada', 'Referência que não é citada no texto.', onde)
      continue
    }
    const chave = sem(r.texto).replace(/[^a-z0-9]/g, '')
    if (vistas.has(chave)) problema(problemas, 'aviso', 'referencia-repetida', 'Referência repetida.', onde)
    vistas.add(chave)
    const ordem = sem(r.apelidos[0] ?? r.autores)
    if (anterior !== null && ordem.localeCompare(anterior) < 0) problema(problemas, 'aviso', 'ordem', 'Fora da ordem alfabética (as referências ordenam-se pelo apelido do primeiro autor).', onde)
    anterior = ordem
    if (r.apelidos.length >= 2 && !/&/.test(r.autores)) problema(problemas, 'aviso', 'e-comercial', 'Antes do último autor usa-se «&» (por exemplo: Laudon, K. C., & Laudon, J. P.).', onde)
    if (/\bdoi:\s*10\./i.test(r.texto) || /dx\.doi\.org/i.test(r.texto)) problema(problemas, 'aviso', 'doi', 'O DOI escreve-se como ligação: https://doi.org/10.…', onde)
    if (/(^|\s)(acesso em|dispon[ií]vel em)\b/i.test(r.texto)) problema(problemas, 'aviso', 'url', 'Em APA não se escreve «Disponível em» nem «Acesso em»: põe-se só o endereço (https://…).', onde)
    if (/\.\s*\(\d+\.ª?\s*(ed|edição)\.?\)/i.test(r.texto)) problema(problemas, 'aviso', 'edicao', 'A edição vem logo a seguir ao título, sem ponto antes: Título (7.ª ed.). Editora.', onde)
    if (!/(\.|https?:\/\/\S+)$/.test(r.texto)) problema(problemas, 'aviso', 'ponto-final', 'A referência termina com ponto final (exceto quando acaba num DOI ou endereço).', onde)
    if (/\b[A-ZÀ-Ý]{4,}\b,\s+[A-ZÀ-Ý]\./.test(r.autores)) problema(problemas, 'aviso', 'maiusculas', 'Em APA o apelido escreve-se só com a inicial maiúscula.', onde)
    if (seccao && !r.citada) problema(problemas, 'aviso', 'nao-citada', 'Referência que não é citada no texto (em APA a lista só tem obras citadas; as consultadas vão para «Bibliografia»).', onde)
  }

  const erros = problemas.filter((p) => p.gravidade === 'erro').length
  return {
    citacoes: citacoes.length, citacoesDiretas: diretas.length, referencias: refs.length,
    referenciasCitadas: refs.filter((r) => r.citada).length, erros, avisos: problemas.length - erros,
    cabecalho: seccao?.cabecalho ?? null, problemas: problemas.sort((x, y) => (x.inicio ?? -1) - (y.inicio ?? -1)),
  }
}

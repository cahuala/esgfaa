import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'

/*
  Obra do catálogo da biblioteca (livro, tese, TFC, …). Pode ter exemplares físicos (que se emprestam)
  e/ou uma versão digital (PDF), lida no portal por todos ou só pelos docentes.
*/
export const TIPOS_OBRA = {
  livro: 'Livro', tese: 'Tese / dissertação', monografia: 'Monografia', tfc: 'Trabalho de fim de curso',
  artigo: 'Artigo', revista: 'Revista', outro: 'Outro',
}
export const ACESSOS_DIGITAL = { todos: 'Estudantes e docentes', docentes: 'Só docentes' }
export const ESTADOS_EXEMPLAR = { bom: 'Bom', danificado: 'Danificado', perdido: 'Perdido', abatido: 'Abatido' }
export const IDIOMAS = { pt: 'Português', en: 'Inglês', fr: 'Francês', es: 'Espanhol', outro: 'Outro' }

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
const texto = (v, campo, rotulo, { min = 0, max = 300 } = {}) => {
  const t = limparTexto(v ?? '')
  if (t.length < min || t.length > max) throw erro(campo, min ? `${rotulo}: entre ${min} e ${max} caracteres.` : `${rotulo}: no máximo ${max} caracteres.`)
  return t
}
const lista = (v, campo, rotulo, max) => {
  const l = [...new Set((Array.isArray(v) ? v : String(v ?? '').split(/[;\n]/)).map((x) => limparTexto(x)).filter(Boolean))]
  if (l.length > max || l.some((x) => x.length > 200)) throw erro(campo, `${rotulo}: no máximo ${max}, cada um com até 200 caracteres.`)
  return l
}

// ISBN-10 ou ISBN-13, sem hífenes nem espaços; null se vier vazio. Confirma o dígito de controlo.
export function normalizarIsbn(v) {
  const s = String(v ?? '').replace(/[\s-]/g, '').toUpperCase()
  if (!s) return null
  if (/^\d{9}[\dX]$/.test(s)) {
    const soma = [...s].reduce((t, c, i) => t + (c === 'X' ? 10 : Number(c)) * (10 - i), 0)
    if (soma % 11 === 0) return s
  } else if (/^\d{13}$/.test(s)) {
    const soma = [...s].reduce((t, c, i) => t + Number(c) * (i % 2 ? 3 : 1), 0)
    if (soma % 10 === 0) return s
  }
  throw erro('isbn', 'ISBN inválido (confira os algarismos: o último é de controlo).')
}

export function validarObra(d, atual = null) {
  const r = {}
  const tem = (k) => d[k] !== undefined || !atual
  if (tem('tipo')) {
    if (!TIPOS_OBRA[d.tipo ?? 'livro']) throw erro('tipo', 'Tipo de obra desconhecido.')
    r.tipo = d.tipo ?? 'livro'
  }
  if (tem('titulo')) r.titulo = texto(d.titulo, 'titulo', 'Título', { min: 2, max: 300 })
  if (tem('subtitulo')) r.subtitulo = texto(d.subtitulo, 'subtitulo', 'Subtítulo')
  if (tem('autores')) r.autores = lista(d.autores, 'autores', 'Autores', 20)
  if (tem('ano')) {
    const ano = d.ano === '' || d.ano === null || d.ano === undefined ? null : Number(d.ano)
    if (ano !== null && (!Number.isInteger(ano) || ano < 1450 || ano > 2100)) throw erro('ano', 'Ano inválido.')
    r.ano = ano
  }
  if (tem('editora')) r.editora = texto(d.editora, 'editora', 'Editora', { max: 200 })
  if (tem('edicao')) r.edicao = texto(d.edicao, 'edicao', 'Edição', { max: 60 })
  if (tem('isbn')) r.isbn = normalizarIsbn(d.isbn)
  if (tem('cota')) r.cota = texto(d.cota, 'cota', 'Cota', { max: 60 })
  if (tem('assuntos')) r.assuntos = lista(d.assuntos, 'assuntos', 'Assuntos', 15)
  if (tem('idioma')) {
    if (!IDIOMAS[d.idioma ?? 'pt']) throw erro('idioma', 'Idioma desconhecido.')
    r.idioma = d.idioma ?? 'pt'
  }
  if (tem('resumo')) r.resumo = texto(d.resumo, 'resumo', 'Resumo', { max: 5000 })
  if (tem('acesso')) {
    if (!ACESSOS_DIGITAL[d.acesso ?? 'todos']) throw erro('acesso', 'Acesso desconhecido.')
    r.acesso = d.acesso ?? 'todos'
  }
  return r
}

export function validarExemplar(d, atual = null) {
  const r = {}
  if (d.codigo !== undefined || !atual) {
    r.codigo = limparTexto(d.codigo ?? '').toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9./-]{0,39}$/.test(r.codigo)) throw erro('codigo', 'Código (tombo): letras, algarismos, ".", "/" ou "-", até 40.')
  }
  if (d.estado !== undefined || !atual) {
    if (!ESTADOS_EXEMPLAR[d.estado ?? 'bom']) throw erro('estado', 'Estado desconhecido.')
    r.estado = d.estado ?? 'bom'
  }
  if (d.localizacao !== undefined || !atual) r.localizacao = texto(d.localizacao, 'localizacao', 'Localização', { max: 120 })
  return r
}

// só exemplares em bom estado ou danificados (ainda utilizáveis) se emprestam
export const exemplarEmprestavel = (e) => e.estado === 'bom' || e.estado === 'danificado'

// quem pode ler a versão digital
export const podeLerDigital = (obra, conta) => Boolean(obra.ficheiroId) && (obra.acesso === 'todos' || conta?.tipo === 'docente')

const xml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
const TIPO_DC = { livro: 'Text/Book', tese: 'Text/Thesis', monografia: 'Text/Monograph', tfc: 'Text/Thesis', artigo: 'Text/Article', revista: 'Text/Serial', outro: 'Text' }

// registo Dublin Core (oai_dc) de uma obra, para repositórios e catálogos coletivos
export function dublinCore(o, { instituicao = 'Escola Superior de Guerra' } = {}) {
  const linhas = [
    ['title', o.subtitulo ? `${o.titulo}: ${o.subtitulo}` : o.titulo],
    ...o.autores.map((a) => ['creator', a]),
    ...o.assuntos.map((a) => ['subject', a]),
    ['description', o.resumo],
    ['publisher', o.editora || (['tfc', 'tese', 'monografia'].includes(o.tipo) ? instituicao : '')],
    ['date', o.ano ?? ''],
    ['type', TIPO_DC[o.tipo]],
    ['identifier', o.isbn ? `ISBN:${o.isbn}` : ''],
    ['identifier', o.cota ? `cota:${o.cota}` : ''],
    ['language', o.idioma === 'outro' ? '' : o.idioma],
    ['rights', o.ficheiroId ? (o.acesso === 'todos' ? 'Acesso no portal académico' : 'Acesso restrito a docentes') : ''],
  ].filter(([, v]) => v !== '' && v !== null)
  return `<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">\n${linhas.map(([k, v]) => `  <dc:${k}>${xml(v)}</dc:${k}>`).join('\n')}\n</oai_dc:dc>`
}

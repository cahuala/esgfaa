import config from './config.js'
import db from './db.js'

// coleções editáveis e o campo que identifica cada item no site
export const COLECOES = {
  noticias: { chave: 'slug', titulo: 'titulo', ordenar: (a, b) => (b.data || '').localeCompare(a.data || '') },
  artigos: { chave: 'slug', titulo: 'titulo', ordenar: (a, b) => (b.data || '').localeCompare(a.data || '') },
  eventos: { chave: 'id', titulo: 'titulo', ordenar: (a, b) => (a.data || '').localeCompare(b.data || '') },
  cursos: { chave: 'id', titulo: 'nome', ordenar: null },
  pessoas: { chave: 'id', titulo: 'nome', ordenar: null },
  publicidade: { chave: 'id', titulo: 'titulo', ordenar: null },
}

// páginas com conteúdo editável
export const PAGINAS = ['home', 'institucional', 'contactos', 'cursos']

// coleções onde o público pode dar gosto e comentar
export const INTERATIVAS = ['noticias', 'eventos', 'artigos']

export function slugificar(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 80) || 'item'
}

// "/uploads/x.jpg" -> "https://api…/uploads/x.jpg" (os ficheiros guardam-se com caminho relativo)
function absolutizar(valor, base) {
  if (typeof valor === 'string') return valor.startsWith('/uploads/') ? base + valor : valor
  if (Array.isArray(valor)) return valor.map((v) => absolutizar(v, base))
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, absolutizar(v, base)]))
  }
  return valor
}

// e o inverso, para guardar sempre relativo mesmo que o painel envie o URL completo
export function relativizar(valor) {
  if (typeof valor === 'string') {
    const i = valor.indexOf('/uploads/')
    return i > 0 && /^https?:\/\//.test(valor) ? valor.slice(i) : valor
  }
  if (Array.isArray(valor)) return valor.map(relativizar)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, relativizar(v)]))
  }
  return valor
}

export function baseUrl(req) {
  return config.urlPublico || `${req.protocol}://${req.get('host')}`
}

const hojeIso = () => new Date().toISOString().slice(0, 10)

// banner visível hoje: ativo e dentro das datas (se definidas)
export function bannerVisivel(b) {
  const hoje = hojeIso()
  return b.ativo !== false && (!b.inicio || b.inicio <= hoje) && (!b.fim || b.fim >= hoje)
}

/*
  publico: true  -> só itens publicados (e banners em vigor), sem campos internos
  publico: false -> tudo, com _estado, _ordem e datas (para o painel)
*/
export function listarColecao(colecao, req, { publico = false } = {}) {
  const def = COLECOES[colecao]
  const linhas = db.prepare(`
    SELECT i.id, i.dados, i.ordem, i.estado, i.criado_em, i.atualizado_em, u.nome autor_edicao
    FROM itens i LEFT JOIN utilizadores u ON u.id = i.atualizado_por
    WHERE i.colecao = ? ${publico ? "AND i.estado = 'publicado'" : ''}
    ORDER BY i.ordem, i.criado_em`).all(colecao)
  let itens = linhas.map((l) => publico
    ? JSON.parse(l.dados)
    : { ...JSON.parse(l.dados), _estado: l.estado, _ordem: l.ordem, _criado: l.criado_em, _atualizado: l.atualizado_em, _editadoPor: l.autor_edicao })
  if (publico && colecao === 'publicidade') itens = itens.filter(bannerVisivel)
  if (def.ordenar) itens.sort(def.ordenar)
  return absolutizar(itens, baseUrl(req))
}

export function lerItem(colecao, id, req, { publico = false } = {}) {
  const l = db.prepare(`SELECT i.dados, i.estado, i.atualizado_em, u.nome autor_edicao
    FROM itens i LEFT JOIN utilizadores u ON u.id = i.atualizado_por WHERE i.colecao = ? AND i.id = ?`).get(colecao, id)
  if (!l || (publico && l.estado !== 'publicado')) return null
  const internos = publico ? {} : { _estado: l.estado, _atualizado: l.atualizado_em, _editadoPor: l.autor_edicao }
  return absolutizar({ ...JSON.parse(l.dados), ...internos }, baseUrl(req))
}

export function lerPagina(chave, req) {
  const l = db.prepare('SELECT dados FROM paginas WHERE chave = ?').get(chave)
  return l ? absolutizar(JSON.parse(l.dados), baseUrl(req)) : null
}

// gostos, comentários e visualizações por item: { 'noticias/slug': { gostos, comentarios, visualizacoes } }
export function estatisticas() {
  const mapa = {}
  const juntar = (linhas, campo) => linhas.forEach((l) => {
    const k = `${l.colecao}/${l.item_id}`
    mapa[k] = { gostos: 0, comentarios: 0, visualizacoes: 0, ...mapa[k], [campo]: l.total }
  })
  juntar(db.prepare('SELECT colecao, item_id, COUNT(*) total FROM gostos GROUP BY colecao, item_id').all(), 'gostos')
  juntar(db.prepare('SELECT colecao, item_id, COUNT(*) total FROM comentarios GROUP BY colecao, item_id').all(), 'comentarios')
  juntar(db.prepare('SELECT colecao, item_id, total FROM visualizacoes').all(), 'visualizacoes')
  return mapa
}

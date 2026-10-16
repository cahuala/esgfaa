/*
  Traduções dos conteúdos do site (notícias, artigos, eventos, cursos, pessoas e páginas).
  O original fica sempre em português; cada tradução é um mapa "caminho -> texto"
  (ex.: "titulo", "conteudo.3.texto") com os textos traduzíveis do original.
  Endereços, imagens, datas, horas, códigos, e-mails e telefones nunca se traduzem.
*/
export const LINGUA_ORIGINAL = 'pt'
export const LINGUAS = { en: 'English', fr: 'Français', es: 'Español' }
export const ESTADOS_TRADUCAO = { rascunho: 'Rascunho (por rever)', publicada: 'Publicada' }
export const COLECOES_TRADUZIVEIS = ['noticias', 'artigos', 'eventos', 'cursos', 'pessoas', 'revistas']

const CHAVES_FIXAS = new Set([
  'id', 'slug', 'tipo', 'src', 'capa', 'imagem', 'imagemSede', 'foto', 'poster', 'video', 'youtube', 'posicao', 'data', 'hora', 'horaInicio',
  'horaFim', 'inicio', 'fim', 'ano', 'anoAcademico', 'sigla', 'vagas', 'coordenador', 'ligacao', 'link', 'url', 'href', 'email', 'telefones',
  'telefone', 'mapa', 'icone', 'cor', 'chave', 'ordem', 'destaque_', 'categoriaId', 'pdf', 'numero', 'pagina',
])
const NAO_TEXTO = [
  /^(https?:|mailto:|tel:|\/|#|data:)/i, /^\d{4}-\d{2}-\d{2}/, /^\d{1,2}:\d{2}$/, /^[\d\s.,:+%()/-]*$/, /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // nomes com o posto à frente ("Cor. Ana Baptista") e identificadores ("ana-baptista") ficam como estão
  /^(?:[A-Z][a-z]{0,4}\.?-)?[A-Z][a-z]{0,4}\.\s+\p{Lu}/u, /^[a-z0-9]+(-[a-z0-9]+)+$/,
]

const traduzivel = (chave, v) => typeof v === 'string' && v.trim().length > 1 && !CHAVES_FIXAS.has(chave) && !chave.startsWith('_')
  && /\p{L}/u.test(v) && !NAO_TEXTO.some((re) => re.test(v.trim()))

// um texto solto (dos painéis) que vale a pena traduzir
export const textoTraduzivel = (v) => traduzivel('texto', v)

// { caminho: texto } com todos os textos traduzíveis
export function extrairTextos(dados) {
  const r = {}
  const andar = (v, caminho, chave) => {
    if (Array.isArray(v)) v.forEach((x, i) => andar(x, caminho ? `${caminho}.${i}` : String(i), chave))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) andar(x, caminho ? `${caminho}.${k}` : k, k)
    else if (traduzivel(chave, v)) r[caminho] = v
  }
  andar(dados, '', '')
  return r
}

// cópia dos dados com os textos traduzidos nos seus lugares (os que faltarem ficam em português)
export function aplicarTextos(dados, textos) {
  const copia = structuredClone(dados)
  for (const [caminho, texto] of Object.entries(textos || {})) {
    if (typeof texto !== 'string' || !texto.trim()) continue
    const partes = caminho.split('.')
    let alvo = copia
    for (const p of partes.slice(0, -1)) {
      if (alvo === null || typeof alvo !== 'object' || !(p in alvo)) { alvo = null; break }
      alvo = alvo[p]
    }
    const ultima = partes.at(-1)
    if (alvo && typeof alvo === 'object' && typeof alvo[ultima] === 'string') alvo[ultima] = texto
  }
  return copia
}

// caminhos cujo texto original mudou (ou apareceu) depois da tradução
export function desatualizados(originaisNaTraducao, atuais) {
  return Object.keys(atuais).filter((c) => originaisNaTraducao?.[c] !== atuais[c])
}

// só ficam os caminhos que existem no original, com textos limpos e de tamanho razoável
export function limparTextos(textos, originais) {
  const r = {}
  for (const [c, t] of Object.entries(textos || {})) {
    if (!(c in originais) || typeof t !== 'string') continue
    const limpo = t.replaceAll(String.fromCharCode(0), '').trim()
    if (limpo) r[c] = limpo.slice(0, Math.max(400, originais[c].length * 3))
  }
  return r
}

import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'

export const VISITANTE_VALIDO = /^[a-zA-Z0-9-]{8,64}$/
export const visitanteValido = (v) => typeof v === 'string' && VISITANTE_VALIDO.test(v)

// valida um comentário de um visitante (publicado de imediato; o painel pode apagar)
export function novoComentario({ nome, texto }) {
  const n = limparTexto(nome).replace(/\s+/g, ' ')
  const t = limparTexto(texto)
  if (n.length < 2 || n.length > 80) throw new ErroValidacao('Indique um nome entre 2 e 80 caracteres.')
  if (t.length < 2 || t.length > 2000) throw new ErroValidacao('O comentário deve ter entre 2 e 2000 caracteres.')
  if ((t.match(/https?:\/\//gi) || []).length > 2) throw new ErroValidacao('O comentário tem demasiadas ligações.')
  return { nome: n, texto: t }
}

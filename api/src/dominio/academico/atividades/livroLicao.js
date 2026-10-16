import { ErroValidacao } from '../../comum/erros.js'
import { limparTexto } from '../../comum/texto.js'

/*
  Livro e Lição (como os do Moodle).
  Livro: capítulos com texto rico e índice próprio — [{ titulo, conteudo, sub }] (sub = subcapítulo).
  Lição: páginas de matéria com perguntas pelo meio; cada resposta leva a uma página
    [{ id, titulo, conteudo, pergunta?: { enunciado, opcoes: [{ texto, correta, resposta, salto }] } }]
    salto: "seguinte" | "repetir" | "fim" | id de outra página.
  A nota da lição conta a primeira resposta a cada pergunta (de 0 a 20).
*/
const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
const textoEntre = (v, campo, nome, min, max) => {
  const t = limparTexto(v)
  if (t.length < min || t.length > max) throw erro(campo, `${nome}: entre ${min} e ${max} caracteres.`)
  return t
}
const html = (filtro, v, max) => {
  const h = String(v ?? '')
  if (h.length > max) throw erro('estrutura', 'Uma página é demasiado longa.')
  return filtro(h)
}

export function validarLivro(capitulos, filtroHtml) {
  if (!Array.isArray(capitulos) || capitulos.length < 1 || capitulos.length > 100) throw erro('estrutura', 'O livro tem de 1 a 100 capítulos.')
  const r = capitulos.map((c, i) => ({
    titulo: textoEntre(c?.titulo, 'estrutura', `Título do capítulo ${i + 1}`, 1, 200),
    conteudo: html(filtroHtml, c?.conteudo, 200_000),
    sub: i > 0 && c?.sub === true, // o primeiro capítulo nunca é subcapítulo
  }))
  if (JSON.stringify(r).length > 2_000_000) throw erro('estrutura', 'O livro é demasiado grande: divida-o em dois.')
  return r
}

export const SALTOS = ['seguinte', 'repetir', 'fim']

export function validarLicao(paginas, filtroHtml) {
  if (!Array.isArray(paginas) || paginas.length < 1 || paginas.length > 60) throw erro('estrutura', 'A lição tem de 1 a 60 páginas.')
  const ids = paginas.map((p) => String(p?.id ?? ''))
  if (ids.some((id) => !/^[a-z0-9]{1,12}$/i.test(id)) || new Set(ids).size !== ids.length) throw erro('estrutura', 'Cada página tem um identificador próprio.')
  const r = paginas.map((p, i) => {
    const pagina = { id: String(p.id), titulo: textoEntre(p?.titulo, 'estrutura', `Título da página ${i + 1}`, 1, 200), conteudo: html(filtroHtml, p?.conteudo, 100_000) }
    if (p?.pergunta) {
      const q = p.pergunta
      const opcoes = Array.isArray(q.opcoes) ? q.opcoes : []
      if (opcoes.length < 2 || opcoes.length > 6) throw erro('estrutura', `A pergunta da página ${i + 1} tem de 2 a 6 opções.`)
      pagina.pergunta = {
        enunciado: textoEntre(q.enunciado, 'estrutura', `Pergunta da página ${i + 1}`, 3, 1000),
        opcoes: opcoes.map((o) => {
          const salto = SALTOS.includes(o?.salto) || ids.includes(String(o?.salto)) ? String(o.salto) : 'seguinte'
          return { texto: textoEntre(o?.texto, 'estrutura', `Opção da página ${i + 1}`, 1, 300), correta: o?.correta === true, resposta: limparTexto(o?.resposta).slice(0, 500), salto }
        }),
      }
      if (!pagina.pergunta.opcoes.some((o) => o.correta)) throw erro('estrutura', `Marque a opção certa da pergunta da página ${i + 1}.`)
    }
    return pagina
  })
  if (JSON.stringify(r).length > 2_000_000) throw erro('estrutura', 'A lição é demasiado grande: divida-a em duas.')
  return r
}

// a lição como o estudante a vê: sem as respostas certas, os comentários nem os saltos
export const licaoSemRespostas = (paginas) => (paginas || []).map((p) => ({
  id: p.id, titulo: p.titulo, conteudo: p.conteudo,
  ...(p.pergunta ? { pergunta: { enunciado: p.pergunta.enunciado, opcoes: p.pergunta.opcoes.map((o) => ({ texto: o.texto })) } } : {}),
}))

// página para onde se vai a partir de outra (null = fim da lição)
export function destino(paginas, de, salto = 'seguinte') {
  const i = paginas.findIndex((p) => p.id === de)
  if (salto === 'fim') return null
  if (salto === 'repetir') return de
  if (salto !== 'seguinte') return paginas.some((p) => p.id === salto) ? salto : null
  return paginas[i + 1]?.id ?? null
}

// nota: primeira resposta certa a cada pergunta, sobre o total de perguntas (sem perguntas: 20)
export function notaLicao(paginas, respostas) {
  const comPergunta = paginas.filter((p) => p.pergunta)
  if (!comPergunta.length) return 20
  const certas = comPergunta.filter((p) => respostas?.[p.id]?.certa).length
  return Math.round((certas / comPergunta.length) * 2000) / 100
}

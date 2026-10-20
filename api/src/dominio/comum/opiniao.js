import { ErroValidacao } from './erros.js'

/*
  Núcleo partilhado dos questionários de opinião (inquéritos das cadeiras e inquéritos institucionais),
  com os tipos de pergunta do Google Forms:
  - curta (resposta curta) e aberta (parágrafo);
  - escolha: escolha múltipla (uma), caixas de verificação (multipla) ou lista pendente (lista), com "Outra:";
  - escala linear: de 0 ou 1 até 2…10, com rótulos nas pontas (por omissão 1 a 5, de discordo a concordo);
  - grelha: linhas × colunas (uma coluna por linha, ou várias com multipla);
  - data e hora;
  - seccao: não é pergunta, divide o inquérito em páginas (título e descrição).
  Cada pergunta pode ser obrigatória ou não; por omissão, a escala, a escolha e a grelha são obrigatórias.
  As respostas ficam com o índice da pergunta na lista; a resposta "Outra:" de uma escolha fica em "<índice>o".
*/

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
export const TIPOS_PERGUNTA_OPINIAO = ['curta', 'aberta', 'escolha', 'escala', 'grelha', 'data', 'hora', 'seccao']
export const MAX_ITENS = 60

export const ESCALA = ['Discordo totalmente', 'Discordo', 'Nem concordo nem discordo', 'Concordo', 'Concordo totalmente']
// valor da opção "Outra:" na lista de opções escolhidas
export const OUTRA = -1

export const obrigatoriaPorOmissao = (tipo) => ['escala', 'escolha', 'grelha'].includes(tipo)
export const eObrigatoria = (p) => p.tipo !== 'seccao' && (p.obrigatoria ?? obrigatoriaPorOmissao(p.tipo))
// escala de concordância clássica (1 a 5), a que entra na média global
const escalaClassica = (p) => (p.min ?? 1) === 1 && (p.max ?? 5) === 5
const limites = (p) => ({ min: p.min ?? 1, max: p.max ?? 5 })

const DATA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function lista(v, campo, { min, max, rotulo }) {
  const l = (Array.isArray(v) ? v : []).map((o) => String(o ?? '').trim()).filter(Boolean)
  if (l.length < min || l.length > max) throw erro('perguntas', `${campo}: de ${min} a ${max} ${rotulo}.`)
  if (new Set(l.map((o) => o.toLowerCase())).size !== l.length) throw erro('perguntas', `${campo}: as ${rotulo} têm de ser diferentes.`)
  if (l.some((o) => o.length > 200)) throw erro('perguntas', `${campo}: cada uma até 200 caracteres.`)
  return l
}

// perguntas de um inquérito: 1 a 60 itens (secções incluídas), com pelo menos uma pergunta
export function validarPerguntasOpiniao(itens) {
  if (!Array.isArray(itens) || !itens.length || itens.length > MAX_ITENS) throw erro('perguntas', `O inquérito tem de 1 a ${MAX_ITENS} perguntas.`)
  const r = itens.map((p, i) => {
    const tipo = TIPOS_PERGUNTA_OPINIAO.includes(p?.tipo) ? p.tipo : null
    const nome = `Pergunta ${i + 1}`
    if (!tipo) throw erro('perguntas', `${nome}: tipo inválido.`)
    const texto = String(p.texto ?? '').trim()
    if (tipo === 'seccao' ? texto.length < 1 || texto.length > 200 : texto.length < 3 || texto.length > 500) {
      throw erro('perguntas', tipo === 'seccao' ? `Secção ${i + 1}: escreva o título.` : `${nome}: escreva o texto (3 a 500 caracteres).`)
    }
    const descricao = String(p.descricao ?? '').trim().slice(0, 1000)
    const base = { tipo, texto, ...(descricao ? { descricao } : {}) }
    if (tipo === 'seccao') return base
    if (p.obrigatoria !== undefined && Boolean(p.obrigatoria) !== obrigatoriaPorOmissao(tipo)) base.obrigatoria = Boolean(p.obrigatoria)
    if (tipo === 'escolha') {
      const opcoes = lista(p.opcoes, nome, { min: p.outra ? 1 : 2, max: 20, rotulo: 'opções' })
      const multipla = Boolean(p.multipla)
      const pendente = Boolean(p.lista) && !multipla
      return { ...base, opcoes, multipla, ...(pendente ? { lista: true } : {}), ...(p.outra && !pendente ? { outra: true } : {}) }
    }
    if (tipo === 'escala') {
      const min = p.min === undefined || p.min === null || p.min === '' ? 1 : Number(p.min)
      const max = p.max === undefined || p.max === null || p.max === '' ? 5 : Number(p.max)
      if (![0, 1].includes(min) || !Number.isInteger(max) || max < 2 || max > 10) throw erro('perguntas', `${nome}: a escala vai de 0 ou 1 até 2…10.`)
      const rotuloMin = String(p.rotuloMin ?? '').trim().slice(0, 60)
      const rotuloMax = String(p.rotuloMax ?? '').trim().slice(0, 60)
      return { ...base, ...(min !== 1 || max !== 5 ? { min, max } : {}), ...(rotuloMin ? { rotuloMin } : {}), ...(rotuloMax ? { rotuloMax } : {}) }
    }
    if (tipo === 'grelha') {
      return { ...base, linhas: lista(p.linhas, nome, { min: 1, max: 15, rotulo: 'linhas' }), colunas: lista(p.colunas, nome, { min: 2, max: 10, rotulo: 'colunas' }), multipla: Boolean(p.multipla) }
    }
    return base
  })
  if (!r.some((p) => p.tipo !== 'seccao')) throw erro('perguntas', 'O inquérito tem de ter pelo menos uma pergunta.')
  return r
}

/*
  Respostas de quem responde, conferidas com as perguntas: escolha -> índices das opções (e "Outra:"),
  escala -> número dentro dos limites, grelha -> { linha: [colunas] }, texto/data/hora -> texto.
  As obrigatórias têm de vir respondidas.
*/
export function limparRespostasInquerito(perguntas, respostas) {
  const r = respostas && typeof respostas === 'object' ? respostas : {}
  const limpas = {}
  perguntas.forEach((p, i) => {
    if (p.tipo === 'seccao') return
    const v = r[i] ?? r[String(i)]
    const falta = () => { if (eObrigatoria(p)) throw erro('respostas', `Responda à pergunta obrigatória «${p.texto.slice(0, 80)}».`) }
    if (p.tipo === 'escolha') {
      const textoOutra = String(r[`${i}o`] ?? '').trim().slice(0, 300)
      let l = [...new Set((Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]).map(Number))]
        .filter((x) => Number.isInteger(x) && ((x >= 0 && x < p.opcoes.length) || (x === OUTRA && p.outra)))
      if (l.includes(OUTRA) && !textoOutra) l = l.filter((x) => x !== OUTRA)
      if (!l.length) return falta()
      if (!p.multipla && l.length > 1) throw erro('respostas', 'Escolha só uma opção.')
      limpas[i] = l.sort((a, b) => a - b)
      if (l.includes(OUTRA)) limpas[`${i}o`] = textoOutra
    } else if (p.tipo === 'escala') {
      if (v === undefined || v === null || v === '') return falta()
      const n = Number(v)
      const { min, max } = limites(p)
      if (!Number.isInteger(n) || n < min || n > max) throw erro('respostas', `Pergunta ${i + 1}: escolha um valor de ${min} a ${max}.`)
      limpas[i] = n
    } else if (p.tipo === 'grelha') {
      const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
      const linhas = {}
      p.linhas.forEach((_, l) => {
        const c = [...new Set((Array.isArray(o[l]) ? o[l] : o[l] === undefined || o[l] === null ? [] : [o[l]]).map(Number))].filter((x) => Number.isInteger(x) && x >= 0 && x < p.colunas.length)
        if (!p.multipla && c.length > 1) throw erro('respostas', 'Escolha só uma coluna por linha.')
        if (c.length) linhas[l] = c.sort((a, b) => a - b)
      })
      if (eObrigatoria(p) && Object.keys(linhas).length < p.linhas.length) throw erro('respostas', `Responda a todas as linhas de «${p.texto.slice(0, 80)}».`)
      if (Object.keys(linhas).length) limpas[i] = linhas
    } else {
      const t = String(v ?? '').trim()
      if (!t) return falta()
      if (p.tipo === 'data' && !DATA.test(t)) throw erro('respostas', `Pergunta ${i + 1}: data inválida.`)
      if (p.tipo === 'hora' && !HORA.test(t)) throw erro('respostas', `Pergunta ${i + 1}: hora inválida.`)
      const max = p.tipo === 'curta' ? 300 : 2000
      if (t.length > max) throw erro('respostas', `Cada resposta tem até ${max} caracteres.`)
      limpas[i] = t
    }
  })
  return limpas
}

// resultados agregados (nunca dizem quem respondeu o quê)
export function resultadosInquerito(perguntas, respostas) {
  const total = respostas.length
  const pct = (c) => (total ? Math.round((c / total) * 100) : 0)
  // textos por ordem alfabética, para não revelar a ordem de chegada
  const ordenados = (l) => [...l].sort((a, b) => String(a).localeCompare(String(b), 'pt'))
  return {
    total,
    perguntas: perguntas.map((p, i) => {
      if (p.tipo === 'seccao') return { ...p }
      const valores = respostas.map((r) => r[i] ?? r[String(i)]).filter((v) => v !== undefined && v !== null)
      if (p.tipo === 'escolha') {
        const contagens = p.opcoes.map((_, j) => valores.filter((v) => v.includes(j)).length)
        const outras = p.outra ? ordenados(respostas.map((r) => r[`${i}o`]).filter(Boolean)) : []
        return { ...p, respostas: valores.length, contagens, percentagens: contagens.map(pct), ...(p.outra ? { outras, outraContagem: outras.length, outraPercentagem: pct(outras.length) } : {}) }
      }
      if (p.tipo === 'escala') {
        const { min, max } = limites(p)
        const distribuicao = Array.from({ length: max - min + 1 }, (_, k) => valores.filter((v) => v === min + k).length)
        const media = valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 100) / 100 : null
        return { ...p, respostas: valores.length, distribuicao, media }
      }
      if (p.tipo === 'grelha') {
        const contagens = p.linhas.map((_, l) => p.colunas.map((__, c) => valores.filter((v) => (v[l] ?? v[String(l)] ?? []).includes(c)).length))
        return { ...p, respostas: valores.length, contagens }
      }
      return { ...p, respostas: valores.length, comentarios: ordenados(valores) }
    }),
  }
}

// média global das afirmações de concordância (escalas de 1 a 5): síntese da avaliação
export function mediaGlobal(resultados) {
  const medias = resultados.perguntas.filter((p) => p.tipo === 'escala' && escalaClassica(p) && p.media !== null).map((p) => p.media)
  return medias.length ? Math.round((medias.reduce((s, v) => s + v, 0) / medias.length) * 100) / 100 : null
}

// número de perguntas (sem as secções)
export const contarPerguntas = (perguntas) => perguntas.filter((p) => p.tipo !== 'seccao').length

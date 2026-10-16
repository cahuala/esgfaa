import { ErroValidacao } from '../../comum/erros.js'
import { limparTexto } from '../../comum/texto.js'

// Questionários online (como os do Moodle): vários tipos de pergunta, correção automática e manual

export const TIPOS_PERGUNTA = {
  unica: 'Escolha única',
  multipla: 'Escolha múltipla',
  vf: 'Verdadeiro ou falso',
  curta: 'Resposta curta',
  numerica: 'Numérica',
  correspondencia: 'Correspondência',
  lacunas: 'Preencher lacunas',
  ordenar: 'Ordenar',
  dissertacao: 'Dissertação (correção manual)',
}
export const TIPOS_COM_OPCOES = ['unica', 'multipla', 'vf']
export const MARGEM_ENTREGA_MS = 30_000 // tolerância de rede para a entrega no fim do tempo

const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })
const arred = (n) => Math.round(n * 100) / 100

// "Carl von  Clausewitz " → "carl von clausewitz" (sem acentos nem maiúsculas)
export const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const numero = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'))
  return String(v ?? '').trim() === '' || !Number.isFinite(n) ? null : n
}

/*
  Valida uma pergunta vinda do docente. "opcoes" muda de forma conforme o tipo:
  - unica / multipla / vf: [{ texto, correta }]
  - curta: { respostas: ["Clausewitz", …] }      (aceites, sem contar maiúsculas nem acentos)
  - numerica: { valor, tolerancia }
  - correspondencia: { pares: [{ a, b }] }       (2 a 8 pares)
  - lacunas: { texto: "A capital é [[Luanda]] e o rio é o [[Kwanza|Cuanza]]." }   (respostas aceites entre [[ ]], separadas por |)
  - ordenar: { itens: ["primeiro", "segundo", …] } (2 a 10, pela ordem certa; o estudante vê-os baralhados)
  - dissertacao: { orientacao }                  (corrigida à mão)
*/
export function validarPergunta(p = {}) {
  const tipo = String(p.tipo || '')
  if (!TIPOS_PERGUNTA[tipo]) throw erro('tipo', 'Tipo de pergunta inválido.')
  const enunciado = limparTexto(p.enunciado)
  if (enunciado.length < 3 || enunciado.length > 2000) throw erro('enunciado', 'O enunciado tem entre 3 e 2000 caracteres.')
  const pontos = Number(String(p.pontos ?? 1).replace(',', '.'))
  if (!Number.isFinite(pontos) || pontos <= 0 || pontos > 100) throw erro('pontos', 'Os pontos vão de 0,25 a 100.')
  const o = p.opcoes
  let opcoes
  if (tipo === 'vf') {
    const verdadeira = o?.[0]?.correta === true || p.correta === true || p.correta === 'verdadeiro'
    opcoes = [{ texto: 'Verdadeiro', correta: verdadeira }, { texto: 'Falso', correta: !verdadeira }]
  } else if (tipo === 'unica' || tipo === 'multipla') {
    if (!Array.isArray(o) || o.length < 2 || o.length > 8) throw erro('opcoes', 'Indique de 2 a 8 opções.')
    opcoes = o.map((x) => {
      const texto = limparTexto(x?.texto)
      if (!texto || texto.length > 500) throw erro('opcoes', 'Cada opção tem de 1 a 500 caracteres.')
      return { texto, correta: x?.correta === true }
    })
    const corretas = opcoes.filter((x) => x.correta).length
    if (corretas === 0) throw erro('opcoes', 'Marque pelo menos uma opção correta.')
    if (tipo === 'unica' && corretas !== 1) throw erro('opcoes', 'Na escolha única só uma opção é correta.')
  } else if (tipo === 'curta') {
    const respostas = (Array.isArray(o?.respostas) ? o.respostas : []).map((r) => limparTexto(r)).filter(Boolean).slice(0, 10)
    if (!respostas.length || respostas.some((r) => r.length > 200)) throw erro('opcoes', 'Indique pelo menos uma resposta aceite (até 200 caracteres).')
    opcoes = { respostas }
  } else if (tipo === 'numerica') {
    const valor = numero(o?.valor)
    const tolerancia = numero(o?.tolerancia ?? 0) ?? 0
    if (valor === null) throw erro('opcoes', 'Indique o valor certo.')
    if (tolerancia < 0) throw erro('opcoes', 'A tolerância não pode ser negativa.')
    opcoes = { valor, tolerancia }
  } else if (tipo === 'correspondencia') {
    const pares = (Array.isArray(o?.pares) ? o.pares : []).map((x) => ({ a: limparTexto(x?.a), b: limparTexto(x?.b) }))
    if (pares.length < 2 || pares.length > 8) throw erro('opcoes', 'Indique de 2 a 8 pares.')
    if (pares.some((x) => !x.a || !x.b || x.a.length > 300 || x.b.length > 300)) throw erro('opcoes', 'Cada par tem os dois lados preenchidos (até 300 caracteres).')
    if (new Set(pares.map((x) => normalizar(x.b))).size !== pares.length) throw erro('opcoes', 'As respostas da direita têm de ser diferentes.')
    opcoes = { pares }
  } else if (tipo === 'lacunas') {
    const textoLacunas = String(o?.texto ?? '').replace(/\s+/g, ' ').trim()
    if (textoLacunas.length > 3000) throw erro('opcoes', 'O texto tem no máximo 3000 caracteres.')
    const lacunas = [...textoLacunas.matchAll(/\[\[([^\]]*)\]\]/g)].map((m) => m[1].split('|').map((x) => limparTexto(x)).filter(Boolean))
    if (lacunas.length < 1 || lacunas.length > 20) throw erro('opcoes', 'Marque de 1 a 20 lacunas com [[resposta]] no texto.')
    if (lacunas.some((l) => !l.length || l.some((x) => x.length > 200))) throw erro('opcoes', 'Cada lacuna tem pelo menos uma resposta aceite (até 200 caracteres).')
    opcoes = { texto: textoLacunas, lacunas }
  } else if (tipo === 'ordenar') {
    const itens = (Array.isArray(o?.itens) ? o.itens : []).map((x) => limparTexto(x)).filter(Boolean)
    if (itens.length < 2 || itens.length > 10) throw erro('opcoes', 'Indique de 2 a 10 itens, pela ordem certa.')
    if (itens.some((x) => x.length > 300)) throw erro('opcoes', 'Cada item tem até 300 caracteres.')
    if (new Set(itens.map(normalizar)).size !== itens.length) throw erro('opcoes', 'Os itens têm de ser diferentes.')
    opcoes = { itens }
  } else {
    opcoes = { orientacao: limparTexto(o?.orientacao).slice(0, 1000) }
  }
  return { tipo, enunciado, pontos: Math.round(pontos * 100) / 100, opcoes }
}

// texto de uma pergunta de lacunas em partes: [{ texto }, { lacuna: 0 }, { texto }, …] (sem as respostas)
export function partesLacunas(texto) {
  const partes = []
  let n = 0
  let ultimo = 0
  for (const m of String(texto || '').matchAll(/\[\[([^\]]*)\]\]/g)) {
    if (m.index > ultimo) partes.push({ texto: texto.slice(ultimo, m.index) })
    partes.push({ lacuna: n++ })
    ultimo = m.index + m[0].length
  }
  if (ultimo < String(texto || '').length) partes.push({ texto: texto.slice(ultimo) })
  return partes
}

/*
  Respostas do estudante, limpas por tipo:
  escolha → [índices]; correspondência → [índice de "b" para cada "a"]; curta e dissertação → texto; numérica → texto.
*/
export function limparRespostas(respostas, perguntas) {
  const r = respostas && typeof respostas === 'object' && !Array.isArray(respostas) ? respostas : {}
  const limpas = {}
  for (const p of perguntas) {
    const v = r[p.id]
    if (v === undefined || v === null) continue
    if (TIPOS_COM_OPCOES.includes(p.tipo)) {
      const escolhidos = Array.isArray(v) ? v : [v]
      const validos = [...new Set(escolhidos.map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < p.opcoes.length).sort((a, b) => a - b)
      if (p.tipo !== 'multipla' && validos.length > 1) validos.splice(1)
      if (validos.length) limpas[p.id] = validos
    } else if (p.tipo === 'correspondencia') {
      const n = p.opcoes.pares.length
      if (!Array.isArray(v)) continue
      const mapa = Array.from({ length: n }, (_, i) => {
        const x = Number(v[i])
        return Number.isInteger(x) && x >= 0 && x < n ? x : null
      })
      if (mapa.some((x) => x !== null)) limpas[p.id] = mapa
    } else if (p.tipo === 'lacunas') {
      if (!Array.isArray(v)) continue
      const n = p.opcoes.lacunas.length
      const textos = Array.from({ length: n }, (_, i) => String(v[i] ?? '').slice(0, 200))
      if (textos.some((x) => x.trim())) limpas[p.id] = textos
    } else if (p.tipo === 'ordenar') {
      // a ordem dada: índices originais dos itens, do primeiro ao último (tem de ser uma permutação completa)
      const n = p.opcoes.itens.length
      if (!Array.isArray(v) || v.length !== n) continue
      const ordem = v.map(Number)
      if (ordem.every((x) => Number.isInteger(x) && x >= 0 && x < n) && new Set(ordem).size === n) limpas[p.id] = ordem
    } else {
      const t = String(Array.isArray(v) ? v[0] ?? '' : v).slice(0, p.tipo === 'dissertacao' ? 20_000 : 300)
      if (t.trim()) limpas[p.id] = t
    }
  }
  return limpas
}

// pontos obtidos numa pergunta corrigida automaticamente (null = precisa de correção manual)
function pontuar(p, dada) {
  const pts = Number(p.pontos)
  if (p.tipo === 'dissertacao') return null
  if (dada === undefined) return 0
  if (TIPOS_COM_OPCOES.includes(p.tipo)) {
    const certas = p.opcoes.map((o, i) => (o.correta ? i : -1)).filter((i) => i >= 0)
    return dada.length === certas.length && dada.every((i, k) => i === certas[k]) ? pts : 0
  }
  if (p.tipo === 'curta') return p.opcoes.respostas.some((r) => normalizar(r) === normalizar(dada)) ? pts : 0
  if (p.tipo === 'numerica') {
    const n = numero(dada)
    return n !== null && Math.abs(n - p.opcoes.valor) <= p.opcoes.tolerancia + 1e-9 ? pts : 0
  }
  // lacunas: crédito parcial por lacuna certa (sem contar maiúsculas nem acentos)
  if (p.tipo === 'lacunas') {
    const certas = p.opcoes.lacunas.filter((aceites, i) => aceites.some((a) => normalizar(a) === normalizar(dada[i]))).length
    return arred((pts * certas) / p.opcoes.lacunas.length)
  }
  // ordenar: crédito parcial por item no lugar certo
  if (p.tipo === 'ordenar') return arred((pts * dada.filter((x, i) => x === i).length) / p.opcoes.itens.length)
  // correspondência: crédito parcial por par certo
  const n = p.opcoes.pares.length
  const certos = dada.filter((x, i) => x === i).length
  return arred((pts * certos) / n)
}

/*
  Correção da tentativa. manuais: { perguntaId: pontos } dados pelo docente às dissertações.
  porCorrigir = há dissertações ainda sem pontos (a nota fica null até lá). Nota de 0 a 20.
*/
export function corrigir(perguntas, respostas, manuais = {}) {
  const limpas = limparRespostas(respostas, perguntas)
  let total = 0
  let obtidos = 0
  let porCorrigir = false
  const detalhe = perguntas.map((p) => {
    const dada = limpas[p.id]
    let pts = pontuar(p, dada)
    if (pts === null) {
      const m = manuais?.[p.id]
      if (m === undefined || m === null) { porCorrigir = true } else pts = Math.min(Number(p.pontos), Math.max(0, Number(m)))
    }
    total += Number(p.pontos)
    obtidos += pts ?? 0
    return {
      perguntaId: p.id, pontos: Number(p.pontos), obtidos: pts, certa: pts === null ? null : pts >= Number(p.pontos) - 1e-9,
      dada: dada ?? null, solucao: solucao(p),
    }
  })
  const nota = porCorrigir ? null : total ? arred((obtidos / total) * 20) : 0
  return { nota, obtidos: arred(obtidos), total: arred(total), porCorrigir, detalhe }
}

// resposta certa, para a revisão depois da entrega
function solucao(p) {
  if (TIPOS_COM_OPCOES.includes(p.tipo)) return p.opcoes.map((o, i) => (o.correta ? i : -1)).filter((i) => i >= 0)
  if (p.tipo === 'curta') return p.opcoes.respostas
  if (p.tipo === 'numerica') return { valor: p.opcoes.valor, tolerancia: p.opcoes.tolerancia }
  if (p.tipo === 'correspondencia') return p.opcoes.pares.map((_, i) => i)
  if (p.tipo === 'lacunas') return p.opcoes.lacunas
  if (p.tipo === 'ordenar') return p.opcoes.itens
  return null
}

// comentário conforme a nota: o do maior mínimo que a nota atinge ([{ minimo: 0, texto }, { minimo: 14, texto }])
export function comentarioDaNota(comentarios, nota) {
  if (nota === null || nota === undefined || !Array.isArray(comentarios)) return ''
  const aplicaveis = comentarios.filter((c) => Number(c.minimo) <= nota + 1e-9).sort((a, b) => b.minimo - a.minimo)
  return aplicaveis[0]?.texto || ''
}

export function validarComentarios(lista) {
  if (!Array.isArray(lista)) throw erro('comentarios', 'Comentários inválidos.')
  if (lista.length > 10) throw erro('comentarios', 'No máximo 10 comentários por nota.')
  return lista.map((c) => {
    const minimo = Number(String(c?.minimo ?? '').replace(',', '.'))
    const texto = limparTexto(c?.texto).slice(0, 500)
    if (!Number.isFinite(minimo) || minimo < 0 || minimo > 20) throw erro('comentarios', 'A nota mínima de cada comentário vai de 0 a 20.')
    if (!texto) throw erro('comentarios', 'Cada comentário tem texto.')
    return { minimo: Math.round(minimo * 100) / 100, texto }
  }).sort((a, b) => a.minimo - b.minimo)
}

// perguntas de uma tentativa divididas em páginas ([[ids da página 1], [ids da página 2], …])
export function paginasDaTentativa(perguntas, porPagina) {
  const ids = perguntas.map((p) => p.id)
  if (!porPagina || porPagina <= 0) return [ids]
  const r = []
  for (let i = 0; i < ids.length; i += porPagina) r.push(ids.slice(i, i + porPagina))
  return r.length ? r : [[]]
}

// ---------- ordem aleatória (perguntas, opções e um subconjunto por tentativa) ----------

export function baralhar(lista, aleatorio = Math.random) {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/*
  Ordem de uma tentativa: que perguntas (e por que ordem) e como se mostram as opções.
  Devolve { ordem: [perguntaId], permutacoes: { perguntaId: [índices] } }.
*/
export function sortearTentativa(q, perguntas, aleatorio = Math.random) {
  let lista = perguntas.map((p) => p.id)
  if (q.baralhar) lista = baralhar(lista, aleatorio)
  if (q.perguntasPorTentativa > 0 && q.perguntasPorTentativa < lista.length) {
    lista = (q.baralhar ? lista : baralhar(lista, aleatorio)).slice(0, q.perguntasPorTentativa)
    if (!q.baralhar) lista.sort((a, b) => perguntas.findIndex((p) => p.id === a) - perguntas.findIndex((p) => p.id === b))
  }
  const permutacoes = {}
  for (const p of perguntas) {
    if (!lista.includes(p.id)) continue
    const n = TIPOS_COM_OPCOES.includes(p.tipo) && p.tipo !== 'vf' ? p.opcoes.length : p.tipo === 'correspondencia' ? p.opcoes.pares.length : p.tipo === 'ordenar' ? p.opcoes.itens.length : 0
    // a correspondência baralha sempre a coluna da direita e o ordenar os itens (senão a resposta seria óbvia)
    const sempre = p.tipo === 'correspondencia' || p.tipo === 'ordenar'
    if (n && (q.baralhar || sempre)) {
      let perm = baralhar([...Array(n).keys()], aleatorio)
      for (let k = 0; sempre && n > 1 && k < 5 && perm.every((x, i) => x === i); k++) perm = baralhar([...Array(n).keys()], aleatorio)
      if (sempre && n > 1 && perm.every((x, i) => x === i)) perm = [...perm.slice(1), perm[0]] // nunca já pela ordem certa
      permutacoes[p.id] = perm
    }
  }
  return { ordem: lista, permutacoes }
}

// perguntas da tentativa pela ordem sorteada (tentativas antigas sem ordem: todas)
export const perguntasDaTentativa = (perguntas, t) => (Array.isArray(t?.ordem) && t.ordem.length
  ? t.ordem.map((id) => perguntas.find((p) => p.id === id)).filter(Boolean)
  : perguntas)

/*
  Estado do questionário para o estudante num momento:
  em_breve (ainda não abriu) | aberto | fechado.
*/
export function estadoQuestionario(q, agora) {
  if (q.abre && agora < new Date(q.abre)) return 'em_breve'
  if (q.fecha && agora > new Date(q.fecha)) return 'fechado'
  return 'aberto'
}

// o questionário para um estudante, com a sua exceção (outro fecho, mais tempo, mais tentativas)
export const comExcecao = (q, excecao) => (excecao ? {
  ...q,
  fecha: excecao.fecha ?? q.fecha,
  duracao: excecao.duracao ?? q.duracao,
  tentativas: excecao.tentativas ?? q.tentativas,
} : q)

// fim da tentativa: o que acontecer primeiro entre a duração e o fecho do questionário
export function limiteTentativa(q, inicio) {
  const fins = []
  if (q.duracao > 0) fins.push(new Date(inicio.getTime() + q.duracao * 60_000))
  if (q.fecha) fins.push(new Date(q.fecha))
  return fins.length ? new Date(Math.min(...fins.map((d) => d.getTime()))) : null
}

export const dentroDoTempo = (tentativa, agora) => !tentativa.limite || agora.getTime() <= new Date(tentativa.limite).getTime() + MARGEM_ENTREGA_MS

/*
  Estatísticas de um questionário (como o relatório do Moodle): por pergunta, quantas responderam,
  a média de pontos (facilidade) e, nas de escolha, quantas vezes cada opção foi escolhida.
*/
export function estatisticas(perguntas, tentativas) {
  const feitas = tentativas.filter((t) => t.entregueEm)
  const notas = feitas.map((t) => t.nota).filter((n) => n !== null && n !== undefined).sort((a, b) => a - b)
  const media = notas.length ? arred(notas.reduce((s, n) => s + n, 0) / notas.length) : null
  const mediana = notas.length ? (notas.length % 2 ? notas[(notas.length - 1) / 2] : arred((notas[notas.length / 2 - 1] + notas[notas.length / 2]) / 2)) : null
  const porPergunta = perguntas.map((p) => {
    let respondidas = 0
    let soma = 0
    let corrigidas = 0
    const escolhas = TIPOS_COM_OPCOES.includes(p.tipo) ? p.opcoes.map(() => 0) : null
    for (const t of feitas) {
      if (!perguntasDaTentativa(perguntas, t).some((x) => x.id === p.id)) continue
      const r = corrigir([p], t.respostas, t.manuais).detalhe[0]
      if (r.dada !== null) respondidas += 1
      if (escolhas && Array.isArray(r.dada)) for (const i of r.dada) escolhas[i] += 1
      if (r.obtidos !== null) { soma += r.obtidos; corrigidas += 1 }
    }
    return {
      perguntaId: p.id, tipo: p.tipo, enunciado: p.enunciado, respondidas,
      facilidade: corrigidas ? Math.round((soma / corrigidas / Number(p.pontos)) * 100) : null, // % média dos pontos
      escolhas,
    }
  })
  return { tentativas: feitas.length, media, mediana, maxima: notas.at(-1) ?? null, minima: notas[0] ?? null, porPergunta }
}

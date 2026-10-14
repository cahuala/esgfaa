import { ErroValidacao } from '../../comum/erros.js'
import { avaliarGrelha, validarGrelha } from '../avaliacao/grelha.js'
import { texto } from '../comum/validacao.js'

/*
  Avaliação por pares ("Workshop" do Moodle):
  1) submissão até fimSubmissao; 2) cada estudante que entregou avalia N trabalhos de colegas
  (distribuídos ao acaso, nunca o seu) até fimAvaliacao; 3) encerrado: o autor vê as avaliações.
  Nota = média das avaliações feitas (0 a 20), ou a nota que o docente der.
*/
const erro = (campo, mensagem) => new ErroValidacao(mensagem, { campo })

export function faseWorkshop(w, agora = new Date()) {
  if (agora < new Date(w.fimSubmissao)) return 'submissao'
  if (agora < new Date(w.fimAvaliacao)) return 'avaliacao'
  return 'encerrado'
}

export function validarWorkshop(d, atual = null) {
  const r = {}
  if (d.titulo !== undefined || !atual) r.titulo = texto(d.titulo, 'titulo', 'Título', { min: 3, max: 200 })
  if (d.enunciado !== undefined) r.enunciado = texto(d.enunciado, 'enunciado', 'Enunciado', { max: 10_000, obrigatorio: false })
  if (d.grelha !== undefined || !atual) {
    let g = d.grelha
    if (typeof g === 'string') {
      try { g = g.trim() ? JSON.parse(g) : [] } catch { throw erro('grelha', 'Grelha de avaliação inválida.') }
    }
    r.grelha = validarGrelha(g)
    if (!r.grelha.length) throw erro('grelha', 'Defina pelo menos um critério para os colegas avaliarem.')
  }
  for (const k of ['fimSubmissao', 'fimAvaliacao']) {
    if (d[k] !== undefined || !atual) {
      const v = new Date(d[k])
      if (!d[k] || Number.isNaN(v.getTime())) throw erro(k, k === 'fimSubmissao' ? 'Indique até quando se entrega.' : 'Indique até quando se avalia.')
      r[k] = v
    }
  }
  const fs = r.fimSubmissao ?? new Date(atual?.fimSubmissao)
  const fa = r.fimAvaliacao ?? new Date(atual?.fimAvaliacao)
  if (fa <= fs) throw erro('fimAvaliacao', 'A avaliação tem de terminar depois da entrega.')
  if (d.avaliacoesPorPar !== undefined || !atual) {
    const n = Number(d.avaliacoesPorPar ?? 3)
    if (!Number.isInteger(n) || n < 1 || n > 10) throw erro('avaliacoesPorPar', 'Cada estudante avalia de 1 a 10 trabalhos.')
    r.avaliacoesPorPar = n
  }
  if (d.anonimo !== undefined) r.anonimo = d.anonimo === true || d.anonimo === 'true'
  return r
}

/*
  Distribuição: cada estudante avalia n trabalhos de outros (n = min(n, total - 1)), e cada trabalho
  recebe n avaliações. Ordem ao acaso; i avalia os trabalhos de i+1 … i+n (em círculo).
  autores: ids de quem entregou. Devolve [{ autorId, avaliadorId }].
*/
export function distribuirAvaliacoes(autores, n, aleatorio = Math.random) {
  const l = [...autores]
  for (let i = l.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1))
    ;[l[i], l[j]] = [l[j], l[i]]
  }
  const k = Math.min(n, l.length - 1)
  const r = []
  l.forEach((avaliadorId, i) => {
    for (let d = 1; d <= k; d += 1) r.push({ avaliadorId, autorId: l[(i + d) % l.length] })
  })
  return r
}

// avaliação de um par: pontos da grelha (todos os critérios) -> nota de 0 a 20
export function notaDoPar(grelha, pontos) {
  const r = avaliarGrelha(grelha, pontos)
  if (r.nota === null) throw erro('pontos', 'Dê pontos a todos os critérios.')
  return r
}

// média das avaliações feitas (null se nenhuma)
export function notaDosPares(avaliacoes) {
  const notas = avaliacoes.filter((a) => a.nota !== null && a.nota !== undefined).map((a) => Number(a.nota))
  return notas.length ? Math.round((notas.reduce((s, x) => s + x, 0) / notas.length) * 100) / 100 : null
}

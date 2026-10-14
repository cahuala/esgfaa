import { Conflito, NaoEncontrado } from '../../dominio/comum/erros.js'
import { avaliarAcesso, chave, explicarMotivos } from '../../dominio/academico/disponibilidade.js'

/*
  O que um estudante já fez numa cadeira e que atividades tem abertas (restrições de acesso).
  Usado para mostrar a cadeira, para o progresso e para recusar abrir o que ainda está fechado.
*/
export class ServicoDisponibilidade {
  constructor({ academico, recursos, inqueritos, relogio }) {
    Object.assign(this, { academico, recursos, inqueritos, relogio })
  }

  // todas as atividades da cadeira (com as restrições) e os capítulos
  async atividades(cadeiraId) {
    const [materiais, trabalhos, questionarios, inqueritos, secoes] = await Promise.all([
      this.academico.materiais(cadeiraId), this.academico.trabalhos(cadeiraId),
      this.recursos.questionarios(cadeiraId), this.inqueritos ? this.inqueritos.inqueritos(cadeiraId) : [], this.academico.secoes(cadeiraId),
    ])
    const lista = [
      ...materiais.map((a) => ({ ...a, tipoAtividade: 'material' })),
      ...trabalhos.map((a) => ({ ...a, tipoAtividade: 'trabalho' })),
      ...questionarios.map((a) => ({ ...a, tipoAtividade: 'questionario' })),
      ...inqueritos.map((a) => ({ ...a, tipoAtividade: 'inquerito' })),
    ].map((a) => ({ ...a, chave: chave(a.tipoAtividade, a.id) }))
    return { lista, secoes: Object.fromEntries(secoes.map((s) => [s.id, s])) }
  }

  // { "tipo-id": { feita, nota } } do estudante
  async estado(estudanteId, lista) {
    const ids = (t) => lista.filter((a) => a.tipoAtividade === t).map((a) => a.id)
    const [concluidos, entregas, tentativas, respondidos] = await Promise.all([
      this.recursos.conclusoesDoEstudante(estudanteId, ids('material')),
      this.academico.entregasDoEstudante(estudanteId, ids('trabalho')),
      this.recursos.tentativasDoEstudante(estudanteId, ids('questionario')),
      this.inqueritos ? this.inqueritos.respondidos(estudanteId, ids('inquerito')) : new Set(),
    ])
    const estado = {}
    for (const id of ids('material')) estado[chave('material', id)] = { feita: concluidos.has(id), nota: null }
    for (const id of ids('trabalho')) estado[chave('trabalho', id)] = { feita: Boolean(entregas[id]), nota: entregas[id]?.nota ?? null }
    for (const id of ids('questionario')) {
      const feitas = tentativas.filter((t) => t.questionarioId === id && t.entregueEm)
      const notas = feitas.map((t) => t.nota).filter((n) => n !== null)
      estado[chave('questionario', id)] = { feita: feitas.length > 0, nota: notas.length ? Math.max(...notas) : null }
    }
    for (const id of ids('inquerito')) estado[chave('inquerito', id)] = { feita: respondidos.has(id), nota: null }
    return estado
  }

  /*
    Mapa de acesso do estudante: { "tipo-id": { escondida, aberta, motivos } }.
    Escondida = a atividade ou o capítulo estão escondidos (o estudante não a vê).
  */
  async acessos(cadeiraId, estudanteId) {
    const { lista, secoes } = await this.atividades(cadeiraId)
    const estado = await this.estado(estudanteId, lista)
    const titulos = Object.fromEntries(lista.map((a) => [a.chave, a.titulo]))
    const agora = this.relogio.agora()
    const r = {}
    for (const a of lista) {
      const secao = a.secaoId ? secoes[a.secaoId] : null
      const escondida = a.visivel === false || secao?.visivel === false || (a.tipoAtividade === 'questionario' && !a.publicado)
      r[a.chave] = { escondida, ...avaliarAcesso(a, { agora, estado, titulos, secao }) }
    }
    return { acessos: r, estado, lista }
  }

  // recusa abrir uma atividade fechada (ou escondida) a um estudante
  async exigir(cadeiraId, estudanteId, tipo, id) {
    const { acessos } = await this.acessos(cadeiraId, estudanteId)
    const a = acessos[chave(tipo, id)]
    if (!a || a.escondida) throw new NaoEncontrado('Atividade não encontrada.')
    if (!a.aberta) throw new Conflito(`Esta atividade ainda não está disponível: ${explicarMotivos(a.motivos)}.`)
  }
}

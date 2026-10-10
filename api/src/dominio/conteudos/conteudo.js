import { definicao } from './colecoes.js'

export const ESTADOS = ['rascunho', 'publicado']

// Notícia, artigo, evento, curso, pessoa ou banner
export class Conteudo {
  constructor({ colecao, id, dados, estado = 'rascunho', ordem = 0, criadoEm = null, atualizadoEm = null, editadoPor = null }) {
    Object.assign(this, { colecao, id, dados, estado, ordem, criadoEm, atualizadoEm, editadoPor })
  }

  get titulo() {
    return this.dados[definicao(this.colecao).titulo]
  }

  get publicado() {
    return this.estado === 'publicado'
  }

  // campos alterados entre a versão atual e os novos dados (para o registo de atividades)
  camposAlterados(novos) {
    return Object.keys({ ...this.dados, ...novos }).filter((k) => JSON.stringify(this.dados[k]) !== JSON.stringify(novos[k]))
  }
}

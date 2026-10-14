import { Conflito } from '../comum/erros.js'

/*
  Reserva: o leitor escolhe um livro no portal; a biblioteca separa um exemplar ("pronta") e o leitor
  tem uns dias para o levantar. Ao emprestar-lhe a obra, a reserva fica atendida.
*/
export const REGRAS_RESERVA = { maximo: 3, diasLevantar: 3 }
export const ESTADOS_RESERVA = { pendente: 'À espera', pronta: 'Pronta a levantar', atendida: 'Levantada', cancelada: 'Cancelada' }
const ABERTAS = ['pendente', 'pronta']

export const chaveAberta = (contaId, obraId) => `${contaId}:${obraId}`

export class Reserva {
  constructor(d) {
    Object.assign(this, d)
  }

  get aberta() {
    return ABERTAS.includes(this.estado)
  }

  expirada(agora) {
    return this.estado === 'pronta' && this.levantarAte && new Date(agora) > new Date(this.levantarAte)
  }

  preparar(agora) {
    if (this.estado !== 'pendente') throw new Conflito('Esta reserva já não está à espera.')
    const d = new Date(new Date(agora).getTime() + REGRAS_RESERVA.diasLevantar * 86_400_000 + 3_600_000)
    return { estado: 'pronta', prontaEm: new Date(agora), levantarAte: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 59, 59)) }
  }

  fechar(estado, agora) {
    if (!this.aberta) throw new Conflito('Esta reserva já está fechada.')
    return { estado, fechadaEm: new Date(agora), aberta: null }
  }
}

// pode reservar mais esta obra?
export function verificarReserva({ abertas, obra, emprestadaAoLeitor }) {
  if (!obra.exemplares.some((x) => x.estado === 'bom' || x.estado === 'danificado')) throw new Conflito('Esta obra não tem exemplares para emprestar.')
  if (emprestadaAoLeitor) throw new Conflito('Já tem esta obra emprestada.')
  if (abertas.some((r) => r.obraId === obra.id)) throw new Conflito('Já reservou esta obra.')
  if (abertas.length >= REGRAS_RESERVA.maximo) throw new Conflito(`Já tem ${abertas.length} reservas abertas (máximo ${REGRAS_RESERVA.maximo}).`)
}

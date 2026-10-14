import { Conflito } from '../comum/erros.js'

/*
  Regras de circulação: prazo conforme o leitor, limite de empréstimos em simultâneo,
  renovações (só antes de o prazo acabar) e bloqueio enquanto houver atrasos. Sem multas.
*/
export const REGRAS_EMPRESTIMO = {
  estudante: { prazoDias: 14, maximo: 3 },
  docente: { prazoDias: 30, maximo: 5 },
  renovacoes: 2,
}

const DIA = 86_400_000
// o prazo acaba no fim do dia (23:59 de Luanda, UTC+1)
export function prazoPara(tipoLeitor, desde) {
  const dias = REGRAS_EMPRESTIMO[tipoLeitor]?.prazoDias ?? REGRAS_EMPRESTIMO.estudante.prazoDias
  const d = new Date(new Date(desde).getTime() + dias * DIA + 3_600_000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 59, 59))
}

export class Emprestimo {
  constructor(d) {
    Object.assign(this, d)
  }

  get ativo() {
    return !this.devolvidoEm
  }

  emAtraso(agora) {
    return this.ativo && new Date(agora) > new Date(this.prazo)
  }

  diasAtraso(agora) {
    return this.emAtraso(agora) ? Math.ceil((new Date(agora) - new Date(this.prazo)) / DIA) : 0
  }

  // novo prazo, contado a partir de hoje
  renovar(agora, tipoLeitor) {
    if (!this.ativo) throw new Conflito('Este empréstimo já foi devolvido.')
    if (this.emAtraso(agora)) throw new Conflito('O prazo já passou: devolva o livro na biblioteca.')
    if (this.renovacoes >= REGRAS_EMPRESTIMO.renovacoes) throw new Conflito(`Já renovou ${REGRAS_EMPRESTIMO.renovacoes} vezes: devolva o livro na biblioteca.`)
    const prazo = prazoPara(tipoLeitor, agora)
    if (prazo <= new Date(this.prazo)) throw new Conflito('Renovar hoje não lhe dá mais tempo: renove mais perto da data de devolução.')
    return { prazo, renovacoes: this.renovacoes + 1 }
  }

  podeRenovar(agora, tipoLeitor) {
    try {
      this.renovar(agora, tipoLeitor)
      return true
    } catch {
      return false
    }
  }
}

// o leitor pode levar mais um livro? (lista dos empréstimos ativos dele)
export function verificarLeitor(conta, ativos, agora) {
  if (!conta?.ativo) throw new Conflito('Esta conta está desativada.')
  const atrasados = ativos.filter((e) => e.emAtraso(agora))
  if (atrasados.length) throw new Conflito(`${conta.nome} tem ${atrasados.length} empréstimo(s) em atraso: só pode levar mais depois de devolver.`)
  const maximo = REGRAS_EMPRESTIMO[conta.tipo]?.maximo ?? REGRAS_EMPRESTIMO.estudante.maximo
  if (ativos.length >= maximo) throw new Conflito(`${conta.nome} já tem ${ativos.length} livro(s) emprestado(s) (máximo ${maximo}).`)
}

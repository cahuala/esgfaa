import { Utilizador } from '../identidade/utilizador.js'

// Conta do portal académico (estudante ou docente): as mesmas regras de bloqueio e sessões do painel
export class ContaPortal extends Utilizador {
  get eDocente() {
    return this.tipo === 'docente'
  }

  publico() {
    return {
      id: this.id, tipo: this.tipo, numero: this.numero, nome: this.nome, email: this.email,
      ativo: Boolean(this.ativo), dados: this.dados || {}, criadoEm: this.criadoEm, ultimoAcesso: this.ultimoAcesso,
    }
  }
}

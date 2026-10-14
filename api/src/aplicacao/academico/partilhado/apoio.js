import { ErroValidacao } from '../../../dominio/comum/erros.js'

/*
  Apoio comum aos casos de uso das cadeiras: quem pode abrir cada cadeira (AcessoCadeiras),
  ficheiros enviados para a pasta privada, avisos aos estudantes e capítulos da cadeira.
*/
export class ApoioCadeiras {
  constructor({ acesso, academico, notificacoes, privados }) {
    Object.assign(this, { acesso, academico, notificacoes, privados })
  }

  cadeiraAcessivel(conta, cadeiraId) {
    return this.acesso.acessivel(conta, cadeiraId)
  }

  cadeiraDoDocente(conta, cadeiraId) {
    return this.acesso.doDocente(conta, cadeiraId)
  }

  soEstudante(conta) {
    this.acesso.soEstudante(conta)
  }

  minhasCadeiras(conta) {
    return this.acesso.minhasCadeiras(conta)
  }

  // avisa os estudantes da cadeira de algo novo (não se o capítulo estiver escondido)
  async avisarEstudantes(ctx, cadeira, secaoId, dados) {
    if (!this.notificacoes) return
    if (secaoId && !(await this.academico.secao(secaoId))?.visivel) return
    await this.notificacoes.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), dados, { excepto: ctx.conta.id })
  }

  // ficheiro enviado (já gravado na pasta privada): confirma o tipo real e regista-o
  async registarFicheiro(f, donoId) {
    if (!this.privados.confirmarTipo(f.caminho, f.tipo)) {
      this.privados.apagar(f.caminho)
      throw new ErroValidacao(`O ficheiro "${f.nome}" não corresponde ao tipo indicado.`, { campo: 'ficheiro' })
    }
    const id = f.caminho.split(/[\\/]/).pop().split('.')[0]
    await this.academico.criarFicheiro({ id, caminho: this.privados.relativo(f.caminho), nome: f.nome, tipo: f.tipo, tamanho: f.tamanho, donoId })
    return id
  }

  // capítulo indicado num formulário: tem de ser desta cadeira (vazio = secção geral)
  async secaoDaCadeira(cadeiraId, secaoId) {
    if (secaoId === undefined || secaoId === null || secaoId === '' || secaoId === 'null') return null
    const secao = await this.academico.secao(secaoId)
    if (!secao || secao.cadeiraId !== cadeiraId) throw new ErroValidacao('Capítulo inválido.', { campo: 'secaoId' })
    return secao.id
  }

  dataValida(v, campo = 'disponivelDe') {
    if (v === null || v === undefined || v === '') return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) throw new ErroValidacao('Data inválida.', { campo })
    return d
  }
}

import { NaoEncontrado } from '../../../dominio/comum/erros.js'

// Ficheiros privados do portal: só para quem tem acesso (cadeira, entrega, pedido).
export class ServicoFicheirosPortal {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // devolve { caminho, nome, tipo } se quem pede tiver acesso
  async ficheiro(ctx, id) {
    const { conta } = ctx
    const f = await this.academico.ficheiro(id)
    const uso = f && (await this.academico.usoDoFicheiro(f.id))
    const negar = () => { throw new NaoEncontrado('Ficheiro não encontrado.') }
    if (!uso) negar()
    if (['material', 'enunciado', 'programa', 'forum'].includes(uso.tipo)) {
      await this.apoio.cadeiraAcessivel(conta, uso.cadeiraId)
      if (conta.tipo === 'estudante' && uso.escondido) negar() // capítulo ainda escondido
      if (conta.tipo === 'estudante' && uso.atividade) {
        const { acessos } = await this.disponibilidade.acessos(uso.cadeiraId, conta.id)
        const a = acessos[uso.atividade]
        if (!a || a.escondida || !a.aberta) negar()
        const [tipo, alvo] = uso.atividade.split('-')
        await this.registos?.registar(conta, uso.cadeiraId, tipo, Number(alvo))
      }
    }
    else if (uso.tipo === 'workshop') {
      if (conta.tipo === 'estudante' && !uso.estudantes.includes(conta.id)) negar()
      if (conta.tipo === 'docente') await this.apoio.cadeiraDoDocente(conta, uso.cadeiraId)
    } else if (uso.tipo === 'entrega') {
      if (conta.tipo === 'estudante' && (!uso.estudantes.includes(conta.id) || uso.correcaoPorLibertar)) negar()
      if (conta.tipo === 'docente') await this.apoio.cadeiraDoDocente(conta, uso.cadeiraId)
    } else if (uso.tipo === 'pedido' && uso.estudanteId !== conta.id) negar()
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }
}

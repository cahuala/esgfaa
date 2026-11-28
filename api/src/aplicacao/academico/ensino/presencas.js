import crypto from 'node:crypto'
import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { ESTADOS_PRESENCA } from '../../../dominio/academico/atividades/presencas.js'
import { dataValida, escolha, texto } from '../../../dominio/academico/comum/validacao.js'

// Aulas dadas (sumário) e presenças registadas pelo docente.
export class ServicoPresencas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
    // presenças rápidas: código da aula → { aulaId, ate }; tentativas erradas por estudante
    this.codigos = new Map()
    this.tentativas = new Map()
  }

  #agora() {
    return this.relogio?.agora() ?? new Date()
  }

  /*
    Presenças rápidas: o docente abre o código da aula (6 algarismos, 15 minutos) e mostra-o no quadro como QR; cada
    estudante lê-o no telemóvel (ou escreve o código no portal) e fica presente. O docente corrige o resto na lista.
  */
  async codigoPresenca(ctx, aulaId) {
    const aula = await this.academico.aula(aulaId)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    await this.apoio.cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    const agora = this.#agora().getTime()
    for (const [k, v] of this.codigos) if (v.ate < agora || v.aulaId === aula.id) this.codigos.delete(k)
    let codigo
    do codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); while (this.codigos.has(codigo))
    const ate = agora + 15 * 60_000
    this.codigos.set(codigo, { aulaId: aula.id, ate })
    return { codigo, ate: new Date(ate).toISOString() }
  }

  async marcarPorCodigo(ctx, codigo) {
    if (ctx.conta?.tipo !== 'estudante') throw new SemPermissao('Só o estudante marca a sua presença com o código da aula.')
    const agora = this.#agora().getTime()
    const t = this.tentativas.get(ctx.conta.id) ?? { n: 0, desde: agora }
    if (agora - t.desde > 10 * 60_000) { t.n = 0; t.desde = agora }
    if (t.n >= 10) throw new ErroValidacao('Demasiados códigos errados. Espere uns minutos ou peça ao docente que marque a presença.')
    const x = this.codigos.get(String(codigo ?? '').replace(/\D/g, ''))
    if (!x || x.ate < agora) {
      t.n++
      this.tentativas.set(ctx.conta.id, t)
      throw new ErroValidacao('Código errado ou já fora do tempo. Confirme o código no quadro.', { campo: 'codigo' })
    }
    const aula = await this.academico.aula(x.aulaId)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    const cadeira = await this.academico.cadeira(aula.cadeiraId)
    if (!(await this.academico.estudantesDaCadeira(cadeira)).some((e) => e.id === ctx.conta.id)) throw new SemPermissao('Não está inscrito nesta cadeira.')
    await this.academico.marcarPresenca(aula.id, ctx.conta.id, 'presente')
    return { cadeira: { id: cadeira.id, codigo: cadeira.codigo, nome: cadeira.nome }, data: aula.data }
  }

  async aulas(ctx, cadeiraId) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    const [aulas, estudantes] = await Promise.all([this.academico.aulas(cadeira.id), this.academico.estudantesDaCadeira(cadeira)])
    return { aulas, estudantes }
  }

  async #presencasValidas(cadeira, presencas) {
    const validos = new Set((await this.academico.estudantesDaCadeira(cadeira)).map((e) => e.id))
    return (presencas || []).map((p) => {
      if (!validos.has(Number(p.estudanteId))) throw new ErroValidacao('A lista de presenças tem um estudante que não pertence à turma.')
      return { estudanteId: Number(p.estudanteId), estado: escolha(p.estado, 'estado', 'Presença', ESTADOS_PRESENCA) }
    })
  }

  async registarAula(ctx, cadeiraId, { data, sumario, presencas }) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    if (!dataValida(data)) throw new ErroValidacao('Data da aula inválida.', { campo: 'data' })
    return this.academico.registarAula({
      cadeiraId: cadeira.id, data,
      sumario: texto(sumario, 'sumario', 'Sumário', { max: 2000, obrigatorio: false }),
      presencas: await this.#presencasValidas(cadeira, presencas),
    })
  }

  async atualizarAula(ctx, id, { sumario, presencas }) {
    const aula = await this.academico.aula(id)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.atualizarAula(aula.id, {
      sumario: texto(sumario, 'sumario', 'Sumário', { max: 2000, obrigatorio: false }),
      presencas: await this.#presencasValidas(cadeira, presencas),
    })
  }

  async apagarAula(ctx, id) {
    const aula = await this.academico.aula(id)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    await this.apoio.cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.apagarAula(aula.id)
  }
}

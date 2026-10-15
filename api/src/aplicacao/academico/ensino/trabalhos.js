import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { entregaAtrasada, estadoPrazo, prazoDe, TIPOS_ENTREGA } from '../../../dominio/academico/atividades/trabalhos.js'
import { avaliarGrelha, validarGrelha } from '../../../dominio/academico/avaliacao/grelha.js'
import { validarNota } from '../../../dominio/academico/avaliacao/nota.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { quem } from '../partilhado/autor.js'

// Trabalhos: criar, entregar (individual ou em grupo), corrigir com grelha e prorrogar prazos.
export class ServicoTrabalhos {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  // entrega do estudante: ficheiros e/ou texto, conforme o trabalho pede (substitui a anterior)
  async entregar(ctx, trabalhoId, ficheiros, { comentario, texto: escrito }) {
    const { conta } = ctx
    const apagar = () => { for (const f of ficheiros) this.privados.apagar(f.caminho) }
    let trabalho
    let corpo
    let grupo = null
    try {
      this.apoio.soEstudante(conta)
      trabalho = await this.academico.trabalho(trabalhoId)
      if (!trabalho) throw new NaoEncontrado('Trabalho não encontrado.')
      await this.apoio.cadeiraAcessivel(conta, trabalho.cadeiraId)
      await this.disponibilidade.exigir(trabalho.cadeiraId, conta.id, 'trabalho', trabalho.id)
      const prazo = prazoDe(trabalho, await this.academico.prorrogacao(trabalho.id, conta.id))
      if (estadoPrazo(prazo, this.relogio.agora(), trabalho.aceitaAtraso) === 'fechado') throw new ErroValidacao('O prazo de entrega terminou.')
      if (trabalho.emGrupo) {
        grupo = await this.grupos.grupoDe(trabalho.cadeiraId, conta.id)
        if (!grupo) throw new Conflito('Este trabalho é em grupo e ainda não está em nenhum grupo. Fale com o docente.')
        const atual = await this.academico.entregaDoGrupo(trabalho.id, grupo.id)
        if (atual?.nota !== null && atual?.nota !== undefined) throw new Conflito('A entrega do grupo já foi corrigida.')
      }
      corpo = texto(escrito, 'texto', 'Texto', { max: 50_000, obrigatorio: false })
      const querFicheiros = trabalho.tipoEntrega !== 'texto'
      const querTexto = trabalho.tipoEntrega !== 'ficheiro'
      if (!querFicheiros && ficheiros.length) throw new ErroValidacao('Este trabalho entrega-se só com texto.', { campo: 'ficheiros' })
      if (!querTexto && corpo) throw new ErroValidacao('Este trabalho entrega-se só com ficheiros.', { campo: 'texto' })
      if (ficheiros.length > trabalho.maxFicheiros) throw new ErroValidacao(`No máximo ${trabalho.maxFicheiros} ficheiro(s).`, { campo: 'ficheiros' })
      if (trabalho.tipoEntrega === 'ficheiro' && !ficheiros.length) throw new ErroValidacao('Escolha o ficheiro a entregar.', { campo: 'ficheiros' })
      if (trabalho.tipoEntrega === 'texto' && !corpo) throw new ErroValidacao('Escreva o texto do trabalho.', { campo: 'texto' })
      if (trabalho.tipoEntrega === 'ambos' && !corpo && !ficheiros.length) throw new ErroValidacao('Junte ficheiros ou escreva o texto.', { campo: 'texto' })
    } catch (e) {
      apagar()
      throw e
    }
    const ficheiroIds = []
    try {
      for (const f of ficheiros) ficheiroIds.push(await this.apoio.registarFicheiro(f, conta.id))
    } catch (e) {
      apagar()
      throw e
    }
    const entrega = await this.academico.gravarEntrega({
      trabalhoId: trabalho.id, estudanteId: conta.id, grupoId: grupo?.id ?? null, ficheiroIds, texto: corpo, comentario: texto(comentario, 'comentario', 'Comentário', { max: 2000, obrigatorio: false }),
    })
    await this.auditoria.registar(ctx, { acao: 'entregar_trabalho', colecao: 'trabalhos', alvoId: trabalho.id, alvoTitulo: trabalho.titulo, detalhes: { ficheiros: ficheiroIds.length }, utilizador: quem(conta) })
    if (grupo) {
      await this.notificacoes?.notificar(grupo.membros.map((m) => m.id), {
        tipo: 'trabalho', titulo: `Entrega do grupo ${grupo.nome}: ${trabalho.titulo}`, texto: `${conta.nome} entregou o trabalho pelo grupo.`,
        ligacao: `/cadeiras/${trabalho.cadeiraId}?atividade=trabalho-${trabalho.id}`,
      }, { excepto: conta.id })
    }
    this.originalidade?.entregaFeita(entrega.id) // verificação de originalidade, em segundo plano
    const prazo = prazoDe(trabalho, await this.academico.prorrogacao(trabalho.id, conta.id))
    return { ...entrega, atrasada: entregaAtrasada(entrega.entregueEm, prazo) }
  }

  // campos do trabalho; parcial = só os que vierem (edição)
  #dadosTrabalho(dados, parcial = false) {
    const r = {}
    if (!parcial || dados.prazo !== undefined) {
      const prazo = new Date(dados.prazo)
      if (Number.isNaN(prazo.getTime())) throw new ErroValidacao('Indique a data e hora do prazo.', { campo: 'prazo' })
      r.prazo = prazo
    }
    if (!parcial || dados.titulo !== undefined) r.titulo = texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 })
    if (!parcial || dados.enunciado !== undefined) r.enunciado = texto(dados.enunciado, 'enunciado', 'Enunciado', { max: 10000, obrigatorio: false })
    if (!parcial || dados.aceitaAtraso !== undefined) r.aceitaAtraso = dados.aceitaAtraso === true || dados.aceitaAtraso === 'true'
    if (!parcial || dados.tipoEntrega !== undefined) r.tipoEntrega = escolha(dados.tipoEntrega || 'ficheiro', 'tipoEntrega', 'Forma de entrega', Object.keys(TIPOS_ENTREGA))
    if (!parcial || dados.maxFicheiros !== undefined) {
      const n = Number(dados.maxFicheiros ?? 1)
      if (!Number.isInteger(n) || n < 1 || n > 10) throw new ErroValidacao('Número de ficheiros de 1 a 10.', { campo: 'maxFicheiros' })
      r.maxFicheiros = n
    }
    if (!parcial || dados.grelha !== undefined) {
      let g = dados.grelha
      if (typeof g === 'string') {
        try { g = g.trim() ? JSON.parse(g) : [] } catch { throw new ErroValidacao('Grelha de avaliação inválida.', { campo: 'grelha' }) }
      }
      r.grelha = validarGrelha(g)
    }
    if (!parcial || dados.emGrupo !== undefined) r.emGrupo = dados.emGrupo === true || dados.emGrupo === 'true'
    return r
  }

  async editarTrabalho(ctx, id, dados) {
    const t = await this.academico.trabalho(id)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const mudanca = this.#dadosTrabalho(dados, true)
    if (mudanca.emGrupo !== undefined && mudanca.emGrupo !== t.emGrupo && (await this.academico.entregasDoTrabalho(t.id)).length) {
      throw new Conflito('Já há entregas: o trabalho já não passa a ser (ou deixa de ser) em grupo.')
    }
    await this.academico.atualizarTrabalho(t.id, mudanca)
    return this.academico.trabalho(t.id)
  }

  // prazo alargado só para um estudante (prazo null retira a prorrogação)
  async prorrogar(ctx, trabalhoId, { estudanteId, prazo, motivo }) {
    const t = await this.academico.trabalho(trabalhoId)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const id = Number(estudanteId)
    if (!(await this.academico.estudantesDaCadeira(cadeira)).some((e) => e.id === id)) throw new ErroValidacao('O estudante não pertence à turma.', { campo: 'estudanteId' })
    if (prazo === null) {
      await this.academico.definirProrrogacao(t.id, id, null)
      return { estudanteId: id, prorrogacao: null }
    }
    const novo = new Date(prazo)
    if (Number.isNaN(novo.getTime())) throw new ErroValidacao('Indique a nova data e hora.', { campo: 'prazo' })
    if (novo <= new Date(t.prazo)) throw new ErroValidacao('A prorrogação tem de ser depois do prazo do trabalho.', { campo: 'prazo' })
    const dados = { prazo: novo, motivo: texto(motivo, 'motivo', 'Motivo', { max: 300, obrigatorio: false }) }
    await this.academico.definirProrrogacao(t.id, id, dados)
    await this.auditoria.registar(ctx, { acao: 'prorrogar_prazo', colecao: 'trabalhos', alvoId: t.id, alvoTitulo: t.titulo, detalhes: { estudanteId: id, prazo: novo.toISOString() }, utilizador: quem(ctx.conta) })
    await this.notificacoes?.notificar([id], {
      tipo: 'trabalho', titulo: `Prazo alargado: ${t.titulo}`, texto: `${cadeira.nome}. Novo prazo: ${novo.toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}`,
      ligacao: `/cadeiras/${cadeira.id}?atividade=trabalho-${t.id}`,
    })
    return { estudanteId: id, prorrogacao: { prazo: novo.toISOString(), motivo: dados.motivo } }
  }

  async criarTrabalho(ctx, cadeiraId, dados, ficheiro) {
    let cadeira
    let campos
    try {
      cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
      campos = this.#dadosTrabalho(dados)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const secaoId = await this.apoio.secaoDaCadeira(cadeira.id, dados.secaoId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e })
    const ficheiroId = ficheiro ? await this.apoio.registarFicheiro(ficheiro, ctx.conta.id) : null
    const t = await this.academico.criarTrabalho({ cadeiraId: cadeira.id, ...campos, secaoId, ficheiroId })
    await this.apoio.avisarEstudantes(ctx, cadeira, secaoId, {
      tipo: 'trabalho', titulo: `Novo trabalho em ${cadeira.nome}: ${t.titulo}`, texto: `Prazo de entrega: ${new Date(t.prazo).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}`,
      ligacao: `/cadeiras/${cadeira.id}?atividade=trabalho-${t.id}`,
    })
    return t
  }

  async apagarTrabalho(ctx, id) {
    const t = await this.academico.trabalho(id)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    await this.academico.apagarTrabalho(t.id)
  }

  // entregas de um trabalho, incluindo quem ainda não entregou
  async entregas(ctx, trabalhoId) {
    const t = await this.academico.trabalho(trabalhoId)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const [estudantes, porEstudante, prorrogacoes, grupos] = await Promise.all([
      this.academico.estudantesDaCadeira(cadeira), this.academico.entregasPorEstudante(t.id), this.academico.prorrogacoes(t.id),
      t.emGrupo ? this.grupos.grupos(cadeira.id) : [],
    ])
    const grupoDe = Object.fromEntries(grupos.flatMap((g) => g.membros.map((m) => [m.id, { id: g.id, nome: g.nome }])))
    return {
      trabalho: t,
      linhas: estudantes.map((e) => {
        const x = porEstudante[e.id]
        const prazo = prazoDe(t, prorrogacoes[x?.estudanteId ?? e.id])
        return { estudante: e, grupo: grupoDe[e.id] || null, prorrogacao: prorrogacoes[e.id] || null, entrega: x ? { ...x, atrasada: entregaAtrasada(x.entregueEm, prazo) } : null }
      }),
    }
  }

  // correção: nota (ou pontos da grelha), comentário e, se quiser, um ficheiro corrigido para o estudante
  async corrigir(ctx, entregaId, { nota, correcao, grelha, removerFicheiro }, ficheiro) {
    let e
    let t
    let cadeira
    const dados = {}
    try {
      e = await this.academico.entrega(entregaId)
      if (!e) throw new NaoEncontrado('Entrega não encontrada.')
      t = await this.academico.trabalho(e.trabalhoId)
      cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, t.cadeiraId)
      dados.correcao = texto(correcao, 'correcao', 'Comentário de correção', { max: 5000, obrigatorio: false })
      if (grelha !== undefined && t.grelha?.length) {
        let pontos = grelha
        if (typeof pontos === 'string') {
          try { pontos = JSON.parse(pontos || '{}') } catch { throw new ErroValidacao('Pontos da grelha inválidos.', { campo: 'grelha' }) }
        }
        const r = avaliarGrelha(t.grelha, pontos)
        dados.grelha = r.pontos
        dados.nota = r.nota // a nota vem da grelha (null enquanto faltar algum critério)
      } else {
        dados.nota = validarNota(nota)
      }
    } catch (erro) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw erro
    }
    if (ficheiro) dados.correcaoFicheiroId = await this.apoio.registarFicheiro(ficheiro, ctx.conta.id)
    else if (removerFicheiro === true || removerFicheiro === 'true') dados.correcaoFicheiroId = null
    const r = await this.academico.corrigirEntrega(e.id, dados)
    await this.pautas.sincronizar(cadeira) // a nota pode contar para uma componente da pauta
    await this.notificacoes?.notificar(e.grupo ? e.grupo.membros : [e.estudanteId], {
      tipo: 'correcao', titulo: `Trabalho corrigido: ${t.titulo}`, texto: `${cadeira.nome}${r.nota !== null ? ` — nota ${r.nota} valores` : ''}`,
      ligacao: `/cadeiras/${cadeira.id}?atividade=trabalho-${t.id}`,
    })
    return r
  }
}

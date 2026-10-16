import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { comExcecao, estadoQuestionario } from '../../../dominio/academico/atividades/questionarios.js'
import { entregaAtrasada, estadoPrazo, prazoDe } from '../../../dominio/academico/atividades/trabalhos.js'
import { faseWorkshop } from '../../../dominio/academico/atividades/workshops.js'
import { notasVisiveis } from '../../../dominio/academico/avaliacao/resultado.js'

// Página inicial do portal e página de cada cadeira (vista do estudante ou do docente).
export class ServicoPainel {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async inicio(ctx) {
    const { conta } = ctx
    const cadeiras = await this.apoio.minhasCadeiras(conta)
    const ids = cadeiras.map((c) => c.id)
    const agora = this.relogio.agora()
    const hoje = agora.getDay() === 0 ? 7 : agora.getDay()
    const [prazos, avisos, horario] = await Promise.all([
      this.academico.proximosPrazos(ids, agora),
      this.academico.avisosRecentes(ids),
      this.academico.horariosDasCadeiras(ids),
    ])
    const resposta = { cadeiras, prazos, avisos, aulasHoje: horario.filter((h) => h.diaSemana === hoje) }
    if (conta.tipo === 'estudante') {
      const turmas = await this.academico.turmasAtivas(conta.id)
      resposta.avisosGerais = (await this.academico.avisosGerais(turmas)).slice(0, 5)
      const entregues = await this.academico.entregasDoEstudante(conta.id, prazos.map((p) => p.id))
      resposta.prazos = prazos.map((p) => ({ ...p, entregue: Boolean(entregues[p.id]) }))
    }
    return resposta
  }

  cadeiras(ctx) {
    return this.apoio.minhasCadeiras(ctx.conta)
  }

  async cadeira(ctx, id) {
    const { conta } = ctx
    const cadeira = await this.apoio.cadeiraAcessivel(conta, id)
    await this.registos?.registar(conta, cadeira.id, 'cadeira')
    const agora = this.relogio.agora()
    const eDocente = conta.tipo === 'docente'
    const [todosMateriais, avisos, todosTrabalhos, horario, secoes, todosQuestionarios, topicos, eventos, todosInqueritos, todosWorkshops] = await Promise.all([
      this.academico.materiais(cadeira.id),
      this.academico.avisosDaCadeira(cadeira.id),
      this.academico.trabalhos(cadeira.id),
      this.academico.horariosDasCadeiras([cadeira.id]),
      this.academico.secoes(cadeira.id),
      this.recursos.questionarios(cadeira.id, { soPublicados: !eDocente }),
      this.recursos.topicos(cadeira.id),
      this.recursos.eventosDaCadeira(cadeira.id),
      this.inqueritos.inqueritos(cadeira.id),
      this.workshops.workshops(cadeira.id),
    ])
    // estudante: o que está escondido não aparece; o que está fechado aparece com o motivo
    const acessos = eDocente ? null : (await this.disponibilidade.acessos(cadeira.id, conta.id)).acessos
    const comAcesso = (tipo) => (a) => {
      if (eDocente) return a
      const x = acessos[`${tipo}-${a.id}`]
      return { ...a, bloqueio: x && !x.aberta ? x.motivos : null }
    }
    const visivel = (tipo) => (a) => eDocente || (acessos[`${tipo}-${a.id}`] && !acessos[`${tipo}-${a.id}`].escondida)
    const materiais = todosMateriais.filter(visivel('material')).map(comAcesso('material'))
    const trabalhos = todosTrabalhos.filter(visivel('trabalho')).map(comAcesso('trabalho'))
    // com a exceção do estudante (outro fecho, mais tempo ou tentativas), se a tiver
    const excecoes = eDocente ? {} : await this.recursos.excecoesDoEstudante(conta.id, todosQuestionarios.map((q) => q.id))
    const questionarios = todosQuestionarios.filter(visivel('questionario')).map(comAcesso('questionario')).map((q) => comExcecao(q, excecoes[q.id])).map((q) => ({ ...q, estado: estadoQuestionario(q, agora) }))
    // inquéritos: sem as perguntas na lista; o estudante não vê quantos responderam
    const respondidos = eDocente ? new Set() : await this.inqueritos.respondidos(conta.id, todosInqueritos.map((i) => i.id))
    const inqueritos = todosInqueritos.filter(visivel('inquerito')).map(comAcesso('inquerito')).map(({ perguntas, respostas, ...i }) => ({
      ...i, fechado: Boolean(i.fecha && new Date(i.fecha) <= agora), numeroPerguntas: perguntas.length,
      ...(eDocente ? { respostas } : { respondido: respondidos.has(i.id) }),
    }))
    const base = {
      ...cadeira, materiais, avisos, horario, questionarios, inqueritos, eventos,
      workshops: await this.#workshopsDaVista(todosWorkshops.filter(visivel('workshop')).map(comAcesso('workshop')), conta, agora),
      secoes: (eDocente ? secoes : secoes.filter((x) => x.visivel)).map((x) => ({
        id: x.id, ordem: x.ordem, titulo: x.titulo, resumo: x.resumo, visivel: x.visivel,
        disponivelDe: x.disponivelDe ? new Date(x.disponivelDe).toISOString() : null, fechado: Boolean(x.disponivelDe && new Date(x.disponivelDe) > agora),
      })),
      forum: { topicos: topicos.length, recentes: topicos.slice(0, 3).map((t) => ({ id: t.id, titulo: t.titulo, autor: t.autor.nome, atividadeEm: t.atividadeEm })) },
    }

    if (eDocente) {
      const estudantes = await this.academico.estudantesDaCadeira(cadeira)
      const comEntregas = await Promise.all(trabalhos.map(async (t) => ({
        ...t, estado: estadoPrazo(t.prazo, agora, t.aceitaAtraso), entregas: (await this.academico.entregasDoTrabalho(t.id)).length,
      })))
      return { ...base, trabalhos: comEntregas, estudantes }
    }

    // estudante: as suas notas publicadas, as suas entregas e presenças
    const minhasNotas = await this.academico.notasDoEstudante(conta.id, [cadeira.id])
    const minhasEntregas = await this.academico.entregasDoEstudante(conta.id, trabalhos.map((t) => t.id))
    const minhasProrrogacoes = await this.academico.prorrogacoesDoEstudante(conta.id, trabalhos.map((t) => t.id))
    const presencas = (await this.academico.presencasDoEstudante(conta.id, [cadeira.id])).sort((a, b) => b.data.localeCompare(a.data))
    return {
      ...base,
      trabalhos: trabalhos.map((t) => {
        const e = minhasEntregas[t.id]
        const prazo = prazoDe(t, minhasProrrogacoes[t.id])
        return {
          ...t, prazo, prazoOriginal: t.prazo, prorrogado: Boolean(minhasProrrogacoes[t.id]), estado: estadoPrazo(prazo, agora, t.aceitaAtraso),
          entrega: e ? {
            entregueEm: e.entregueEm, atrasada: entregaAtrasada(e.entregueEm, prazo), ficheiros: e.ficheiros, texto: e.texto, comentario: e.comentario,
            nota: e.nota, correcao: e.correcao, correcaoFicheiroId: e.correcaoFicheiroId, grelha: e.grelha, corrigidaEm: e.corrigidaEm,
          } : null,
        }
      }),
      meuGrupo: await this.grupos.grupoDe(cadeira.id, conta.id),
      notas: notasVisiveis(minhasNotas[cadeira.id], cadeira.notasPublicadas),
      presencas,
      assiduidade: assiduidade(presencas),
    }
  }

  // workshops na página da cadeira: a fase e, para o estudante, se já entregou
  async #workshopsDaVista(lista, conta, agora) {
    const minhas = conta.tipo === 'estudante' ? await this.workshops.estadoDoEstudante(conta.id, lista.map((w) => w.id)) : {}
    return lista.map((w) => ({ ...w, fase: faseWorkshop(w, agora), ...(conta.tipo === 'estudante' ? { entregue: Boolean(minhas[w.id]) } : {}) }))
  }
}

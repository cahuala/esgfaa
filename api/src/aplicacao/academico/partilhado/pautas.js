import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { notaDosPares } from '../../../dominio/academico/atividades/workshops.js'
import { notaComposta, validarComposicao } from '../../../dominio/academico/avaliacao/composicao.js'
import { validarNota } from '../../../dominio/academico/avaliacao/nota.js'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, resultadoDisciplina } from '../../../dominio/academico/avaliacao/resultado.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'

/*
  Pauta de uma cadeira (1.ª e 2.ª prova, exame, recurso), partilhada pelo portal (docentes alocados)
  e pelo painel (Repartição de Administração Escolar). Quem chama já confirmou o acesso à cadeira;
  "utilizador" é quem fica no registo de atividades (undefined = o utilizador do painel).
*/
export class ServicoPautas {
  constructor({ academico, recursos, workshops, auditoria, notificacoes, relogio }) {
    Object.assign(this, { academico, recursos, workshops, auditoria, notificacoes, relogio })
  }

  // ---------- componentes calculadas a partir das atividades ----------

  /*
    Notas de cada atividade por estudante: { "trabalho-3": { estudanteId: nota | null } }.
    Trabalho: nota da correção; sem entrega depois do prazo (e sem aceitar atrasos) conta 0.
    Questionário: a melhor tentativa entregue; sem tentativas depois de fechar conta 0.
  */
  async #notasDasAtividades(cadeira, estudantes, itens) {
    const agora = this.relogio.agora()
    const notas = {}
    for (const i of itens) {
      const chave = `${i.tipo}-${i.id}`
      notas[chave] = {}
      if (i.tipo === 'trabalho') {
        const t = await this.academico.trabalho(i.id)
        if (!t || t.cadeiraId !== cadeira.id) continue
        const entregas = await this.academico.entregasPorEstudante(t.id) // a do grupo vale para todos
        const prorrogacoes = await this.academico.prorrogacoes(t.id)
        // cada estudante tem o seu prazo (pode ter uma prorrogação)
        const fechado = (e) => new Date(prorrogacoes[e]?.prazo || t.prazo) < agora && !t.aceitaAtraso
        for (const e of estudantes) notas[chave][e] = entregas[e] ? entregas[e].nota : fechado(e) ? 0 : null
      } else if (i.tipo === 'workshop') {
        const w = this.workshops && await this.workshops.workshop(i.id)
        if (!w || w.cadeiraId !== cadeira.id) continue
        const porAutor = Object.fromEntries((await this.workshops.submissoes(w.id)).map((s) => [s.estudanteId, s]))
        const encerrado = new Date(w.fimAvaliacao) <= agora
        // nota do docente ou média dos pares, só no fim; quem não entregou fica com 0
        for (const e of estudantes) {
          const s = porAutor[e]
          notas[chave][e] = !encerrado ? null : !s ? 0 : s.notaFinal ?? notaDosPares(s.avaliacoes)
        }
      } else {
        const q = await this.recursos.questionario(i.id)
        if (!q || q.cadeiraId !== cadeira.id) continue
        const melhor = {}
        for (const t of await this.recursos.tentativas(q.id)) if (t.entregueEm && t.nota !== null) melhor[t.estudanteId] = Math.max(melhor[t.estudanteId] ?? 0, t.nota)
        const fechado = q.fecha && new Date(q.fecha) < agora
        // tentativa entregue mas com dissertações por corrigir: ainda sem nota
        const pendentes = new Set((await this.recursos.tentativas(q.id)).filter((t) => t.entregueEm && t.porCorrigir).map((t) => t.estudanteId))
        for (const e of estudantes) notas[chave][e] = melhor[e] ?? (pendentes.has(e) ? null : fechado ? 0 : null)
      }
    }
    return notas
  }

  // recalcula e grava na pauta as componentes calculadas (chamado ao abrir a pauta e quando chegam notas novas)
  async sincronizar(cadeira) {
    const composicoes = await this.academico.composicoes(cadeira.id)
    if (!Object.keys(composicoes).length) return composicoes
    const estudantes = (await this.academico.estudantesDaPautaDaCadeira(cadeira)).map((e) => e.id)
    for (const [componente, itens] of Object.entries(composicoes)) {
      const porAtividade = await this.#notasDasAtividades(cadeira, estudantes, itens)
      const valores = Object.fromEntries(estudantes.map((e) => [e, notaComposta(itens, Object.fromEntries(itens.map((i) => [`${i.tipo}-${i.id}`, porAtividade[`${i.tipo}-${i.id}`]?.[e] ?? null])))]))
      await this.academico.gravarComponente(cadeira.id, componente, valores)
    }
    return composicoes
  }

  // define (ou retira, com itens = null) a composição de uma componente
  async definirComposicao(ctx, cadeira, componente, itens, utilizador) {
    if (!COMPONENTES_NOTA.includes(componente)) throw new ErroValidacao('Componente de avaliação desconhecida.')
    let limpos = null
    if (itens) {
      limpos = validarComposicao(itens)
      const [trabalhos, questionarios, workshops] = await Promise.all([this.academico.trabalhos(cadeira.id), this.recursos.questionarios(cadeira.id), this.workshops ? this.workshops.workshops(cadeira.id) : []])
      const daCadeira = new Set([...trabalhos.map((t) => `trabalho-${t.id}`), ...questionarios.map((q) => `questionario-${q.id}`), ...workshops.map((w) => `workshop-${w.id}`)])
      if (limpos.some((i) => !daCadeira.has(`${i.tipo}-${i.id}`))) throw new ErroValidacao('Só pode usar trabalhos, questionários e avaliações por pares desta cadeira.')
    }
    await this.academico.guardarComposicao(cadeira.id, componente, limpos)
    await this.auditoria.registar(ctx, { acao: 'composicao_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${NOMES_COMPONENTES[componente]} — ${cadeira.nome}`, detalhes: { itens: limpos }, utilizador })
    return this.pauta(cadeira)
  }

  // matriz: estudantes × componentes, com MAC, nota final, situação e classificação
  async pauta(cadeira) {
    const composicoes = await this.sincronizar(cadeira)
    const [trabalhos, questionarios] = await Promise.all([this.academico.trabalhos(cadeira.id), this.recursos.questionarios(cadeira.id)])
    const workshops = this.workshops ? await this.workshops.workshops(cadeira.id) : []
    const atividades = [
      ...trabalhos.map((t) => ({ tipo: 'trabalho', id: t.id, titulo: t.titulo })),
      ...questionarios.map((q) => ({ tipo: 'questionario', id: q.id, titulo: q.titulo })),
      ...workshops.map((w) => ({ tipo: 'workshop', id: w.id, titulo: w.titulo })),
    ]
    const [estudantes, notas] = await Promise.all([
      this.academico.estudantesDaPautaDaCadeira(cadeira),
      this.academico.pautaDaCadeira(cadeira.id),
    ])
    return {
      cadeira, publicadas: cadeira.notasPublicadas, composicoes, atividades,
      linhas: estudantes.map((e) => {
        const n = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, notas[e.id]?.[k] ?? null]))
        return { estudante: e, ...n, observacao: notas[e.id]?.observacao || '', ...resultadoDisciplina(n) }
      }),
    }
  }

  async gravar(ctx, cadeira, linhas, utilizador) {
    const validos = new Set((await this.academico.estudantesDaPautaDaCadeira(cadeira)).map((e) => e.id))
    const vistos = new Set()
    const notas = linhas.map((l) => {
      const estudanteId = Number(l.estudanteId)
      if (!validos.has(estudanteId)) throw new ErroValidacao('A pauta tem um estudante que não pertence à turma.')
      if (vistos.has(estudanteId)) throw new ErroValidacao('A pauta tem o mesmo estudante repetido.')
      vistos.add(estudanteId)
      const linha = { estudanteId, observacao: texto(l.observacao, 'observacao', 'Observação', { max: 300, obrigatorio: false }) }
      for (const k of COMPONENTES_NOTA) {
        try {
          linha[k] = validarNota(l[k])
        } catch {
          throw new ErroValidacao(`${NOMES_COMPONENTES[k]}: a nota deve estar entre 0 e 20.`, { campo: k })
        }
      }
      return linha
    })
    // as componentes calculadas não se escrevem à mão: ficam com o valor das atividades
    const calculadas = Object.keys(await this.academico.composicoes(cadeira.id))
    const atuais = await this.academico.pautaDaCadeira(cadeira.id)
    for (const l of notas) for (const k of calculadas) l[k] = atuais[l.estudanteId]?.[k] ?? null
    await this.academico.gravarPauta(cadeira.id, notas)
    await this.auditoria.registar(ctx, { acao: 'lancar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: cadeira.nome, detalhes: { estudantes: notas.length }, utilizador })
    return this.pauta(await this.academico.cadeira(cadeira.id))
  }

  // escolhe que componentes os estudantes já podem ver
  async publicar(ctx, cadeira, componentes, utilizador) {
    const lista = [...new Set(componentes)]
    if (lista.some((k) => !COMPONENTES_NOTA.includes(k))) throw new ErroValidacao('Componente de avaliação desconhecida.')
    const ordenada = COMPONENTES_NOTA.filter((k) => lista.includes(k))
    await this.academico.publicarNotas(cadeira.id, ordenada)
    const novas = ordenada.filter((k) => !cadeira.notasPublicadas.includes(k))
    if (novas.length) {
      const quais = novas.map((k) => NOMES_COMPONENTES[k]).join(', ')
      await this.auditoria.registar(ctx, { acao: 'publicar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${quais} — ${cadeira.nome}`, utilizador })
      await this.notificacoes?.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), {
        tipo: 'notas', titulo: `Notas publicadas: ${quais}`, texto: cadeira.nome, ligacao: '/notas',
      })
    }
    return this.pauta(await this.academico.cadeira(cadeira.id))
  }
}

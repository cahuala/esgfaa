import { ErroValidacao } from '../dominio/comum/erros.js'
import { COMPONENTES_NOTA, NOMES_COMPONENTES, notaComposta, resultadoDisciplina, texto, validarComposicao, validarNota } from '../dominio/academico/regras.js'

/*
  Pauta de uma cadeira (1.ª e 2.ª prova, exame, recurso), partilhada pelo portal (docentes alocados)
  e pelo painel (Repartição de Administração Escolar). Quem chama já confirmou o acesso à cadeira;
  "utilizador" é quem fica no registo de atividades (undefined = o utilizador do painel).
*/
export class ServicoPautas {
  constructor({ academico, recursos, auditoria, notificacoes, relogio }) {
    Object.assign(this, { academico, recursos, auditoria, notificacoes, relogio })
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
        const entregas = Object.fromEntries((await this.academico.entregasDoTrabalho(t.id)).map((e) => [e.estudanteId, e]))
        const fechado = new Date(t.prazo) < agora && !t.aceitaAtraso
        for (const e of estudantes) notas[chave][e] = entregas[e] ? entregas[e].nota : fechado ? 0 : null
      } else {
        const q = await this.recursos.questionario(i.id)
        if (!q || q.cadeiraId !== cadeira.id) continue
        const melhor = {}
        for (const t of await this.recursos.tentativas(q.id)) if (t.entregueEm) melhor[t.estudanteId] = Math.max(melhor[t.estudanteId] ?? 0, t.nota)
        const fechado = q.fecha && new Date(q.fecha) < agora
        for (const e of estudantes) notas[chave][e] = melhor[e] ?? (fechado ? 0 : null)
      }
    }
    return notas
  }

  // recalcula e grava na pauta as componentes calculadas (chamado ao abrir a pauta e quando chegam notas novas)
  async sincronizar(cadeira) {
    const composicoes = await this.academico.composicoes(cadeira.id)
    if (!Object.keys(composicoes).length) return composicoes
    const estudantes = (await this.academico.estudantesDaPauta(cadeira.turmaId)).map((e) => e.id)
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
      const [trabalhos, questionarios] = await Promise.all([this.academico.trabalhos(cadeira.id), this.recursos.questionarios(cadeira.id)])
      const daCadeira = new Set([...trabalhos.map((t) => `trabalho-${t.id}`), ...questionarios.map((q) => `questionario-${q.id}`)])
      if (limpos.some((i) => !daCadeira.has(`${i.tipo}-${i.id}`))) throw new ErroValidacao('Só pode usar trabalhos e questionários desta cadeira.')
    }
    await this.academico.guardarComposicao(cadeira.id, componente, limpos)
    await this.auditoria.registar(ctx, { acao: 'composicao_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${NOMES_COMPONENTES[componente]} — ${cadeira.nome}`, detalhes: { itens: limpos }, utilizador })
    return this.pauta(cadeira)
  }

  // matriz: estudantes × componentes, com MAC, nota final, situação e classificação
  async pauta(cadeira) {
    const composicoes = await this.sincronizar(cadeira)
    const [trabalhos, questionarios] = await Promise.all([this.academico.trabalhos(cadeira.id), this.recursos.questionarios(cadeira.id)])
    const atividades = [
      ...trabalhos.map((t) => ({ tipo: 'trabalho', id: t.id, titulo: t.titulo })),
      ...questionarios.map((q) => ({ tipo: 'questionario', id: q.id, titulo: q.titulo })),
    ]
    const [estudantes, notas] = await Promise.all([
      this.academico.estudantesDaPauta(cadeira.turmaId),
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
    const validos = new Set((await this.academico.estudantesDaPauta(cadeira.turmaId)).map((e) => e.id))
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

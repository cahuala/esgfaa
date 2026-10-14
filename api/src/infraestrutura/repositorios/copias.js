/*
  Cópia dos conteúdos de uma cadeira para outra (novo ano letivo, como o "Importar" do Moodle):
  capítulos, materiais, trabalhos, questionários com perguntas, datas, programa, composição das
  notas e, se se pedir, a alocação de docentes. Não copia entregas, tentativas, notas, fórum nem presenças.
*/
export class RepositorioCopias {
  constructor({ prisma }) {
    this.prisma = prisma
  }

  async conteudoDe(cadeiraId) {
    const p = this.prisma
    const [cadeira, secoes, materiais, trabalhos, questionarios, eventos, composicoes, docencias] = await Promise.all([
      p.unidadeCurricular.findUnique({ where: { id: cadeiraId } }),
      p.secaoCadeira.findMany({ where: { cadeiraId }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] }),
      p.material.findMany({ where: { cadeiraId }, orderBy: { id: 'asc' } }),
      p.trabalho.findMany({ where: { cadeiraId }, orderBy: { id: 'asc' } }),
      p.questionario.findMany({ where: { cadeiraId }, orderBy: { id: 'asc' }, include: { perguntas: { orderBy: [{ ordem: 'asc' }, { id: 'asc' }] } } }),
      p.eventoAcademico.findMany({ where: { cadeiraId } }),
      p.composicaoNota.findMany({ where: { cadeiraId } }),
      p.docencia.findMany({ where: { cadeiraId } }),
    ])
    const idsFicheiros = [...new Set([...materiais.map((m) => m.ficheiroId), ...trabalhos.map((t) => t.ficheiroId), cadeira?.programaFicheiroId].filter(Boolean))]
    const ficheiros = await p.ficheiro.findMany({ where: { id: { in: idsFicheiros } } })
    return { cadeira, secoes, materiais, trabalhos, questionarios, eventos, composicoes, docencias, ficheiros }
  }

  // a cadeira de destino já tem conteúdos? (para não duplicar ao copiar uma turma inteira)
  async temConteudos(cadeiraId) {
    const p = this.prisma
    const [s, m, t, q] = await Promise.all([
      p.secaoCadeira.count({ where: { cadeiraId } }), p.material.count({ where: { cadeiraId } }),
      p.trabalho.count({ where: { cadeiraId } }), p.questionario.count({ where: { cadeiraId } }),
    ])
    return s + m + t + q > 0
  }

  /*
    Aplica a cópia numa transação. c: conteúdo da origem; ficheiros: { idAntigo: idNovo };
    data(d) e dia(s) deslocam as datas; docentes: copiar também a alocação.
  */
  async aplicar(destinoId, c, { ficheiros, data, dia, docentes }) {
    return this.prisma.$transaction(async (tx) => {
      const destino = await tx.unidadeCurricular.findUnique({ where: { id: destinoId } })
      const ordemBase = (await tx.secaoCadeira.aggregate({ where: { cadeiraId: destinoId }, _max: { ordem: true } }))._max.ordem ?? 0
      const secoes = {}
      for (const s of c.secoes) {
        secoes[s.id] = (await tx.secaoCadeira.create({ data: { cadeiraId: destinoId, ordem: ordemBase + s.ordem, titulo: s.titulo, resumo: s.resumo, visivel: s.visivel, disponivelDe: s.disponivelDe ? data(s.disponivelDe) : null } })).id
      }
      const secao = (id) => (id ? secoes[id] ?? null : null)
      // restrições: visibilidade e data copiam-se já; as condições remapeiam-se no fim
      const restricoes = (a) => ({ visivel: a.visivel, disponivelDe: a.disponivelDe ? data(a.disponivelDe) : null })
      const materiais = {}
      for (const m of c.materiais) {
        materiais[m.id] = (await tx.material.create({ data: {
          ...restricoes(m),
          cadeiraId: destinoId, secaoId: secao(m.secaoId), titulo: m.titulo, descricao: m.descricao, tipo: m.tipo,
          ficheiroId: m.ficheiroId ? ficheiros[m.ficheiroId] ?? null : null, url: m.url, autorId: m.autorId,
        } })).id
      }
      const trabalhos = {}
      for (const t of c.trabalhos) {
        trabalhos[t.id] = (await tx.trabalho.create({ data: {
          ...restricoes(t), cadeiraId: destinoId, secaoId: secao(t.secaoId), titulo: t.titulo, enunciado: t.enunciado, prazo: data(t.prazo),
          aceitaAtraso: t.aceitaAtraso, ficheiroId: t.ficheiroId ? ficheiros[t.ficheiroId] ?? null : null,
          tipoEntrega: t.tipoEntrega, maxFicheiros: t.maxFicheiros, grelha: t.grelha,
        } })).id
      }
      const questionarios = {}
      for (const q of c.questionarios) {
        const novo = await tx.questionario.create({ data: {
          ...restricoes(q), cadeiraId: destinoId, secaoId: secao(q.secaoId), titulo: q.titulo, descricao: q.descricao,
          abre: q.abre ? data(q.abre) : null, fecha: q.fecha ? data(q.fecha) : null, duracao: q.duracao, tentativas: q.tentativas,
          publicado: q.publicado, mostrarRespostas: q.mostrarRespostas, baralhar: q.baralhar, perguntasPorTentativa: q.perguntasPorTentativa,
        } })
        questionarios[q.id] = novo.id
        if (q.perguntas.length) {
          await tx.pergunta.createMany({ data: q.perguntas.map((x) => ({ questionarioId: novo.id, ordem: x.ordem, enunciado: x.enunciado, tipo: x.tipo, opcoes: x.opcoes, pontos: x.pontos })) })
        }
      }
      // condições de acesso, agora com as atividades novas
      const novoId = { material: materiais, trabalho: trabalhos, questionario: questionarios }
      const remapear = (lista) => (lista || []).map((r) => ({ ...r, id: novoId[r.tipo]?.[r.id] })).filter((r) => r.id)
      for (const [tipo, origem, modelo] of [['material', c.materiais, tx.material], ['trabalho', c.trabalhos, tx.trabalho], ['questionario', c.questionarios, tx.questionario]]) {
        for (const a of origem) if (a.requisitos?.length) await modelo.update({ where: { id: novoId[tipo][a.id] }, data: { requisitos: remapear(a.requisitos) } })
      }
      for (const e of c.eventos) {
        await tx.eventoAcademico.create({ data: { cadeiraId: destinoId, tipo: e.tipo, titulo: e.titulo, data: dia(e.data), inicio: e.inicio, fim: e.fim, local: e.local, descricao: e.descricao } })
      }
      // programa: só se o destino ainda não tiver
      const programa = {}
      if (!destino.programa && c.cadeira.programa) programa.programa = c.cadeira.programa
      if (!destino.programaFicheiroId && c.cadeira.programaFicheiroId) programa.programaFicheiroId = ficheiros[c.cadeira.programaFicheiroId] ?? null
      if (Object.keys(programa).length) await tx.unidadeCurricular.update({ where: { id: destinoId }, data: programa })
      // composição das notas, com as atividades novas
      for (const comp of c.composicoes) {
        const itens = comp.itens
          .map((i) => ({ ...i, id: (i.tipo === 'trabalho' ? trabalhos : questionarios)[i.id] }))
          .filter((i) => i.id)
        if (itens.length) {
          await tx.composicaoNota.upsert({
            where: { cadeiraId_componente: { cadeiraId: destinoId, componente: comp.componente } },
            create: { cadeiraId: destinoId, componente: comp.componente, itens }, update: { itens },
          })
        }
      }
      let docentesCopiados = 0
      if (docentes && !(await tx.docencia.count({ where: { cadeiraId: destinoId } }))) {
        const r = await tx.docencia.createMany({ data: c.docencias.map((d) => ({ cadeiraId: destinoId, docenteId: d.docenteId, papel: d.papel, horas: d.horas })) })
        docentesCopiados = r.count
      }
      return {
        capitulos: c.secoes.length, materiais: c.materiais.length, trabalhos: c.trabalhos.length,
        questionarios: c.questionarios.length, datas: c.eventos.length, docentes: docentesCopiados,
      }
    }, { timeout: 30_000 })
  }
}

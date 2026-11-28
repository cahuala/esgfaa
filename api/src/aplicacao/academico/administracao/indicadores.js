import { assiduidade } from '../../../dominio/academico/atividades/presencas.js'
import { media, motivosDeRisco, pautasEmAtraso, taxaAprovacao } from '../../../dominio/academico/acompanhamento/indicadores.js'

import { NOTA_MINIMA_APROVACAO } from '../../../dominio/academico/avaliacao/nota.js'

const DIA = 86_400_000
const sem = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const CHAVE_DIRECTORES = 'directores-de-curso'

/*
  O TII atrasado (alertas precoces): ainda sem tema ou orientador 90 dias depois do início do ano; sem data de defesa
  a 45 dias do fim; defendido e ainda sem nota. tfc: { tema, orientador, dataDefesa, nota } ou nada.
*/
export function motivosDoTii(tfc, { inicio, fim, agora }) {
  const m = []
  if (inicio && agora - inicio > 90 * DIA && (!tfc || !tfc.tema || !tfc.orientador)) m.push({ tipo: 'tii', texto: !tfc || !tfc.tema ? 'TII ainda sem tema' : 'TII ainda sem orientador' })
  const semNota = !tfc || tfc.nota === null || tfc.nota === undefined
  if (tfc?.tema && semNota && !tfc.dataDefesa && fim && fim - agora < 45 * DIA) m.push({ tipo: 'tii', texto: 'TII sem data de defesa' })
  if (tfc?.dataDefesa && semNota && new Date(`${tfc.dataDefesa}T23:59:59Z`) < agora) m.push({ tipo: 'tii', texto: 'TII defendido e sem nota lançada' })
  return m
}

/*
  Painel de indicadores da Administração Escolar: por turma e por cadeira (aprovação, médias,
  assiduidade), estudantes em risco (faltas, negativas — também os TAI e TAG das cadeiras da ESG —, TII atrasado,
  sem acesso) e pautas por lançar. Cada caso leva o curso e o seu Director de Curso: quem é Director vê logo os
  dos seus cursos (no painel e aqui). evolucao: os indicadores ao longo dos anos.
*/
export class ServicoIndicadores {
  constructor({ academico, recursos, pautas, relogio, conclusao = null, prisma = null, paginas = null, documentos = null }) {
    Object.assign(this, { academico, recursos, pautas, relogio, conclusao, prisma, paginas, documentos })
    this.cache = new Map()
  }

  // os cursos de que quem vê é Director de Curso
  async #meusCursos(ctx) {
    const d = (await this.paginas?.ler(CHAVE_DIRECTORES).catch(() => null)) ?? {}
    return Object.entries(d).filter(([, x]) => x?.utilizadorId && x.utilizadorId === ctx.actor.id).map(([c]) => c)
  }

  // guarda o resultado uns minutos (as contas lêem as pautas todas)
  async #guardado(chave, minutos, fazer) {
    const x = this.cache.get(chave)
    if (x && x.ate > Date.now()) return x.valor
    const valor = await fazer()
    this.cache.set(chave, { valor, ate: Date.now() + minutos * 60_000 })
    return valor
  }

  // os alertas precoces para o painel: os discentes em risco (os dos cursos de quem é Director, se o for)
  async alertas(ctx, { anoLetivo } = {}) {
    ctx.actor.exigir('academico.ver')
    const meus = await this.#meusCursos(ctx)
    const d = await this.#guardado(`ind-${anoLetivo ?? ''}`, 10, () => this.#calcular({ anoLetivo }))
    // no painel só o risco académico (faltas, negativas, recurso, TII); a falta de acesso ao portal vê-se nos indicadores
    const risco = (meus.length ? d.risco.filter((r) => meus.includes(r.curso)) : d.risco).filter((r) => r.motivos.some((m) => m.tipo !== 'acesso'))
    const porTipo = {}
    for (const r of risco) for (const t of new Set(r.motivos.map((m) => m.tipo))) porTipo[t] = (porTipo[t] ?? 0) + 1
    return { anoLetivo: d.anoLetivo, meusCursos: meus, emRisco: risco.length, porTipo }
  }

  async indicadores(ctx, { anoLetivo } = {}) {
    ctx.actor.exigir('academico.ver')
    const d = await this.#calcular({ anoLetivo })
    this.cache.set(`ind-${anoLetivo ?? ''}`, { valor: d, ate: Date.now() + 10 * 60_000 })
    return { ...d, meusCursos: await this.#meusCursos(ctx) }
  }

  async #calcular({ anoLetivo } = {}) {
    const agora = this.relogio.agora()
    const todas = await this.academico.listarTurmas()
    const activas = todas.filter((t) => t.ativa !== false)
    const anos = [...new Set(todas.map((t) => t.anoLetivo))].sort().reverse()
    // o ano pedido (também os que já passaram: contam todas as turmas desse ano); sem ele, o das turmas activas
    const ano = anoLetivo && anos.includes(anoLetivo) ? anoLetivo : activas[0]?.anoLetivo ?? anos[0]
    const turmas = todas.filter((t) => t.anoLetivo === ano)
    const dadosAno = this.prisma ? await this.prisma.anoLetivo.findUnique({ where: { id: ano ?? '' } }).catch(() => null) : null
    // num ano fechado o que falta já não se recupera: não há alertas de acesso nem do TII
    const aberto = !dadosAno?.fechado
    const directores = (await this.paginas?.ler(CHAVE_DIRECTORES).catch(() => null)) ?? {}

    const linhasTurmas = []
    const linhasCadeiras = []
    const risco = []
    const atrasos = []
    for (const t of turmas) {
      const [estudantes, cadeiras] = await Promise.all([aberto ? this.academico.estudantesAtivosDaTurma(t.id) : this.academico.estudantesDaTurmaParaListas(t.id), this.academico.cadeirasDasTurmas([t.id])])
      const ids = estudantes.map((e) => e.id)
      const [presencas, acessos] = await Promise.all([this.academico.presencasDasCadeiras(cadeiras.map((c) => c.id)), this.academico.ultimosAcessos(ids)])
      const porEstudante = Object.fromEntries(ids.map((id) => [id, { assiduidades: [], notas: [], extra: [] }]))
      const todasLinhas = []
      for (const c of cadeiras) {
        const [pauta, eventos] = await Promise.all([this.pautas.pauta(c), this.recursos.eventosDaCadeira(c.id)])
        const linhas = pauta.linhas.filter((l) => porEstudante[l.estudante.id])
        todasLinhas.push(...linhas)
        const assid = []
        for (const id of ids) {
          const a = assiduidade(presencas.filter((p) => p.cadeiraId === c.id && p.estudanteId === id))
          if (a !== null) assid.push(a)
          porEstudante[id].assiduidades.push({ cadeira: c.codigo, valor: a })
        }
        for (const l of linhas) porEstudante[l.estudante.id].notas.push({ cadeira: c.codigo, ...l })
        // cadeiras da ESG: as provas do plano (TAI, TAG) com nota negativa e sem recuperação positiva
        if (pauta.modo === 'esg') {
          for (const l of linhas) {
            const negativas = (pauta.avaliacoes ?? []).filter((a) => {
              const n = l.notas?.[a.id] ?? {}
              return n.nota !== null && n.nota !== undefined && Number(n.nota) < NOTA_MINIMA_APROVACAO && !(Number(n.recuperacao) >= NOTA_MINIMA_APROVACAO)
            })
            if (negativas.length && l.situacao !== 'reprovado') porEstudante[l.estudante.id].extra.push({ tipo: 'nota', cadeira: c.codigo, texto: `Negativa no ${negativas.map((a) => `${a.tipo} ${a.titulo} (${Number(l.notas[a.id].nota)})`).join(', ')}` })
          }
        }
        const contar = (s) => linhas.filter((l) => l.situacao === s).length
        linhasCadeiras.push({
          id: c.id, codigo: c.codigo, nome: c.nome, turma: t.nome, turmaId: t.id,
          docentes: c.docentes.map((d) => d.nome), semDocente: c.docentes.length === 0,
          estudantes: linhas.length, aprovados: contar('aprovado') + contar('dispensado'), reprovados: contar('reprovado'),
          exame: contar('exame'), recurso: contar('recurso'), emCurso: contar('em_curso'), excluidos: contar('excluido'),
          taxaAprovacao: taxaAprovacao(linhas), media: media(linhas.map((l) => l.final)), assiduidade: media(assid),
        })
        for (const a of pautasEmAtraso(eventos, linhas, agora)) {
          atrasos.push({ ...a, cadeira: { id: c.id, codigo: c.codigo, nome: c.nome }, turma: t.nome, docentes: c.docentes.map((d) => d.nome) })
        }
      }
      // o TII de cada discente (só nas turmas com a cadeira do TII)
      const temTii = cadeiras.some((c) => c.tii)
      const tfcs = temTii && aberto && this.conclusao ? new Map((await this.conclusao.tfcsDaTurma(t.id).catch(() => [])).map((x) => [x.estudanteId, x])) : null
      const director = directores[t.curso]?.utilizadorId ?? null
      let emRisco = 0
      for (const e of estudantes) {
        const base = motivosDeRisco({ ...porEstudante[e.id], ultimoAcesso: acessos[e.id], agora }).filter((m) => aberto || m.tipo !== 'acesso')
        const motivos = [...base, ...porEstudante[e.id].extra, ...(tfcs ? motivosDoTii(tfcs.get(e.id), { inicio: dadosAno?.inicio ?? null, fim: dadosAno?.fim ?? null, agora }) : [])]
        if (motivos.length) {
          emRisco += 1
          risco.push({ estudante: e, turma: { id: t.id, nome: t.nome }, curso: t.curso, director, motivos })
        }
      }
      const doAno = linhasCadeiras.filter((c) => c.turmaId === t.id)
      linhasTurmas.push({
        id: t.id, nome: t.nome, curso: t.curso, anoCurricular: t.anoCurricular, estudantes: estudantes.length, cadeiras: cadeiras.length, emRisco,
        taxaAprovacao: taxaAprovacao(todasLinhas), media: media(todasLinhas.map((l) => l.final)), assiduidade: media(doAno.map((c) => c.assiduidade)),
      })
    }
    // os casos mais graves primeiro
    risco.sort((a, b) => b.motivos.length - a.motivos.length || a.estudante.nome.localeCompare(b.estudante.nome, 'pt'))
    atrasos.sort((a, b) => b.diasAtraso - a.diasAtraso)
    const estudantes = linhasTurmas.reduce((s, t) => s + t.estudantes, 0)
    return {
      anoLetivo: ano, anos,
      geral: {
        turmas: linhasTurmas.length, estudantes, cadeiras: linhasCadeiras.length,
        cadeirasSemDocente: linhasCadeiras.filter((c) => c.semDocente).length, emRisco: risco.length, pautasEmAtraso: atrasos.length,
        taxaAprovacao: media(linhasCadeiras.map((c) => c.taxaAprovacao)), assiduidade: media(linhasCadeiras.map((c) => c.assiduidade)),
      },
      turmas: linhasTurmas, cadeiras: linhasCadeiras, risco, atrasos,
    }
  }

  /*
    Os indicadores ao longo dos anos (a partir das pautas finais de cada turma): por curso e por Ramo os
    discentes, os que terminaram com aproveitamento (média final ≥ 10 e não reprovados) e a média; por cadeira a
    média e as negativas; por docente as horas e as cadeiras de cada ano. Guarda-se meia hora (lê todas as pautas).
  */
  async evolucao(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.#guardado('evolucao', 30, () => this.#evolucao(ctx))
  }

  async #evolucao(ctx) {
    const turmas = await this.academico.listarTurmas()
    const anos = [...new Set(turmas.map((t) => t.anoLetivo))].sort()
    const cursos = new Map()
    const ramos = new Map()
    const cadeiras = new Map()
    const juntar = (mapa, chave, nome, ano) => {
      const x = mapa.get(chave) ?? { chave, nome, porAno: {} }
      mapa.set(chave, x)
      return (x.porAno[ano] ??= { discentes: 0, comFinal: 0, aprovados: 0, soma: 0 })
    }
    for (const t of turmas) {
      const pf = await this.documentos?.pautaFinal(ctx, t.id).catch(() => null)
      if (!pf) continue
      for (const l of pf.linhas) {
        const fim = l.final === null || l.final === undefined ? null : Number(l.final)
        const ok = fim !== null && fim >= NOTA_MINIMA_APROVACAO && l.mencao !== 'Reprovado'
        const ramo = l.estudante.ramo || 'Outros'
        for (const a of [juntar(cursos, t.curso, pf.turma.curso || t.curso, t.anoLetivo), juntar(ramos, ramo, ramo, t.anoLetivo)]) {
          a.discentes++
          if (fim !== null) { a.comFinal++; a.soma += fim }
          if (ok) a.aprovados++
        }
        for (const b of pf.blocos) {
          for (const u of b.ucs) {
            const v = l.ucs[u.codigo]
            if (v === null || v === undefined || Number(v) <= 0) continue
            const a = juntar(cadeiras, sem(u.nome), u.nome, t.anoLetivo)
            a.discentes++; a.comFinal++; a.soma += Number(v)
            if (Number(v) >= NOTA_MINIMA_APROVACAO) a.aprovados++
          }
        }
      }
    }
    // a carga dos docentes: as horas das cadeiras em que estão, por ano lectivo
    const docentes = new Map()
    for (const c of await this.academico.todasCadeiras()) {
      const ano = c.turma?.anoLetivo
      if (!ano) continue
      for (const d of [...(c.docentes ?? []), ...(c.docentesPropostos ?? [])]) {
        const x = docentes.get(d.id) ?? { chave: d.id, nome: d.nome, porAno: {} }
        docentes.set(d.id, x)
        const a = (x.porAno[ano] ??= { horas: 0, cadeiras: 0 })
        a.horas += Number(d.horas) || 0
        a.cadeiras++
      }
    }
    const fechar = (mapa) => [...mapa.values()].map((x) => ({ ...x, porAno: Object.fromEntries(Object.entries(x.porAno).map(([ano, a]) => [ano, { discentes: a.discentes, aprovados: a.aprovados, media: a.comFinal ? Math.round((a.soma / a.comFinal) * 100) / 100 : null, taxa: a.comFinal ? Math.round((a.aprovados / a.discentes) * 1000) / 10 : null }])) }))
    const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt')
    return {
      anos,
      cursos: fechar(cursos).sort(porNome),
      ramos: fechar(ramos).sort(porNome),
      cadeiras: fechar(cadeiras).sort(porNome),
      docentes: [...docentes.values()].sort(porNome),
    }
  }
}

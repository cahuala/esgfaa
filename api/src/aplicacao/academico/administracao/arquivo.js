import { ErroValidacao } from '../../../dominio/comum/erros.js'
import { MODELOS_PLANO, mencao, NOTA_MINIMA, resultadoCurso, validarPlano } from '../../../dominio/academico/avaliacao/planoCurso.js'
import { noCatalogo } from '../../../dominio/academico/cadeirasCatalogo.js'

export const CHAVE_CATALOGO = 'cadeiras-catalogo'

/*
  Carga do arquivo da Repartição de Administração Escolar (as pautas finais dos anos anteriores, já assinadas):
  para cada curso de cada ano lectivo, a turma, o plano do curso, as cadeiras, as matrículas, a nota final de
  cada cadeira e o resultado de cada discente tal como está na pauta (média final e classificação), com o
  Conselho do curso homologado — a pauta final, o histórico e os certificados saem como os do arquivo.
  - Os discentes entram pela conta do portal que o Sistema de Pessoal criou (pelo NIP ou n.º de agente); quem
    ainda não tem conta fica na lista para depois (o Pessoal envia-o quando tiver o e-mail de acesso).
  - Nunca mexe no que já está no sistema: uma turma desse curso e ano com matrículas ou notas lançadas fica como
    está; um ano lectivo fechado também (reabre-se por ordem do Comandante). Pode correr-se outra vez: completa
    só o que faltava (quem entretanto ganhou conta).
  - simular: mostra o que faria, sem gravar.
*/
export const TITULO_NOTA_ARQUIVO = 'Nota final (arquivo da Administração Escolar)'
const ORIGEM = 'Arquivo da Administração Escolar'
const ANO = /^\d{4}\/\d{4}$/
const norm = (n) => String(n ?? '').toUpperCase().replace(/\s/g, '').replace(/^I/, '').replace(/^0+/, '')
const nota = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : null
}
const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
// sigla de um bloco a partir do nome («Administração» → ADM; «Op. Conjuntas» → OPC)
const siglaBloco = (nome, usadas) => {
  const base = txt(nome, 60).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').trim()
  const palavras = base.split(/\s+/).filter((w) => w.length > 2)
  let s = (palavras.length > 1 ? palavras.map((w) => w[0]).join('') : base.replace(/\s/g, '')).slice(0, 4) || 'B'
  while (usadas.has(s)) s = `${s.slice(0, 3)}${usadas.size}`
  usadas.add(s)
  return s
}

export class ServicoArquivoAcademico {
  constructor({ prisma, conteudos, anosLetivos, auditoria, paginas = null, aprovacaoComandante = false }) {
    this.paginas = paginas
    this.aprovacaoComandante = aprovacaoComandante
    this.prisma = prisma
    this.conteudos = conteudos
    this.anosLetivos = anosLetivos
    this.auditoria = auditoria
  }

  // valida e arruma uma turma do ficheiro (o que vem do conversor das pautas do arquivo)
  #turmaDoFicheiro(t, i) {
    const sigla = txt(t?.sigla, 10).toUpperCase()
    const edicao = Number(t?.edicao)
    const anoLetivo = txt(t?.anoLetivo, 9)
    if (!sigla || !Number.isInteger(edicao) || edicao < 1 || !ANO.test(anoLetivo)) throw new ErroValidacao(`Turma ${i + 1} do ficheiro: falta a sigla do curso, a edição ou o ano lectivo (2024/2025).`)
    const usadas = new Set()
    const blocos = []
    const ucs = []
    for (const u of t.ucs ?? []) {
      const codigo = txt(u?.codigo, 20).toUpperCase()
      if (!codigo || ucs.some((x) => x.codigo === codigo)) continue
      const nomeBloco = txt(u?.bloco, 80)
      let b = nomeBloco ? blocos.find((x) => x.nome === nomeBloco) : null
      if (nomeBloco && !b) blocos.push((b = { sigla: siglaBloco(nomeBloco, usadas), nome: nomeBloco, coeficiente: 1 }))
      ucs.push({ codigo, nome: txt(u?.nome, 200) || codigo, bloco: b?.sigla ?? '', tii: /^TII\b|^TFC\b/.test(codigo) })
    }
    if (!ucs.length) throw new ErroValidacao(`${edicao}.º ${sigla} (${anoLetivo}): a pauta não tem cadeiras.`)
    const estudantes = (t.estudantes ?? []).map((e) => ({
      nip: txt(e?.nip, 20), nome: txt(e?.nome, 200),
      notas: Object.fromEntries(ucs.map((u) => [u.codigo, nota(e?.notas?.[u.codigo])])),
      final: nota(e?.final), mencao: txt(e?.mencao, 30),
    })).filter((e) => e.nome)
    return { sigla, edicao, anoLetivo, nome: `${edicao}.º ${sigla}`, blocos, ucs, estudantes, ficheiro: txt(t.ficheiro, 300) }
  }

  async importar(ctx, { turmas, simular = true } = {}) {
    ctx.actor.exigir('academico.gerir')
    if (!Array.isArray(turmas) || !turmas.length) throw new ErroValidacao('O ficheiro não tem turmas (pautas do arquivo).')
    if (turmas.length > 200) throw new ErroValidacao('No máximo 200 turmas de cada vez.')
    const lista = turmas.map((t, i) => this.#turmaDoFicheiro(t, i))
    const cursos = await this.conteudos.listar('cursos')
    const porSigla = new Map(cursos.map((c) => [String(c.dados?.sigla ?? '').toUpperCase(), c]).filter(([s]) => s))
    const contas = await this.prisma.contaPortal.findMany({ where: { tipo: 'estudante' }, select: { id: true, nome: true, dados: true } })
    const porNumero = new Map()
    for (const c of contas) for (const n of [c.dados?.nip, c.dados?.numeroAgente]) if (n && norm(n)) porNumero.set(norm(n), c)
    // sem NIP na pauta (estrangeiros, pautas antigas): pelo nome completo, só se houver uma conta com esse nome
    const nomeChave = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
    const porNome = new Map()
    for (const c of contas) { const k = nomeChave(c.nome); porNome.set(k, porNome.has(k) ? null : c) }
    const resultado = []
    let gravadas = 0
    for (const t of lista) {
      const r = { turma: `${t.nome} (${t.anoLetivo})`, sigla: t.sigla, anoLetivo: t.anoLetivo, cadeiras: t.ucs.length, discentes: t.estudantes.length, comConta: 0, semConta: [], estado: '', motivo: '' }
      resultado.push(r)
      const curso = porSigla.get(t.sigla)
      if (!curso) { Object.assign(r, { estado: 'sem curso', motivo: `O curso ${t.sigla} não está em Conteúdos › Cursos (crie-o com esta sigla e volte a carregar).` }); continue }
      const ano = await this.prisma.anoLetivo.findUnique({ where: { id: t.anoLetivo } })
      if (ano?.fechado) { Object.assign(r, { estado: 'ano fechado', motivo: `O ano lectivo ${t.anoLetivo} está fechado: peça a reabertura ao Comandante.` }); continue }
      // o que já está no sistema não se toca
      const existentes = await this.prisma.turma.findMany({ where: { curso: curso.id, anoLetivo: t.anoLetivo }, select: { id: true, nome: true, _count: { select: { matriculas: true } } } })
      const daqui = existentes.find((x) => x.nome === t.nome)
      const outras = existentes.filter((x) => x !== daqui && x._count.matriculas > 0)
      if (outras.length) { Object.assign(r, { estado: 'já existe', motivo: `Já há no sistema a turma ${outras.map((x) => x.nome).join(', ')} deste curso em ${t.anoLetivo}, com matrículas: fica como está.` }); continue }
      if (daqui && await this.#temNotasDoSistema(daqui.id)) { Object.assign(r, { estado: 'já existe', motivo: `A turma ${t.nome} já tem notas lançadas no sistema: fica como está.` }); continue }
      const linhas = []
      for (const e of t.estudantes) {
        const c = (e.nip ? porNumero.get(norm(e.nip)) : null) ?? (!e.nip ? porNome.get(nomeChave(e.nome)) : null)
        if (c) linhas.push({ ...e, conta: c })
        else r.semConta.push(`${e.nome}${e.nip ? ` (${e.nip})` : ''}`)
      }
      r.comConta = linhas.length
      r.estado = simular ? 'por carregar' : 'carregada'
      if (simular) continue
      await this.anosLetivos.garantir(t.anoLetivo)
      await this.prisma.$transaction(async (tx) => this.#gravar(tx, t, curso, daqui, linhas, ctx), { timeout: 120_000 })
      gravadas++
    }
    if (!simular && gravadas) await this.auditoria.registar(ctx, { acao: 'carregar_arquivo_academico', colecao: 'turmas', alvoTitulo: `${gravadas} turma(s) do arquivo`, detalhes: { turmas: resultado.filter((x) => x.estado === 'carregada').map((x) => x.turma) } })
    return { simulado: Boolean(simular), turmas: resultado }
  }

  // notas que não vieram do arquivo (lançadas pelos docentes, pela Administração ou na pauta clássica)
  async #temNotasDoSistema(turmaId) {
    const [provas, pauta] = await Promise.all([
      this.prisma.notaAvaliacaoUc.count({ where: { avaliacao: { cadeira: { turmaId }, titulo: { not: TITULO_NOTA_ARQUIVO } }, nota: { not: null } } }),
      this.prisma.notaPauta.count({ where: { cadeira: { turmaId } } }),
    ])
    return provas + pauta > 0
  }

  async #gravar(tx, t, curso, existente, linhas, ctx) {
    const turma = existente ?? await tx.turma.create({ data: { curso: curso.id, anoLetivo: t.anoLetivo, nome: t.nome, anoFinal: true, ativa: false } })
    // o plano do curso desse ano (se ainda não houver): os blocos da pauta; a média e a classificação ficam as do arquivo
    let plano = await tx.planoCurso.findUnique({ where: { curso_anoLetivo: { curso: curso.id, anoLetivo: t.anoLetivo } } })
    if (!plano) {
      plano = await tx.planoCurso.create({ data: {
        curso: curso.id, anoLetivo: t.anoLetivo, nome: `${curso.dados?.nome ?? curso.titulo ?? t.sigla} — ${t.anoLetivo} (arquivo)`,
        formula: t.blocos.length ? 'blocos' : 'media', blocos: t.blocos, exigirTesteEscrito: false,
      } })
    }
    const planoDominio = { ...plano, blocos: plano.blocos ?? [], ajusteMaximo: Number(plano.ajusteMaximo ?? 0) }
    // as cadeiras (pelo código) e a prova com a nota final de cada uma
    const cadeiras = []
    for (const [i, u] of t.ucs.entries()) {
      let c = await tx.unidadeCurricular.findFirst({ where: { turmaId: turma.id, codigo: u.codigo } })
      if (!c) c = await tx.unidadeCurricular.create({ data: { turmaId: turma.id, codigo: u.codigo, nome: u.nome, periodo: 'anual', bloco: u.bloco, tii: u.tii } })
      let a = await tx.avaliacaoUc.findFirst({ where: { cadeiraId: c.id, titulo: TITULO_NOTA_ARQUIVO } })
      if (!a) a = await tx.avaliacaoUc.create({ data: { cadeiraId: c.id, tipo: 'TAI', forma: 'trabalho', titulo: TITULO_NOTA_ARQUIVO, ordem: i, publicadaEm: new Date() } })
      cadeiras.push({ ...c, codigoArquivo: u.codigo, avaliacaoId: a.id })
    }
    for (const l of linhas) {
      await tx.matricula.upsert({ where: { estudanteId_turmaId: { estudanteId: l.conta.id, turmaId: turma.id } }, create: { estudanteId: l.conta.id, turmaId: turma.id, estado: 'concluida' }, update: {} })
      const ucs = []
      for (const c of cadeiras) {
        const n = l.notas[c.codigoArquivo]
        if (n !== null) await tx.notaAvaliacaoUc.upsert({ where: { avaliacaoId_estudanteId: { avaliacaoId: c.avaliacaoId, estudanteId: l.conta.id } }, create: { avaliacaoId: c.avaliacaoId, estudanteId: l.conta.id, nota: n }, update: { nota: n } })
        ucs.push({ id: c.id, codigo: c.codigo, nome: c.nome, bloco: c.bloco, creditos: c.creditos ?? 0, tii: c.tii, final: n, situacao: n === null ? 'sem nota' : n >= NOTA_MINIMA ? 'aprovado' : 'reprovado', mencao: n === null ? null : mencao(n) })
      }
      // o resultado da pauta assinada (a média e a classificação do arquivo); as médias dos blocos calculam-se
      const calc = resultadoCurso(planoDominio, ucs)
      const final = l.final ?? calc.final
      const reprovado = /^reprov/i.test(l.mencao) || (final !== null && final < NOTA_MINIMA)
      const fixado = {
        final, media: final, mencao: l.mencao ? l.mencao.replace(/^Muito bom$/i, 'Muito Bom') : calc.mencao, concluido: final !== null && !reprovado,
        emFalta: calc.emFalta.filter((x) => !/^Bloco|Média final/.test(x)), blocos: calc.blocos, ajuste: 0, ucs, origem: ORIGEM,
      }
      await tx.classificacaoCurso.upsert({ where: { turmaId_estudanteId: { turmaId: turma.id, estudanteId: l.conta.id } }, create: { turmaId: turma.id, estudanteId: l.conta.id, fixado }, update: { fixado } })
    }
    const quem = ctx.actor?.nome || ctx.utilizador?.nome || ''
    await tx.conselhoCurso.upsert({
      where: { turmaId: turma.id },
      create: { turmaId: turma.id, estado: 'homologada', homologadaPor: `${ORIGEM} (carregado por ${quem})`, homologadaEm: new Date(), observacoes: `Pauta do arquivo${t.ficheiro ? `: ${t.ficheiro}` : ''}` },
      update: { estado: 'homologada' },
    })
  }

  /*
    Arranque do ano lectivo (das relações do corpo docente e das listas dos discentes):
      - o catálogo das cadeiras (o departamento e os docentes habituais de cada uma) fica guardado: as cadeiras que se
        criarem depois recebem o departamento sozinhas;
      - cada turma do ano (o curso pela sigla): cria-se, com as cadeiras do modelo do plano de curso, e matriculam-se
        os discentes que já têm conta (pelo NIP); numa turma que já existe, só se completa o que falta;
      - em cada cadeira: o departamento (se estiver em branco) e os docentes habituais, como proposta para o Comandante
        aprovar na distribuição (ou logo aprovados, sem a aprovação dele ligada). Os docentes que já lá estão ficam.
    simular: mostra o que faria (as ligações das cadeiras ao catálogo, para conferir), sem gravar.
  */
  async arrancar(ctx, { anoLetivo, cadeiras = [], turmas = [], simular = true } = {}) {
    ctx.actor.exigir('academico.gerir')
    if (!ANO.test(String(anoLetivo ?? ''))) throw new ErroValidacao('Indique o ano lectivo (2026/2027).')
    const catalogo = cadeiras.map((c) => ({
      nome: txt(c?.nome, 200), departamento: txt(c?.departamento, 120),
      docentes: (c?.docentes ?? []).map((d) => ({ nip: txt(d?.nip, 20), nome: txt(d?.nome, 200), tipo: d?.tipo === 'colaborador' ? 'colaborador' : 'efectivo' })).filter((d) => d.nome),
    })).filter((c) => c.nome)
    const ano = await this.prisma.anoLetivo.findUnique({ where: { id: anoLetivo } })
    if (ano?.fechado) throw new ErroValidacao(`O ano lectivo ${anoLetivo} está fechado: peça a reabertura ao Comandante.`)
    const cursos = await this.conteudos.listar('cursos')
    const porSigla = new Map(cursos.map((c) => [String(c.dados?.sigla ?? '').toUpperCase(), c]).filter(([k]) => k))
    const contas = await this.prisma.contaPortal.findMany({ select: { id: true, tipo: true, nome: true, dados: true } })
    const nomeChave = (n) => String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')
    const conta = (tipo, nip, nome) => {
      const l = contas.filter((c) => c.tipo === tipo)
      return (nip && l.find((c) => norm(c.dados?.nip) === norm(nip) || norm(c.dados?.numeroAgente) === norm(nip))) || (() => { const m = l.filter((c) => nomeChave(c.nome) === nomeChave(nome)); return m.length === 1 ? m[0] : null })()
    }
    if (!simular) {
      await this.anosLetivos.garantir(anoLetivo)
      if (catalogo.length && this.paginas) await this.paginas.guardar(CHAVE_CATALOGO, { anoLetivo, cadeiras: catalogo }, ctx.actor?.id ?? null)
    }
    const resultado = []
    for (const t of turmas) {
      const sigla = txt(t?.sigla, 10).toUpperCase()
      const edicao = Number(t?.edicao)
      const nome = `${edicao}.º ${sigla}`
      const r = { turma: `${nome} (${anoLetivo})`, estado: '', motivo: '', discentes: 0, comConta: 0, semConta: [], cadeiras: [] }
      resultado.push(r)
      const curso = porSigla.get(sigla)
      if (!curso) { Object.assign(r, { estado: 'sem curso', motivo: `O curso ${sigla} não está em Conteúdos › Cursos (Gestão do Site).` }); continue }
      const modelo = MODELOS_PLANO[t?.modelo]
      let turma = await this.prisma.turma.findFirst({ where: { curso: curso.id, anoLetivo }, orderBy: { id: 'asc' } })
      const ucs = turma ? await this.prisma.unidadeCurricular.findMany({ where: { turmaId: turma.id }, include: { docentes: true } }) : []
      const doModelo = modelo ? modelo.cadeiras.filter((c) => !ucs.some((u) => u.codigo === c.codigo)) : []
      const todas = [...ucs.map((u) => ({ codigo: u.codigo, nome: u.nome, departamento: u.departamento, docentes: u.docentes, existe: u })), ...doModelo.map((c) => ({ codigo: c.codigo, nome: c.nome, departamento: '', docentes: [], modelo: c }))]
      const estudantes = (t?.estudantes ?? []).map((e) => ({ nip: txt(e?.nip, 20), nome: txt(e?.nome, 200) })).filter((e) => e.nome)
      const comConta = estudantes.map((e) => ({ e, c: conta('estudante', e.nip, e.nome) }))
      r.discentes = estudantes.length
      r.comConta = comConta.filter((x) => x.c).length
      r.semConta = comConta.filter((x) => !x.c).map((x) => `${x.e.nome}${x.e.nip ? ` (${x.e.nip})` : ''}`)
      for (const c of todas) {
        const k = noCatalogo(c.nome, catalogo)
        const propostos = (k?.docentes ?? []).map((d) => ({ d, conta: conta('docente', d.nip, d.nome) }))
        r.cadeiras.push({
          codigo: c.codigo, nome: c.nome, catalogo: k?.nome ?? null, departamento: c.departamento || k?.departamento || '',
          docentes: propostos.filter((x) => x.conta).map((x) => x.conta.nome), docentesSemConta: propostos.filter((x) => !x.conta).map((x) => x.d.nome),
        })
      }
      r.estado = simular ? (turma ? 'completar' : 'por criar') : turma ? 'completada' : 'criada'
      r.motivo = modelo ? '' : 'Sem modelo do plano de curso: a turma fica sem cadeiras (carregue o plano em Turma › Plano de curso).'
      if (simular) continue
      await this.prisma.$transaction(async (tx) => {
        if (!turma) turma = await tx.turma.create({ data: { curso: curso.id, anoLetivo, nome, anoFinal: true, ativa: true } })
        if (modelo && !(await tx.planoCurso.findUnique({ where: { curso_anoLetivo: { curso: curso.id, anoLetivo } } }))) {
          await tx.planoCurso.create({ data: validarPlano({ ...modelo.plano, curso: curso.id, anoLetivo }) })
        }
        for (const x of comConta.filter((y) => y.c)) await tx.matricula.upsert({ where: { estudanteId_turmaId: { estudanteId: x.c.id, turmaId: turma.id } }, create: { estudanteId: x.c.id, turmaId: turma.id, estado: 'ativa' }, update: {} })
        for (const [i, c] of todas.entries()) {
          const info = r.cadeiras[i]
          let uc = c.existe
          if (!uc) {
            const m = c.modelo
            uc = await tx.unidadeCurricular.create({ data: { turmaId: turma.id, codigo: m.codigo, nome: m.nome, periodo: m.periodo, bloco: m.bloco, creditos: m.creditos, horasContacto: m.horasContacto, horasNaoContacto: m.horasNaoContacto, horas: m.horasContacto + m.horasNaoContacto, tii: Boolean(m.tii), departamento: info.departamento } })
          } else if (!uc.departamento && info.departamento) await tx.unidadeCurricular.update({ where: { id: uc.id }, data: { departamento: info.departamento } })
          const ja = new Set((c.docentes ?? []).map((d) => d.docenteId))
          const k = noCatalogo(c.nome, catalogo)
          let primeiro = ja.size === 0
          for (const d of k?.docentes ?? []) {
            const cd = conta('docente', d.nip, d.nome)
            if (!cd || ja.has(cd.id)) continue
            await tx.docencia.create({ data: { cadeiraId: uc.id, docenteId: cd.id, papel: primeiro && d.tipo === 'efectivo' ? 'regente' : 'assistente', estado: this.aprovacaoComandante ? 'proposta' : 'aprovada' } })
            if (d.tipo === 'efectivo') primeiro = false
            ja.add(cd.id)
          }
        }
      }, { timeout: 120_000 })
    }
    if (!simular) await this.auditoria.registar(ctx, { acao: 'arranque_ano_letivo', colecao: 'turmas', alvoTitulo: `${anoLetivo}: ${resultado.length} turma(s), ${catalogo.length} cadeira(s) no catálogo` })
    return { simulado: Boolean(simular), anoLetivo, catalogo: catalogo.length, turmas: resultado }
  }
}

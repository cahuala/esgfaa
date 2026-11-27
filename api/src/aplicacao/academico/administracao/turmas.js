import { Conflito, ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { termosDoPlano } from '../../../dominio/academico/avaliacao/planoCurso.js'

// a duração do curso em meses, do texto da ficha do curso («10 meses», «2 anos»); sem ela, null
export function mesesDoCurso(curso) {
  const t = String(curso?.dados?.duracao ?? curso?.duracao ?? '').toLowerCase()
  const m = /(\d+)\s*m[eê]s/.exec(t)
  if (m) return Number(m[1])
  const a = /(\d+)\s*ano/.exec(t)
  return a ? Number(a[1]) * 12 : null
}
import { ordenarPorHierarquia } from '../../../dominio/academico/pessoas/hierarquia.js'
import { ESTADOS_MATRICULA } from '../../../dominio/academico/matriculas/estados.js'
import { DEPARTAMENTOS_ENSINO, mesmoDepartamento } from '../../../dominio/academico/departamentos.js'

const ANO_LETIVO = /^\d{4}\/\d{4}$/

// Turmas e matrículas: a Administração Escolar matricula estudantes já registados pelo Pessoal e Quadros.
/*
  Os directores de curso: { [curso]: { utilizadorId, desde, designadoPor, aprovadoPor, proposta?, recusa? } }. A
  Administração Escolar propõe (proposta: { utilizadorId | null para retirar, pedidoPor, pedidoEm }); só vale quando o
  Comandante aprova (em «Por aprovar»); se recusar, fica a recusa com o motivo.
*/
export const CHAVE_DIRECTORES = 'directores-de-curso'

export class ServicoTurmas {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  listarTurmas(ctx) {
    ctx.actor.exigir('academico.ver')
    return this.academico.listarTurmas()
  }

  async #cursoValido(curso) {
    const c = (await this.conteudos.listar('cursos')).find((x) => x.id === curso)
    if (!c) throw new ErroValidacao('Escolha um curso existente.', { campo: 'curso' })
    return c
  }

  #anoCurricular(valor) {
    const n = Number(valor ?? 1)
    if (!Number.isInteger(n) || n < 1 || n > 6) throw new ErroValidacao('Ano curricular entre 1 e 6.', { campo: 'anoCurricular' })
    return n
  }

  async criarTurma(ctx, { curso, anoLetivo, nome, anoCurricular }) {
    ctx.actor.exigir('academico.gerir')
    if (!ANO_LETIVO.test(anoLetivo || '')) throw new ErroValidacao('Ano lectivo no formato 2026/2027.', { campo: 'anoLetivo' })
    const [a, b] = anoLetivo.split('/').map(Number)
    if (b !== a + 1) throw new ErroValidacao('O ano lectivo tem dois anos seguidos (ex.: 2026/2027).', { campo: 'anoLetivo' })
    // o ano fica configurado (datas dos semestres) se ainda não estava
    await this.anosLetivos?.garantir(anoLetivo)
    const c = await this.#cursoValido(curso)
    // um curso de até 12 meses (os da Escola duram 10) tem um só ano: a turma é logo a final (trabalho de fim de curso,
    // conclusão, diplomas) e não há ano curricular
    const umSoAno = (mesesDoCurso(c) ?? 0) > 0 && mesesDoCurso(c) <= 12
    const turma = await this.academico.criarTurma({
      curso: c.id, anoLetivo, anoCurricular: umSoAno ? 1 : this.#anoCurricular(anoCurricular), nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }),
      ...(umSoAno ? { anoFinal: true } : {}),
    })
    await this.auditoria.registar(ctx, { acao: 'criar_turma', colecao: 'turmas', alvoId: turma.id, alvoTitulo: turma.nome })
    return turma
  }

  async editarTurma(ctx, id, { nome, ativa, anoCurricular, anoFinal }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    return this.academico.atualizarTurma(t.id, {
      ...(nome !== undefined ? { nome: texto(nome, 'nome', 'Nome da turma', { min: 2, max: 80 }) } : {}),
      ...(ativa !== undefined ? { ativa: Boolean(ativa) } : {}),
      ...(anoCurricular !== undefined ? { anoCurricular: this.#anoCurricular(anoCurricular) } : {}),
      ...(anoFinal !== undefined ? { anoFinal: Boolean(anoFinal) } : {}),
    })
  }

  async turma(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const t = await this.academico.turma(id)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const [matriculas, cadeiras] = await Promise.all([this.academico.matriculasDaTurma(t.id), this.academico.cadeirasDasTurmas([t.id])])
    const horarios = await this.academico.horariosDasCadeiras(cadeiras.map((c) => c.id))
    // os termos do curso (auditor/discente, TII/TFC), pelo plano de curso da turma
    const plano = this.planosCurso ? await this.planosCurso.daTurma(t) : null
    return { ...t, matriculas, cadeiras: cadeiras.map((c) => ({ ...c, horarios: horarios.filter((h) => h.cadeiraId === c.id) })), termos: termosDoPlano(plano, cadeiras), temPlano: Boolean(plano), blocos: plano?.blocos ?? [] }
  }

  /*
    Lista do curso: os estudantes com matrícula activa em todas as turmas de um curso num ano lectivo, com a turma de
    cada um, pela ordem hierárquica (posto e, no mesmo posto, nome).
  */
  /*
    Directores de curso: a Repartição de Administração Escolar designa, para cada curso, uma das contas do painel que
    veem o Ensino (o Director de Curso, um chefe de departamento…). Fica na lista do curso, para assinar.
  */
  async directoresDeCurso(ctx) {
    ctx.actor.exigir('academico.ver')
    const guardado = (await this.paginas.ler(CHAVE_DIRECTORES)) ?? {}
    const contas = await this.#contasDoEnsino()
    const porId = new Map(contas.map((u) => [u.id, u]))
    const directores = {}
    const propostas = {}
    const recusas = {}
    for (const [curso, x] of Object.entries(guardado)) {
      if (x.utilizadorId && porId.get(x.utilizadorId)) directores[curso] = { utilizadorId: x.utilizadorId, desde: x.desde, aprovadoPor: x.aprovadoPor ?? '', ...this.#resumoConta(porId.get(x.utilizadorId)) }
      if (x.proposta) propostas[curso] = { ...x.proposta, ...(x.proposta.utilizadorId && porId.get(x.proposta.utilizadorId) ? this.#resumoConta(porId.get(x.proposta.utilizadorId)) : { nome: x.proposta.utilizadorId ? '(conta já sem acesso)' : null }) }
      if (x.recusa) recusas[curso] = x.recusa
    }
    // o Director de um curso é um docente: só as contas do painel que são de um docente (a mesma ficha do Pessoal ou
    // o mesmo nome)
    const candidatos = ctx.actor.pode('academico.gerir') ? (await this.#soDocentes(contas)).map((u) => this.#resumoConta(u)) : []
    return { directores, propostas, recusas, aprovacaoComandante: Boolean(this.aprovacaoComandante), candidatos }
  }

  /*
    A Administração Escolar propõe o Director do curso (ou retirá-lo: utilizadorId null); o Comandante aprova em
    «Por aprovar». Sem a aprovação do Comandante ligada (ou se é o próprio Comandante), fica logo.
  */
  async definirDirectorDeCurso(ctx, cursoId, utilizadorId) {
    ctx.actor.exigir('academico.gerir')
    const curso = (await this.conteudos.listar('cursos')).find((x) => x.id === cursoId)
    if (!curso) throw new NaoEncontrado('Curso não encontrado.')
    const nomeCurso = (curso.dados ?? curso).nome
    let u = null
    if (utilizadorId !== null) {
      u = (await this.#soDocentes(await this.#contasDoEnsino())).find((x) => x.id === utilizadorId)
      if (!u) throw new ErroValidacao('O Director do curso tem de ser um docente com conta no painel (a conta vem do Sistema de Pessoal).', { campo: 'utilizadorId' })
    }
    const guardado = (await this.paginas.ler(CHAVE_DIRECTORES)) ?? {}
    const atual = guardado[cursoId] ?? {}
    const agora = this.relogio.agora().toISOString()
    if (!this.aprovacaoComandante || ctx.actor.pode('academico.homologar')) {
      guardado[cursoId] = u ? { utilizadorId: u.id, desde: agora, designadoPor: ctx.actor.nome ?? '', aprovadoPor: ctx.actor.nome ?? '' } : {}
      await this.paginas.guardar(CHAVE_DIRECTORES, guardado, ctx.actor.id)
      await this.auditoria.registar(ctx, { acao: u ? 'designar_director_curso' : 'retirar_director_curso', colecao: 'cursos', alvoId: cursoId, alvoTitulo: u ? `${nomeCurso}: ${u.nome}` : nomeCurso })
      return this.directoresDeCurso(ctx)
    }
    if ((atual.utilizadorId ?? null) === utilizadorId) {
      // volta ao que já está aprovado: a proposta em curso cai
      guardado[cursoId] = { ...atual, proposta: undefined, recusa: undefined }
    } else {
      guardado[cursoId] = { ...atual, proposta: { utilizadorId, pedidoPor: ctx.actor.nome ?? '', pedidoEm: agora }, recusa: undefined }
    }
    await this.paginas.guardar(CHAVE_DIRECTORES, guardado, ctx.actor.id)
    await this.auditoria.registar(ctx, { acao: 'propor_director_curso', colecao: 'cursos', alvoId: cursoId, alvoTitulo: u ? `${nomeCurso}: ${u.nome}` : `${nomeCurso}: retirar o Director` })
    return this.directoresDeCurso(ctx)
  }

  // as contas activas do painel cujo papel vê o Ensino (sem as de administração técnica)
  /*
    Estrutura do ensino num ano lectivo: os cursos (com o Director e as turmas) e os departamentos (com quem lá
    trabalha e as cadeiras de cada um). Quem é de um departamento (o chefe, os professores) vê só o seu.
  */
  async estruturaDoEnsino(ctx, anoLetivo) {
    ctx.actor.exigir('academico.ver')
    const turmas = (await this.academico.listarTurmas()).filter((t) => !anoLetivo || t.anoLetivo === anoLetivo)
    const cadeiras = turmas.length ? await this.academico.cadeirasDasTurmas(turmas.map((t) => t.id)) : []
    const porTurma = new Map(turmas.map((t) => [t.id, t]))
    const cursos = new Map((await this.conteudos.listar('cursos')).map((c) => [c.id, c]))
    const nomeCurso = (id) => cursos.get(id)?.titulo || cursos.get(id)?.dados?.nome || id
    const pessoas = (await this.utilizadores.listar()).filter((u) => u.ativo && u.departamento)
    const dirs = (await this.paginas?.ler(CHAVE_DIRECTORES)) ?? {}
    const contas = new Map((await this.utilizadores.listar()).map((u) => [u.id, u]))
    const nomes = [...DEPARTAMENTOS_ENSINO]
    for (const n of [...cadeiras.map((c) => c.departamento), ...pessoas.map((u) => u.departamento)]) if (n && !nomes.some((x) => mesmoDepartamento(x, n))) nomes.push(n)
    const linha = (c) => {
      const t = porTurma.get(c.turmaId)
      return { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, turmaId: c.turmaId, turma: t?.nome ?? '', curso: nomeCurso(t?.curso), departamento: c.departamento ?? '', docentes: c.docentes.map((d) => `${d.nome}${d.papel === 'assistente' ? ' (assist.)' : ''}`), propostos: c.docentesPropostos.length }
    }
    // o chefe e os professores de um departamento veem o seu; a Administração Escolar e o Comando veem tudo
    const meu = !ctx.actor.pode('academico.gerir') && ctx.actor.departamento ? ctx.actor.departamento : ''
    const departamentos = nomes.filter((n) => !meu || mesmoDepartamento(n, meu)).map((n) => ({
      nome: n,
      pessoas: pessoas.filter((u) => mesmoDepartamento(u.departamento, n)).map((u) => ({ id: u.id, nome: u.nome, cargo: u.cargo ?? '' })),
      cadeiras: cadeiras.filter((c) => mesmoDepartamento(c.departamento, n)).map(linha),
    }))
    return {
      anoLetivo: anoLetivo ?? '', meuDepartamento: meu,
      departamentos, semDepartamento: meu ? [] : cadeiras.filter((c) => !nomes.some((n) => mesmoDepartamento(c.departamento, n))).map(linha),
      cursos: meu ? [] : [...new Set(turmas.map((t) => t.curso))].map((id) => {
        const d = dirs[id]?.utilizadorId ? contas.get(dirs[id].utilizadorId) : null
        return { id, nome: nomeCurso(id), sigla: cursos.get(id)?.dados?.sigla ?? '', director: d ? { nome: d.nome, cargo: d.cargo ?? '' } : null, turmas: turmas.filter((t) => t.curso === id).map((t) => ({ id: t.id, nome: t.nome, estudantes: t.estudantes ?? 0, cadeiras: t.cadeiras ?? 0 })) }
      }),
    }
  }

  // muda o departamento de uma cadeira (a Administração Escolar)
  async departamentoDaCadeira(ctx, cadeiraId, departamento) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.academico.cadeira(cadeiraId)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    await this.academico.atualizarCadeira(c.id, { departamento: String(departamento ?? '').trim().slice(0, 120) })
    await this.auditoria.registar(ctx, { acao: 'editar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome, detalhes: { departamento } })
    return { id: c.id, departamento: String(departamento ?? '').trim() }
  }

  async #contasDoEnsino() {
    const papeis = new Map((await this.papeis.listar()).map((p) => [p.id, p]))
    const veEnsino = (u) => (u.permissoes ?? papeis.get(u.papel)?.permissoes ?? []).includes('academico.ver')
    return (await this.utilizadores.listar()).filter((u) => u.ativo && !u.aprovacao && u.papel !== 'administrador' && veEnsino(u))
      .map((u) => ({ ...u, nomePapel: papeis.get(u.papel)?.nome ?? u.papel })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  }

  // das contas do painel, só as que são de um docente (pela ficha do Pessoal ou, sem ela, pelo nome)
  async #soDocentes(contas) {
    const docentes = await this.contas.listar({ tipo: 'docente' }).catch(() => [])
    const sem = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(\S+\.\s+)+/, '').replace(/\s+/g, ' ').trim()
    const refs = new Set(docentes.map((d) => d.dados?.pessoalRef).filter(Boolean))
    const nomes = new Set(docentes.map((d) => sem(d.nome)))
    return contas.filter((u) => (u.pessoalRef && refs.has(u.pessoalRef)) || nomes.has(sem(u.nome)))
  }

  #resumoConta(u) {
    return { utilizadorId: u.id, nome: u.nome, cargo: u.cargo ?? '', papel: u.papel, nomePapel: u.nomePapel }
  }

  async listaDoCurso(ctx, cursoId, anoLetivo) {
    ctx.actor.exigir('academico.ver')
    const curso = (await this.conteudos.listar('cursos')).find((x) => x.id === cursoId)
    if (!curso) throw new NaoEncontrado('Curso não encontrado.')
    const turmas = (await this.academico.listarTurmas()).filter((t) => t.curso === curso.id && (!anoLetivo || t.anoLetivo === anoLetivo))
    const estudantes = []
    for (const t of turmas) for (const e of await this.academico.estudantesAtivosDaTurma(t.id)) estudantes.push({ ...e, turma: t.nome, turmaId: t.id })
    const d = curso.dados ?? curso
    return {
      curso: { id: curso.id, nome: d.nome, sigla: d.sigla ?? '', duracao: d.duracao ?? '' }, anoLetivo: anoLetivo || null,
      director: (await this.directoresDeCurso(ctx)).directores[curso.id] ?? null,
      turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, anoLetivo: t.anoLetivo, estudantes: t.estudantes })),
      estudantes: ordenarPorHierarquia(estudantes),
    }
  }

  async matricular(ctx, turmaId, { estudanteId }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const e = await this.contas.porId(estudanteId)
    if (!e || e.tipo !== 'estudante') throw new ErroValidacao('Escolha um estudante.', { campo: 'estudanteId' })
    const m = await this.academico.matricular(e.id, t.id)
    await this.auditoria.registar(ctx, { acao: 'matricular', colecao: 'matriculas', alvoId: m.id, alvoTitulo: `${e.nome} → ${t.nome}` })
    return m
  }

  // matricula vários estudantes já registados (escolhidos da lista do Pessoal e Quadros)
  async matricularVarios(ctx, turmaId, { estudanteIds }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const ids = [...new Set((estudanteIds || []).map(Number))]
    if (!ids.length || ids.length > 300) throw new ErroValidacao('Escolha de 1 a 300 estudantes.', { campo: 'estudanteIds' })
    let matriculados = 0
    for (const id of ids) {
      const e = await this.contas.porId(id)
      if (!e || e.tipo !== 'estudante') throw new ErroValidacao('A lista tem quem não é estudante registado.', { campo: 'estudanteIds' })
      try {
        await this.academico.matricular(e.id, t.id)
        matriculados += 1
      } catch (erro) {
        if (!(erro instanceof Conflito)) throw erro
      }
    }
    await this.auditoria.registar(ctx, { acao: 'matricular', colecao: 'matriculas', alvoId: t.id, alvoTitulo: `${matriculados} estudante(s) → ${t.nome}` })
    return { matriculados, jaMatriculados: ids.length - matriculados }
  }

  /*
    Matrícula a partir de uma folha (CSV/Excel): só estudantes já registados pelo Pessoal e Quadros
    (encontrados pelo e-mail ou pelo número). Com simular, só diz o que faria a cada linha.
  */
  async importarEstudantes(ctx, turmaId, { linhas, simular = true }) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    if (!Array.isArray(linhas) || !linhas.length) throw new ErroValidacao('A folha não tem estudantes.', { campo: 'linhas' })
    if (linhas.length > 500) throw new ErroValidacao('No máximo 500 estudantes de cada vez.', { campo: 'linhas' })
    const matriculados = new Set((await this.academico.matriculasDaTurma(t.id)).map((m) => m.estudante.id))
    const vistos = new Set()
    const resultado = []
    for (const [i, l] of linhas.entries()) {
      const linha = { linha: i + 1, nome: String(l.nome ?? '').trim(), email: String(l.email ?? '').trim().toLowerCase(), numero: String(l.numero ?? '').trim() }
      try {
        const conta = linha.email ? await this.contas.porEmail(linha.email) : linha.numero ? await this.contas.porNumero(linha.numero) : null
        if (!linha.email && !linha.numero) throw new ErroValidacao('Falta o e-mail ou o número de estudante.')
        if (!conta) throw new ErroValidacao('Não está registado: o registo é feito pelo Pessoal e Quadros.')
        if (conta.tipo !== 'estudante') throw new ErroValidacao('Esta conta é de um docente.')
        if (vistos.has(conta.id)) throw new ErroValidacao('Estudante repetido na folha.')
        vistos.add(conta.id)
        let acao = matriculados.has(conta.id) ? 'ja_matriculado' : 'matricular'
        if (!simular && acao === 'matricular') {
          await this.academico.matricular(conta.id, t.id).catch((e) => { if (e instanceof Conflito) acao = 'ja_matriculado'; else throw e })
        }
        resultado.push({ ...linha, nome: conta.nome, email: conta.email, numero: conta.numero, acao })
      } catch (e) {
        if (!(e instanceof ErroValidacao)) throw e
        resultado.push({ ...linha, acao: 'erro', erro: e.message })
      }
    }
    const resumo = Object.fromEntries(['matricular', 'ja_matriculado', 'erro'].map((k) => [k, resultado.filter((r) => r.acao === k).length]))
    if (!simular) await this.auditoria.registar(ctx, { acao: 'importar_estudantes', colecao: 'turmas', alvoId: t.id, alvoTitulo: t.nome, detalhes: resumo })
    return { simulacao: simular, resumo, linhas: resultado }
  }

  /*
    Passagem de ano: da turma de um ano curricular para a do ano seguinte do mesmo curso.
    Transita quem tem todas as cadeiras da turma aprovadas (ou dispensadas); não transita quem tem
    cadeiras reprovadas ou excluídas por faltas; fica por decidir quem ainda tem pautas por fechar
    (em curso, à espera de exame ou de recurso). Com executar = false só mostra o que aconteceria.
    Ao executar: matrícula na turma de destino e a da turma de origem passa a «concluída».
  */
  async transicao(ctx, turmaId, { destinoId, executar = false }) {
    ctx.actor.exigir('academico.gerir')
    const [t, d] = await Promise.all([this.academico.turma(turmaId), this.academico.turma(Number(destinoId))])
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    if (!d) throw new ErroValidacao('Escolha a turma do ano seguinte.', { campo: 'destinoId' })
    if (t.anoFinal) throw new ErroValidacao('É a turma de finalistas: o curso conclui-se em «Finalistas» (TFC e certificado), não passa a outro ano.')
    if (d.curso !== t.curso || d.anoCurricular !== t.anoCurricular + 1) throw new ErroValidacao(`A turma de destino tem de ser do mesmo curso e do ${t.anoCurricular + 1}.º ano.`, { campo: 'destinoId' })
    const [estudantes, cadeiras] = await Promise.all([this.academico.estudantesAtivosDaTurma(t.id), this.academico.cadeirasDasTurmas([t.id])])
    if (!cadeiras.length) throw new ErroValidacao('A turma não tem cadeiras.')
    const resultados = {}
    for (const c of cadeiras) {
      const pauta = await this.pautas.pauta(c)
      for (const l of pauta.linhas) (resultados[l.estudante.id] ??= []).push({ codigo: c.codigo, nome: c.nome, situacao: l.situacao, final: l.final })
    }
    const NOMES = { reprovado: 'reprovada', excluido: 'excluído por faltas', em_curso: 'em curso', exame: 'falta o exame', recurso: 'falta o recurso' }
    const linhas = estudantes.map((e) => {
      const r = resultados[e.id] ?? []
      const aprovadas = r.filter((x) => x.situacao === 'aprovado' || x.situacao === 'dispensado')
      const falhadas = r.filter((x) => x.situacao === 'reprovado' || x.situacao === 'excluido')
      const abertas = r.filter((x) => ['em_curso', 'exame', 'recurso'].includes(x.situacao))
      const decisao = falhadas.length ? 'nao_transita' : abertas.length || aprovadas.length < cadeiras.length ? 'por_decidir' : 'transita'
      return {
        estudante: { id: e.id, nome: e.nome, numero: e.numero }, decisao, aprovadas: aprovadas.length, cadeiras: cadeiras.length,
        pendentes: [...falhadas, ...abertas].map((x) => `${x.codigo} (${NOMES[x.situacao] ?? x.situacao})`),
      }
    })
    const resumo = { transita: linhas.filter((l) => l.decisao === 'transita').length, nao_transita: linhas.filter((l) => l.decisao === 'nao_transita').length, por_decidir: linhas.filter((l) => l.decisao === 'por_decidir').length }
    if (executar) {
      const daOrigem = new Map((await this.academico.matriculasDaTurma(t.id)).map((m) => [m.estudante.id, m]))
      for (const l of linhas.filter((x) => x.decisao === 'transita')) {
        try {
          await this.academico.matricular(l.estudante.id, d.id)
        } catch (e) {
          if (!(e instanceof Conflito) && e?.code !== 'P2002') throw e // já matriculado no destino
        }
        const m = daOrigem.get(l.estudante.id)
        if (m) await this.academico.alterarMatricula(m.id, 'concluida')
      }
      await this.auditoria.registar(ctx, { acao: 'passagem_de_ano', colecao: 'turmas', alvoId: t.id, alvoTitulo: `${t.nome} → ${d.nome}`, detalhes: resumo })
    }
    return { origem: { id: t.id, nome: t.nome, anoLetivo: t.anoLetivo, anoCurricular: t.anoCurricular }, destino: { id: d.id, nome: d.nome, anoLetivo: d.anoLetivo, anoCurricular: d.anoCurricular }, executada: Boolean(executar), resumo, linhas }
  }

  async alterarMatricula(ctx, id, { estado }) {
    ctx.actor.exigir('academico.gerir')
    const m = await this.academico.matricula(id)
    if (!m) throw new NaoEncontrado('Matrícula não encontrada.')
    const r = await this.academico.alterarMatricula(m.id, escolha(estado, 'estado', 'Estado', ESTADOS_MATRICULA))
    await this.auditoria.registar(ctx, { acao: 'alterar_matricula', colecao: 'matriculas', alvoId: m.id, detalhes: { de: m.estado, para: estado } })
    return r
  }
}

import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'
import { PERIODOS, validarAlocacao } from '../../../dominio/academico/organizacao/cadeira.js'
import { validarHorario } from '../../../dominio/academico/organizacao/horario.js'

// Cadeiras: dados, período, programa, horários, alocação de docentes e cópia para o novo ano letivo.
export class ServicoCadeiras {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  #camposCadeira(dados) {
    const horas = Number(dados.horas ?? 0)
    if (!Number.isInteger(horas) || horas < 0 || horas > 1000) throw new ErroValidacao('Horas inválidas.', { campo: 'horas' })
    const codigo = texto(dados.codigo, 'codigo', 'Código', { min: 2, max: 20 }).toUpperCase()
    if (!/^[A-Z0-9-]+$/.test(codigo)) throw new ErroValidacao('O código só tem letras, números e hífens.', { campo: 'codigo' })
    return {
      codigo, horas,
      periodo: escolha(String(dados.periodo ?? '1'), 'periodo', 'Período', Object.keys(PERIODOS)),
      nome: texto(dados.nome, 'nome', 'Nome', { min: 3, max: 150 }),
      descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
    }
  }

  async #cadeira(id) {
    const c = await this.academico.cadeira(id)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return c
  }

  // a cadeira pode ser criada sem docentes; a alocação faz-se depois
  async criarCadeira(ctx, turmaId, dados) {
    ctx.actor.exigir('academico.gerir')
    const t = await this.academico.turma(turmaId)
    if (!t) throw new NaoEncontrado('Turma não encontrada.')
    const c = await this.academico.criarCadeira({ turmaId: t.id, ...this.#camposCadeira(dados) })
    await this.auditoria.registar(ctx, { acao: 'criar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: `${c.nome} (${t.nome})` })
    return this.academico.cadeira(c.id)
  }

  async editarCadeira(ctx, id, dados) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(id)
    await this.academico.atualizarCadeira(c.id, this.#camposCadeira({ ...c, ...dados }))
    await this.auditoria.registar(ctx, { acao: 'editar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
    return this.academico.cadeira(c.id)
  }

  async apagarCadeira(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(id)
    await this.academico.apagarCadeira(c.id)
    await this.auditoria.registar(ctx, { acao: 'apagar_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
  }

  // ficha completa de uma cadeira no painel (dados, docentes, horário)
  async cadeira(ctx, id) {
    ctx.actor.exigir('academico.ver')
    const c = await this.#cadeira(id)
    const [horarios, programaFicheiro] = await Promise.all([
      this.academico.horariosDasCadeiras([c.id]),
      c.programaFicheiroId ? this.academico.ficheiro(c.programaFicheiroId) : null,
    ])
    return { ...c, horarios, programaFicheiro: programaFicheiro && { id: programaFicheiro.id, nome: programaFicheiro.nome, tamanho: programaFicheiro.tamanho } }
  }

  /*
    Programa da cadeira: escrito no próprio portal (HTML filtrado) e/ou em documento (PDF, Word).
    removerFicheiro: true tira o documento.
  */
  async programa(ctx, id, { texto: html, removerFicheiro }, ficheiro) {
    let c
    try {
      ctx.actor.exigir('academico.gerir')
      c = await this.#cadeira(id)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const mudanca = {}
    if (html !== undefined) {
      if (String(html).length > 200_000) throw new ErroValidacao('O programa é demasiado longo.', { campo: 'texto' })
      mudanca.programa = this.filtroHtml(String(html))
    }
    if (ficheiro) {
      if (!this.privados.confirmarTipo(ficheiro.caminho, ficheiro.tipo)) {
        this.privados.apagar(ficheiro.caminho)
        throw new ErroValidacao('O ficheiro não corresponde ao tipo indicado.', { campo: 'ficheiro' })
      }
      const ficheiroId = ficheiro.caminho.split(/[\\/]/).pop().split('.')[0]
      await this.academico.criarFicheiro({ id: ficheiroId, caminho: this.privados.relativo(ficheiro.caminho), nome: ficheiro.nome, tipo: ficheiro.tipo, tamanho: ficheiro.tamanho })
      mudanca.programaFicheiroId = ficheiroId
    } else if (removerFicheiro === true || removerFicheiro === 'true') {
      mudanca.programaFicheiroId = null
    }
    await this.academico.atualizarCadeira(c.id, mudanca)
    await this.auditoria.registar(ctx, { acao: 'programa_cadeira', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome })
    return this.cadeira(ctx, c.id)
  }

  // cadeiras de onde se pode copiar (todas, das turmas mais recentes para as mais antigas)
  async origensDeCopia(ctx) {
    ctx.actor.exigir('academico.ver')
    return (await this.academico.todasCadeiras()).map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, turma: c.turma }))
  }

  // copia os conteúdos de uma cadeira (de outro ano) para esta
  async copiarParaCadeira(ctx, destinoId, { origemId, docentes }) {
    ctx.actor.exigir('academico.gerir')
    const [origem, destino] = [await this.#cadeira(origemId), await this.#cadeira(destinoId)]
    return this.copias.copiar(ctx, origem, destino, { docentes: Boolean(docentes) })
  }

  /*
    Novo ano letivo: para cada cadeira da turma de origem, cria a cadeira na turma nova (se não existir,
    com o mesmo código) e copia os conteúdos. Cadeiras que já têm conteúdos ficam como estão.
  */
  async copiarTurma(ctx, turmaId, { origemTurmaId, docentes }) {
    ctx.actor.exigir('academico.gerir')
    const destino = await this.academico.turma(turmaId)
    const origem = await this.academico.turma(origemTurmaId)
    if (!destino || !origem) throw new NaoEncontrado('Turma não encontrada.')
    if (destino.id === origem.id) throw new ErroValidacao('Escolha outra turma de origem.', { campo: 'origemTurmaId' })
    const [deOrigem, existentes] = await Promise.all([this.academico.cadeirasDasTurmas([origem.id]), this.academico.cadeirasDasTurmas([destino.id])])
    const resultado = []
    for (const o of deOrigem) {
      let alvo = existentes.find((x) => x.codigo === o.codigo)
      let criada = false
      if (!alvo) {
        const nova = await this.academico.criarCadeira({ turmaId: destino.id, codigo: o.codigo, nome: o.nome, periodo: o.periodo, horas: o.horas, descricao: o.descricao })
        alvo = await this.academico.cadeira(nova.id)
        criada = true
      } else if (await this.copiasRepo.temConteudos(alvo.id)) {
        resultado.push({ codigo: o.codigo, nome: o.nome, criada: false, copiada: false, motivo: 'já tinha conteúdos' })
        continue
      }
      const resumo = await this.copias.copiar(ctx, o, alvo, { docentes: Boolean(docentes) })
      resultado.push({ codigo: o.codigo, nome: o.nome, criada, copiada: true, ...resumo })
    }
    return { turma: { id: destino.id, nome: destino.nome }, origem: { id: origem.id, nome: origem.nome }, cadeiras: resultado }
  }

  // visão geral: cada docente com as suas cadeiras e horas; cadeiras sem regente
  async alocacao(ctx) {
    ctx.actor.exigir('academico.ver')
    const [docentes, cadeiras] = await Promise.all([this.contas.listar({ tipo: 'docente' }), this.academico.todasCadeiras({ soAtivas: true })])
    const porDocente = new Map(docentes.map((d) => [d.id, { docente: { id: d.id, nome: d.nome, numero: d.numero, email: d.email, ativo: d.ativo }, cadeiras: [], horas: 0 }]))
    for (const c of cadeiras) {
      for (const d of c.docentes) {
        const linha = porDocente.get(d.id)
        if (!linha) continue
        linha.cadeiras.push({ id: c.id, codigo: c.codigo, nome: c.nome, turma: c.turma?.nome, periodo: c.periodo, papel: d.papel, horas: d.horas })
        linha.horas += d.horas
      }
    }
    return {
      docentes: [...porDocente.values()].sort((a, b) => b.horas - a.horas || a.docente.nome.localeCompare(b.docente.nome)),
      cadeiras: cadeiras.map((c) => ({
        id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, turma: c.turma, docentes: c.docentes,
        horasAlocadas: c.docentes.reduce((s, d) => s + d.horas, 0),
      })),
    }
  }

  async alocarDocentes(ctx, cadeiraId, lista) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.#cadeira(cadeiraId)
    const docentes = validarAlocacao(lista)
    for (const d of docentes) {
      const conta = await this.contas.porId(d.docenteId)
      if (!conta || conta.tipo !== 'docente') throw new ErroValidacao('Escolha um docente.', { campo: 'docentes' })
    }
    await this.academico.definirDocentes(c.id, docentes)
    const nova = await this.academico.cadeira(c.id)
    await this.auditoria.registar(ctx, {
      acao: 'alocar_docentes', colecao: 'cadeiras', alvoId: c.id, alvoTitulo: c.nome,
      detalhes: { docentes: nova.docentes.map((d) => `${d.nome} (${d.papel}, ${d.horas} h)`) },
    })
    return nova
  }

  async criarHorario(ctx, cadeiraId, dados) {
    ctx.actor.exigir('academico.gerir')
    const c = await this.academico.cadeira(cadeiraId)
    if (!c) throw new NaoEncontrado('Cadeira não encontrada.')
    return this.academico.criarHorario({ cadeiraId: c.id, ...validarHorario(dados) })
  }

  async apagarHorario(ctx, id) {
    ctx.actor.exigir('academico.gerir')
    await this.academico.apagarHorario(id)
  }
}

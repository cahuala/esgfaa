import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { urlSegura } from '../../dominio/comum/urls.js'
import { estadoQuestionario } from '../../dominio/academico/questionarios.js'
import {
  COMPONENTES_NOTA, ESTADOS_PRESENCA, TIPOS_MATERIAL, TIPOS_PEDIDO,
  assiduidade, dataValida, entregaAtrasada, escolha, estadoPrazo, resultadoDisciplina, texto, validarNota,
} from '../../dominio/academico/regras.js'

// o estudante só vê as componentes já publicadas pelo docente; o resultado conta só com essas
const notasVisiveis = (linha, publicadas) => {
  const notas = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, publicadas.includes(k) ? linha?.[k] ?? null : null]))
  return { ...notas, ...resultadoDisciplina(notas), observacao: publicadas.length ? linha?.observacao || '' : '' }
}

const quem = (c) => ({ id: null, nome: `${c.nome} (portal, ${c.numero})` })

/*
  O que estudantes e docentes fazem no portal.
  Regra de acesso: o estudante só vê as cadeiras das turmas onde tem matrícula ativa;
  o docente só as cadeiras que lhe estão atribuídas. Tudo o resto responde "não encontrado".
*/
export class ServicoPortal {
  constructor({ academico, recursos, pautas, privados, auditoria, relogio }) {
    Object.assign(this, { academico, recursos, pautas, privados, auditoria, relogio })
  }

  // ---------- acesso ----------

  async #cadeiraAcessivel(conta, cadeiraId) {
    const cadeira = await this.academico.cadeira(cadeiraId)
    if (cadeira) {
      if (conta.tipo === 'docente' && cadeira.docentes.some((d) => d.id === conta.id)) return cadeira
      if (conta.tipo === 'estudante' && (await this.academico.turmasAtivas(conta.id)).includes(cadeira.turmaId)) return cadeira
    }
    throw new NaoEncontrado('Cadeira não encontrada.')
  }

  async #cadeiraDoDocente(conta, cadeiraId) {
    if (conta.tipo !== 'docente') throw new SemPermissao('Só o docente da cadeira pode fazer isto.')
    return this.#cadeiraAcessivel(conta, cadeiraId)
  }

  #soEstudante(conta) {
    if (conta.tipo !== 'estudante') throw new SemPermissao('Disponível apenas para estudantes.')
  }

  async #minhasCadeiras(conta) {
    if (conta.tipo === 'docente') return this.academico.cadeirasDoDocente(conta.id)
    return this.academico.cadeirasDasTurmas(await this.academico.turmasAtivas(conta.id))
  }

  // ficheiro enviado (já gravado na pasta privada): confirma o tipo real e regista-o
  async #registarFicheiro(f, donoId) {
    if (!this.privados.confirmarTipo(f.caminho, f.tipo)) {
      this.privados.apagar(f.caminho)
      throw new ErroValidacao(`O ficheiro "${f.nome}" não corresponde ao tipo indicado.`, { campo: 'ficheiro' })
    }
    const id = f.caminho.split(/[\\/]/).pop().split('.')[0]
    await this.academico.criarFicheiro({ id, caminho: this.privados.relativo(f.caminho), nome: f.nome, tipo: f.tipo, tamanho: f.tamanho, donoId })
    return id
  }

  // ---------- página inicial ----------

  async inicio(ctx) {
    const { conta } = ctx
    const cadeiras = await this.#minhasCadeiras(conta)
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
    return this.#minhasCadeiras(ctx.conta)
  }

  // ---------- uma cadeira ----------

  async cadeira(ctx, id) {
    const { conta } = ctx
    const cadeira = await this.#cadeiraAcessivel(conta, id)
    const agora = this.relogio.agora()
    const eDocente = conta.tipo === 'docente'
    const [todosMateriais, avisos, todosTrabalhos, horario, secoes, todosQuestionarios, topicos, eventos] = await Promise.all([
      this.academico.materiais(cadeira.id),
      this.academico.avisosDaCadeira(cadeira.id),
      this.academico.trabalhos(cadeira.id),
      this.academico.horariosDasCadeiras([cadeira.id]),
      this.academico.secoes(cadeira.id),
      this.recursos.questionarios(cadeira.id, { soPublicados: !eDocente }),
      this.recursos.topicos(cadeira.id),
      this.recursos.eventosDaCadeira(cadeira.id),
    ])
    // capítulos escondidos (e o que têm dentro) não aparecem aos estudantes
    const escondidos = new Set(secoes.filter((x) => !x.visivel).map((x) => x.id))
    const visivel = (a) => eDocente || !escondidos.has(a.secaoId)
    const materiais = todosMateriais.filter(visivel)
    const trabalhos = todosTrabalhos.filter(visivel)
    const questionarios = todosQuestionarios.filter(visivel).map((q) => ({ ...q, estado: estadoQuestionario(q, agora) }))
    const base = {
      ...cadeira, materiais, avisos, horario, questionarios, eventos,
      secoes: (eDocente ? secoes : secoes.filter((x) => x.visivel)).map((x) => ({ id: x.id, ordem: x.ordem, titulo: x.titulo, resumo: x.resumo, visivel: x.visivel })),
      forum: { topicos: topicos.length, recentes: topicos.slice(0, 3).map((t) => ({ id: t.id, titulo: t.titulo, autor: t.autor.nome, atividadeEm: t.atividadeEm })) },
    }

    if (eDocente) {
      const estudantes = await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)
      const comEntregas = await Promise.all(trabalhos.map(async (t) => ({
        ...t, estado: estadoPrazo(t.prazo, agora, t.aceitaAtraso), entregas: (await this.academico.entregasDoTrabalho(t.id)).length,
      })))
      return { ...base, trabalhos: comEntregas, estudantes }
    }

    // estudante: as suas notas publicadas, as suas entregas e presenças
    const minhasNotas = await this.academico.notasDoEstudante(conta.id, [cadeira.id])
    const minhasEntregas = await this.academico.entregasDoEstudante(conta.id, trabalhos.map((t) => t.id))
    const presencas = (await this.academico.presencasDoEstudante(conta.id, [cadeira.id])).sort((a, b) => b.data.localeCompare(a.data))
    return {
      ...base,
      trabalhos: trabalhos.map((t) => {
        const e = minhasEntregas[t.id]
        return {
          ...t, estado: estadoPrazo(t.prazo, agora, t.aceitaAtraso),
          entrega: e ? { entregueEm: e.entregueEm, atrasada: entregaAtrasada(e.entregueEm, t.prazo), ficheiroId: e.ficheiroId, comentario: e.comentario, nota: e.nota, correcao: e.correcao } : null,
        }
      }),
      notas: notasVisiveis(minhasNotas[cadeira.id], cadeira.notasPublicadas),
      presencas,
      assiduidade: assiduidade(presencas),
    }
  }

  // ---------- estudante ----------

  async notas(ctx) {
    this.#soEstudante(ctx.conta)
    const cadeiras = await this.#minhasCadeiras(ctx.conta)
    const notas = await this.academico.notasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    // boletim em matriz: uma linha por disciplina, uma coluna por componente
    return cadeiras.map((c) => ({
      cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '' },
      publicadas: c.notasPublicadas,
      ...notasVisiveis(notas[c.id], c.notasPublicadas),
    }))
  }

  /*
    Percurso académico: todas as matrículas do estudante (ano a ano), com as disciplinas de cada uma,
    as notas publicadas, a situação e um resumo (aprovadas, horas concluídas, média das aprovadas).
  */
  async percurso(ctx) {
    this.#soEstudante(ctx.conta)
    const matriculas = await this.academico.percursoDoEstudante(ctx.conta.id)
    const cadeiras = await this.academico.cadeirasDasTurmas(matriculas.map((m) => m.turma.id))
    const notas = await this.academico.notasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    const aprovada = (l) => l.situacao === 'aprovado' || l.situacao === 'dispensado'
    const resumir = (linhas) => {
      const feitas = linhas.filter(aprovada)
      return {
        disciplinas: linhas.length,
        aprovadas: feitas.length,
        reprovadas: linhas.filter((l) => l.situacao === 'reprovado').length,
        emCurso: linhas.length - feitas.length - linhas.filter((l) => l.situacao === 'reprovado').length,
        horas: linhas.reduce((s, l) => s + l.cadeira.horas, 0),
        horasAprovadas: feitas.reduce((s, l) => s + l.cadeira.horas, 0),
        media: feitas.length ? Math.round((feitas.reduce((s, l) => s + l.final, 0) / feitas.length) * 10) / 10 : null,
      }
    }
    const anos = matriculas.map((m) => {
      const linhas = cadeiras.filter((c) => c.turmaId === m.turma.id).map((c) => ({
        cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, periodo: c.periodo, horas: c.horas, docente: c.docente?.nome || '' },
        ...notasVisiveis(notas[c.id], c.notasPublicadas),
      }))
      return { matricula: { id: m.id, estado: m.estado }, turma: m.turma, disciplinas: linhas, resumo: resumir(linhas) }
    })
    return { anos, resumo: resumir(anos.flatMap((a) => a.disciplinas)) }
  }

  async horario(ctx) {
    const cadeiras = await this.#minhasCadeiras(ctx.conta)
    return this.academico.horariosDasCadeiras(cadeiras.map((c) => c.id))
  }

  async presencas(ctx) {
    this.#soEstudante(ctx.conta)
    const cadeiras = await this.#minhasCadeiras(ctx.conta)
    const todas = await this.academico.presencasDoEstudante(ctx.conta.id, cadeiras.map((c) => c.id))
    return cadeiras.map((c) => {
      const dela = todas.filter((p) => p.cadeiraId === c.id)
      return { cadeira: { id: c.id, nome: c.nome }, aulas: dela.length, faltas: dela.filter((p) => p.estado === 'falta').length, assiduidade: assiduidade(dela) }
    })
  }

  async entregar(ctx, trabalhoId, ficheiro, { comentario }) {
    const { conta } = ctx
    this.#soEstudante(conta)
    const trabalho = await this.academico.trabalho(trabalhoId)
    if (!trabalho) throw new NaoEncontrado('Trabalho não encontrado.')
    try {
      await this.#cadeiraAcessivel(conta, trabalho.cadeiraId)
      if (estadoPrazo(trabalho.prazo, this.relogio.agora(), trabalho.aceitaAtraso) === 'fechado') {
        throw new ErroValidacao('O prazo de entrega terminou.')
      }
      if (!ficheiro) throw new ErroValidacao('Escolha o ficheiro a entregar.', { campo: 'ficheiro' })
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const ficheiroId = await this.#registarFicheiro(ficheiro, conta.id)
    const entrega = await this.academico.gravarEntrega({ trabalhoId: trabalho.id, estudanteId: conta.id, ficheiroId, comentario: texto(comentario, 'comentario', 'Comentário', { max: 2000, obrigatorio: false }) })
    await this.auditoria.registar(ctx, { acao: 'entregar_trabalho', colecao: 'trabalhos', alvoId: trabalho.id, alvoTitulo: trabalho.titulo, utilizador: quem(conta) })
    return { ...entrega, atrasada: entregaAtrasada(entrega.entregueEm, trabalho.prazo) }
  }

  async pedidos(ctx) {
    this.#soEstudante(ctx.conta)
    return this.academico.pedidos({ estudanteId: ctx.conta.id })
  }

  async criarPedido(ctx, { tipo, motivo }) {
    this.#soEstudante(ctx.conta)
    const p = await this.academico.criarPedido({
      estudanteId: ctx.conta.id,
      tipo: escolha(tipo, 'tipo', 'Tipo de documento', TIPOS_PEDIDO),
      motivo: texto(motivo, 'motivo', 'Motivo', { max: 1000, obrigatorio: tipo === 'Outro', min: tipo === 'Outro' ? 5 : 1 }),
    })
    await this.auditoria.registar(ctx, { acao: 'pedido_documento', colecao: 'pedidos', alvoId: p.id, alvoTitulo: p.tipo, utilizador: quem(ctx.conta) })
    return p
  }

  async avisosGerais(ctx) {
    this.#soEstudante(ctx.conta)
    return this.academico.avisosGerais(await this.academico.turmasAtivas(ctx.conta.id))
  }

  // ---------- ficheiros privados ----------

  // devolve { caminho, nome, tipo } se quem pede tiver acesso
  async ficheiro(ctx, id) {
    const { conta } = ctx
    const f = await this.academico.ficheiro(id)
    const uso = f && (await this.academico.usoDoFicheiro(f.id))
    const negar = () => { throw new NaoEncontrado('Ficheiro não encontrado.') }
    if (!uso) negar()
    if (['material', 'enunciado', 'programa'].includes(uso.tipo)) {
      await this.#cadeiraAcessivel(conta, uso.cadeiraId)
      if (conta.tipo === 'estudante' && uso.escondido) negar() // capítulo ainda escondido
    }
    else if (uso.tipo === 'entrega') {
      if (conta.tipo === 'estudante' && uso.estudanteId !== conta.id) negar()
      if (conta.tipo === 'docente') await this.#cadeiraDoDocente(conta, uso.cadeiraId)
    } else if (uso.tipo === 'pedido' && uso.estudanteId !== conta.id) negar()
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }

  // ---------- docente: capítulos da cadeira ----------

  // capítulo indicado num formulário: tem de ser desta cadeira (vazio = secção geral)
  async #secaoDaCadeira(cadeiraId, secaoId) {
    if (secaoId === undefined || secaoId === null || secaoId === '' || secaoId === 'null') return null
    const secao = await this.academico.secao(secaoId)
    if (!secao || secao.cadeiraId !== cadeiraId) throw new ErroValidacao('Capítulo inválido.', { campo: 'secaoId' })
    return secao.id
  }

  async #secaoDoDocente(ctx, id) {
    const secao = await this.academico.secao(id)
    if (!secao) throw new NaoEncontrado('Capítulo não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, secao.cadeiraId)
    return secao
  }

  #camposSecao(dados) {
    return {
      ...(dados.titulo !== undefined ? { titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 150 }) } : {}),
      ...(dados.resumo !== undefined ? { resumo: texto(dados.resumo, 'resumo', 'Resumo', { max: 3000, obrigatorio: false }) } : {}),
      ...(dados.visivel !== undefined ? { visivel: Boolean(dados.visivel) } : {}),
    }
  }

  async criarSecao(ctx, cadeiraId, dados) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    if (dados.titulo === undefined) throw new ErroValidacao('Indique o título.', { campo: 'titulo' })
    return this.academico.criarSecao({ cadeiraId: cadeira.id, ...this.#camposSecao(dados) })
  }

  async atualizarSecao(ctx, id, dados) {
    const secao = await this.#secaoDoDocente(ctx, id)
    return this.academico.atualizarSecao(secao.id, this.#camposSecao(dados))
  }

  async apagarSecao(ctx, id) {
    const secao = await this.#secaoDoDocente(ctx, id)
    await this.academico.apagarSecao(secao.id)
  }

  async ordenarSecoes(ctx, cadeiraId, ids) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const minhas = new Set((await this.academico.secoes(cadeira.id)).map((x) => x.id))
    const lista = ids.map(Number)
    if (lista.length !== minhas.size || lista.some((x) => !minhas.has(x)) || new Set(lista).size !== lista.length) {
      throw new ErroValidacao('A ordem tem de incluir todos os capítulos da cadeira, uma vez cada.')
    }
    await this.academico.ordenarSecoes(cadeira.id, lista)
    return this.academico.secoes(cadeira.id)
  }

  // muda um material, trabalho ou questionário de capítulo
  async moverAtividade(ctx, { tipo, id, secaoId }) {
    const buscar = { material: (x) => this.academico.material(x), trabalho: (x) => this.academico.trabalho(x), questionario: (x) => this.recursos.questionario(x) }[tipo]
    if (!buscar) throw new ErroValidacao('Tipo de atividade inválido.', { campo: 'tipo' })
    const atividade = await buscar(id)
    if (!atividade) throw new NaoEncontrado('Atividade não encontrada.')
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, atividade.cadeiraId)
    await this.academico.moverAtividade(tipo, atividade.id, await this.#secaoDaCadeira(cadeira.id, secaoId))
  }

  // participantes da cadeira (docentes e estudantes da turma), como no Moodle
  async participantes(ctx, cadeiraId) {
    const cadeira = await this.#cadeiraAcessivel(ctx.conta, cadeiraId)
    const estudantes = await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)
    return {
      docentes: cadeira.docentes.map((d) => ({ id: d.id, nome: d.nome, email: d.email, papel: d.papel })),
      estudantes: estudantes.map((e) => ({ id: e.id, nome: e.nome, numero: e.numero, email: e.email })),
    }
  }

  // ---------- docente: materiais e avisos ----------

  async criarMaterial(ctx, cadeiraId, dados, ficheiro) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e })
    const tipo = escolha(dados.tipo, 'tipo', 'Tipo', TIPOS_MATERIAL)
    const base = {
      cadeiraId: cadeira.id, autorId: ctx.conta.id, tipo,
      titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
      secaoId: await this.#secaoDaCadeira(cadeira.id, dados.secaoId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e }),
    }
    if (tipo === 'ficheiro') {
      if (!ficheiro) throw new ErroValidacao('Escolha o ficheiro.', { campo: 'ficheiro' })
      return this.academico.criarMaterial({ ...base, ficheiroId: await this.#registarFicheiro(ficheiro, ctx.conta.id) })
    }
    if (ficheiro) this.privados.apagar(ficheiro.caminho)
    const url = String(dados.url || '').trim()
    if (!/^https?:\/\//.test(url) || !urlSegura(url)) throw new ErroValidacao('Indique um endereço começado por https://', { campo: 'url' })
    return this.academico.criarMaterial({ ...base, url })
  }

  async apagarMaterial(ctx, id) {
    const m = await this.academico.material(id)
    if (!m) throw new NaoEncontrado('Material não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, m.cadeiraId)
    await this.academico.apagarMaterial(m.id)
  }

  async criarAviso(ctx, cadeiraId, { titulo, texto: corpo }) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    return this.academico.criarAvisoCadeira({
      cadeiraId: cadeira.id, autorId: ctx.conta.id,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
    })
  }

  async apagarAviso(ctx, id) {
    const a = await this.academico.avisoCadeira(id)
    if (!a) throw new NaoEncontrado('Aviso não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, a.cadeiraId)
    await this.academico.apagarAvisoCadeira(a.id)
  }

  // ---------- docente: pauta ----------

  // pauta completa em matriz: estudantes × (1.ª prova, 2.ª prova, MAC, exame, recurso, final)
  async pauta(ctx, cadeiraId) {
    return this.pautas.pauta(await this.#cadeiraDoDocente(ctx.conta, cadeiraId))
  }

  async gravarPauta(ctx, cadeiraId, linhas) {
    return this.pautas.gravar(ctx, await this.#cadeiraDoDocente(ctx.conta, cadeiraId), linhas, quem(ctx.conta))
  }

  async publicarNotas(ctx, cadeiraId, componentes) {
    return this.pautas.publicar(ctx, await this.#cadeiraDoDocente(ctx.conta, cadeiraId), componentes, quem(ctx.conta))
  }

  // ---------- docente: trabalhos e entregas ----------

  #dadosTrabalho(dados) {
    const prazo = new Date(dados.prazo)
    if (Number.isNaN(prazo.getTime())) throw new ErroValidacao('Indique a data e hora do prazo.', { campo: 'prazo' })
    return {
      titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      enunciado: texto(dados.enunciado, 'enunciado', 'Enunciado', { max: 10000, obrigatorio: false }),
      prazo,
      aceitaAtraso: dados.aceitaAtraso === true || dados.aceitaAtraso === 'true',
    }
  }

  async criarTrabalho(ctx, cadeiraId, dados, ficheiro) {
    let cadeira
    let campos
    try {
      cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
      campos = this.#dadosTrabalho(dados)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const secaoId = await this.#secaoDaCadeira(cadeira.id, dados.secaoId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e })
    const ficheiroId = ficheiro ? await this.#registarFicheiro(ficheiro, ctx.conta.id) : null
    return this.academico.criarTrabalho({ cadeiraId: cadeira.id, ...campos, secaoId, ficheiroId })
  }

  async apagarTrabalho(ctx, id) {
    const t = await this.academico.trabalho(id)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
    await this.academico.apagarTrabalho(t.id)
  }

  // entregas de um trabalho, incluindo quem ainda não entregou
  async entregas(ctx, trabalhoId) {
    const t = await this.academico.trabalho(trabalhoId)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const [estudantes, entregas] = await Promise.all([this.academico.estudantesAtivosDaTurma(cadeira.turmaId), this.academico.entregasDoTrabalho(t.id)])
    const porEstudante = Object.fromEntries(entregas.map((e) => [e.estudanteId, e]))
    return {
      trabalho: t,
      linhas: estudantes.map((e) => {
        const x = porEstudante[e.id]
        return { estudante: e, entrega: x ? { ...x, atrasada: entregaAtrasada(x.entregueEm, t.prazo) } : null }
      }),
    }
  }

  async corrigir(ctx, entregaId, { nota, correcao }) {
    const e = await this.academico.entrega(entregaId)
    if (!e) throw new NaoEncontrado('Entrega não encontrada.')
    const t = await this.academico.trabalho(e.trabalhoId)
    await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
    return this.academico.corrigirEntrega(e.id, {
      nota: validarNota(nota),
      correcao: texto(correcao, 'correcao', 'Comentário de correção', { max: 5000, obrigatorio: false }),
    })
  }

  // ---------- docente: aulas e presenças ----------

  async aulas(ctx, cadeiraId) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const [aulas, estudantes] = await Promise.all([this.academico.aulas(cadeira.id), this.academico.estudantesAtivosDaTurma(cadeira.turmaId)])
    return { aulas, estudantes }
  }

  async #presencasValidas(cadeira, presencas) {
    const validos = new Set((await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)).map((e) => e.id))
    return (presencas || []).map((p) => {
      if (!validos.has(Number(p.estudanteId))) throw new ErroValidacao('A lista de presenças tem um estudante que não pertence à turma.')
      return { estudanteId: Number(p.estudanteId), estado: escolha(p.estado, 'estado', 'Presença', ESTADOS_PRESENCA) }
    })
  }

  async registarAula(ctx, cadeiraId, { data, sumario, presencas }) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
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
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.atualizarAula(aula.id, {
      sumario: texto(sumario, 'sumario', 'Sumário', { max: 2000, obrigatorio: false }),
      presencas: await this.#presencasValidas(cadeira, presencas),
    })
  }

  async apagarAula(ctx, id) {
    const aula = await this.academico.aula(id)
    if (!aula) throw new NaoEncontrado('Aula não encontrada.')
    await this.#cadeiraDoDocente(ctx.conta, aula.cadeiraId)
    await this.academico.apagarAula(aula.id)
  }
}

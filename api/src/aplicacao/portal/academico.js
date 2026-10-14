import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { urlSegura } from '../../dominio/comum/urls.js'
import { estadoQuestionario } from '../../dominio/academico/questionarios.js'
import { validarRestricoes } from '../../dominio/academico/disponibilidade.js'
import {
  COMPONENTES_NOTA, ESTADOS_PRESENCA, TIPOS_MATERIAL, TIPOS_PEDIDO,
  TIPOS_ENTREGA, assiduidade, avaliarGrelha, dataValida, entregaAtrasada, escolha, estadoPrazo, prazoDe, resultadoDisciplina, texto, validarGrelha, validarNota,
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
  constructor({ academico, recursos, pautas, notificacoes, copias, disponibilidade, privados, auditoria, relogio }) {
    Object.assign(this, { academico, recursos, pautas, notificacoes, copias, disponibilidade, privados, auditoria, relogio })
  }

  // avisa os estudantes da turma de algo novo na cadeira (não se o capítulo estiver escondido)
  async #avisarEstudantes(ctx, cadeira, secaoId, dados) {
    if (!this.notificacoes) return
    if (secaoId && !(await this.academico.secao(secaoId))?.visivel) return
    await this.notificacoes.notificar(await this.notificacoes.estudantesDaCadeira(cadeira), dados, { excepto: ctx.conta.id })
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
    const questionarios = todosQuestionarios.filter(visivel('questionario')).map(comAcesso('questionario')).map((q) => ({ ...q, estado: estadoQuestionario(q, agora) }))
    const base = {
      ...cadeira, materiais, avisos, horario, questionarios, eventos,
      secoes: (eDocente ? secoes : secoes.filter((x) => x.visivel)).map((x) => ({
        id: x.id, ordem: x.ordem, titulo: x.titulo, resumo: x.resumo, visivel: x.visivel,
        disponivelDe: x.disponivelDe ? new Date(x.disponivelDe).toISOString() : null, fechado: Boolean(x.disponivelDe && new Date(x.disponivelDe) > agora),
      })),
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
      notas: notasVisiveis(minhasNotas[cadeira.id], cadeira.notasPublicadas),
      presencas,
      assiduidade: assiduidade(presencas),
    }
  }

  // ---------- estudante ----------

  async notas(ctx) {
    this.#soEstudante(ctx.conta)
    const cadeiras = await this.#minhasCadeiras(ctx.conta)
    for (const c of cadeiras) await this.pautas.sincronizar(c) // componentes calculadas em dia
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

  // entrega do estudante: ficheiros e/ou texto, conforme o trabalho pede (substitui a anterior)
  async entregar(ctx, trabalhoId, ficheiros, { comentario, texto: escrito }) {
    const { conta } = ctx
    const apagar = () => { for (const f of ficheiros) this.privados.apagar(f.caminho) }
    let trabalho
    let corpo
    try {
      this.#soEstudante(conta)
      trabalho = await this.academico.trabalho(trabalhoId)
      if (!trabalho) throw new NaoEncontrado('Trabalho não encontrado.')
      await this.#cadeiraAcessivel(conta, trabalho.cadeiraId)
      await this.disponibilidade.exigir(trabalho.cadeiraId, conta.id, 'trabalho', trabalho.id)
      const prazo = prazoDe(trabalho, await this.academico.prorrogacao(trabalho.id, conta.id))
      if (estadoPrazo(prazo, this.relogio.agora(), trabalho.aceitaAtraso) === 'fechado') throw new ErroValidacao('O prazo de entrega terminou.')
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
      for (const f of ficheiros) ficheiroIds.push(await this.#registarFicheiro(f, conta.id))
    } catch (e) {
      apagar()
      throw e
    }
    const entrega = await this.academico.gravarEntrega({
      trabalhoId: trabalho.id, estudanteId: conta.id, ficheiroIds, texto: corpo, comentario: texto(comentario, 'comentario', 'Comentário', { max: 2000, obrigatorio: false }),
    })
    await this.auditoria.registar(ctx, { acao: 'entregar_trabalho', colecao: 'trabalhos', alvoId: trabalho.id, alvoTitulo: trabalho.titulo, detalhes: { ficheiros: ficheiroIds.length }, utilizador: quem(conta) })
    const prazo = prazoDe(trabalho, await this.academico.prorrogacao(trabalho.id, conta.id))
    return { ...entrega, atrasada: entregaAtrasada(entrega.entregueEm, prazo) }
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
      if (conta.tipo === 'estudante' && uso.atividade) {
        const { acessos } = await this.disponibilidade.acessos(uso.cadeiraId, conta.id)
        const a = acessos[uso.atividade]
        if (!a || a.escondida || !a.aberta) negar()
      }
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
      ...(dados.disponivelDe !== undefined ? { disponivelDe: dados.disponivelDe ? this.#dataValida(dados.disponivelDe) : null } : {}),
    }
  }

  #dataValida(v) {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) throw new ErroValidacao('Data inválida.', { campo: 'disponivelDe' })
    return d
  }

  // restrições de uma atividade: esconder, data de abertura, condições (como o "Restrict access" do Moodle)
  async restricoes(ctx, { tipo, id, ...dados }) {
    const buscar = { material: (x) => this.academico.material(x), trabalho: (x) => this.academico.trabalho(x), questionario: (x) => this.recursos.questionario(x) }[tipo]
    if (!buscar) throw new ErroValidacao('Tipo de atividade inválido.', { campo: 'tipo' })
    const a = await buscar(id)
    if (!a) throw new NaoEncontrado('Atividade não encontrada.')
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, a.cadeiraId)
    const { lista } = await this.disponibilidade.atividades(cadeira.id)
    const mudanca = validarRestricoes(dados, new Set(lista.map((x) => x.chave)), `${tipo}-${a.id}`)
    await this.academico.restringirAtividade(tipo, a.id, mudanca)
    return { tipo, id: a.id, ...mudanca }
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

  // importar conteúdos de outra cadeira do mesmo docente (como o "Importar" do Moodle)
  async importar(ctx, destinoId, { origemId }) {
    const destino = await this.#cadeiraDoDocente(ctx.conta, destinoId)
    const origem = await this.#cadeiraDoDocente(ctx.conta, origemId)
    return this.copias.copiar(ctx, origem, destino, { docentes: false }, quem(ctx.conta))
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
    let m
    if (tipo === 'ficheiro') {
      if (!ficheiro) throw new ErroValidacao('Escolha o ficheiro.', { campo: 'ficheiro' })
      m = await this.academico.criarMaterial({ ...base, ficheiroId: await this.#registarFicheiro(ficheiro, ctx.conta.id) })
    } else {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      const url = String(dados.url || '').trim()
      if (!/^https?:\/\//.test(url) || !urlSegura(url)) throw new ErroValidacao('Indique um endereço começado por https://', { campo: 'url' })
      m = await this.academico.criarMaterial({ ...base, url })
    }
    await this.#avisarEstudantes(ctx, cadeira, m.secaoId, { tipo: 'material', titulo: `Novo material em ${cadeira.nome}`, texto: m.titulo, ligacao: `/cadeiras/${cadeira.id}` })
    return m
  }

  async apagarMaterial(ctx, id) {
    const m = await this.academico.material(id)
    if (!m) throw new NaoEncontrado('Material não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, m.cadeiraId)
    await this.academico.apagarMaterial(m.id)
  }

  async criarAviso(ctx, cadeiraId, { titulo, texto: corpo }) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const a = await this.academico.criarAvisoCadeira({
      cadeiraId: cadeira.id, autorId: ctx.conta.id,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
    })
    await this.#avisarEstudantes(ctx, cadeira, null, { tipo: 'aviso', titulo: `Aviso em ${cadeira.nome}: ${a.titulo}`, texto: a.texto.slice(0, 300), ligacao: `/cadeiras/${cadeira.id}?separador=avisos` })
    return a
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

  async definirComposicao(ctx, cadeiraId, { componente, itens }) {
    return this.pautas.definirComposicao(ctx, await this.#cadeiraDoDocente(ctx.conta, cadeiraId), componente, itens, quem(ctx.conta))
  }

  // ---------- docente: trabalhos e entregas ----------

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
    return r
  }

  async editarTrabalho(ctx, id, dados) {
    const t = await this.academico.trabalho(id)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
    await this.academico.atualizarTrabalho(t.id, this.#dadosTrabalho(dados, true))
    return this.academico.trabalho(t.id)
  }

  // prazo alargado só para um estudante (prazo null retira a prorrogação)
  async prorrogar(ctx, trabalhoId, { estudanteId, prazo, motivo }) {
    const t = await this.academico.trabalho(trabalhoId)
    if (!t) throw new NaoEncontrado('Trabalho não encontrado.')
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
    const id = Number(estudanteId)
    if (!(await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)).some((e) => e.id === id)) throw new ErroValidacao('O estudante não pertence à turma.', { campo: 'estudanteId' })
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
      cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
      campos = this.#dadosTrabalho(dados)
    } catch (e) {
      if (ficheiro) this.privados.apagar(ficheiro.caminho)
      throw e
    }
    const secaoId = await this.#secaoDaCadeira(cadeira.id, dados.secaoId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e })
    const ficheiroId = ficheiro ? await this.#registarFicheiro(ficheiro, ctx.conta.id) : null
    const t = await this.academico.criarTrabalho({ cadeiraId: cadeira.id, ...campos, secaoId, ficheiroId })
    await this.#avisarEstudantes(ctx, cadeira, secaoId, {
      tipo: 'trabalho', titulo: `Novo trabalho em ${cadeira.nome}: ${t.titulo}`, texto: `Prazo de entrega: ${new Date(t.prazo).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}`,
      ligacao: `/cadeiras/${cadeira.id}?atividade=trabalho-${t.id}`,
    })
    return t
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
    const [estudantes, entregas, prorrogacoes] = await Promise.all([
      this.academico.estudantesAtivosDaTurma(cadeira.turmaId), this.academico.entregasDoTrabalho(t.id), this.academico.prorrogacoes(t.id),
    ])
    const porEstudante = Object.fromEntries(entregas.map((e) => [e.estudanteId, e]))
    return {
      trabalho: t,
      linhas: estudantes.map((e) => {
        const x = porEstudante[e.id]
        const prazo = prazoDe(t, prorrogacoes[e.id])
        return { estudante: e, prorrogacao: prorrogacoes[e.id] || null, entrega: x ? { ...x, atrasada: entregaAtrasada(x.entregueEm, prazo) } : null }
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
      cadeira = await this.#cadeiraDoDocente(ctx.conta, t.cadeiraId)
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
    if (ficheiro) dados.correcaoFicheiroId = await this.#registarFicheiro(ficheiro, ctx.conta.id)
    else if (removerFicheiro === true || removerFicheiro === 'true') dados.correcaoFicheiroId = null
    const r = await this.academico.corrigirEntrega(e.id, dados)
    await this.pautas.sincronizar(cadeira) // a nota pode contar para uma componente da pauta
    await this.notificacoes?.notificar([e.estudanteId], {
      tipo: 'correcao', titulo: `Trabalho corrigido: ${t.titulo}`, texto: `${cadeira.nome}${r.nota !== null ? ` — nota ${r.nota} valores` : ''}`,
      ligacao: `/cadeiras/${cadeira.id}?atividade=trabalho-${t.id}`,
    })
    return r
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

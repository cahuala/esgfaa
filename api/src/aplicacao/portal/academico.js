import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../dominio/comum/erros.js'
import { urlSegura } from '../../dominio/comum/urls.js'
import {
  COMPONENTES_NOTA, ESTADOS_PRESENCA, NOMES_COMPONENTES, TIPOS_MATERIAL, TIPOS_PEDIDO,
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
  constructor({ academico, privados, auditoria, relogio }) {
    Object.assign(this, { academico, privados, auditoria, relogio })
  }

  // ---------- acesso ----------

  async #cadeiraAcessivel(conta, cadeiraId) {
    const cadeira = await this.academico.cadeira(cadeiraId)
    if (cadeira) {
      if (conta.tipo === 'docente' && cadeira.docente?.id === conta.id) return cadeira
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
    const [materiais, avisos, trabalhos, horario] = await Promise.all([
      this.academico.materiais(cadeira.id),
      this.academico.avisosDaCadeira(cadeira.id),
      this.academico.trabalhos(cadeira.id),
      this.academico.horariosDasCadeiras([cadeira.id]),
    ])
    const base = { ...cadeira, materiais, avisos, horario }

    if (conta.tipo === 'docente') {
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
      cadeira: { id: c.id, codigo: c.codigo, nome: c.nome, semestre: c.semestre, horas: c.horas, docente: c.docente?.nome || '' },
      publicadas: c.notasPublicadas,
      ...notasVisiveis(notas[c.id], c.notasPublicadas),
    }))
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
    if (uso.tipo === 'material' || uso.tipo === 'enunciado') await this.#cadeiraAcessivel(conta, uso.cadeiraId)
    else if (uso.tipo === 'entrega') {
      if (conta.tipo === 'estudante' && uso.estudanteId !== conta.id) negar()
      if (conta.tipo === 'docente') await this.#cadeiraDoDocente(conta, uso.cadeiraId)
    } else if (uso.tipo === 'pedido' && uso.estudanteId !== conta.id) negar()
    return { caminho: this.privados.absoluto(f.caminho), nome: f.nome, tipo: f.tipo }
  }

  // ---------- docente: materiais e avisos ----------

  async criarMaterial(ctx, cadeiraId, dados, ficheiro) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId).catch((e) => { if (ficheiro) this.privados.apagar(ficheiro.caminho); throw e })
    const tipo = escolha(dados.tipo, 'tipo', 'Tipo', TIPOS_MATERIAL)
    const base = {
      cadeiraId: cadeira.id, autorId: ctx.conta.id, tipo,
      titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
      topico: texto(dados.topico, 'topico', 'Tópico', { max: 120, obrigatorio: false }),
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
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const [estudantes, notas] = await Promise.all([
      this.academico.estudantesAtivosDaTurma(cadeira.turmaId),
      this.academico.pautaDaCadeira(cadeira.id),
    ])
    return {
      cadeira, publicadas: cadeira.notasPublicadas,
      linhas: estudantes.map((e) => {
        const n = Object.fromEntries(COMPONENTES_NOTA.map((k) => [k, notas[e.id]?.[k] ?? null]))
        return { estudante: e, ...n, observacao: notas[e.id]?.observacao || '', ...resultadoDisciplina(n) }
      }),
    }
  }

  async gravarPauta(ctx, cadeiraId, linhas) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const validos = new Set((await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)).map((e) => e.id))
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
    await this.academico.gravarPauta(cadeira.id, notas)
    await this.auditoria.registar(ctx, { acao: 'lancar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: cadeira.nome, detalhes: { estudantes: notas.length }, utilizador: quem(ctx.conta) })
    return this.pauta(ctx, cadeira.id)
  }

  // escolhe que componentes da pauta os estudantes já podem ver
  async publicarNotas(ctx, cadeiraId, componentes) {
    const cadeira = await this.#cadeiraDoDocente(ctx.conta, cadeiraId)
    const lista = [...new Set(componentes)]
    if (lista.some((k) => !COMPONENTES_NOTA.includes(k))) throw new ErroValidacao('Componente de avaliação desconhecida.')
    const ordenada = COMPONENTES_NOTA.filter((k) => lista.includes(k))
    await this.academico.publicarNotas(cadeira.id, ordenada)
    const novas = ordenada.filter((k) => !cadeira.notasPublicadas.includes(k))
    if (novas.length) {
      await this.auditoria.registar(ctx, { acao: 'publicar_notas', colecao: 'pautas', alvoId: cadeira.id, alvoTitulo: `${novas.map((k) => NOMES_COMPONENTES[k]).join(', ')} — ${cadeira.nome}`, utilizador: quem(ctx.conta) })
    }
    return this.pauta(ctx, cadeira.id)
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
    const ficheiroId = ficheiro ? await this.#registarFicheiro(ficheiro, ctx.conta.id) : null
    return this.academico.criarTrabalho({ cadeiraId: cadeira.id, ...campos, ficheiroId })
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

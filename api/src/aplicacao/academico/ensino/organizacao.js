import { ErroValidacao, NaoEncontrado, SemPermissao } from '../../../dominio/comum/erros.js'
import { validarRestricoes } from '../../../dominio/academico/atividades/disponibilidade.js'
import { texto } from '../../../dominio/academico/comum/validacao.js'
import { quem } from '../partilhado/autor.js'

// Organização da cadeira pelo docente: capítulos, restrições de acesso, mudar de capítulo, importar e participantes.
export class ServicoOrganizacao {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async #secaoDoDocente(ctx, id) {
    const secao = await this.academico.secao(id)
    if (!secao) throw new NaoEncontrado('Capítulo não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, secao.cadeiraId)
    return secao
  }

  #camposSecao(dados) {
    return {
      ...(dados.titulo !== undefined ? { titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 150 }) } : {}),
      ...(dados.resumo !== undefined ? { resumo: texto(dados.resumo, 'resumo', 'Resumo', { max: 3000, obrigatorio: false }) } : {}),
      ...(dados.visivel !== undefined ? { visivel: Boolean(dados.visivel) } : {}),
      ...(dados.disponivelDe !== undefined ? { disponivelDe: dados.disponivelDe ? this.apoio.dataValida(dados.disponivelDe) : null } : {}),
    }
  }

  // restrições de uma atividade: esconder, data de abertura, condições (como o "Restrict access" do Moodle)
  // como encontrar cada tipo de atividade; a avaliação do docente é da Administração Escolar
  #buscarAtividade(tipo) {
    const buscar = { material: (x) => this.academico.material(x), trabalho: (x) => this.academico.trabalho(x), questionario: (x) => this.recursos.questionario(x), inquerito: (x) => this.inqueritos.inquerito(x), workshop: (x) => this.workshops.workshop(x) }[tipo]
    if (!buscar) return null
    return async (id) => {
      const a = await buscar(id)
      if (a?.tipo === 'avaliacao' && tipo === 'inquerito') throw new SemPermissao('A avaliação do docente é gerida pela Administração Escolar.')
      return a
    }
  }

  async restricoes(ctx, { tipo, id, ...dados }) {
    const buscar = this.#buscarAtividade(tipo)
    if (!buscar) throw new ErroValidacao('Tipo de atividade inválido.', { campo: 'tipo' })
    const a = await buscar(id)
    if (!a) throw new NaoEncontrado('Atividade não encontrada.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, a.cadeiraId)
    const { lista } = await this.disponibilidade.atividades(cadeira.id)
    const mudanca = validarRestricoes(dados, new Set(lista.map((x) => x.chave)), `${tipo}-${a.id}`)
    await this.academico.restringirAtividade(tipo, a.id, mudanca)
    return { tipo, id: a.id, ...mudanca }
  }

  async criarSecao(ctx, cadeiraId, dados) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
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
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
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
    const buscar = this.#buscarAtividade(tipo)
    if (!buscar) throw new ErroValidacao('Tipo de atividade inválido.', { campo: 'tipo' })
    const atividade = await buscar(id)
    if (!atividade) throw new NaoEncontrado('Atividade não encontrada.')
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, atividade.cadeiraId)
    await this.academico.moverAtividade(tipo, atividade.id, await this.apoio.secaoDaCadeira(cadeira.id, secaoId))
  }

  // importar conteúdos de outra cadeira do mesmo docente (como o "Importar" do Moodle)
  async importar(ctx, destinoId, { origemId }) {
    const destino = await this.apoio.cadeiraDoDocente(ctx.conta, destinoId)
    const origem = await this.apoio.cadeiraDoDocente(ctx.conta, origemId)
    return this.copias.copiar(ctx, origem, destino, { docentes: false }, quem(ctx.conta))
  }

  // participantes da cadeira (docentes e estudantes da turma), como no Moodle
  async participantes(ctx, cadeiraId) {
    const cadeira = await this.apoio.cadeiraAcessivel(ctx.conta, cadeiraId)
    const estudantes = await this.academico.estudantesAtivosDaTurma(cadeira.turmaId)
    return {
      docentes: cadeira.docentes.map((d) => ({ id: d.id, nome: d.nome, email: d.email, papel: d.papel })),
      estudantes: estudantes.map((e) => ({ id: e.id, nome: e.nome, numero: e.numero, email: e.email })),
    }
  }
}

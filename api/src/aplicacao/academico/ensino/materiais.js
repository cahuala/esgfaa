import { randomBytes } from 'node:crypto'
import { ErroValidacao, NaoEncontrado } from '../../../dominio/comum/erros.js'
import { validarLicao, validarLivro } from '../../../dominio/academico/atividades/livroLicao.js'
import { urlSegura } from '../../../dominio/comum/urls.js'
import { TIPOS_MATERIAL, TIPOS_PACOTE } from '../../../dominio/academico/atividades/materiais.js'
import { escolha, texto } from '../../../dominio/academico/comum/validacao.js'

// Materiais (ficheiros, ligações, páginas, pastas, videoconferências) e avisos da cadeira.
export class ServicoMateriais {
  constructor(dependencias) {
    Object.assign(this, dependencias)
  }

  async criarMaterial(ctx, cadeiraId, dados, recebidos = []) {
    const ficheiros = (Array.isArray(recebidos) ? recebidos : [recebidos]).filter(Boolean)
    const largar = () => { for (const f of ficheiros) this.privados.apagar(f.caminho) }
    try {
      const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
      const tipo = escolha(dados.tipo, 'tipo', 'Tipo', TIPOS_MATERIAL)
      const base = {
        cadeiraId: cadeira.id, autorId: ctx.conta.id, tipo,
        titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 }),
        descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }),
        secaoId: await this.apoio.secaoDaCadeira(cadeira.id, dados.secaoId),
        ...this.#camposMaterial(tipo, dados, { novo: true }),
      }
      if (tipo === 'ficheiro' && ficheiros.length !== 1) throw new ErroValidacao('Escolha o ficheiro.', { campo: 'ficheiro' })
      if (tipo === 'pasta' && ficheiros.length === 0) throw new ErroValidacao('Junte pelo menos um ficheiro à pasta.', { campo: 'ficheiros' })
      const comFicheiro = tipo === 'ficheiro' || TIPOS_PACOTE.includes(tipo)
      if (TIPOS_PACOTE.includes(tipo) && (ficheiros.length !== 1 || ficheiros[0].tipo !== 'application/zip')) {
        throw new ErroValidacao(tipo === 'scorm' ? 'Escolha o pacote SCORM (ficheiro .zip).' : 'Escolha o conteúdo H5P (ficheiro .h5p).', { campo: 'ficheiro' })
      }
      if (!comFicheiro && tipo !== 'pasta') largar()
      let m
      // SCORM e H5P: o zip abre-se (e confirma-se) antes de guardar; o original fica para as cópias
      if (TIPOS_PACOTE.includes(tipo)) {
        const estrutura = this.pacotes.abrirZip(ficheiros[0].caminho, tipo)
        m = await this.academico.criarMaterial({ ...base, estrutura, ficheiroId: await this.apoio.registarFicheiro(ficheiros[0], ctx.conta.id) })
      } else if (tipo === 'ficheiro') m = await this.academico.criarMaterial({ ...base, ficheiroId: await this.apoio.registarFicheiro(ficheiros[0], ctx.conta.id) })
      else if (tipo === 'pasta') {
        const ids = []
        for (const f of ficheiros) ids.push(await this.apoio.registarFicheiro(f, ctx.conta.id))
        m = await this.academico.criarMaterial({ ...base, ficheiros: { create: ids.map((ficheiroId, ordem) => ({ ficheiroId, ordem })) } })
      } else m = await this.academico.criarMaterial(base)
      await this.apoio.avisarEstudantes(ctx, cadeira, m.secaoId, {
        tipo: 'material', titulo: tipo === 'videoconferencia' ? `Videoconferência em ${cadeira.nome}` : `Novo material em ${cadeira.nome}`,
        texto: tipo === 'videoconferencia' && m.inicio ? `${m.titulo} · ${new Date(m.inicio).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', dateStyle: 'short', timeStyle: 'short' })}` : m.titulo,
        ligacao: `/cadeiras/${cadeira.id}`,
      })
      return this.academico.material(m.id)
    } catch (e) {
      largar()
      throw e
    }
  }

  // campos próprios de cada tipo: endereço, texto da página, hora da videoconferência
  #camposMaterial(tipo, d, { novo = false } = {}) {
    const r = {}
    // videoconferência na sala do portal: o portal cria uma sala Jitsi com um nome difícil de adivinhar
    const salaPortal = tipo === 'videoconferencia' && (d.salaPortal === true || d.salaPortal === 'true')
    if (salaPortal) r.url = `${this.jitsiUrl || 'https://meet.jit.si'}/ESGFAA-${randomBytes(9).toString('hex')}`
    else if (['ligacao', 'video', 'videoconferencia'].includes(tipo) && (novo || d.url !== undefined)) {
      const url = String(d.url || '').trim()
      if (!/^https?:\/\//.test(url) || !urlSegura(url)) throw new ErroValidacao('Indique um endereço começado por https://', { campo: 'url' })
      r.url = url
    }
    if (tipo === 'pagina' && (novo || d.conteudo !== undefined)) {
      const html = String(d.conteudo || '')
      if (html.length > 200_000) throw new ErroValidacao('A página é demasiado longa.', { campo: 'conteudo' })
      r.conteudo = this.filtroHtml(html)
      if (!r.conteudo.replace(/<[^>]*>/g, '').trim() && !/<img|<iframe|<video/i.test(r.conteudo)) throw new ErroValidacao('Escreva o conteúdo da página.', { campo: 'conteudo' })
    }
    // livro (capítulos) e lição (páginas com perguntas): começam com uma página, que o docente depois escreve
    if (tipo === 'livro' && (novo || d.estrutura !== undefined)) r.estrutura = validarLivro(d.estrutura ?? [{ titulo: 'Introdução', conteudo: '' }], this.filtroHtml)
    if (tipo === 'licao' && (novo || d.estrutura !== undefined)) r.estrutura = validarLicao(d.estrutura ?? [{ id: 'p1', titulo: 'Introdução', conteudo: '' }], this.filtroHtml)
    if (tipo === 'videoconferencia') {
      if (novo || d.inicio !== undefined) {
        r.inicio = this.apoio.dataValida(d.inicio, 'inicio')
        if (!r.inicio) throw new ErroValidacao('Indique o dia e a hora da sessão.', { campo: 'inicio' })
      }
      if (novo || d.duracao !== undefined) {
        const n = Number(d.duracao || 60)
        if (!Number.isInteger(n) || n < 5 || n > 600) throw new ErroValidacao('A duração vai de 5 a 600 minutos.', { campo: 'duracao' })
        r.duracao = n
      }
    }
    return r
  }

  async editarMaterial(ctx, id, dados, recebidos = []) {
    const ficheiros = (recebidos || []).filter(Boolean)
    const largar = () => { for (const f of ficheiros) this.privados.apagar(f.caminho) }
    try {
      const m = await this.academico.material(id)
      if (!m) throw new NaoEncontrado('Material não encontrado.')
      await this.apoio.cadeiraDoDocente(ctx.conta, m.cadeiraId)
      const mudanca = {
        ...(dados.titulo !== undefined ? { titulo: texto(dados.titulo, 'titulo', 'Título', { min: 2, max: 200 }) } : {}),
        ...(dados.descricao !== undefined ? { descricao: texto(dados.descricao, 'descricao', 'Descrição', { max: 2000, obrigatorio: false }) } : {}),
        ...this.#camposMaterial(m.tipo, dados),
      }
      if (ficheiros.length && m.tipo !== 'pasta') throw new ErroValidacao('Só as pastas recebem mais ficheiros.', { campo: 'ficheiros' })
      const retirar = (dados.retirarFicheiros || []).map(String).filter((x) => m.ficheiros.some((f) => f.id === x))
      if (m.tipo === 'pasta' && m.ficheiros.length - retirar.length + ficheiros.length > 50) throw new ErroValidacao('Uma pasta tem até 50 ficheiros.', { campo: 'ficheiros' })
      const novos = []
      for (const f of ficheiros) novos.push(await this.apoio.registarFicheiro(f, ctx.conta.id))
      await this.academico.editarMaterial(m.id, mudanca, { juntar: novos, retirar, ordemBase: m.ficheiros.length })
      return this.academico.material(m.id)
    } catch (e) {
      largar()
      throw e
    }
  }

  async apagarMaterial(ctx, id) {
    const m = await this.academico.material(id)
    if (!m) throw new NaoEncontrado('Material não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, m.cadeiraId)
    await this.academico.apagarMaterial(m.id)
  }

  async criarAviso(ctx, cadeiraId, { titulo, texto: corpo }) {
    const cadeira = await this.apoio.cadeiraDoDocente(ctx.conta, cadeiraId)
    const a = await this.academico.criarAvisoCadeira({
      cadeiraId: cadeira.id, autorId: ctx.conta.id,
      titulo: texto(titulo, 'titulo', 'Título', { min: 2, max: 200 }),
      texto: texto(corpo, 'texto', 'Texto', { min: 2, max: 5000 }),
    })
    await this.apoio.avisarEstudantes(ctx, cadeira, null, { tipo: 'aviso', titulo: `Aviso em ${cadeira.nome}: ${a.titulo}`, texto: a.texto.slice(0, 300), ligacao: `/cadeiras/${cadeira.id}?separador=avisos` })
    return a
  }

  async apagarAviso(ctx, id) {
    const a = await this.academico.avisoCadeira(id)
    if (!a) throw new NaoEncontrado('Aviso não encontrado.')
    await this.apoio.cadeiraDoDocente(ctx.conta, a.cadeiraId)
    await this.academico.apagarAvisoCadeira(a.id)
  }
}

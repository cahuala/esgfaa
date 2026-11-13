import { invalido, naoEncontrado } from '../erros.js'

const limpo = (t, max) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
// o nome do ficheiro no disco não sai do servidor
const publico = (d) => ({ id: d.id, titulo: d.titulo, pasta: d.pasta, nomeOriginal: d.nomeOriginal, mime: d.mime, tamanho: d.tamanho, criadoEm: d.criadoEm })

/*
  Secretária digital de cada conta: os documentos que a pessoa guarda (PDF, imagens, Word, Excel), arrumados
  por pastas que ela própria escreve, para os abrir quando precisar. Só o dono vê, abre, muda e apaga os seus.
*/
export class ServicoPastas {
  constructor({ bd, auditoria, ficheiros }) {
    this.bd = bd
    this.auditoria = auditoria
    this.ficheiros = ficheiros
  }

  async listar(u) {
    const l = await this.bd.documentoGuardado.findMany({ where: { utilizadorId: u.id }, orderBy: [{ pasta: 'asc' }, { criadoEm: 'desc' }] })
    return l.map(publico)
  }

  async guardar(u, { titulo = '', pasta = '' }, ficheiro) {
    const f = await this.ficheiros.guardar(ficheiro)
    const d = await this.bd.documentoGuardado.create({ data: { utilizadorId: u.id, titulo: limpo(titulo, 200) || f.nomeOriginal, pasta: limpo(pasta, 100), ...f } })
    await this.auditoria.registar(u, 'guardar_documento', `${d.pasta ? `${d.pasta} / ` : ''}${d.titulo}`)
    return publico(d)
  }

  // mudar o título ou a pasta
  async editar(u, id, { titulo, pasta }) {
    const d = await this.#meu(u, id)
    const dados = {}
    if (titulo !== undefined) {
      if (!limpo(titulo, 200)) throw invalido('Escreva o título.', 'titulo')
      dados.titulo = limpo(titulo, 200)
    }
    if (pasta !== undefined) dados.pasta = limpo(pasta, 100)
    return publico(await this.bd.documentoGuardado.update({ where: { id: d.id }, data: dados }))
  }

  async ficheiro(u, id) {
    const d = await this.#meu(u, id)
    return { caminho: this.ficheiros.caminho(d.ficheiro), nome: d.nomeOriginal, mime: d.mime }
  }

  async remover(u, id) {
    const d = await this.#meu(u, id)
    await this.bd.documentoGuardado.delete({ where: { id: d.id } })
    this.ficheiros.apagar(d.ficheiro)
    await this.auditoria.registar(u, 'apagar_documento', `${d.pasta ? `${d.pasta} / ` : ''}${d.titulo}`)
  }

  // de outra conta responde como se não existisse
  async #meu(u, id) {
    const d = await this.bd.documentoGuardado.findUnique({ where: { id } })
    if (!d || d.utilizadorId !== u.id) throw naoEncontrado('Documento não encontrado.')
    return d
  }
}

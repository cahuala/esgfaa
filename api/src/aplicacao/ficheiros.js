import { ErroValidacao, SemPermissao } from '../dominio/comum/erros.js'

// Envio de imagens, vídeos e PDF para usar nos conteúdos
export class ServicoFicheiros {
  constructor({ armazenamento, auditoria }) {
    Object.assign(this, { armazenamento, auditoria })
  }

  // só quem pode criar ou editar algum conteúdo (ou páginas) envia ficheiros
  garantirPodeEnviar(ctx) {
    const pode = [...ctx.actor.permissoes].some((p) => /\.(criar|editar)$/.test(p) && !p.startsWith('utilizadores') && !p.startsWith('papeis'))
    if (!pode) throw new SemPermissao('Não tem permissão para enviar ficheiros.')
  }

  // confirma o tipo real de cada ficheiro já gravado; se algum falhar, apagam-se todos
  registar(ctx, ficheiros) {
    this.garantirPodeEnviar(ctx)
    const falso = ficheiros.find((f) => !this.armazenamento.confirmarTipo(f.caminho, f.tipo))
    if (falso) {
      ficheiros.forEach((f) => this.armazenamento.apagar(f.caminho))
      throw new ErroValidacao(`O ficheiro "${falso.nome}" não corresponde ao tipo indicado.`)
    }
    return ficheiros.map((f) => {
      const url = this.armazenamento.urlRelativa(f.caminho)
      this.auditoria.registar(ctx, { acao: 'carregar_ficheiro', alvoTitulo: f.nome, detalhes: { url, tamanho: f.tamanho } })
      return { url, nome: f.nome, tipo: f.tipo, tamanho: f.tamanho }
    })
  }
}

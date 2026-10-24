import { ErroValidacao, SemPermissao } from '../dominio/comum/erros.js'

// Envio de imagens, vídeos e PDF para usar nos conteúdos
export class ServicoFicheiros {
  // otimizar: reduz as imagens grandes (infraestrutura/ficheiros/imagens.js)
  constructor({ armazenamento, auditoria, otimizar = null }) {
    Object.assign(this, { armazenamento, auditoria, otimizar })
  }

  // só quem pode criar ou editar algum conteúdo (ou páginas) envia ficheiros
  garantirPodeEnviar(ctx) {
    const pode = [...ctx.actor.permissoes].some((p) => /\.(criar|editar|gerir)$/.test(p) && !p.startsWith('utilizadores') && !p.startsWith('papeis'))
    if (!pode) throw new SemPermissao('Não tem permissão para enviar ficheiros.')
  }

  // confirma o tipo real de cada ficheiro já gravado; se algum falhar, apagam-se todos
  async registar(ctx, ficheiros) {
    this.garantirPodeEnviar(ctx)
    const falso = ficheiros.find((f) => !this.armazenamento.confirmarTipo(f.caminho, f.tipo))
    if (falso) {
      ficheiros.forEach((f) => this.armazenamento.apagar(f.caminho))
      throw new ErroValidacao(`O ficheiro "${falso.nome}" não corresponde ao tipo indicado.`)
    }
    const resultado = []
    for (const recebido of ficheiros) {
      // uma fotografia de vários MB fica leve (o site abre depressa); se não der, fica a original
      const f = this.otimizar ? await this.otimizar(recebido).catch(() => recebido) : recebido
      const url = this.armazenamento.urlRelativa(f.caminho)
      await this.auditoria.registar(ctx, { acao: 'carregar_ficheiro', alvoTitulo: f.nome, detalhes: { url, tamanho: f.tamanho } })
      resultado.push({ url, nome: f.nome, tipo: f.tipo, tamanho: f.tamanho })
    }
    return resultado
  }
}

import { NOMES_COLECOES, COLECOES } from '../dominio/conteudos/colecoes.js'
import { classificarAgente, origemExterna } from '../dominio/estatisticas/visita.js'
import { visitanteValido } from '../dominio/interacao/comentario.js'

// Visitas ao site, painel inicial e publicidade
export class ServicoEstatisticas {
  constructor({ visitas, interacoes, conteudos, atividades, publicidade, titulos }) {
    Object.assign(this, { visitas, interacoes, conteudos, atividades, publicidade, titulos })
  }

  // página vista (o visitante é um identificador aleatório do navegador, não o IP)
  async registarVisita({ visitante, caminho, origem }, { agente, origemPedido }) {
    const { dispositivo, navegador, robo } = classificarAgente(agente)
    if (robo || !visitanteValido(visitante) || typeof caminho !== 'string' || !caminho.startsWith('/')) return
    await this.visitas.registar({ visitante, caminho: caminho.slice(0, 200), origem: origemExterna(origem, origemPedido), dispositivo, navegador })
  }

  async contarBanner(id, tipo) {
    if (await this.conteudos.publicadoExiste('publicidade', id)) await this.publicidade.contar(id, tipo)
  }

  relatorio(ctx, dias) {
    ctx.actor.exigir('estatisticas.ver')
    return this.visitas.relatorio(Math.min(365, Math.max(1, Number(dias) || 30)))
  }

  async painel(ctx) {
    const { actor } = ctx
    const totais = {}
    const rascunhos = {}
    const porPublicar = []
    for (const c of NOMES_COLECOES) {
      if (actor.pode(`${c}.ver`)) {
        totais[c] = await this.conteudos.contar(c, 'publicado')
        rascunhos[c] = await this.conteudos.contar(c, 'rascunho')
      }
      // rascunhos à espera de publicação (para quem pode publicar)
      if (actor.pode(`${c}.publicar`)) {
        for (const it of await this.conteudos.listar(c)) {
          if (it.estado === 'rascunho') porPublicar.push({ colecao: c, id: it.id, titulo: it.dados[COLECOES[c].titulo], atualizado: it.atualizadoEm, por: it.editadoPor })
        }
      }
    }
    const resposta = { totais, rascunhos, interacoes: await this.interacoes.totais() }
    resposta.porPublicar = porPublicar.sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado))).slice(0, 8)

    const titulos = actor.podeAlguma('estatisticas.ver', 'comentarios.ver') ? await this.titulos() : {}
    if (actor.pode('estatisticas.ver')) {
      const [hoje, semana, mes, online, visitasDias, porItem] = await Promise.all([
        this.visitas.hoje(), this.visitas.resumo(7), this.visitas.resumo(30), this.visitas.online(),
        this.visitas.visitantesPorDia(14), this.interacoes.porItem(),
      ])
      resposta.visitas = { hoje, semana, mes, online }
      resposta.visitasDias = visitasDias
      resposta.maisVistos = Object.entries(porItem)
        .filter(([k]) => titulos[k])
        .map(([k, v]) => ({ chave: k, colecao: k.split('/')[0], titulo: titulos[k], ...v }))
        .sort((a, b) => b.visualizacoes - a.visualizacoes || b.gostos - a.gostos)
        .slice(0, 6)
    }
    if (actor.pode('comentarios.ver')) {
      resposta.comentariosDias = await this.interacoes.comentariosPorDia(14)
      resposta.ultimosComentarios = (await this.interacoes.listarComentarios({ limite: 5 }))
        .map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id }))
    }
    resposta.ultimasAtividades = await this.atividades.ultimas({ utilizadorId: actor.pode('atividades.ver') ? null : actor.id })
    return resposta
  }
}

import { NOMES_COLECOES, COLECOES } from '../dominio/conteudos/colecoes.js'
import { classificarAgente, origemExterna } from '../dominio/estatisticas/visita.js'
import { visitanteValido } from '../dominio/interacao/comentario.js'

// Visitas ao site, painel inicial e publicidade
export class ServicoEstatisticas {
  constructor({ visitas, interacoes, conteudos, atividades, publicidade, titulos }) {
    Object.assign(this, { visitas, interacoes, conteudos, atividades, publicidade, titulos })
  }

  // página vista (o visitante é um identificador aleatório do navegador, não o IP)
  registarVisita({ visitante, caminho, origem }, { agente, origemPedido }) {
    const { dispositivo, navegador, robo } = classificarAgente(agente)
    if (robo || !visitanteValido(visitante) || typeof caminho !== 'string' || !caminho.startsWith('/')) return
    this.visitas.registar({ visitante, caminho: caminho.slice(0, 200), origem: origemExterna(origem, origemPedido), dispositivo, navegador })
  }

  contarBanner(id, tipo) {
    if (this.conteudos.publicadoExiste('publicidade', id)) this.publicidade.contar(id, tipo)
  }

  relatorio(ctx, dias) {
    ctx.actor.exigir('estatisticas.ver')
    return this.visitas.relatorio(Math.min(365, Math.max(1, Number(dias) || 30)))
  }

  painel(ctx) {
    const { actor } = ctx
    const totais = {}
    const rascunhos = {}
    for (const c of NOMES_COLECOES) {
      if (!actor.pode(`${c}.ver`)) continue
      totais[c] = this.conteudos.contar(c, 'publicado')
      rascunhos[c] = this.conteudos.contar(c, 'rascunho')
    }
    const resposta = { totais, rascunhos, interacoes: this.interacoes.totais() }

    // rascunhos à espera de publicação (para quem pode publicar)
    const porPublicar = []
    for (const c of NOMES_COLECOES) {
      if (!actor.pode(`${c}.publicar`)) continue
      for (const it of this.conteudos.listar(c)) {
        if (it.estado === 'rascunho') porPublicar.push({ colecao: c, id: it.id, titulo: it.dados[COLECOES[c].titulo], atualizado: it.atualizadoEm, por: it.editadoPor })
      }
    }
    resposta.porPublicar = porPublicar.sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado))).slice(0, 8)

    const titulos = actor.podeAlguma('estatisticas.ver', 'comentarios.ver') ? this.titulos() : {}
    if (actor.pode('estatisticas.ver')) {
      resposta.visitas = { hoje: this.visitas.hoje(), semana: this.visitas.resumo(7), mes: this.visitas.resumo(30), online: this.visitas.online() }
      resposta.visitasDias = this.visitas.visitantesPorDia(14)
      resposta.maisVistos = Object.entries(this.interacoes.porItem())
        .filter(([k]) => titulos[k])
        .map(([k, v]) => ({ chave: k, colecao: k.split('/')[0], titulo: titulos[k], ...v }))
        .sort((a, b) => b.visualizacoes - a.visualizacoes || b.gostos - a.gostos)
        .slice(0, 6)
    }
    if (actor.pode('comentarios.ver')) {
      resposta.comentariosDias = this.interacoes.comentariosPorDia(14)
      resposta.ultimosComentarios = this.interacoes.listarComentarios({ limite: 5 })
        .map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id }))
    }
    resposta.ultimasAtividades = this.atividades.ultimas({ utilizadorId: actor.pode('atividades.ver') ? null : actor.id })
    return resposta
  }
}

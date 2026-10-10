import { Router } from 'express'
import { z } from 'zod'
import { limitar } from '../middlewares/limites.js'
import { validar } from '../middlewares/validar.js'
import { absolutizar, baseUrl } from '../apresentacao.js'
import * as E from '../esquemas.js'

const pItem = z.object({ colecao: z.string().max(40), id: E.id })
const pBanner = z.object({ id: E.id })

// Rotas do site público: /api/publico/…
export function rotasPublicas({ servicos, config }) {
  const r = Router()
  const L = config.limites
  r.use(limitar(L.publico))

  // todo o conteúdo do site num só pedido (o site é pequeno e assim abre mais depressa)
  r.get('/conteudo', (req, res) => {
    const conteudo = {
      paginas: servicos.paginas.todas(),
      estatisticas: servicos.interacoes.contagens(),
      ...servicos.conteudos.todosPublicados(),
    }
    res.set('Cache-Control', 'no-cache')
    res.json(absolutizar(conteudo, baseUrl(req, config)))
  })

  r.get('/interacoes/:colecao/:id', validar({ params: pItem, query: E.consultaVisitante }), (req, res) => {
    const { colecao, id } = req.dados.params
    res.json(servicos.interacoes.resumo(colecao, id, req.dados.query.visitante))
  })

  r.post('/interacoes/:colecao/:id/visualizacao', validar({ params: pItem, body: E.corpoVisitante }), (req, res) => {
    const { colecao, id } = req.dados.params
    servicos.interacoes.registarVisualizacao(colecao, id, req.dados.body.visitante, req.ip)
    res.status(204).end()
  })

  r.post('/interacoes/:colecao/:id/gosto', limitar(L.gosto), validar({ params: pItem, body: E.corpoVisitante }), (req, res) => {
    const { colecao, id } = req.dados.params
    res.json(servicos.interacoes.alternarGosto(colecao, id, req.dados.body.visitante))
  })

  r.post(
    '/interacoes/:colecao/:id/comentarios',
    limitar(L.comentario, { mensagem: 'Está a comentar demasiado depressa. Aguarde um minuto.' }),
    validar({ params: pItem, body: E.comentario }),
    (req, res) => {
      const { colecao, id } = req.dados.params
      if (req.dados.body.website) return res.status(204).end() // campo escondido: só robôs o preenchem
      res.status(201).json(servicos.interacoes.comentar(colecao, id, req.dados.body, req.ip))
    },
  )

  r.post('/visita', limitar(L.visita), validar({ body: E.visita }), (req, res) => {
    servicos.estatisticas.registarVisita(req.dados.body, { agente: req.get('user-agent') || '', origemPedido: req.get('origin') })
    res.status(204).end()
  })

  r.post('/publicidade/:id/impressao', limitar(L.impressao), validar({ params: pBanner }), (req, res) => {
    servicos.estatisticas.contarBanner(req.dados.params.id, 'impressao')
    res.status(204).end()
  })

  r.post('/publicidade/:id/clique', limitar(L.clique), validar({ params: pBanner }), (req, res) => {
    servicos.estatisticas.contarBanner(req.dados.params.id, 'clique')
    res.status(204).end()
  })

  return r
}

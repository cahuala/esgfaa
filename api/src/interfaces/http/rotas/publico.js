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

  // verificação pública de um certificado do portal pelo código
  // calendário assinado (iCal): o endereço secreto substitui a sessão
  r.get('/calendario/:token', validar({ params: z.object({ token: z.string().max(80) }) }), async (req, res) => {
    const ics = await servicos.ensino.calendario.ical(req.dados.params.token.replace(/\.ics$/, ''))
    res.set({ 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="esg.ics"', 'Cache-Control': 'private, max-age=900' }).send(ics)
  })
  r.get('/certificados/:codigo', validar({ params: z.object({ codigo: z.string().max(40) }) }), async (req, res) => res.json(await servicos.ensino.progresso.verificarCertificado(req.dados.params.codigo)))

  // todo o conteúdo do site num só pedido (o site é pequeno e assim abre mais depressa)
  r.get('/conteudo', async (req, res) => {
    const conteudo = {
      paginas: await servicos.paginas.todas(),
      traducoes: await servicos.traducoes.publicas(),
      estatisticas: await servicos.interacoes.contagens(),
      ...(await servicos.conteudos.todosPublicados()),
    }
    res.set('Cache-Control', 'no-cache')
    res.json(absolutizar(conteudo, baseUrl(req, config)))
  })

  r.get('/interacoes/:colecao/:id', validar({ params: pItem, query: E.consultaVisitante }), async (req, res) => {
    const { colecao, id } = req.dados.params
    res.json(await servicos.interacoes.resumo(colecao, id, req.dados.query.visitante))
  })

  r.post('/interacoes/:colecao/:id/visualizacao', validar({ params: pItem, body: E.corpoVisitante }), async (req, res) => {
    const { colecao, id } = req.dados.params
    await servicos.interacoes.registarVisualizacao(colecao, id, req.dados.body.visitante, req.ip)
    res.status(204).end()
  })

  r.post('/interacoes/:colecao/:id/gosto', limitar(L.gosto), validar({ params: pItem, body: E.corpoVisitante }), async (req, res) => {
    const { colecao, id } = req.dados.params
    res.json(await servicos.interacoes.alternarGosto(colecao, id, req.dados.body.visitante))
  })

  r.post(
    '/interacoes/:colecao/:id/comentarios',
    limitar(L.comentario, { mensagem: 'Está a comentar demasiado depressa. Aguarde um minuto.' }),
    validar({ params: pItem, body: E.comentario }),
    async (req, res) => {
      const { colecao, id } = req.dados.params
      if (req.dados.body.website) return res.status(204).end() // campo escondido: só robôs o preenchem
      res.status(201).json(await servicos.interacoes.comentar(colecao, id, req.dados.body, req.ip))
    },
  )

  // candidatura a um curso (formulário por passos do site)
  r.post('/candidaturas', limitar(L.candidatura, { mensagem: 'Recebemos várias candidaturas deste endereço. Tente de novo mais tarde.' }), validar({ body: E.candidatura }), async (req, res) => {
    if (req.dados.body.website) return res.status(204).end() // campo escondido: só robôs o preenchem
    const { website, ...entrada } = req.dados.body
    void website
    res.status(201).json(await servicos.candidaturas.submeter(entrada, { ip: req.ip, agente: req.get('user-agent') || '', actor: null }))
  })

  r.post('/visita', limitar(L.visita), validar({ body: E.visita }), async (req, res) => {
    await servicos.estatisticas.registarVisita(req.dados.body, { agente: req.get('user-agent') || '', origemPedido: req.get('origin') })
    res.status(204).end()
  })

  r.post('/publicidade/:id/impressao', limitar(L.impressao), validar({ params: pBanner }), async (req, res) => {
    await servicos.estatisticas.contarBanner(req.dados.params.id, 'impressao')
    res.status(204).end()
  })

  r.post('/publicidade/:id/clique', limitar(L.clique), validar({ params: pBanner }), async (req, res) => {
    await servicos.estatisticas.contarBanner(req.dados.params.id, 'clique')
    res.status(204).end()
  })

  return r
}

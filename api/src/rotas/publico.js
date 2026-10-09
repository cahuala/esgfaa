import { Router } from 'express'
import db from '../db.js'
import { limitador } from '../auth.js'
import { COLECOES, INTERATIVAS, PAGINAS, estatisticas, listarColecao, lerItem, lerPagina } from '../conteudo.js'

const rotas = Router()

// Todo o conteúdo do site num só pedido (o site é pequeno e assim abre mais depressa)
rotas.get('/conteudo', (req, res) => {
  const conteudo = { paginas: {}, estatisticas: estatisticas() }
  for (const c of Object.keys(COLECOES)) conteudo[c] = listarColecao(c, req)
  for (const p of PAGINAS) conteudo.paginas[p] = lerPagina(p, req)
  res.set('Cache-Control', 'no-cache')
  res.json(conteudo)
})

// valida a coleção e o item antes de qualquer interação
function itemInterativo(req, res, next) {
  const { colecao, id } = req.params
  if (!INTERATIVAS.includes(colecao)) return res.status(404).json({ erro: 'Coleção inválida.' })
  if (!lerItem(colecao, id, req)) return res.status(404).json({ erro: 'Conteúdo não encontrado.' })
  next()
}

const visitanteValido = (v) => typeof v === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(v)

function resumoInteracoes(colecao, id, visitante) {
  const gostos = db.prepare('SELECT COUNT(*) n FROM gostos WHERE colecao = ? AND item_id = ?').get(colecao, id).n
  const gostei = visitanteValido(visitante)
    && Boolean(db.prepare('SELECT 1 FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').get(colecao, id, visitante))
  const comentarios = db.prepare('SELECT id, nome, texto, data FROM comentarios WHERE colecao = ? AND item_id = ? ORDER BY data DESC, id DESC').all(colecao, id)
  const visualizacoes = db.prepare('SELECT total FROM visualizacoes WHERE colecao = ? AND item_id = ?').get(colecao, id)?.total || 0
  return { gostos, gostei, comentarios, visualizacoes }
}

rotas.get('/interacoes/:colecao/:id', itemInterativo, (req, res) => {
  res.json(resumoInteracoes(req.params.colecao, req.params.id, req.query.visitante))
})

// Conta uma visualização (no máximo uma por visitante a cada 30 min para o mesmo item)
const visualizacoesRecentes = new Map()
rotas.post('/interacoes/:colecao/:id/visualizacao', itemInterativo, (req, res) => {
  const { colecao, id } = req.params
  const k = `${colecao}/${id}/${req.body?.visitante || req.ip}`
  const agora = Date.now()
  if (!visualizacoesRecentes.has(k) || agora - visualizacoesRecentes.get(k) > 30 * 60 * 1000) {
    visualizacoesRecentes.set(k, agora)
    db.prepare(`INSERT INTO visualizacoes (colecao, item_id, total) VALUES (?, ?, 1)
      ON CONFLICT (colecao, item_id) DO UPDATE SET total = total + 1`).run(colecao, id)
  }
  res.status(204).end()
})

// Dar / retirar gosto
rotas.post(
  '/interacoes/:colecao/:id/gosto',
  limitador({ janelaMs: 60_000, maximo: 30 }),
  itemInterativo,
  (req, res) => {
    const { colecao, id } = req.params
    const { visitante } = req.body || {}
    if (!visitanteValido(visitante)) return res.status(400).json({ erro: 'Identificador de visitante inválido.' })

    const existe = db.prepare('SELECT 1 FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').get(colecao, id, visitante)
    if (existe) db.prepare('DELETE FROM gostos WHERE colecao = ? AND item_id = ? AND visitante = ?').run(colecao, id, visitante)
    else db.prepare('INSERT INTO gostos (colecao, item_id, visitante) VALUES (?, ?, ?)').run(colecao, id, visitante)

    res.json(resumoInteracoes(colecao, id, visitante))
  },
)

// Comentar (publicado de imediato; o painel pode apagar)
rotas.post(
  '/interacoes/:colecao/:id/comentarios',
  limitador({ janelaMs: 60_000, maximo: 4, mensagem: 'Está a comentar demasiado depressa. Aguarde um minuto.' }),
  itemInterativo,
  (req, res) => {
    const { colecao, id } = req.params
    const { nome, texto, website, visitante } = req.body || {}

    // campo escondido: só robôs o preenchem
    if (website) return res.status(204).end()

    const n = String(nome || '').trim()
    const t = String(texto || '').trim()
    if (n.length < 2 || n.length > 80) return res.status(400).json({ erro: 'Indique um nome entre 2 e 80 caracteres.' })
    if (t.length < 2 || t.length > 2000) return res.status(400).json({ erro: 'O comentário deve ter entre 2 e 2000 caracteres.' })
    if ((t.match(/https?:\/\//g) || []).length > 2) return res.status(400).json({ erro: 'O comentário tem demasiadas ligações.' })

    db.prepare('INSERT INTO comentarios (colecao, item_id, nome, texto, ip) VALUES (?, ?, ?, ?, ?)').run(colecao, id, n, t, req.ip)
    res.status(201).json(resumoInteracoes(colecao, id, visitante))
  },
)

export default rotas

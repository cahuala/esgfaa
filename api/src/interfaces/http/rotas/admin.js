import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { TIPOS } from '../../../infraestrutura/ficheiros/armazenamento.js'
import { limparTexto } from '../../../dominio/comum/texto.js'
import { autenticar } from '../middlewares/autenticacao.js'
import { limitar } from '../middlewares/limites.js'
import { contextoAnonimo } from '../middlewares/pedido.js'
import { validar } from '../middlewares/validar.js'
import { absolutizar, baseUrl } from '../apresentacao.js'
import * as E from '../esquemas.js'

const pColecao = z.object({ colecao: E.colecao })
const pItem = z.object({ colecao: E.colecao, id: E.id })
const pId = z.object({ id: E.id })
const pNumero = z.object({ id: E.idNumerico })
const pPagina = z.object({ chave: z.string().max(40) })

// nomes de ficheiros enviados pelo navegador chegam em latin1 (multer); repõe-se o UTF-8
const nomeOriginal = (n) => limparTexto(Buffer.from(n, 'latin1').toString('utf8')).slice(0, 200)

// Rotas do painel de administração: /api/admin/…
export function rotasAdmin({ servicos, config, armazenamento }) {
  const r = Router()
  const ctx = (req) => req.contexto
  const enviar = (req, res, dados, estado = 200) => res.status(estado).json(absolutizar(dados, baseUrl(req, config)))

  // ---------- sessão ----------

  r.post(
    '/entrar',
    limitar(config.limites.entrar, {
      mensagem: 'Demasiadas tentativas. Aguarde 15 minutos.',
      chave: (req) => String(req.body?.email || '').trim().toLowerCase().slice(0, 254),
    }),
    validar({ body: E.entrar }),
    async (req, res) => {
      res.json(await servicos.sessao.entrar(contextoAnonimo(req), req.dados.body))
    },
  )

  // tudo o que está abaixo exige sessão
  r.use(limitar(config.limites.admin))
  r.use(autenticar(servicos.sessao))

  r.get('/eu', (req, res) => res.json(servicos.sessao.eu(ctx(req))))

  r.post('/sair', (req, res) => {
    servicos.sessao.sair(ctx(req))
    res.status(204).end()
  })

  r.put('/eu/senha', validar({ body: E.mudarSenha }), async (req, res) => {
    res.json(await servicos.sessao.mudarSenha(ctx(req), req.dados.body))
  })

  // ---------- painel e estatísticas ----------

  r.get('/painel', (req, res) => res.json(servicos.estatisticas.painel(ctx(req))))

  r.get('/estatisticas', validar({ query: E.dias }), (req, res) => {
    res.json(servicos.estatisticas.relatorio(ctx(req), req.dados.query.dias))
  })

  // ---------- coleções ----------

  r.get('/colecoes/:colecao', validar({ params: pColecao }), (req, res) => {
    enviar(req, res, servicos.conteudos.listar(ctx(req), req.dados.params.colecao))
  })

  r.get('/colecoes/:colecao/:id', validar({ params: pItem }), (req, res) => {
    const { colecao, id } = req.dados.params
    enviar(req, res, servicos.conteudos.ler(ctx(req), colecao, id))
  })

  r.post('/colecoes/:colecao', validar({ params: pColecao, body: E.corpoConteudo }), (req, res) => {
    enviar(req, res, servicos.conteudos.criar(ctx(req), req.dados.params.colecao, req.dados.body), 201)
  })

  r.put('/colecoes/:colecao/:id', validar({ params: pItem, body: E.corpoConteudo }), (req, res) => {
    const { colecao, id } = req.dados.params
    enviar(req, res, servicos.conteudos.editar(ctx(req), colecao, id, req.dados.body))
  })

  r.delete('/colecoes/:colecao/:id', validar({ params: pItem }), (req, res) => {
    const { colecao, id } = req.dados.params
    servicos.conteudos.apagar(ctx(req), colecao, id)
    res.status(204).end()
  })

  r.put('/ordem/:colecao', validar({ params: pColecao, body: E.ordem }), (req, res) => {
    servicos.conteudos.reordenar(ctx(req), req.dados.params.colecao, req.dados.body.ids)
    res.status(204).end()
  })

  // ---------- páginas ----------

  r.get('/paginas/:chave', validar({ params: pPagina }), (req, res) => {
    enviar(req, res, servicos.paginas.ler(ctx(req), req.dados.params.chave))
  })

  r.put('/paginas/:chave', validar({ params: pPagina, body: E.pagina }), (req, res) => {
    enviar(req, res, servicos.paginas.guardar(ctx(req), req.dados.params.chave, req.dados.body))
  })

  // ---------- ficheiros ----------

  if (armazenamento) {
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, f, cb) => cb(null, armazenamento.pastaDoMes()),
        filename: (req, f, cb) => cb(null, armazenamento.nomeNovo(f.mimetype)),
      }),
      limits: { fileSize: config.tamanhoMaximoUpload, files: 20, fields: 5, parts: 25 },
      fileFilter: (req, f, cb) => cb(null, Boolean(TIPOS[f.mimetype])),
    }).array('ficheiros', 20)

    r.post(
      '/ficheiros',
      (req, res, next) => {
        servicos.ficheiros.garantirPodeEnviar(ctx(req)) // antes de receber qualquer byte
        req.limiteUpload = config.tamanhoMaximoUpload
        next()
      },
      upload,
      (req, res) => {
        const enviados = req.files || []
        if (!enviados.length) return res.status(400).json({ erro: 'Nenhum ficheiro válido (aceites: imagens JPG, PNG, WebP, GIF, vídeos MP4/WebM e PDF).', codigo: 'validacao' })
        const ficheiros = servicos.ficheiros.registar(ctx(req), enviados.map((f) => ({
          caminho: f.path, nome: nomeOriginal(f.originalname), tipo: f.mimetype, tamanho: f.size,
        })))
        enviar(req, res, ficheiros, 201)
      },
    )
  }

  // ---------- comentários ----------

  r.get('/comentarios', (req, res) => res.json(servicos.interacoes.listarComentarios(ctx(req))))

  r.delete('/comentarios/:id', validar({ params: pNumero }), (req, res) => {
    servicos.interacoes.apagarComentario(ctx(req), req.dados.params.id)
    res.status(204).end()
  })

  // ---------- papéis ----------

  r.get('/papeis', (req, res) => res.json(servicos.papeis.listar(ctx(req))))

  r.post('/papeis', validar({ body: E.papel }), (req, res) => {
    res.status(201).json(servicos.papeis.criar(ctx(req), req.dados.body))
  })

  r.put('/papeis/:id', validar({ params: pId, body: E.papel }), (req, res) => {
    servicos.papeis.editar(ctx(req), req.dados.params.id, req.dados.body)
    res.status(204).end()
  })

  r.delete('/papeis/:id', validar({ params: pId }), (req, res) => {
    servicos.papeis.apagar(ctx(req), req.dados.params.id)
    res.status(204).end()
  })

  // ---------- utilizadores ----------

  r.get('/utilizadores', (req, res) => res.json(servicos.utilizadores.listar(ctx(req))))

  r.post('/utilizadores', validar({ body: E.novoUtilizador }), async (req, res) => {
    res.status(201).json(await servicos.utilizadores.criar(ctx(req), req.dados.body))
  })

  r.put('/utilizadores/:id', validar({ params: pNumero, body: E.editarUtilizador }), async (req, res) => {
    res.json(await servicos.utilizadores.editar(ctx(req), req.dados.params.id, req.dados.body))
  })

  // ---------- atividades ----------

  r.get('/atividades', validar({ query: E.filtrosAtividades }), (req, res) => {
    res.json(servicos.auditoria.listar(ctx(req), req.dados.query))
  })

  return r
}

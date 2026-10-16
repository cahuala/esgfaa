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
import { rotasSecretaria } from './secretaria.js'
import { rotasBiblioteca } from './biblioteca.js'
import { rotasIntegridade } from './integridade.js'
import { rotasTraducoes } from './traducoes.js'

const pColecao = z.object({ colecao: E.colecao })
const pItem = z.object({ colecao: E.colecao, id: E.id })
const pId = z.object({ id: E.id })
const pNumero = z.object({ id: E.idNumerico })
const pPagina = z.object({ chave: z.string().max(40) })

// nomes de ficheiros enviados pelo navegador chegam em latin1 (multer); repõe-se o UTF-8
const nomeOriginal = (n) => limparTexto(Buffer.from(n, 'latin1').toString('utf8')).slice(0, 200)

// Rotas do painel de administração: /api/admin/…
export function rotasAdmin({ servicos, config, armazenamento, privados }) {
  const r = Router()
  const ctx = (req) => req.contexto
  const enviar = (req, res, dados, estado = 200) => res.status(estado).json(absolutizar(dados, baseUrl(req, config)))

  // ---------- sessão ----------

  r.post(
    '/entrar',
    limitar(config.limites.entrarIp, { mensagem: 'Demasiadas tentativas a partir deste endereço. Aguarde 15 minutos.' }),
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

  r.get('/eu', async (req, res) => res.json(await servicos.sessao.eu(ctx(req))))
  r.post('/traduzir', validar({ body: E.traduzirTextos }), async (req, res) => res.json(await servicos.traducaoDados.traduzir(ctx(req), req.dados.body)))

  r.post('/sair', async (req, res) => {
    await servicos.sessao.sair(ctx(req))
    res.status(204).end()
  })

  r.put('/eu/senha', validar({ body: E.mudarSenha }), async (req, res) => {
    res.json(await servicos.sessao.mudarSenha(ctx(req), req.dados.body))
  })

  // ---------- painel e estatísticas ----------

  r.get('/painel', async (req, res) => res.json(await servicos.estatisticas.painel(ctx(req))))

  r.get('/estatisticas', validar({ query: E.dias }), async (req, res) => {
    res.json(await servicos.estatisticas.relatorio(ctx(req), req.dados.query.dias))
  })

  // ---------- coleções ----------

  r.get('/colecoes/:colecao', validar({ params: pColecao }), async (req, res) => {
    enviar(req, res, await servicos.conteudos.listar(ctx(req), req.dados.params.colecao))
  })

  r.get('/colecoes/:colecao/:id', validar({ params: pItem }), async (req, res) => {
    const { colecao, id } = req.dados.params
    enviar(req, res, await servicos.conteudos.ler(ctx(req), colecao, id))
  })

  r.post('/colecoes/:colecao', validar({ params: pColecao, body: E.corpoConteudo }), async (req, res) => {
    enviar(req, res, await servicos.conteudos.criar(ctx(req), req.dados.params.colecao, req.dados.body), 201)
  })

  r.put('/colecoes/:colecao/:id', validar({ params: pItem, body: E.corpoConteudo }), async (req, res) => {
    const { colecao, id } = req.dados.params
    enviar(req, res, await servicos.conteudos.editar(ctx(req), colecao, id, req.dados.body))
  })

  r.delete('/colecoes/:colecao/:id', validar({ params: pItem }), async (req, res) => {
    const { colecao, id } = req.dados.params
    await servicos.conteudos.apagar(ctx(req), colecao, id)
    res.status(204).end()
  })

  r.put('/ordem/:colecao', validar({ params: pColecao, body: E.ordem }), async (req, res) => {
    await servicos.conteudos.reordenar(ctx(req), req.dados.params.colecao, req.dados.body.ids)
    res.status(204).end()
  })

  // ---------- páginas ----------

  r.get('/paginas/:chave', validar({ params: pPagina }), async (req, res) => {
    enviar(req, res, await servicos.paginas.ler(ctx(req), req.dados.params.chave))
  })

  r.put('/paginas/:chave', validar({ params: pPagina, body: E.pagina }), async (req, res) => {
    enviar(req, res, await servicos.paginas.guardar(ctx(req), req.dados.params.chave, req.dados.body))
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
      async (req, res) => {
        const enviados = req.files || []
        if (!enviados.length) return res.status(400).json({ erro: 'Nenhum ficheiro válido (aceites: imagens JPG, PNG, WebP, GIF, vídeos MP4/WebM e PDF).', codigo: 'validacao' })
        const ficheiros = await servicos.ficheiros.registar(ctx(req), enviados.map((f) => ({
          caminho: f.path, nome: nomeOriginal(f.originalname), tipo: f.mimetype, tamanho: f.size,
        })))
        enviar(req, res, ficheiros, 201)
      },
    )
  }

  // ---------- mensagens do formulário de contacto ----------

  r.get('/contactos', async (req, res) => res.json(await servicos.contactos.listar(ctx(req))))
  r.get('/contactos/novas', async (req, res) => res.json({ novas: await servicos.contactos.contarNovas(ctx(req)) }))
  r.get('/contactos/:id', validar({ params: pNumero }), async (req, res) => res.json(await servicos.contactos.abrir(ctx(req), req.dados.params.id)))
  r.patch('/contactos/:id', validar({ params: pNumero, body: E.atualizarContacto }), async (req, res) => res.json(await servicos.contactos.atualizar(ctx(req), req.dados.params.id, req.dados.body)))
  r.delete('/contactos/:id', validar({ params: pNumero }), async (req, res) => {
    await servicos.contactos.apagar(ctx(req), req.dados.params.id)
    res.status(204).end()
  })

  // ---------- comentários ----------

  r.get('/comentarios', async (req, res) => res.json(await servicos.interacoes.listarComentarios(ctx(req))))

  r.delete('/comentarios/:id', validar({ params: pNumero }), async (req, res) => {
    await servicos.interacoes.apagarComentario(ctx(req), req.dados.params.id)
    res.status(204).end()
  })

  // ---------- gestão académica (Secretaria) ----------
  r.use('/academico', rotasSecretaria({ servicos, config, privados }))
  r.use('/biblioteca', rotasBiblioteca({ servicos, config, privados }))
  r.use('/integridade', rotasIntegridade({ servicos, config, privados }))
  r.use('/traducoes', rotasTraducoes({ servicos }))


  // ---------- papéis ----------

  r.get('/papeis', async (req, res) => res.json(await servicos.papeis.listar(ctx(req))))

  r.post('/papeis', validar({ body: E.papel }), async (req, res) => {
    res.status(201).json(await servicos.papeis.criar(ctx(req), req.dados.body))
  })

  r.put('/papeis/:id', validar({ params: pId, body: E.papel }), async (req, res) => {
    await servicos.papeis.editar(ctx(req), req.dados.params.id, req.dados.body)
    res.status(204).end()
  })

  r.delete('/papeis/:id', validar({ params: pId }), async (req, res) => {
    await servicos.papeis.apagar(ctx(req), req.dados.params.id)
    res.status(204).end()
  })

  // ---------- utilizadores ----------

  r.get('/utilizadores', async (req, res) => res.json(await servicos.utilizadores.listar(ctx(req))))

  r.post('/utilizadores', validar({ body: E.novoUtilizador }), async (req, res) => {
    res.status(201).json(await servicos.utilizadores.criar(ctx(req), req.dados.body))
  })

  r.put('/utilizadores/:id', validar({ params: pNumero, body: E.editarUtilizador }), async (req, res) => {
    res.json(await servicos.utilizadores.editar(ctx(req), req.dados.params.id, req.dados.body))
  })

  // ---------- atividades ----------

  r.get('/atividades', validar({ query: E.filtrosAtividades }), async (req, res) => {
    res.json(await servicos.auditoria.listar(ctx(req), req.dados.query))
  })

  return r
}

import fs from 'node:fs'
import path from 'node:path'
import { DIFICULDADE, ProvasUsadas, criarDesafio, verificarProva } from '../dominio/seguranca/robo.js'
import crypto from 'node:crypto'
import express from 'express'
import multer from 'multer'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import * as E from './esquemas.js'
import { autenticar, validar } from './middlewares.js'
import { invalido } from '../erros.js'
import { exigir, PAPEIS } from '../aplicacao/sessao.js'
import { referencias } from '../dominio/pessoal/referencias.js'
import { TIPOS_DOCUMENTO, ESTADOS_PROCESSO } from '../aplicacao/processos.js'
import { TIPOS_EXTRACTO } from '../aplicacao/extractos.js'
import { TIPOS_UNIDADE } from '../aplicacao/organica.js'
import { CLASSIFICACOES, SENTIDOS, TIPOS_EXPEDIENTE } from '../aplicacao/expediente.js'
import { EVENTOS_MANUAIS, TIPOS_EVENTO } from '../aplicacao/pessoas.js'
import { DESPACHOS_PROPOSTA, ESTADOS_PROPOSTA, TIPOS_PROPOSTA } from '../aplicacao/propostas.js'
import { NOMES_LICENCA } from '../aplicacao/licencas.js'
import { TIPOS_AUSENCIA } from '../aplicacao/ausencias.js'
import { sessaoEmCookie } from './sessaoCookie.js'
import { fluxoEventos } from '../aplicacao/tempoReal.js'
import { COOKIE_PESSOAL } from './middlewares.js'

// assinaturas dos formatos de imagem aceites para a fotografia
const IMAGENS = [['jpg', [0xff, 0xd8, 0xff]], ['png', [0x89, 0x50, 0x4e, 0x47]], ['webp', [0x52, 0x49, 0x46, 0x46]]]
const tipoImagem = (b) => IMAGENS.find(([, m]) => m.every((x, i) => b[i] === x))?.[0]

export function rotas({ servicos: s, config }) {
  const r = express.Router()
  const u = (req) => req.utilizador
  r.use(sessaoEmCookie({ nome: COOKIE_PESSOAL, caminho: '/api', caminhos: ['/entrar', '/mudar-senha'], seguro: config.producao }))
  const ip = (req) => req.ip

  // entrar: no máximo 60 pedidos por minuto por endereço (o pessoal da Escola sai pelo mesmo IP; cada conta bloqueia-se à parte)
  const limiteEntrar = rateLimit({ windowMs: 60_000, limit: config.teste ? 1000 : 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { erro: 'Demasiadas tentativas. Aguarde um minuto.', codigo: 'demasiados_pedidos' } })
  // «Não sou um robô»: o navegador resolve um desafio antes de entrar (mais difícil para quem já errou)
  const provasUsadas = new ProvasUsadas()
  const falhas = new Map() // ip -> [instantes das palavras-passe erradas]
  const suspeito = (x) => (falhas.get(x) || []).filter((t) => t > Date.now() - 5 * 60_000).length >= 3
  r.get('/desafio', limiteEntrar, (req, res) => res.set('Cache-Control', 'no-store').json({ ativo: config.verificarRobo, ...(config.verificarRobo ? criarDesafio(config.segredoJwt, { maximo: suspeito(ip(req)) ? DIFICULDADE.suspeito : DIFICULDADE.normal }) : {}) }))
  const exigirProva = (req, res, next) => (!config.verificarRobo || verificarProva(config.segredoJwt, req.body?.prova, provasUsadas) ? next() : res.status(400).json({ erro: 'Confirme que não é um robô e tente outra vez.', codigo: 'prova_robo' }))
  r.post('/entrar', limiteEntrar, exigirProva, validar({ body: E.entrar }), async (req, res) => {
    try {
      res.json(await s.sessao.entrar(req.dados.body, ip(req)))
    } catch (e) {
      if (e.codigo !== 'codigo_2fa') falhas.set(ip(req), [...(falhas.get(ip(req)) || []).slice(-20), Date.now()])
      throw e
    }
  })

  r.use(autenticar(s.sessao))
  // depois de uma gravação bem-sucedida, o painel volta a calcular os números e as páginas abertas atualizam-se
  r.use((req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode >= 400) return
        s.painel.esquecer()
        s.tempoReal.avisar('pessoal', { tipo: 'atualizar' })
      })
    }
    next()
  })
  // avisos instantâneos (mensagens, despachos, avisos): a página volta a pedir o que mudou
  r.get('/eventos', (req, res) => fluxoEventos(req, res, (enviar) => s.tempoReal.ouvir('pessoal', enviar, { conta: u(req).id })))
  r.get('/eu', async (req, res) => res.json(await s.sessao.eu(u(req))))
  // verificação em dois passos (aplicação de autenticação)
  r.get('/eu/2fa', async (req, res) => res.json(await s.doisFatores.estado(u(req))))
  r.post('/eu/2fa/iniciar', async (req, res) => res.json(await s.doisFatores.iniciar(u(req))))
  r.post('/eu/2fa/confirmar', validar({ body: E.codigo2fa }), async (req, res) => res.json(await s.doisFatores.confirmar(u(req), req.dados.body)))
  r.post('/eu/2fa/codigos', validar({ body: E.codigo2fa }), async (req, res) => res.json(await s.doisFatores.novosCodigos(u(req), req.dados.body)))
  r.post('/eu/2fa/desligar', validar({ body: E.desligar2fa }), async (req, res) => res.json(await s.doisFatores.desligar(u(req), req.dados.body, (senha) => s.sessao.cifra.verificar(senha, u(req).senha))))
  r.post('/mudar-senha', validar({ body: E.mudarSenha }), async (req, res) => res.json(await s.sessao.mudarSenha(u(req), req.dados.body)))
  r.post('/sair', async (req, res) => { await s.sessao.sair(u(req)); res.status(204).end() })
  // protecção de dados pessoais (Lei n.º 22/11)
  r.get('/eu/privacidade', (req, res) => res.json(s.privacidade.aviso(u(req))))
  r.post('/eu/privacidade', async (req, res) => res.json(await s.privacidade.aceitar(u(req))))
  r.get('/eu/dados', async (req, res) => { res.set('Content-Disposition', 'attachment; filename="os-meus-dados.json"'); res.json(await s.privacidade.meusDados(u(req))) })
  r.get('/eu/pedidos-dados', async (req, res) => res.json(await s.privacidade.meusPedidos(u(req))))
  r.post('/eu/pedidos-dados', validar({ body: z.object({ tipo: z.string().max(20), texto: z.string().max(3000) }) }), async (req, res) => res.status(201).json(await s.privacidade.pedir(u(req), req.dados.body)))
  r.get('/privacidade/pedidos', async (req, res) => res.json(await s.privacidade.listar(u(req))))
  r.put('/privacidade/pedidos/:id', validar({ params: E.pId, body: z.object({ estado: z.string().max(20), resposta: z.string().max(3000) }) }), async (req, res) => res.json(await s.privacidade.responder(u(req), req.dados.params.id, req.dados.body)))
  r.get('/referencias', (req, res) => res.json({ ...referencias(), papeis: PAPEIS, tiposEvento: TIPOS_EVENTO, eventosManuais: EVENTOS_MANUAIS, tiposProposta: TIPOS_PROPOSTA, estadosProposta: ESTADOS_PROPOSTA, tiposLicenca: NOMES_LICENCA, tiposAusencia: TIPOS_AUSENCIA, tiposDocumento: TIPOS_DOCUMENTO, estadosProcesso: ESTADOS_PROCESSO, tiposExtracto: TIPOS_EXTRACTO, tiposUnidade: TIPOS_UNIDADE, tiposExpediente: TIPOS_EXPEDIENTE, classificacoes: CLASSIFICACOES, sentidos: SENTIDOS }))

  r.get('/painel', async (req, res) => res.json(await s.painel.resumo(u(req))))

  // fichas
  r.get('/pessoas', validar({ query: E.filtrosPessoas }), async (req, res) => res.json(await s.pessoas.listar(u(req), req.dados.query)))
  r.post('/pessoas', validar({ body: E.pessoa }), async (req, res) => res.status(201).json(await s.pessoas.criar(u(req), req.dados.body)))
  r.get('/pessoas/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.pessoas.perfil(u(req), req.dados.params.id)))
  r.put('/pessoas/:id', validar({ params: E.pId, body: E.editarPessoa }), async (req, res) => res.json(await s.pessoas.editar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/pessoas/:id/cursos', validar({ params: E.pId, body: E.curso }), async (req, res) => res.status(201).json(await s.pessoas.guardarCurso(u(req), req.dados.params.id, null, req.dados.body)))
  r.put('/pessoas/:id/cursos/:sub', validar({ params: E.pIdSub, body: E.curso }), async (req, res) => res.json(await s.pessoas.guardarCurso(u(req), req.dados.params.id, req.dados.params.sub, req.dados.body)))
  r.delete('/pessoas/:id/cursos/:sub', validar({ params: E.pIdSub }), async (req, res) => { await s.pessoas.removerCurso(u(req), req.dados.params.id, req.dados.params.sub); res.status(204).end() })
  r.post('/pessoas/:id/eventos', validar({ params: E.pId, body: E.evento }), async (req, res) => res.status(201).json(await s.pessoas.adicionarEvento(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/pessoas/:id/eventos/:sub', validar({ params: E.pIdSub }), async (req, res) => { await s.pessoas.removerEvento(u(req), req.dados.params.id, req.dados.params.sub); res.status(204).end() })
  r.post('/pessoas/:id/graduacoes/:sub/terminar', validar({ params: E.pIdSub, body: E.fimGraduacao }), async (req, res) => { await s.pessoas.terminarGraduacao(u(req), req.dados.params.id, req.dados.params.sub, req.dados.body); res.status(204).end() })

  // fotografia: guardada fora de qualquer pasta pública, só se vê com sessão
  fs.mkdirSync(config.pastaFotos, { recursive: true })
  const envio = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFoto, files: 1 } })
  r.put('/pessoas/:id/foto', validar({ params: E.pId }), envio.single('foto'), async (req, res) => {
    exigir(u(req), 'editar')
    const ext = req.file && tipoImagem(req.file.buffer)
    if (!ext) throw invalido('Envie uma fotografia JPG, PNG ou WEBP.', 'foto')
    const nome = `${crypto.randomUUID()}.${ext}`
    await fs.promises.writeFile(path.join(config.pastaFotos, nome), req.file.buffer)
    const antiga = await s.pessoas.guardarFoto(u(req), req.dados.params.id, nome)
    if (antiga) fs.rm(path.join(config.pastaFotos, path.basename(antiga)), { force: true }, () => {})
    res.json({ fotoId: nome })
  })
  r.get('/pessoas/:id/foto', validar({ params: E.pId }), async (req, res) => {
    const f = await s.pessoas.fotoDe(u(req), req.dados.params.id)
    if (!f) return res.status(404).json({ erro: 'Sem fotografia.', codigo: 'nao_encontrado' })
    res.set('Cache-Control', 'private, max-age=300')
    res.sendFile(path.join(config.pastaFotos, path.basename(f)), { dotfiles: 'deny' })
  })

  // importação por Excel, BI, fotos em lote, domiciliares
  r.post('/pessoas/importar', validar({ body: E.importar }), async (req, res) => res.json(await s.importacao.importar(u(req), req.dados.body)))
  r.get('/bi/:numero', validar({ params: z.object({ numero: z.string().max(20) }) }), async (req, res) => res.json(await s.pessoas.consultarBi(u(req), req.dados.params.numero)))
  // fotografias em lote: o nome de cada ficheiro é o NIP ou o n.º de agente (já reduzidas no navegador)
  const lote = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFoto, files: 500 } })
  r.post('/fotos/lote', lote.array('fotos', 500), async (req, res) => {
    exigir(u(req), 'editar')
    const resultados = []
    for (const f of req.files ?? []) {
      const ident = path.parse(f.originalname).name.trim().toUpperCase()
      const ext = tipoImagem(f.buffer)
      const p = ident && await s.pessoas.porIdentificacao(ident)
      if (!ext || !p) { resultados.push({ ficheiro: f.originalname, ok: false, erro: !ext ? 'Não é uma imagem JPG/PNG/WEBP.' : 'Nenhuma ficha com esse NIP / n.º de agente.' }); continue }
      const nome = `${crypto.randomUUID()}.${ext}`
      await fs.promises.writeFile(path.join(config.pastaFotos, nome), f.buffer)
      const antiga = await s.pessoas.guardarFoto(u(req), p.id, nome)
      if (antiga) fs.rm(path.join(config.pastaFotos, path.basename(antiga)), { force: true }, () => {})
      resultados.push({ ficheiro: f.originalname, ok: true, pessoaId: p.id, nome: p.nome })
    }
    res.json({ resultados })
  })
  r.get('/domiciliares', async (req, res) => res.json(await s.pessoas.domiciliares(u(req))))

  // processos individuais e documentos digitalizados
  const documento = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxDocumento, files: 10 } })
  const enviarFicheiro = (res, f) => {
    const inline = /^(application\/pdf|image\/)/.test(f.mime ?? '')
    res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nome || 'documento')}`)
    if (f.mime) res.type(f.mime)
    res.set('Cache-Control', 'private, no-store')
    res.sendFile(f.caminho, { dotfiles: 'deny' })
  }
  r.get('/processos', validar({ query: z.object({ incompletos: z.string().max(5).optional() }) }), async (req, res) => res.json(await s.processos.catalogo(u(req), { incompletos: Boolean(req.dados.query.incompletos) })))
  r.put('/processos/:id', validar({ params: E.pId, body: E.processo }), async (req, res) => res.json(await s.processos.guardar(u(req), req.dados.params.id, req.dados.body)))
  r.get('/pessoas/:id/documentos', validar({ params: E.pId }), async (req, res) => res.json(await s.processos.documentos(u(req), req.dados.params.id)))
  r.post('/pessoas/:id/documentos', validar({ params: E.pId }), documento.single('ficheiro'), async (req, res) => {
    const d = E.documentoPessoal.parse(req.body ?? {})
    res.status(201).json(await s.processos.adicionarDocumento(u(req), req.dados.params.id, d, req.file))
  })
  r.get('/documentos/:id/ficheiro', validar({ params: E.pId }), async (req, res) => enviarFicheiro(res, await s.processos.ficheiro(u(req), req.dados.params.id)))
  r.delete('/documentos/:id', validar({ params: E.pId }), async (req, res) => { await s.processos.removerDocumento(u(req), req.dados.params.id); res.status(204).end() })

  // extractos de ordem (promoção, nomeação, reforma…)
  r.get('/extractos', validar({ query: z.object({ tipo: z.string().max(20).optional(), estado: z.string().max(20).optional() }) }), async (req, res) => res.json(await s.extractos.listar(u(req), req.dados.query)))
  r.post('/extractos', documento.single('ficheiro'), async (req, res) => {
    const d = E.extracto.parse(req.body ?? {})
    res.status(201).json(await s.extractos.criar(u(req), d, req.file))
  })
  r.get('/extractos/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.extractos.obter(u(req), req.dados.params.id)))
  r.get('/extractos/:id/ficheiro', validar({ params: E.pId }), async (req, res) => { const f = await s.extractos.ficheiro(u(req), req.dados.params.id); enviarFicheiro(res, { ...f, mime: f.nome.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined }) })
  r.post('/extractos/:id/itens', validar({ params: E.pId, body: E.itemExtracto }), async (req, res) => res.json(await s.extractos.adicionarItem(u(req), req.dados.params.id, req.dados.body)))
  r.put('/extractos/:id/itens/:sub', validar({ params: E.pIdSub, body: E.editarItemExtracto }), async (req, res) => res.json(await s.extractos.editarItem(u(req), req.dados.params.id, req.dados.params.sub, req.dados.body)))
  r.delete('/extractos/:id/itens/:sub', validar({ params: E.pIdSub }), async (req, res) => res.json(await s.extractos.removerItem(u(req), req.dados.params.id, req.dados.params.sub)))
  r.post('/extractos/:id/aplicar', validar({ params: E.pId }), async (req, res) => res.json(await s.extractos.aplicar(u(req), req.dados.params.id)))
  r.delete('/extractos/:id', validar({ params: E.pId }), async (req, res) => { await s.extractos.remover(u(req), req.dados.params.id); res.status(204).end() })

  // orgânica (árvore com o planeamento)
  r.get('/organica', async (req, res) => res.json(await s.organica.arvore(u(req))))
  r.post('/organica/importar', validar({ body: E.importarQuadro }), async (req, res) => res.json(await s.organica.importarQuadro(u(req), req.dados.body)))
  r.get('/organica/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.organica.detalhe(u(req), req.dados.params.id)))

  // expediente entre as áreas
  const anexos = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxDocumento, files: 20 } })
  r.get('/expediente', validar({ query: z.object({ caixa: z.enum(['por_receber', 'na_unidade', 'enviados', 'arquivo', 'todos']).default('por_receber'), de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), sentido: z.enum(['interno', 'entrada', 'saida']).optional(), armario: z.string().max(60).optional() }) }), async (req, res) => res.json(await s.expediente.listar(u(req), req.dados.query)))
  r.get('/expediente/unidades', async (req, res) => res.json(await s.expediente.unidadesDestino(u(req))))
  r.post('/expediente', anexos.array('anexos', 20), async (req, res) => {
    let dados
    try { dados = JSON.parse(req.body?.dados ?? '{}') } catch { throw invalido('Pedido mal formado.') }
    res.status(201).json(await s.expediente.criar(u(req), E.expediente.parse(dados), req.files ?? []))
  })
  r.get('/expediente/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.expediente.obter(u(req), req.dados.params.id)))
  r.post('/expediente/:id/receber', validar({ params: E.pId, body: z.object({ fisico: z.boolean().default(false) }) }), async (req, res) => res.json(await s.expediente.receber(u(req), req.dados.params.id, req.dados.body)))
  r.post('/expediente/:id/encaminhar', validar({ params: E.pId, body: E.encaminhar }), async (req, res) => res.json(await s.expediente.encaminhar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/expediente/:id/movimentos/:sub/entregue', validar({ params: E.pIdSub, body: E.entregue }), async (req, res) => res.json(await s.expediente.entregarFisico(u(req), req.dados.params.id, req.dados.params.sub, req.dados.body)))
  r.post('/expediente/:id/arquivar', validar({ params: E.pId, body: z.object({ armario: z.string().max(60).default(''), prateleira: z.string().max(60).default(''), pasta: z.string().max(100).default('') }).default({}) }), async (req, res) => res.json(await s.expediente.arquivar(u(req), req.dados.params.id, true, req.dados.body)))
  r.post('/expediente/:id/reabrir', validar({ params: E.pId }), async (req, res) => res.json(await s.expediente.arquivar(u(req), req.dados.params.id, false)))
  r.post('/expediente/:id/anexos', validar({ params: E.pId }), anexos.array('anexos', 20), async (req, res) => res.json(await s.expediente.anexar(u(req), req.dados.params.id, req.files ?? [])))
  r.get('/anexos/:id', validar({ params: E.pId }), async (req, res) => enviarFicheiro(res, await s.expediente.anexo(u(req), req.dados.params.id)))
  // Secretária digital: documentos submetidos a despacho do Comandante
  r.get('/secretaria', async (req, res) => res.json({ ...(await s.expediente.secretaria(u(req))), propostas: await s.propostas.aDespacho(u(req)), despachosProposta: DESPACHOS_PROPOSTA }))
  r.post('/propostas/:id/despachar', validar({ params: E.pId, body: z.object({ decisao: z.string().max(30), texto: z.string().max(3000).default('') }) }), async (req, res) => res.json(await s.propostas.despachar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/expediente/:id/despacho', validar({ params: E.pId, body: z.object({ nota: z.string().max(1000).default('') }) }), async (req, res) => res.json(await s.expediente.submeterDespacho(u(req), req.dados.params.id, req.dados.body)))
  r.post('/expediente/:id/despachar', validar({ params: E.pId, body: z.object({ decisao: z.string().max(30), texto: z.string().max(3000).default('') }) }), async (req, res) => res.json(await s.expediente.despachar(u(req), req.dados.params.id, req.dados.body)))

  // mensagens internas
  r.get('/mensagens/conversas', async (req, res) => res.json(await s.mensagens.conversas(u(req))))
  r.get('/mensagens/contactos', async (req, res) => res.json(await s.mensagens.contactos(u(req))))
  r.post('/mensagens/directa', validar({ body: z.object({ utilizadorId: E.pId.shape.id }) }), async (req, res) => res.json(await s.mensagens.directa(u(req), req.dados.body.utilizadorId)))
  r.post('/mensagens/grupo', validar({ body: E.grupo }), async (req, res) => res.status(201).json(await s.mensagens.grupo(u(req), req.dados.body)))
  r.get('/mensagens/conversas/:id', validar({ params: E.pId, query: z.object({ depois: z.coerce.number().int().min(0).default(0) }) }), async (req, res) => res.json(await s.mensagens.mensagens(u(req), req.dados.params.id, req.dados.query)))
  r.post('/mensagens/conversas/:id', validar({ params: E.pId }), anexos.single('ficheiro'), async (req, res) => res.status(201).json(await s.mensagens.enviar(u(req), req.dados.params.id, { texto: req.body?.texto ?? '' }, req.file)))
  r.get('/mensagens/anexo/:id', validar({ params: E.pId }), async (req, res) => enviarFicheiro(res, await s.mensagens.anexo(u(req), req.dados.params.id)))

  // contadores do cabeçalho: documentos por receber e mensagens por ler
  r.get('/avisos', async (req, res) => {
    const c = await s.expediente.contadores(u(req))
    // na Secretária digital: os documentos e as propostas à espera do Comandante
    res.json({ ...c, porDespachar: c.porDespachar + (await s.propostas.contarADespacho(u(req))), mensagens: await s.mensagens.naoLidas(u(req)) })
  })

  // carreiras
  r.get('/carreira/antiguidade', validar({ query: z.object({ posto: z.string().max(30).optional(), ramo: z.string().max(3).optional() }) }), async (req, res) => res.json(await s.pessoas.antiguidade(u(req), req.dados.query)))
  r.get('/carreira/elegiveis', validar({ query: z.object({ tipo: z.enum(['militar', 'civil']).default('militar') }) }), async (req, res) => res.json(await s.pessoas.elegiveis(u(req), req.dados.query)))
  r.get('/carreira/reserva', validar({ query: z.object({ anos: z.coerce.number().int().min(1).max(15).default(5) }) }), async (req, res) => res.json(await s.pessoas.projecaoReserva(u(req), req.dados.query)))

  r.get('/propostas/itens', validar({ query: z.object({ estado: z.string().max(20).optional(), tipo: z.string().max(20).optional() }) }), async (req, res) => res.json(await s.propostas.itens(u(req), req.dados.query)))
  r.get('/propostas', validar({ query: z.object({ estado: z.string().max(20).optional(), tipo: z.string().max(20).optional(), pessoaId: z.string().max(10).optional() }) }), async (req, res) => res.json(await s.propostas.listar(u(req), req.dados.query)))
  r.post('/propostas', validar({ body: E.proposta }), async (req, res) => res.status(201).json(await s.propostas.criar(u(req), req.dados.body)))
  r.get('/propostas/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.propostas.obter(u(req), req.dados.params.id)))
  r.put('/propostas/:id', validar({ params: E.pId, body: E.editarProposta }), async (req, res) => res.json(await s.propostas.editar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/itens', validar({ params: E.pId, body: E.itemProposta }), async (req, res) => res.status(201).json(await s.propostas.adicionarItem(u(req), req.dados.params.id, req.dados.body)))
  r.put('/propostas/:id/itens/:sub', validar({ params: E.pIdSub, body: E.itemProposta.partial().omit({ pessoaId: true }) }), async (req, res) => res.json(await s.propostas.editarItem(u(req), req.dados.params.id, req.dados.params.sub, req.dados.body)))
  r.delete('/propostas/:id/itens/:sub', validar({ params: E.pIdSub }), async (req, res) => res.json(await s.propostas.removerItem(u(req), req.dados.params.id, req.dados.params.sub)))
  // a Escola envia a proposta ao escalão superior; a resposta é o extracto (ou o indeferimento)
  r.post('/propostas/:id/anexos', validar({ params: E.pId }), documento.single('ficheiro'), async (req, res) => res.status(201).json(await s.propostas.juntarAnexo(u(req), req.dados.params.id, { titulo: String(req.body?.titulo ?? '') }, req.file)))
  r.get('/propostas/anexos/:id/ficheiro', validar({ params: E.pId }), async (req, res) => enviarFicheiro(res, await s.propostas.anexo(u(req), req.dados.params.id)))
  r.delete('/propostas/anexos/:id', validar({ params: E.pId }), async (req, res) => { await s.propostas.removerAnexo(u(req), req.dados.params.id); res.status(204).end() })
  r.post('/propostas/:id/submeter', validar({ params: E.pId, body: E.enviarProposta }), async (req, res) => res.json(await s.propostas.submeter(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/indeferir', validar({ params: E.pId, body: E.indeferir }), async (req, res) => res.json(await s.propostas.indeferir(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/devolver', validar({ params: E.pId, body: E.motivo }), async (req, res) => res.json(await s.propostas.devolver(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/cancelar', validar({ params: E.pId, body: E.motivo }), async (req, res) => res.json(await s.propostas.cancelar(u(req), req.dados.params.id, req.dados.body)))

  // licenças
  r.get('/ausencias', validar({ query: z.object({ pessoaId: z.string().max(10).optional(), tipo: z.string().max(30).optional(), de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), emCurso: z.string().max(1).optional() }) }), async (req, res) => res.json(await s.ausencias.listar(u(req), req.dados.query)))
  r.post('/ausencias', validar({ body: E.ausencia }), async (req, res) => res.status(201).json(await s.ausencias.criar(u(req), req.dados.body)))
  r.put('/ausencias/:id', validar({ params: E.pId, body: E.editarAusencia }), async (req, res) => res.json(await s.ausencias.editar(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/ausencias/:id', validar({ params: E.pId }), async (req, res) => { await s.ausencias.remover(u(req), req.dados.params.id); res.status(204).end() })
  // livro de ponto digital (pessoal civil): o dia, o mês, marcações manuais, horário e aparelhos de impressão digital
  const dataQ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  r.get('/ponto/livro', validar({ query: z.object({ data: dataQ.optional() }) }), async (req, res) => res.json(await s.ponto.livro(u(req), req.dados.query)))
  r.get('/ponto/mes', validar({ query: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }) }), async (req, res) => res.json(await s.ponto.mes(u(req), req.dados.query)))
  r.post('/ponto/marcacoes', validar({ body: z.object({ pessoaId: z.number().int().positive(), data: dataQ, hora: z.string().max(5), justificacao: z.string().max(300) }) }), async (req, res) => res.status(201).json(await s.ponto.marcarManual(u(req), req.dados.body)))
  r.delete('/ponto/marcacoes/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.ponto.apagarMarcacao(u(req), req.dados.params.id)))
  r.post('/ponto/faltas', validar({ body: z.object({ data: dataQ }) }), async (req, res) => res.json(await s.ponto.faltasDoDia(u(req), req.dados.body)))
  r.get('/ponto/horario', async (req, res) => res.json(await s.ponto.horario(u(req))))
  r.put('/ponto/horario', validar({ body: z.object({ entrada: z.string().max(5), saida: z.string().max(5), tolerancia: z.number().int() }) }), async (req, res) => res.json(await s.ponto.definirHorario(u(req), req.dados.body)))
  r.get('/ponto/aparelhos', async (req, res) => res.json(await s.ponto.aparelhos(u(req))))
  r.put('/ponto/aparelhos/:id', validar({ params: E.pId, body: z.object({ nome: z.string().max(80).optional(), local: z.string().max(120).optional(), aprovado: z.boolean().optional() }) }), async (req, res) => res.json(await s.ponto.editarAparelho(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/ponto/aparelhos/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.ponto.apagarAparelho(u(req), req.dados.params.id)))
  r.post('/ponto/aparelhos/:id/enviar-pessoal', validar({ params: E.pId }), async (req, res) => res.json(await s.ponto.enviarPessoal(u(req), req.dados.params.id)))
  r.post('/ponto/aparelhos/:id/digital', validar({ params: E.pId, body: z.object({ pessoaId: z.number().int().positive(), dedo: z.number().int().min(0).max(9).optional() }) }), async (req, res) => res.json(await s.ponto.registarDigital(u(req), req.dados.params.id, req.dados.body)))

  // mapa de efectividade do pessoal civil (controlo de faltas, mês a mês)
  r.get('/faltas-civis', validar({ query: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }) }), async (req, res) => res.json(await s.ausencias.mapaCivis(u(req), req.dados.query)))
  r.put('/faltas-civis', validar({ body: z.object({ pessoaId: z.number().int().positive(), data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), falta: z.boolean() }) }), async (req, res) => res.json(await s.ausencias.marcarFalta(u(req), req.dados.body)))
  r.get('/licencas', validar({ query: z.object({ pessoaId: z.string().max(10).optional(), tipo: z.string().max(30).optional(), estado: z.string().max(20).optional(), ano: z.string().regex(/^\d{4}$/).optional() }) }), async (req, res) => res.json(await s.licencas.listar(u(req), req.dados.query)))
  r.post('/licencas/verificar', validar({ body: E.licenca }), async (req, res) => res.json(await s.licencas.verificar(u(req), req.dados.body)))
  r.post('/licencas', validar({ body: E.licenca }), async (req, res) => res.status(201).json(await s.licencas.criar(u(req), req.dados.body)))
  r.delete('/licencas/:id', validar({ params: E.pId }), async (req, res) => { await s.licencas.remover(u(req), req.dados.params.id); res.status(204).end() })

  // quadro orgânico
  r.get('/unidades', async (req, res) => res.json(await s.organica.unidades(u(req))))
  r.post('/unidades', validar({ body: E.unidade }), async (req, res) => res.status(201).json(await s.organica.guardarUnidade(u(req), null, req.dados.body)))
  r.put('/unidades/:id', validar({ params: E.pId, body: E.unidade }), async (req, res) => res.json(await s.organica.guardarUnidade(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/unidades/:id', validar({ params: E.pId }), async (req, res) => { await s.organica.removerUnidade(u(req), req.dados.params.id); res.status(204).end() })
  r.get('/cargos', validar({ query: z.object({ unidadeId: z.string().max(10).optional() }) }), async (req, res) => res.json(await s.organica.cargos(u(req), req.dados.query)))
  r.post('/cargos', validar({ body: E.cargo }), async (req, res) => res.status(201).json(await s.organica.guardarCargo(u(req), null, req.dados.body)))
  r.put('/cargos/:id', validar({ params: E.pId, body: E.cargo }), async (req, res) => res.json(await s.organica.guardarCargo(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/cargos/:id', validar({ params: E.pId }), async (req, res) => { await s.organica.removerCargo(u(req), req.dados.params.id); res.status(204).end() })

  // administração
  r.get('/utilizadores', async (req, res) => res.json(await s.sessao.listar(u(req))))
  r.post('/utilizadores/contas-pessoas', validar({ body: E.contasPessoas }), async (req, res) => res.json(await s.sessao.criarContasPessoas(u(req), req.dados.body)))
  r.post('/utilizadores', validar({ body: E.utilizador }), async (req, res) => res.status(201).json(await s.sessao.criar(u(req), req.dados.body)))
  // documentos pessoais emitidos da ficha (declarações numeradas, guias, fichas) e quem os assina
  r.get('/tabela-salarial', async (req, res) => res.json(await s.tabelaSalarial.ver(u(req))))
  r.put('/tabela-salarial/:posto', validar({ params: z.object({ posto: z.string().max(40) }), body: z.object({ base: z.coerce.number().min(1).max(1e8) }) }), async (req, res) => res.json(await s.tabelaSalarial.alterarBase(u(req), req.dados.params.posto, req.dados.body.base)))
  r.get('/plano-ferias', validar({ query: z.object({ ano: z.coerce.number().int().min(2000).max(2100), unidadeId: z.string().regex(/^\d+$/).optional(), tipo: z.enum(['militar', 'civil']).optional() }) }), async (req, res) => res.json(await s.planoFerias.ver(u(req), req.dados.query)))
  r.put('/plano-ferias', validar({ body: z.object({ ano: z.number().int().min(2000).max(2100), pessoaId: z.number().int().positive(), mes: z.number().int().min(1).max(12).nullable() }) }), async (req, res) => res.json(await s.planoFerias.definir(u(req), req.dados.body)))
  r.post('/plano-ferias/importar', validar({ body: z.object({ ano: z.number().int().min(2000).max(2100), linhas: z.array(z.object({ identificador: z.union([z.string(), z.number()]).transform(String), mes: z.union([z.string(), z.number()]).transform(String) })).max(5000) }) }), async (req, res) => res.json(await s.planoFerias.importar(u(req), req.dados.body)))
  r.get('/tabela-salarial-civis/cargos', async (req, res) => res.json(await s.tabelaSalarial.verCivisCargos(u(req))))
  r.put('/tabela-salarial-civis/cargos', validar({ body: z.object({ chave: z.string().min(1).max(200), vencimento: z.coerce.number().min(1).max(1e8).nullable() }) }), async (req, res) => res.json(await s.tabelaSalarial.alterarCargoCivil(u(req), req.dados.body.chave, req.dados.body.vencimento)))
  r.get('/tabela-salarial-civis', async (req, res) => res.json(await s.tabelaSalarial.verCivis(u(req))))
  r.put('/tabela-salarial-civis/:categoria', validar({ params: z.object({ categoria: z.string().max(40) }), body: z.object({ base: z.coerce.number().min(1).max(1e8) }) }), async (req, res) => res.json(await s.tabelaSalarial.alterarBaseCivil(u(req), req.dados.params.categoria, req.dados.body.base)))
  r.get('/declaracoes', validar({ query: z.object({ q: z.string().max(100).optional(), tipo: z.string().max(40).optional(), de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }) }), async (req, res) => res.json(await s.documentosEmitidos.declaracoes(u(req), req.dados.query)))
  r.post('/declaracoes/impressoes', validar({ body: z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }) }), async (req, res) => res.json(await s.documentosEmitidos.registarImpressao(u(req), req.dados.body.ids)))
  r.get('/definicoes/assinaturas', async (req, res) => res.json(await s.documentosEmitidos.assinaturas(u(req))))
  r.put('/definicoes/assinaturas', validar({ body: E.assinaturas }), async (req, res) => res.json(await s.documentosEmitidos.guardarAssinaturas(u(req), req.dados.body)))
  r.get('/pessoas/:id/documentos-emitidos', validar({ params: E.pId }), async (req, res) => res.json(await s.documentosEmitidos.historico(u(req), req.dados.params.id)))
  r.post('/pessoas/:id/documentos-emitidos', validar({ params: E.pId, body: E.emitirDocumentos }), async (req, res) => res.status(201).json(await s.documentosEmitidos.emitir(u(req), req.dados.params.id, req.dados.body.documentos)))
  r.post('/utilizadores/:id/2fa/repor', validar({ params: E.pId }), async (req, res) => res.json(await s.doisFatores.repor(u(req), req.dados.params.id)))
  r.put('/utilizadores/:id', validar({ params: E.pId, body: E.editarUtilizador }), async (req, res) => res.json(await s.sessao.editar(u(req), req.dados.params.id, req.dados.body)))
  r.get('/auditoria', validar({ query: z.object({ de: z.string().max(10).optional(), ate: z.string().max(10).optional(), utilizador: z.string().max(200).optional(), acao: z.string().max(40).optional() }) }), async (req, res) => res.json(await s.auditoria.listar(u(req), req.dados.query)))
  // cada exportação para Excel ou PDF fica registada (quem levou que dados)
  r.post('/auditoria/exportacao', validar({ body: z.object({ tabela: z.string().max(120), formato: z.enum(['excel', 'pdf']), linhas: z.number().int().min(0).max(1_000_000) }) }), async (req, res) => {
    exigir(u(req), 'ver')
    await s.auditoria.registar(u(req), 'exportar', req.dados.body.tabela, { formato: req.dados.body.formato, linhas: req.dados.body.linhas }, ip(req))
    res.status(204).end()
  })
  r.get('/portal', async (req, res) => res.json(await s.sincronizacao.estado(u(req))))
  // estudantes e docentes (também os de fora da ESG), com o estado no portal
  r.get('/academicos', validar({ query: z.object({ tipo: z.enum(['estudante', 'docente']), q: z.string().max(100).optional(), ativo: z.enum(['sim', 'nao', 'todos']).optional() }) }), async (req, res) => {
    const { tipo, q, ativo } = req.dados.query
    const lista = await s.pessoas.listar(u(req), { vinculo: tipo, q, ativo })
    const estado = await s.sincronizacao.estadoNoPortal(lista.map((p) => p.id))
    res.json({
      portalLigado: s.sincronizacao.ativa,
      pessoas: lista.map((p) => ({
        id: p.id, nome: p.nome, fotoId: p.fotoId, tipo: p.tipo, vinculo: p.vinculo, postoNome: p.postoNome, postoAbreviatura: p.postoAbreviatura, ramo: p.ramo,
        nip: p.nip, numeroAgente: p.numeroAgente, email: p.email, ativo: p.ativo, unidadeNome: p.unidadeNome, unidadeOrigem: p.unidadeOrigem,
        tipoDocente: p.tipoDocente, categoriaDocente: p.categoriaDocente, funcaoActual: p.funcaoActual, portal: estado.get(p.id) ?? null,
        // para a pesquisa e as colunas que se escolhem
        bi: p.bi, telefone: p.telefone, nomeGuerra: p.nomeGuerra, genero: p.genero, idade: p.idade, dataNascimento: p.dataNascimento, naturalidade: p.naturalidade, provincia: p.provincia,
        nacionalidade: p.nacionalidade, habilitacao: p.habilitacao, areaFormacao: p.areaFormacao, especialidade: p.especialidade,
      })),
    })
  })
  r.post('/fichas-acesso', validar({ body: z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }) }), async (req, res) => res.json(await s.sincronizacao.fichasAcesso(u(req), req.dados.body.ids)))
  // ficha de acesso ao portal (palavra-passe inicial nova, só para imprimir)
  r.post('/pessoas/:id/ficha-acesso', validar({ params: E.pId }), async (req, res) => res.json(await s.sincronizacao.fichaAcesso(u(req), req.dados.params.id)))
  r.post('/portal/enviar', async (req, res) => { exigir(u(req), 'administrar'); res.json(await s.sincronizacao.enviarPendentes()) })
  r.post('/portal/reenviar-todos', async (req, res) => res.json(await s.sincronizacao.reenviarTodos(u(req))))
  return r
}

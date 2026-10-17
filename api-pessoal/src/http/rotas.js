import fs from 'node:fs'
import path from 'node:path'
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
import { EVENTOS_MANUAIS, TIPOS_EVENTO } from '../aplicacao/pessoas.js'
import { ESTADOS_PROPOSTA, TIPOS_PROPOSTA } from '../aplicacao/propostas.js'
import { NOMES_LICENCA } from '../aplicacao/licencas.js'

// assinaturas dos formatos de imagem aceites para a fotografia
const IMAGENS = [['jpg', [0xff, 0xd8, 0xff]], ['png', [0x89, 0x50, 0x4e, 0x47]], ['webp', [0x52, 0x49, 0x46, 0x46]]]
const tipoImagem = (b) => IMAGENS.find(([, m]) => m.every((x, i) => b[i] === x))?.[0]

export function rotas({ servicos: s, config }) {
  const r = express.Router()
  const u = (req) => req.utilizador
  const ip = (req) => req.ip

  // entrar: no máximo 10 tentativas por minuto por endereço (além do bloqueio da conta)
  const limiteEntrar = rateLimit({ windowMs: 60_000, limit: config.teste ? 1000 : 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { erro: 'Demasiadas tentativas. Aguarde um minuto.', codigo: 'demasiados_pedidos' } })
  r.post('/entrar', limiteEntrar, validar({ body: E.entrar }), async (req, res) => res.json(await s.sessao.entrar(req.dados.body, ip(req))))

  r.use(autenticar(s.sessao))
  r.get('/eu', (req, res) => res.json(s.sessao.eu(u(req))))
  r.post('/mudar-senha', validar({ body: E.mudarSenha }), async (req, res) => res.json(await s.sessao.mudarSenha(u(req), req.dados.body)))
  r.post('/sair', async (req, res) => { await s.sessao.sair(u(req)); res.status(204).end() })
  r.get('/referencias', (req, res) => res.json({ ...referencias(), papeis: PAPEIS, tiposEvento: TIPOS_EVENTO, eventosManuais: EVENTOS_MANUAIS, tiposProposta: TIPOS_PROPOSTA, estadosProposta: ESTADOS_PROPOSTA, tiposLicenca: NOMES_LICENCA }))

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

  // carreiras
  r.get('/carreira/antiguidade', validar({ query: z.object({ posto: z.string().max(30).optional(), ramo: z.string().max(3).optional() }) }), async (req, res) => res.json(await s.pessoas.antiguidade(u(req), req.dados.query)))
  r.get('/carreira/elegiveis', validar({ query: z.object({ tipo: z.enum(['militar', 'civil']).default('militar') }) }), async (req, res) => res.json(await s.pessoas.elegiveis(u(req), req.dados.query)))
  r.get('/carreira/reserva', validar({ query: z.object({ anos: z.coerce.number().int().min(1).max(15).default(5) }) }), async (req, res) => res.json(await s.pessoas.projecaoReserva(u(req), req.dados.query)))

  r.get('/propostas', validar({ query: z.object({ estado: z.string().max(20).optional(), tipo: z.string().max(20).optional(), pessoaId: z.string().max(10).optional() }) }), async (req, res) => res.json(await s.propostas.listar(u(req), req.dados.query)))
  r.post('/propostas', validar({ body: E.proposta }), async (req, res) => res.status(201).json(await s.propostas.criar(u(req), req.dados.body)))
  r.get('/propostas/:id', validar({ params: E.pId }), async (req, res) => res.json(await s.propostas.obter(u(req), req.dados.params.id)))
  r.put('/propostas/:id', validar({ params: E.pId, body: E.editarProposta }), async (req, res) => res.json(await s.propostas.editar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/itens', validar({ params: E.pId, body: E.itemProposta }), async (req, res) => res.status(201).json(await s.propostas.adicionarItem(u(req), req.dados.params.id, req.dados.body)))
  r.delete('/propostas/:id/itens/:sub', validar({ params: E.pIdSub }), async (req, res) => res.json(await s.propostas.removerItem(u(req), req.dados.params.id, req.dados.params.sub)))
  r.post('/propostas/:id/submeter', validar({ params: E.pId }), async (req, res) => res.json(await s.propostas.submeter(u(req), req.dados.params.id)))
  r.post('/propostas/:id/aprovar', validar({ params: E.pId, body: E.despacho }), async (req, res) => res.json(await s.propostas.aprovar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/rejeitar', validar({ params: E.pId, body: E.motivoObrigatorio }), async (req, res) => res.json(await s.propostas.rejeitar(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/devolver', validar({ params: E.pId, body: E.motivo }), async (req, res) => res.json(await s.propostas.devolver(u(req), req.dados.params.id, req.dados.body)))
  r.post('/propostas/:id/cancelar', validar({ params: E.pId, body: E.motivo }), async (req, res) => res.json(await s.propostas.cancelar(u(req), req.dados.params.id, req.dados.body)))

  // licenças
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
  r.post('/utilizadores', validar({ body: E.utilizador }), async (req, res) => res.status(201).json(await s.sessao.criar(u(req), req.dados.body)))
  r.put('/utilizadores/:id', validar({ params: E.pId, body: E.editarUtilizador }), async (req, res) => res.json(await s.sessao.editar(u(req), req.dados.params.id, req.dados.body)))
  r.get('/auditoria', validar({ query: z.object({ de: z.string().max(10).optional(), ate: z.string().max(10).optional(), utilizador: z.string().max(200).optional(), acao: z.string().max(40).optional() }) }), async (req, res) => res.json(await s.auditoria.listar(u(req), req.dados.query)))
  // cada exportação para Excel ou PDF fica registada (quem levou que dados)
  r.post('/auditoria/exportacao', validar({ body: z.object({ tabela: z.string().max(120), formato: z.enum(['excel', 'pdf']), linhas: z.number().int().min(0).max(1_000_000) }) }), async (req, res) => {
    exigir(u(req), 'ver')
    await s.auditoria.registar(u(req), 'exportar', req.dados.body.tabela, { formato: req.dados.body.formato, linhas: req.dados.body.linhas }, ip(req))
    res.status(204).end()
  })
  r.get('/portal', async (req, res) => res.json(await s.sincronizacao.estado(u(req))))
  r.post('/portal/enviar', async (req, res) => { exigir(u(req), 'administrar'); res.json(await s.sincronizacao.enviarPendentes()) })
  r.post('/portal/reenviar-todos', async (req, res) => res.json(await s.sincronizacao.reenviarTodos(u(req))))
  return r
}

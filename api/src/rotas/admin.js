import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import config from '../config.js'
import db, { transacao } from '../db.js'
import { autenticar, cifrarSenha, criarToken, exigir, limitador, pode, senhaValida, verificarSenha } from '../auth.js'
import { registar } from '../atividade.js'
import { RECURSOS, limparPermissoes } from '../rbac.js'
import { COLECOES, PAGINAS, baseUrl, estatisticas, lerItem, lerPagina, listarColecao, relativizar, slugificar } from '../conteudo.js'

const rotas = Router()

const papelExiste = (id) => Boolean(db.prepare('SELECT 1 FROM papeis WHERE id = ?').get(id))

const publicoUtilizador = (u) => ({
  id: u.id, nome: u.nome, email: u.email, papel: u.papel, ativo: Boolean(u.ativo),
  criadoEm: u.criado_em, ultimoAcesso: u.ultimo_acesso,
})

// títulos de notícias, eventos e artigos (para mostrar comentários e estatísticas)
function titulosInterativos(req) {
  const titulos = {}
  for (const c of ['noticias', 'eventos', 'artigos']) {
    for (const it of listarColecao(c, req)) titulos[`${c}/${it[COLECOES[c].chave]}`] = it[COLECOES[c].titulo]
  }
  return titulos
}

// ===================== Sessão =====================

rotas.post(
  '/entrar',
  limitador({
    janelaMs: 15 * 60_000,
    maximo: 8,
    chave: (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase()}`,
    mensagem: 'Demasiadas tentativas. Aguarde 15 minutos.',
  }),
  (req, res) => {
    const { email, senha } = req.body || {}
    const u = db.prepare('SELECT * FROM utilizadores WHERE email = ?').get(String(email || '').trim())

    if (!u || !verificarSenha(String(senha || ''), u.senha)) {
      registar(req, { acao: 'falha_entrada', detalhes: { email: String(email || '').slice(0, 120) }, utilizador: u ? { id: u.id, nome: u.nome } : null })
      return res.status(401).json({ erro: 'E-mail ou palavra-passe incorretos.' })
    }
    if (!u.ativo) {
      registar(req, { acao: 'falha_entrada', detalhes: 'conta desativada', utilizador: u })
      return res.status(403).json({ erro: 'Esta conta está desativada. Contacte um administrador.' })
    }

    db.prepare("UPDATE utilizadores SET ultimo_acesso = datetime('now') WHERE id = ?").run(u.id)
    registar(req, { acao: 'entrar', utilizador: u })
    res.json({ token: criarToken(u), utilizador: publicoUtilizador(u) })
  },
)

// todas as rotas abaixo exigem sessão
rotas.use(autenticar)

// dados da conta + papel + permissões (o painel usa-as para mostrar só o que o utilizador pode fazer)
rotas.get('/eu', (req, res) => {
  const u = db.prepare('SELECT * FROM utilizadores WHERE id = ?').get(req.utilizador.id)
  const papel = db.prepare('SELECT id, nome FROM papeis WHERE id = ?').get(u.papel)
  res.json({ ...publicoUtilizador(u), nomePapel: papel?.nome || u.papel, permissoes: req.utilizador.permissoes })
})

rotas.post('/sair', (req, res) => {
  registar(req, { acao: 'sair' })
  res.status(204).end()
})

rotas.put('/eu/senha', (req, res) => {
  const { atual, nova } = req.body || {}
  const u = db.prepare('SELECT * FROM utilizadores WHERE id = ?').get(req.utilizador.id)
  if (!verificarSenha(String(atual || ''), u.senha)) return res.status(400).json({ erro: 'A palavra-passe atual está errada.' })
  if (!senhaValida(nova)) return res.status(400).json({ erro: 'A nova palavra-passe deve ter pelo menos 8 caracteres, com letras e números.' })
  db.prepare('UPDATE utilizadores SET senha = ? WHERE id = ?').run(cifrarSenha(nova), u.id)
  registar(req, { acao: 'alterar_senha' })
  res.status(204).end()
})

// ===================== Painel =====================

function resumoVisitas(dias) {
  const desde = `datetime('now', '-${dias} days')`
  return db.prepare(`SELECT COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas WHERE data >= ${desde}`).get()
}

rotas.get('/painel', (req, res) => {
  const u = req.utilizador
  const contar = (sql, ...p) => db.prepare(sql).get(...p).n

  const totais = {}
  const rascunhos = {}
  for (const c of Object.keys(COLECOES)) {
    if (!pode(u, `${c}.ver`)) continue
    totais[c] = contar("SELECT COUNT(*) n FROM itens WHERE colecao = ? AND estado = 'publicado'", c)
    rascunhos[c] = contar("SELECT COUNT(*) n FROM itens WHERE colecao = ? AND estado = 'rascunho'", c)
  }

  const resposta = {
    totais,
    rascunhos,
    interacoes: {
      gostos: contar('SELECT COUNT(*) n FROM gostos'),
      comentarios: contar('SELECT COUNT(*) n FROM comentarios'),
      visualizacoes: contar('SELECT COALESCE(SUM(total), 0) n FROM visualizacoes'),
      comentariosHoje: contar("SELECT COUNT(*) n FROM comentarios WHERE date(data) = date('now')"),
    },
  }

  // rascunhos à espera de publicação (para quem pode publicar)
  const porPublicar = []
  for (const c of Object.keys(COLECOES)) {
    if (!pode(u, `${c}.publicar`)) continue
    for (const it of listarColecao(c, req)) {
      if (it._estado === 'rascunho') porPublicar.push({ colecao: c, id: it[COLECOES[c].chave], titulo: it[COLECOES[c].titulo], atualizado: it._atualizado, por: it._editadoPor })
    }
  }
  resposta.porPublicar = porPublicar.sort((a, b) => b.atualizado.localeCompare(a.atualizado)).slice(0, 8)

  if (pode(u, 'estatisticas.ver')) {
    resposta.visitas = {
      hoje: db.prepare("SELECT COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas WHERE date(data) = date('now')").get(),
      semana: resumoVisitas(7),
      mes: resumoVisitas(30),
      online: contar("SELECT COUNT(DISTINCT visitante) n FROM visitas WHERE data >= datetime('now', '-5 minutes')"),
    }
    resposta.visitasDias = db.prepare(`SELECT date(data) dia, COUNT(DISTINCT visitante) n FROM visitas
      WHERE data >= datetime('now', '-13 days') GROUP BY dia ORDER BY dia`).all()

    const est = estatisticas()
    const titulos = titulosInterativos(req)
    resposta.maisVistos = Object.entries(est)
      .filter(([k]) => titulos[k])
      .map(([k, v]) => ({ chave: k, colecao: k.split('/')[0], titulo: titulos[k], ...v }))
      .sort((a, b) => b.visualizacoes - a.visualizacoes || b.gostos - a.gostos)
      .slice(0, 6)
  }

  if (pode(u, 'comentarios.ver')) {
    const titulos = titulosInterativos(req)
    resposta.comentariosDias = db.prepare(`SELECT date(data) dia, COUNT(*) n FROM comentarios
      WHERE data >= datetime('now', '-13 days') GROUP BY dia ORDER BY dia`).all()
    resposta.ultimosComentarios = db.prepare('SELECT * FROM comentarios ORDER BY data DESC, id DESC LIMIT 5').all()
      .map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id }))
  }

  resposta.ultimasAtividades = pode(u, 'atividades.ver')
    ? db.prepare('SELECT * FROM atividades ORDER BY id DESC LIMIT 8').all()
    : db.prepare('SELECT * FROM atividades WHERE utilizador_id = ? ORDER BY id DESC LIMIT 8').all(u.id)

  res.json(resposta)
})

// ===================== Estatísticas de visitas =====================

rotas.get('/estatisticas', exigir('estatisticas.ver'), (req, res) => {
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30))
  const desde = `datetime('now', '-${dias} days')`
  const top = (campo, limite = 8) => db.prepare(`
    SELECT ${campo} valor, COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas
    WHERE data >= ${desde} AND ${campo} IS NOT NULL GROUP BY ${campo} ORDER BY paginas DESC LIMIT ${limite}`).all()

  // visitantes que já tinham vindo antes do período
  const recorrentes = db.prepare(`SELECT COUNT(DISTINCT visitante) n FROM visitas WHERE data >= ${desde}
    AND visitante IN (SELECT visitante FROM visitas WHERE data < ${desde})`).get().n
  const totais = db.prepare(`SELECT COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas WHERE data >= ${desde}`).get()
  const sessoes = db.prepare(`SELECT COUNT(*) n FROM (SELECT DISTINCT visitante, date(data) FROM visitas WHERE data >= ${desde})`).get().n

  res.json({
    dias,
    totais: { ...totais, sessoes, recorrentes, paginasPorVisita: sessoes ? +(totais.paginas / sessoes).toFixed(1) : 0 },
    online: db.prepare("SELECT COUNT(DISTINCT visitante) n FROM visitas WHERE data >= datetime('now', '-5 minutes')").get().n,
    porDia: db.prepare(`SELECT date(data) dia, COUNT(*) paginas, COUNT(DISTINCT visitante) visitantes FROM visitas
      WHERE data >= ${desde} GROUP BY dia ORDER BY dia`).all(),
    porHora: db.prepare(`SELECT CAST(strftime('%H', data, 'localtime') AS INTEGER) hora, COUNT(*) paginas FROM visitas
      WHERE data >= ${desde} GROUP BY hora ORDER BY hora`).all(),
    paginas: top('caminho', 12),
    origens: top('origem'),
    dispositivos: top('dispositivo'),
    navegadores: top('navegador'),
  })
})

// ===================== Coleções =====================

function validarColecao(req, res, next) {
  if (!COLECOES[req.params.colecao]) return res.status(404).json({ erro: 'Coleção desconhecida.' })
  next()
}

function metricasPublicidade() {
  const linhas = db.prepare('SELECT banner_id, SUM(impressoes) impressoes, SUM(cliques) cliques FROM publicidade_metricas GROUP BY banner_id').all()
  return Object.fromEntries(linhas.map((l) => [l.banner_id, { impressoes: l.impressoes, cliques: l.cliques }]))
}

rotas.get('/colecoes/:colecao', validarColecao, exigir('{colecao}.ver'), (req, res) => {
  const { colecao } = req.params
  const chave = COLECOES[colecao].chave
  const est = estatisticas()
  const pub = colecao === 'publicidade' ? metricasPublicidade() : {}
  res.json(listarColecao(colecao, req).map((it) => ({
    ...it,
    _estatisticas: est[`${colecao}/${it[chave]}`] || null,
    _metricas: pub[it[chave]] || (colecao === 'publicidade' ? { impressoes: 0, cliques: 0 } : undefined),
  })))
})

rotas.get('/colecoes/:colecao/:id', validarColecao, exigir('{colecao}.ver'), (req, res) => {
  const item = lerItem(req.params.colecao, req.params.id, req)
  if (!item) return res.status(404).json({ erro: 'Item não encontrado.' })
  res.json(item)
})

function limparDados(dados) {
  // campos internos (começados por _) não se guardam
  const limpo = Object.fromEntries(Object.entries(dados || {}).filter(([k]) => !k.startsWith('_')))
  return relativizar(limpo)
}

function idUnico(colecao, base) {
  let id = base
  let n = 2
  while (db.prepare('SELECT 1 FROM itens WHERE colecao = ? AND id = ?').get(colecao, id)) id = `${base}-${n++}`
  return id
}

// estado pedido pelo painel: sem permissão de publicar, tudo fica em rascunho
function estadoPedido(req, colecao, atual) {
  const pedido = req.body?._estado
  if (!pode(req.utilizador, `${colecao}.publicar`)) return atual === 'publicado' ? 'publicado' : 'rascunho'
  return pedido === 'rascunho' || pedido === 'publicado' ? pedido : (atual || 'publicado')
}

rotas.post('/colecoes/:colecao', validarColecao, exigir('{colecao}.criar'), (req, res) => {
  const { colecao } = req.params
  const def = COLECOES[colecao]
  const dados = limparDados(req.body)
  const titulo = dados[def.titulo]
  if (!titulo || !String(titulo).trim()) return res.status(400).json({ erro: 'O título é obrigatório.' })

  const id = idUnico(colecao, slugificar(dados[def.chave] || titulo))
  dados[def.chave] = id
  const estado = estadoPedido(req, colecao, null)
  const ordem = db.prepare('SELECT COALESCE(MAX(ordem), 0) + 1 n FROM itens WHERE colecao = ?').get(colecao).n
  db.prepare('INSERT INTO itens (colecao, id, dados, ordem, estado, atualizado_por, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(colecao, id, JSON.stringify(dados), ordem, estado, req.utilizador.id, req.utilizador.id)

  registar(req, { acao: 'criar', colecao, alvoId: id, alvoTitulo: titulo, detalhes: { estado } })
  res.status(201).json(lerItem(colecao, id, req))
})

rotas.put('/colecoes/:colecao/:id', validarColecao, exigir('{colecao}.editar', '{colecao}.publicar'), (req, res) => {
  const { colecao, id } = req.params
  const def = COLECOES[colecao]
  const atual = db.prepare('SELECT dados, estado FROM itens WHERE colecao = ? AND id = ?').get(colecao, id)
  if (!atual) return res.status(404).json({ erro: 'Item não encontrado.' })

  // quem não pode publicar não altera conteúdos já publicados
  const podePublicar = pode(req.utilizador, `${colecao}.publicar`)
  if (atual.estado === 'publicado' && !podePublicar) {
    return res.status(403).json({ erro: 'Este conteúdo já está publicado. Só quem tem permissão de publicar o pode alterar.' })
  }
  if (!pode(req.utilizador, `${colecao}.editar`) && req.body?._estado === atual.estado) {
    return res.status(403).json({ erro: 'Não tem permissão para editar este conteúdo.' })
  }

  const dados = limparDados(req.body)
  if (!dados[def.titulo] || !String(dados[def.titulo]).trim()) return res.status(400).json({ erro: 'O título é obrigatório.' })
  dados[def.chave] = id // o identificador (endereço da página) não muda ao editar
  const estado = estadoPedido(req, colecao, atual.estado)

  const antes = JSON.parse(atual.dados)
  const alterados = Object.keys({ ...antes, ...dados }).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(dados[k]))

  db.prepare("UPDATE itens SET dados = ?, estado = ?, atualizado_em = datetime('now'), atualizado_por = ? WHERE colecao = ? AND id = ?")
    .run(JSON.stringify(dados), estado, req.utilizador.id, colecao, id)

  const acao = estado !== atual.estado ? (estado === 'publicado' ? 'publicar' : 'despublicar') : 'editar'
  registar(req, { acao, colecao, alvoId: id, alvoTitulo: dados[def.titulo], detalhes: { campos: alterados } })
  res.json(lerItem(colecao, id, req))
})

rotas.delete('/colecoes/:colecao/:id', validarColecao, exigir('{colecao}.apagar'), (req, res) => {
  const { colecao, id } = req.params
  const atual = db.prepare('SELECT dados FROM itens WHERE colecao = ? AND id = ?').get(colecao, id)
  if (!atual) return res.status(404).json({ erro: 'Item não encontrado.' })
  const titulo = JSON.parse(atual.dados)[COLECOES[colecao].titulo]

  transacao(() => {
    db.prepare('DELETE FROM itens WHERE colecao = ? AND id = ?').run(colecao, id)
    db.prepare('DELETE FROM gostos WHERE colecao = ? AND item_id = ?').run(colecao, id)
    db.prepare('DELETE FROM comentarios WHERE colecao = ? AND item_id = ?').run(colecao, id)
    db.prepare('DELETE FROM visualizacoes WHERE colecao = ? AND item_id = ?').run(colecao, id)
    db.prepare('DELETE FROM publicidade_metricas WHERE banner_id = ?').run(id)
  })
  registar(req, { acao: 'apagar', colecao, alvoId: id, alvoTitulo: titulo })
  res.status(204).end()
})

// mudar a ordem de cursos, pessoas e banners
rotas.put('/ordem/:colecao', validarColecao, exigir('{colecao}.editar'), (req, res) => {
  const { colecao } = req.params
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  transacao(() => ids.forEach((id, i) => db.prepare('UPDATE itens SET ordem = ? WHERE colecao = ? AND id = ?').run(i + 1, colecao, String(id))))
  registar(req, { acao: 'reordenar', colecao, detalhes: { ids } })
  res.status(204).end()
})

// ===================== Páginas =====================

rotas.get('/paginas/:chave', exigir('paginas.ver'), (req, res) => {
  if (!PAGINAS.includes(req.params.chave)) return res.status(404).json({ erro: 'Página desconhecida.' })
  res.json(lerPagina(req.params.chave, req) || {})
})

rotas.put('/paginas/:chave', exigir('paginas.editar'), (req, res) => {
  const { chave } = req.params
  if (!PAGINAS.includes(chave)) return res.status(404).json({ erro: 'Página desconhecida.' })
  const dados = relativizar(req.body || {})
  db.prepare(`INSERT INTO paginas (chave, dados, atualizado_por) VALUES (?, ?, ?)
    ON CONFLICT (chave) DO UPDATE SET dados = excluded.dados, atualizado_em = datetime('now'), atualizado_por = excluded.atualizado_por`)
    .run(chave, JSON.stringify(dados), req.utilizador.id)
  registar(req, { acao: 'editar_pagina', colecao: 'paginas', alvoId: chave, alvoTitulo: `Página ${chave}` })
  res.json(lerPagina(chave, req))
})

// ===================== Ficheiros =====================

const TIPOS = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'application/pdf': '.pdf',
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => {
      const pasta = path.join(config.pastaUploads, new Date().toISOString().slice(0, 7))
      fs.mkdirSync(pasta, { recursive: true })
      cb(null, pasta)
    },
    // nome aleatório: nunca se usa o nome enviado pelo utilizador no disco
    filename: (req, f, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[f.mimetype]}`),
  }),
  limits: { fileSize: config.tamanhoMaximoUpload, files: 20 },
  fileFilter: (req, f, cb) => cb(TIPOS[f.mimetype] ? null : new Error('Tipo de ficheiro não permitido.'), Boolean(TIPOS[f.mimetype])),
})

// só quem pode criar ou editar algum conteúdo (ou páginas) envia ficheiros
function podeEnviar(req, res, next) {
  const pode_ = req.utilizador.permissoes.some((p) => /\.(criar|editar)$/.test(p) && !p.startsWith('utilizadores'))
  if (!pode_) return res.status(403).json({ erro: 'Não tem permissão para enviar ficheiros.' })
  next()
}

rotas.post('/ficheiros', podeEnviar, (req, res) => {
  upload.array('ficheiros')(req, res, (erro) => {
    if (erro) {
      const msg = erro.code === 'LIMIT_FILE_SIZE' ? `Ficheiro demasiado grande (máximo ${config.tamanhoMaximoUpload / 1048576} MB).` : erro.message
      return res.status(400).json({ erro: msg })
    }
    const base = baseUrl(req)
    const ficheiros = (req.files || []).map((f) => {
      const relativo = '/uploads/' + path.relative(config.pastaUploads, f.path).split(path.sep).join('/')
      return { url: base + relativo, nome: f.originalname, tipo: f.mimetype, tamanho: f.size }
    })
    ficheiros.forEach((f) => registar(req, { acao: 'carregar_ficheiro', alvoTitulo: f.nome, detalhes: { url: f.url, tamanho: f.tamanho } }))
    res.status(201).json(ficheiros)
  })
})

// ===================== Comentários =====================

rotas.get('/comentarios', exigir('comentarios.ver'), (req, res) => {
  const titulos = titulosInterativos(req)
  const linhas = db.prepare('SELECT * FROM comentarios ORDER BY data DESC, id DESC').all()
  res.json(linhas.map((c) => ({ ...c, tituloItem: titulos[`${c.colecao}/${c.item_id}`] || c.item_id })))
})

rotas.delete('/comentarios/:id', exigir('comentarios.apagar'), (req, res) => {
  const c = db.prepare('SELECT * FROM comentarios WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ erro: 'Comentário não encontrado.' })
  db.prepare('DELETE FROM comentarios WHERE id = ?').run(c.id)
  registar(req, {
    acao: 'apagar_comentario', colecao: c.colecao, alvoId: c.item_id,
    alvoTitulo: `Comentário de ${c.nome}`, detalhes: { texto: c.texto.slice(0, 300) },
  })
  res.status(204).end()
})

// ===================== Papéis (RBAC) =====================

rotas.get('/papeis', exigir('papeis.ver', 'utilizadores.ver'), (req, res) => {
  const utilizadores = db.prepare('SELECT papel, COUNT(*) n FROM utilizadores GROUP BY papel').all()
  const porPapel = Object.fromEntries(utilizadores.map((u) => [u.papel, u.n]))
  const papeis = db.prepare('SELECT * FROM papeis ORDER BY sistema DESC, nome').all().map((p) => ({
    id: p.id, nome: p.nome, descricao: p.descricao, sistema: Boolean(p.sistema),
    permissoes: JSON.parse(p.permissoes), utilizadores: porPapel[p.id] || 0,
  }))
  res.json({ papeis, recursos: RECURSOS })
})

rotas.post('/papeis', exigir('papeis.gerir'), (req, res) => {
  const { nome, descricao, permissoes } = req.body || {}
  if (!String(nome || '').trim()) return res.status(400).json({ erro: 'O nome do papel é obrigatório.' })
  const id = (() => {
    let base = slugificar(nome).replace(/-/g, '_')
    let n = 2
    let c = base
    while (papelExiste(c)) c = `${base}_${n++}`
    return c
  })()
  const lista = limparPermissoes(permissoes)
  db.prepare('INSERT INTO papeis (id, nome, descricao, permissoes) VALUES (?, ?, ?, ?)').run(id, nome.trim(), String(descricao || '').trim(), JSON.stringify(lista))
  registar(req, { acao: 'criar_papel', colecao: 'papeis', alvoId: id, alvoTitulo: nome.trim(), detalhes: { permissoes: lista.length } })
  res.status(201).json({ id })
})

rotas.put('/papeis/:id', exigir('papeis.gerir'), (req, res) => {
  const p = db.prepare('SELECT * FROM papeis WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ erro: 'Papel não encontrado.' })
  if (p.sistema) return res.status(400).json({ erro: 'O papel de Administrador tem sempre acesso total e não pode ser alterado.' })
  const { nome, descricao, permissoes } = req.body || {}
  const antes = JSON.parse(p.permissoes)
  const lista = permissoes === undefined ? antes : limparPermissoes(permissoes)
  db.prepare('UPDATE papeis SET nome = ?, descricao = ?, permissoes = ? WHERE id = ?')
    .run(String(nome ?? p.nome).trim() || p.nome, String(descricao ?? p.descricao ?? '').trim(), JSON.stringify(lista), p.id)
  registar(req, {
    acao: 'editar_papel', colecao: 'papeis', alvoId: p.id, alvoTitulo: nome || p.nome,
    detalhes: { acrescentadas: lista.filter((x) => !antes.includes(x)), retiradas: antes.filter((x) => !lista.includes(x)) },
  })
  res.status(204).end()
})

rotas.delete('/papeis/:id', exigir('papeis.gerir'), (req, res) => {
  const p = db.prepare('SELECT * FROM papeis WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ erro: 'Papel não encontrado.' })
  if (p.sistema) return res.status(400).json({ erro: 'O papel de Administrador não pode ser apagado.' })
  const emUso = db.prepare('SELECT COUNT(*) n FROM utilizadores WHERE papel = ?').get(p.id).n
  if (emUso) return res.status(400).json({ erro: `Este papel está atribuído a ${emUso} utilizador(es). Mude-lhes o papel primeiro.` })
  db.prepare('DELETE FROM papeis WHERE id = ?').run(p.id)
  registar(req, { acao: 'apagar_papel', colecao: 'papeis', alvoId: p.id, alvoTitulo: p.nome })
  res.status(204).end()
})

// ===================== Utilizadores =====================

// só quem gere papéis pode atribuir o papel de Administrador
function podeAtribuir(req, papel) {
  return papel !== 'administrador' || pode(req.utilizador, 'papeis.gerir')
}

rotas.get('/utilizadores', exigir('utilizadores.ver'), (req, res) => {
  const lista = db.prepare('SELECT * FROM utilizadores ORDER BY nome').all().map(publicoUtilizador)
  const acoes = db.prepare('SELECT utilizador_id, COUNT(*) n FROM atividades GROUP BY utilizador_id').all()
  const porId = Object.fromEntries(acoes.map((a) => [a.utilizador_id, a.n]))
  res.json(lista.map((u) => ({ ...u, atividades: porId[u.id] || 0 })))
})

rotas.post('/utilizadores', exigir('utilizadores.criar'), (req, res) => {
  const { nome, email, papel, senha } = req.body || {}
  if (!String(nome || '').trim()) return res.status(400).json({ erro: 'O nome é obrigatório.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ erro: 'E-mail inválido.' })
  if (!papelExiste(papel)) return res.status(400).json({ erro: 'Papel inválido.' })
  if (!podeAtribuir(req, papel)) return res.status(403).json({ erro: 'Não pode atribuir o papel de Administrador.' })
  if (!senhaValida(senha)) return res.status(400).json({ erro: 'A palavra-passe deve ter pelo menos 8 caracteres, com letras e números.' })
  if (db.prepare('SELECT 1 FROM utilizadores WHERE email = ?').get(email.trim())) return res.status(409).json({ erro: 'Já existe um utilizador com este e-mail.' })

  const r = db.prepare('INSERT INTO utilizadores (nome, email, senha, papel) VALUES (?, ?, ?, ?)')
    .run(nome.trim(), email.trim(), cifrarSenha(senha), papel)
  registar(req, { acao: 'criar_utilizador', colecao: 'utilizadores', alvoId: r.lastInsertRowid, alvoTitulo: nome.trim(), detalhes: { email, papel } })
  res.status(201).json(publicoUtilizador(db.prepare('SELECT * FROM utilizadores WHERE id = ?').get(r.lastInsertRowid)))
})

rotas.put('/utilizadores/:id', exigir('utilizadores.editar'), (req, res) => {
  const u = db.prepare('SELECT * FROM utilizadores WHERE id = ?').get(req.params.id)
  if (!u) return res.status(404).json({ erro: 'Utilizador não encontrado.' })
  const { nome, email, papel, ativo, senha } = req.body || {}
  const proprio = u.id === req.utilizador.id

  // quem não gere papéis não mexe em contas de administradores
  if (u.papel === 'administrador' && !pode(req.utilizador, 'papeis.gerir')) {
    return res.status(403).json({ erro: 'Só um administrador pode alterar outro administrador.' })
  }
  if (papel && !papelExiste(papel)) return res.status(400).json({ erro: 'Papel inválido.' })
  if (papel && !podeAtribuir(req, papel)) return res.status(403).json({ erro: 'Não pode atribuir o papel de Administrador.' })

  // impede que o sistema fique sem administradores ativos
  const tiraAdmin = u.papel === 'administrador' && ((papel && papel !== 'administrador') || ativo === false)
  if (tiraAdmin) {
    const outros = db.prepare("SELECT COUNT(*) n FROM utilizadores WHERE papel = 'administrador' AND ativo = 1 AND id != ?").get(u.id).n
    if (outros === 0) return res.status(400).json({ erro: 'Tem de existir pelo menos um administrador ativo.' })
  }
  if (proprio && ativo === false) return res.status(400).json({ erro: 'Não pode desativar a sua própria conta.' })
  if (proprio && papel && papel !== u.papel) return res.status(400).json({ erro: 'Não pode mudar o seu próprio papel.' })
  if (email && email !== u.email && db.prepare('SELECT 1 FROM utilizadores WHERE email = ? AND id != ?').get(email, u.id)) {
    return res.status(409).json({ erro: 'Já existe um utilizador com este e-mail.' })
  }
  if (senha && !senhaValida(senha)) return res.status(400).json({ erro: 'A palavra-passe deve ter pelo menos 8 caracteres, com letras e números.' })

  const novo = {
    nome: String(nome ?? u.nome).trim() || u.nome,
    email: String(email ?? u.email).trim() || u.email,
    papel: papel || u.papel,
    ativo: ativo === undefined ? u.ativo : (ativo ? 1 : 0),
  }
  db.prepare('UPDATE utilizadores SET nome = ?, email = ?, papel = ?, ativo = ? WHERE id = ?')
    .run(novo.nome, novo.email, novo.papel, novo.ativo, u.id)
  if (senha) db.prepare('UPDATE utilizadores SET senha = ? WHERE id = ?').run(cifrarSenha(senha), u.id)

  const mudancas = Object.keys(novo).filter((k) => String(novo[k]) !== String(u[k]))
  if (senha) mudancas.push('palavra-passe')
  registar(req, { acao: 'editar_utilizador', colecao: 'utilizadores', alvoId: u.id, alvoTitulo: novo.nome, detalhes: { campos: mudancas } })
  res.json(publicoUtilizador(db.prepare('SELECT * FROM utilizadores WHERE id = ?').get(u.id)))
})

// ===================== Atividades =====================

rotas.get('/atividades', exigir('atividades.ver'), (req, res) => {
  const { utilizador, acao, colecao, desde, ate, q } = req.query
  const pagina = Math.max(1, Number(req.query.pagina) || 1)
  const porPagina = Math.min(100, Number(req.query.porPagina) || 25)

  const condicoes = []
  const params = []
  if (utilizador) { condicoes.push('utilizador_id = ?'); params.push(Number(utilizador)) }
  if (acao) { condicoes.push('acao = ?'); params.push(acao) }
  if (colecao) { condicoes.push('colecao = ?'); params.push(colecao) }
  if (desde) { condicoes.push('date(data) >= date(?)'); params.push(desde) }
  if (ate) { condicoes.push('date(data) <= date(?)'); params.push(ate) }
  if (q) { condicoes.push('(alvo_titulo LIKE ? OR detalhes LIKE ? OR ip LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : ''

  const total = db.prepare(`SELECT COUNT(*) n FROM atividades ${where}`).get(...params).n
  const linhas = db.prepare(`SELECT * FROM atividades ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, porPagina, (pagina - 1) * porPagina)
  const acoes = db.prepare('SELECT DISTINCT acao FROM atividades ORDER BY acao').all().map((a) => a.acao)
  res.json({ total, pagina, porPagina, linhas, acoes })
})

export default rotas

// Copia os dados da base SQLite antiga (dados/esgfaa.sqlite) para o PostgreSQL.
//   npm run importar-sqlite                 -> só se o PostgreSQL ainda não tiver utilizadores
//   npm run importar-sqlite -- caminho.sqlite
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { criarConfig, RAIZ_API } from '../src/infraestrutura/config.js'
import { criarPrisma } from '../src/infraestrutura/bd/prisma.js'

const ficheiro = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(RAIZ_API, 'dados', 'esgfaa.sqlite')
const config = criarConfig()
const antiga = new DatabaseSync(ficheiro, { readOnly: true })
const prisma = criarPrisma(config.urlBaseDados)

// "2026-10-09 10:07:41" (UTC) ou ISO -> Date
const data = (v) => (v ? new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`) : null)
const todas = (tabela) => {
  try {
    return antiga.prepare(`SELECT * FROM ${tabela}`).all()
  } catch {
    return []
  }
}
const json = (t, padrao) => {
  try {
    return JSON.parse(t)
  } catch {
    return padrao
  }
}

if ((await prisma.utilizador.count()) > 0) {
  console.error('O PostgreSQL já tem dados. Importação cancelada (nada foi alterado).')
  process.exit(1)
}

const resumo = {}
await prisma.$transaction(async (tx) => {
  const copiar = async (nome, linhas, modelo, mapa) => {
    if (linhas.length) await tx[modelo].createMany({ data: linhas.map(mapa), skipDuplicates: true })
    resumo[nome] = linhas.length
  }
  await copiar('papeis', todas('papeis'), 'papel', (l) => ({
    id: l.id, nome: l.nome, descricao: l.descricao || '', permissoes: json(l.permissoes, []), sistema: Boolean(l.sistema), criadoEm: data(l.criado_em) ?? new Date(),
  }))
  await copiar('utilizadores', todas('utilizadores'), 'utilizador', (l) => ({
    id: l.id, nome: l.nome, email: String(l.email).toLowerCase(), senha: l.senha, papel: l.papel, ativo: Boolean(l.ativo),
    criadoEm: data(l.criado_em) ?? new Date(), ultimoAcesso: data(l.ultimo_acesso), tentativasFalhadas: l.tentativas_falhadas ?? 0,
    bloqueadoAte: data(l.bloqueado_ate), versaoToken: l.versao_token ?? 0, deveMudarSenha: Boolean(l.deve_mudar_senha),
  }))
  const ids = new Set(todas('utilizadores').map((u) => u.id))
  const autor = (id) => (id != null && ids.has(id) ? id : null)
  await copiar('itens', todas('itens'), 'item', (l) => ({
    colecao: l.colecao, id: l.id, dados: json(l.dados, {}), ordem: l.ordem ?? 0, estado: l.estado || 'publicado',
    criadoEm: data(l.criado_em) ?? new Date(), atualizadoEm: data(l.atualizado_em) ?? new Date(),
    criadoPor: autor(l.criado_por), atualizadoPor: autor(l.atualizado_por),
  }))
  await copiar('paginas', todas('paginas'), 'pagina', (l) => ({
    chave: l.chave, dados: json(l.dados, {}), atualizadoEm: data(l.atualizado_em) ?? new Date(), atualizadoPor: autor(l.atualizado_por),
  }))
  await copiar('atividades', todas('atividades'), 'atividade', (l) => ({
    id: l.id, utilizadorId: l.utilizador_id, utilizadorNome: l.utilizador_nome, acao: l.acao, colecao: l.colecao,
    alvoId: l.alvo_id, alvoTitulo: l.alvo_titulo, detalhes: l.detalhes, ip: l.ip, agente: l.agente, data: data(l.data),
  }))
  await copiar('gostos', todas('gostos'), 'gosto', (l) => ({ colecao: l.colecao, itemId: l.item_id, visitante: l.visitante, data: data(l.data) }))
  await copiar('comentarios', todas('comentarios'), 'comentario', (l) => ({
    id: l.id, colecao: l.colecao, itemId: l.item_id, nome: l.nome, texto: l.texto, ip: l.ip, data: data(l.data),
  }))
  await copiar('visualizacoes', todas('visualizacoes'), 'visualizacao', (l) => ({ colecao: l.colecao, itemId: l.item_id, total: l.total }))
  await copiar('visitas', todas('visitas'), 'visita', (l) => ({
    id: l.id, data: data(l.data), visitante: l.visitante, caminho: l.caminho, origem: l.origem, dispositivo: l.dispositivo, navegador: l.navegador,
  }))
  await copiar('publicidade_metricas', todas('publicidade_metricas'), 'publicidadeMetrica', (l) => ({
    bannerId: l.banner_id, dia: new Date(`${l.dia}T00:00:00Z`), impressoes: l.impressoes, cliques: l.cliques,
  }))

  // os próximos registos continuam a numeração copiada
  for (const t of ['utilizadores', 'atividades', 'comentarios', 'visitas']) {
    await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`)
  }
}, { timeout: 120_000 })

console.log('Importado do SQLite:', resumo)
await prisma.$disconnect()

import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import config from './config.js'

fs.mkdirSync(config.pastaUploads, { recursive: true })

const db = new DatabaseSync(config.ficheiroBase)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

db.exec(`
  -- notícias, artigos, eventos, cursos e pessoas; o conteúdo de cada item fica em JSON
  CREATE TABLE IF NOT EXISTS itens (
    colecao TEXT NOT NULL,
    id TEXT NOT NULL,
    dados TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_por INTEGER,
    PRIMARY KEY (colecao, id)
  );

  -- conteúdos fixos de cada página (home, institucional, contactos, cursos…)
  CREATE TABLE IF NOT EXISTS paginas (
    chave TEXT PRIMARY KEY,
    dados TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_por INTEGER
  );

  CREATE TABLE IF NOT EXISTS utilizadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('administrador', 'editor')),
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    ultimo_acesso TEXT
  );

  -- registo de tudo o que os utilizadores do painel fazem
  CREATE TABLE IF NOT EXISTS atividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilizador_id INTEGER,
    utilizador_nome TEXT,
    acao TEXT NOT NULL,
    colecao TEXT,
    alvo_id TEXT,
    alvo_titulo TEXT,
    detalhes TEXT,
    ip TEXT,
    agente TEXT,
    data TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS atividades_data ON atividades (data DESC);

  CREATE TABLE IF NOT EXISTS gostos (
    colecao TEXT NOT NULL,
    item_id TEXT NOT NULL,
    visitante TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (colecao, item_id, visitante)
  );

  CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colecao TEXT NOT NULL,
    item_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    ip TEXT,
    data TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS comentarios_item ON comentarios (colecao, item_id);

  CREATE TABLE IF NOT EXISTS visualizacoes (
    colecao TEXT NOT NULL,
    item_id TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (colecao, item_id)
  );
`)

// transação simples (node:sqlite não tem helper próprio)
export function transacao(fn) {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (erro) {
    db.exec('ROLLBACK')
    throw erro
  }
}

export default db

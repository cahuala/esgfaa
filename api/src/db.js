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
    papel TEXT NOT NULL,
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

// ---------- migrações (bases criadas por versões anteriores) ----------

db.exec(`
  CREATE TABLE IF NOT EXISTS papeis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    permissoes TEXT NOT NULL DEFAULT '[]',
    sistema INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- uma linha por página vista no site (sem guardar o IP do visitante)
  CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT (datetime('now')),
    visitante TEXT NOT NULL,
    caminho TEXT NOT NULL,
    origem TEXT,
    dispositivo TEXT,
    navegador TEXT
  );
  CREATE INDEX IF NOT EXISTS visitas_data ON visitas (data);

  CREATE TABLE IF NOT EXISTS publicidade_metricas (
    banner_id TEXT NOT NULL,
    dia TEXT NOT NULL,
    impressoes INTEGER NOT NULL DEFAULT 0,
    cliques INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (banner_id, dia)
  );
`)

const colunas = (tabela) => db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name)

// rascunho / publicado
if (!colunas('itens').includes('estado')) {
  db.exec("ALTER TABLE itens ADD COLUMN estado TEXT NOT NULL DEFAULT 'publicado'")
}
if (!colunas('itens').includes('criado_por')) {
  db.exec('ALTER TABLE itens ADD COLUMN criado_por INTEGER')
}

// a 1.ª versão só aceitava 'administrador' e 'editor' (CHECK): recria a tabela sem essa restrição
const sqlUtilizadores = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'utilizadores'").get()?.sql || ''
if (sqlUtilizadores.includes('CHECK')) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE utilizadores_novo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      senha TEXT NOT NULL,
      papel TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      ultimo_acesso TEXT
    );
    INSERT INTO utilizadores_novo SELECT id, nome, email, senha,
      CASE papel WHEN 'editor' THEN 'editor_chefe' ELSE papel END, ativo, criado_em, ultimo_acesso FROM utilizadores;
    DROP TABLE utilizadores;
    ALTER TABLE utilizadores_novo RENAME TO utilizadores;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `)
}

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

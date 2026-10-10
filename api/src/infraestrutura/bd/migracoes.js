/*
  Migrações versionadas. Cada uma corre uma única vez (tabela "migracoes").
  A 001 é compatível com bases criadas pela versão anterior da API.
*/
const colunas = (bd, tabela) => bd.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name)

export const MIGRACOES = [
  {
    versao: 1,
    nome: 'estrutura base',
    aplicar(bd) {
      bd.exec(`
        CREATE TABLE IF NOT EXISTS itens (
          colecao TEXT NOT NULL, id TEXT NOT NULL, dados TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0,
          criado_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
          atualizado_por INTEGER, PRIMARY KEY (colecao, id)
        );
        CREATE TABLE IF NOT EXISTS paginas (
          chave TEXT PRIMARY KEY, dados TEXT NOT NULL,
          atualizado_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_por INTEGER
        );
        CREATE TABLE IF NOT EXISTS utilizadores (
          id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          senha TEXT NOT NULL, papel TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
          criado_em TEXT NOT NULL DEFAULT (datetime('now')), ultimo_acesso TEXT
        );
        CREATE TABLE IF NOT EXISTS atividades (
          id INTEGER PRIMARY KEY AUTOINCREMENT, utilizador_id INTEGER, utilizador_nome TEXT, acao TEXT NOT NULL,
          colecao TEXT, alvo_id TEXT, alvo_titulo TEXT, detalhes TEXT, ip TEXT, agente TEXT,
          data TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS atividades_data ON atividades (data DESC);
        CREATE TABLE IF NOT EXISTS gostos (
          colecao TEXT NOT NULL, item_id TEXT NOT NULL, visitante TEXT NOT NULL,
          data TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (colecao, item_id, visitante)
        );
        CREATE TABLE IF NOT EXISTS comentarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT, colecao TEXT NOT NULL, item_id TEXT NOT NULL,
          nome TEXT NOT NULL, texto TEXT NOT NULL, ip TEXT, data TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS comentarios_item ON comentarios (colecao, item_id);
        CREATE TABLE IF NOT EXISTS visualizacoes (
          colecao TEXT NOT NULL, item_id TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (colecao, item_id)
        );
        CREATE TABLE IF NOT EXISTS papeis (
          id TEXT PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT, permissoes TEXT NOT NULL DEFAULT '[]',
          sistema INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS visitas (
          id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL DEFAULT (datetime('now')), visitante TEXT NOT NULL,
          caminho TEXT NOT NULL, origem TEXT, dispositivo TEXT, navegador TEXT
        );
        CREATE INDEX IF NOT EXISTS visitas_data ON visitas (data);
        CREATE TABLE IF NOT EXISTS publicidade_metricas (
          banner_id TEXT NOT NULL, dia TEXT NOT NULL, impressoes INTEGER NOT NULL DEFAULT 0,
          cliques INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (banner_id, dia)
        );
      `)
      if (!colunas(bd, 'itens').includes('estado')) bd.exec("ALTER TABLE itens ADD COLUMN estado TEXT NOT NULL DEFAULT 'publicado'")
      if (!colunas(bd, 'itens').includes('criado_por')) bd.exec('ALTER TABLE itens ADD COLUMN criado_por INTEGER')

      // a 1.ª versão restringia o papel a 'administrador'/'editor' (CHECK): recria sem essa restrição
      const sql = bd.prepare("SELECT sql FROM sqlite_master WHERE name = 'utilizadores'").get()?.sql || ''
      if (sql.includes('CHECK')) {
        bd.exec(`
          CREATE TABLE utilizadores_novo (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            senha TEXT NOT NULL, papel TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL DEFAULT (datetime('now')), ultimo_acesso TEXT
          );
          INSERT INTO utilizadores_novo SELECT id, nome, email, senha,
            CASE papel WHEN 'editor' THEN 'editor_chefe' ELSE papel END, ativo, criado_em, ultimo_acesso FROM utilizadores;
          DROP TABLE utilizadores;
          ALTER TABLE utilizadores_novo RENAME TO utilizadores;
        `)
      }
    },
  },
  {
    versao: 2,
    nome: 'segurança das contas e sessões',
    aplicar(bd) {
      const c = colunas(bd, 'utilizadores')
      if (!c.includes('tentativas_falhadas')) bd.exec('ALTER TABLE utilizadores ADD COLUMN tentativas_falhadas INTEGER NOT NULL DEFAULT 0')
      if (!c.includes('bloqueado_ate')) bd.exec('ALTER TABLE utilizadores ADD COLUMN bloqueado_ate TEXT')
      if (!c.includes('versao_token')) bd.exec('ALTER TABLE utilizadores ADD COLUMN versao_token INTEGER NOT NULL DEFAULT 0')
      if (!c.includes('deve_mudar_senha')) bd.exec('ALTER TABLE utilizadores ADD COLUMN deve_mudar_senha INTEGER NOT NULL DEFAULT 0')
      bd.exec(`
        CREATE TABLE IF NOT EXISTS sessoes_revogadas (jti TEXT PRIMARY KEY, expira TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS itens_estado ON itens (colecao, estado);
        CREATE INDEX IF NOT EXISTS atividades_utilizador ON atividades (utilizador_id);
      `)
    },
  },
]

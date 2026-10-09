import db from './db.js'

const inserir = db.prepare(`
  INSERT INTO atividades (utilizador_id, utilizador_nome, acao, colecao, alvo_id, alvo_titulo, detalhes, ip, agente)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

/*
  Regista uma ação no histórico de segurança.
  acao: 'entrar', 'falha_entrada', 'sair', 'criar', 'editar', 'apagar', 'carregar_ficheiro',
        'apagar_comentario', 'criar_utilizador', 'editar_utilizador', 'alterar_senha', …
*/
export function registar(req, { acao, colecao = null, alvoId = null, alvoTitulo = null, detalhes = null, utilizador }) {
  const u = utilizador || req.utilizador
  inserir.run(
    u?.id ?? null,
    u?.nome ?? null,
    acao,
    colecao,
    alvoId == null ? null : String(alvoId),
    alvoTitulo,
    detalhes == null ? null : (typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes)),
    req.ip,
    (req.get('user-agent') || '').slice(0, 300),
  )
}

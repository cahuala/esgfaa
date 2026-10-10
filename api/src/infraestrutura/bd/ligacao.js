import { DatabaseSync } from 'node:sqlite'
import { MIGRACOES } from './migracoes.js'

/*
  Abre a base de dados SQLite (ficheiro ou ':memory:' nos testes) e aplica as migrações em falta.
  Devolve { bd, transacao, fechar }.
*/
export function abrirBaseDados(caminho) {
  const bd = new DatabaseSync(caminho)
  bd.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  if (caminho !== ':memory:') bd.exec('PRAGMA journal_mode = WAL;')

  let profundidade = 0
  // transação com suporte a chamadas aninhadas (pontos de gravação)
  function transacao(fn) {
    const nome = `p${profundidade}`
    bd.exec(profundidade === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${nome}`)
    profundidade += 1
    try {
      const r = fn()
      profundidade -= 1
      bd.exec(profundidade === 0 ? 'COMMIT' : `RELEASE ${nome}`)
      return r
    } catch (erro) {
      profundidade -= 1
      bd.exec(profundidade === 0 ? 'ROLLBACK' : `ROLLBACK TO ${nome}; RELEASE ${nome}`)
      throw erro
    }
  }

  bd.exec('CREATE TABLE IF NOT EXISTS migracoes (versao INTEGER PRIMARY KEY, nome TEXT, aplicada_em TEXT NOT NULL DEFAULT (datetime(\'now\')))')
  const feitas = new Set(bd.prepare('SELECT versao FROM migracoes').all().map((m) => m.versao))
  for (const m of MIGRACOES) {
    if (feitas.has(m.versao)) continue
    transacao(() => {
      m.aplicar(bd)
      bd.prepare('INSERT INTO migracoes (versao, nome) VALUES (?, ?)').run(m.versao, m.nome)
    })
  }

  return { bd, transacao, fechar: () => bd.close() }
}

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MODELOS, permissoesDe, rotaDaArea } from '../../src/dominio/seguranca/areas.js'
import { PAPEIS } from '../../src/aplicacao/sessao.js'
import { ServicoDoisFatores } from '../../src/aplicacao/doisFatores.js'

describe('o que cada conta pode fazer (áreas)', () => {
  it('todas as rotas da API têm um ecrã (ou são livres): nenhuma fica de fora sem querer', () => {
    const fonte = fs.readFileSync(new URL('../../src/http/rotas.js', import.meta.url), 'utf8')
    const rotas = [...fonte.matchAll(/r\.(get|post|put|delete|patch)\('([^']+)'/g)].map((m) => [m[1].toUpperCase(), m[2]])
    assert.ok(rotas.length > 150)
    // as de antes de entrar (desafio, entrar) não passam pela verificação
    const semRegra = rotas.filter(([m, c]) => !['/desafio', '/entrar'].includes(c) && rotaDaArea(m, c.replace(/:[a-z]+/g, '1')) === undefined)
    assert.deepEqual(semRegra, [])
  })

  it('os modelos dão a cada papel as mesmas permissões de sempre', () => {
    for (const p of Object.keys(PAPEIS)) assert.deepEqual(permissoesDe({ papel: p }).sort(), [...PAPEIS[p].permissoes].sort(), p)
    assert.ok(MODELOS.administrador.utilizadores === 'alterar')
  })

  it('as áreas próprias da conta mandam sobre as do papel', () => {
    const u = { papel: 'consulta', permissoes: { licencas: 'alterar' } }
    assert.deepEqual(permissoesDe(u).sort(), ['editar', 'expediente', 'mensagens', 'ver'])
  })

  it('a verificação em dois passos é obrigatória também para a conta de utente a quem se dão fichas', () => {
    const df = new ServicoDoisFatores({ bd: null, auditoria: null, papeis: ['administrador', 'chefe', 'comandante', 'operador', 'consulta'] })
    assert.equal(df.obrigatorio({ papel: 'utente' }), false)
    assert.equal(df.obrigatorio({ papel: 'utente', permissoes: { fichas: 'ver' } }), true)
    assert.equal(df.obrigatorio({ papel: 'consulta', permissoes: {} }), true)
    // sem obrigação configurada (desenvolvimento), ninguém é obrigado
    assert.equal(new ServicoDoisFatores({ bd: null, auditoria: null, papeis: [] }).obrigatorio({ papel: 'utente', permissoes: { fichas: 'ver' } }), false)
  })
})

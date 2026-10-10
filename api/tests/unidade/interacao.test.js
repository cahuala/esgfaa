import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { novoComentario, visitanteValido } from '../../src/dominio/interacao/comentario.js'
import { bannerEmVigor } from '../../src/dominio/publicidade/banner.js'
import { classificarAgente, origemExterna } from '../../src/dominio/estatisticas/visita.js'

describe('comentários', () => {
  it('limpa e aceita um comentário normal', () => {
    assert.deepEqual(novoComentario({ nome: '  Maria   João ', texto: ' Parabéns! ' }), { nome: 'Maria João', texto: 'Parabéns!' })
  })

  it('valida tamanhos e ligações', () => {
    assert.throws(() => novoComentario({ nome: 'M', texto: 'ok ok' }), /nome/)
    assert.throws(() => novoComentario({ nome: 'Maria', texto: 'x' }), /comentário/)
    assert.throws(() => novoComentario({ nome: 'Maria', texto: 'x'.repeat(2001) }), /comentário/)
    assert.throws(() => novoComentario({ nome: 'Maria', texto: 'http://a https://b HTTP://c' }), /ligações/)
  })

  it('identificador de visitante', () => {
    assert.ok(visitanteValido('a1b2c3d4-e5f6'))
    for (const v of ['curto', 'x'.repeat(65), 'tem espaço aqui', '<script>xx', null]) assert.ok(!visitanteValido(v), String(v))
  })
})

describe('banners', () => {
  const hoje = '2026-10-10'
  it('em vigor quando ativo e dentro das datas', () => {
    assert.ok(bannerEmVigor({}, hoje))
    assert.ok(bannerEmVigor({ inicio: '2026-10-10', fim: '2026-10-10' }, hoje))
    assert.ok(!bannerEmVigor({ ativo: false }, hoje))
    assert.ok(!bannerEmVigor({ inicio: '2026-10-11' }, hoje))
    assert.ok(!bannerEmVigor({ fim: '2026-10-09' }, hoje))
  })
})

describe('visitas', () => {
  it('classifica dispositivo e navegador', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    assert.deepEqual(classificarAgente(iphone), { dispositivo: 'Telemóvel', navegador: 'Safari', robo: false })
    const edge = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120'
    assert.equal(classificarAgente(edge).navegador, 'Edge')
  })

  it('identifica robôs e pedidos sem agente', () => {
    for (const a of ['Googlebot/2.1', 'curl/8.0', 'HeadlessChrome/120', '']) assert.ok(classificarAgente(a).robo, a)
  })

  it('origem externa ignora navegação interna e endereços inválidos', () => {
    assert.equal(origemExterna('https://www.google.com/search?q=esg', 'https://cahuala.github.io'), 'google.com')
    assert.equal(origemExterna('https://cahuala.github.io/esgfaa/', 'https://cahuala.github.io'), null)
    assert.equal(origemExterna('javascript:alert(1)', null), null)
    assert.equal(origemExterna('nada', null), null)
  })
})

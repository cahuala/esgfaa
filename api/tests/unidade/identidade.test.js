import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { motivoSenhaFraca, validarSenha } from '../../src/dominio/identidade/politicaSenha.js'
import { Utilizador, MAX_TENTATIVAS } from '../../src/dominio/identidade/utilizador.js'
import { Papel } from '../../src/dominio/identidade/papel.js'
import { Actor } from '../../src/dominio/identidade/actor.js'
import { TODAS, limparPermissoes } from '../../src/dominio/identidade/permissoes.js'
import { normalizarEmail } from '../../src/dominio/identidade/email.js'
import { ErroValidacao, SemPermissao, ContaBloqueada } from '../../src/dominio/comum/erros.js'

describe('política de palavras-passe', () => {
  it('aceita uma palavra-passe forte', () => {
    assert.equal(motivoSenhaFraca('Fortaleza2026x'), null)
  })

  it('rejeita curtas, sem números ou sem letras', () => {
    for (const s of ['Abc12345', 'SoLetrasAquiMesmo', '12345678901', '', null]) assert.ok(motivoSenhaFraca(s), String(s))
  })

  it('rejeita palavras-passe comuns e repetidas', () => {
    assert.match(motivoSenhaFraca('Password123'), /comum/)
    assert.ok(motivoSenhaFraca('1111111111'))
  })

  it('rejeita o e-mail ou o nome dentro da palavra-passe', () => {
    assert.match(motivoSenhaFraca('joaquim2026xx', { email: 'joaquim@esg.ao' }), /e-mail/)
    assert.match(motivoSenhaFraca('Fernandes2026', { nome: 'Ana Fernandes' }), /nome/)
  })

  it('validarSenha lança ErroValidacao', () => {
    assert.throws(() => validarSenha('curta1'), ErroValidacao)
  })
})

describe('utilizador', () => {
  const novo = () => Utilizador.novo({ nome: '  Ana  Silva ', email: ' Ana@ESG.ao ', papel: 'redator', senhaCifrada: 'x' })

  it('normaliza nome e e-mail', () => {
    const u = novo()
    assert.equal(u.nome, 'Ana  Silva')
    assert.equal(u.email, 'ana@esg.ao')
  })

  it('rejeita nomes demasiado curtos', () => {
    assert.throws(() => Utilizador.novo({ nome: 'A', email: 'a@b.ao', papel: 'x', senhaCifrada: 'x' }), ErroValidacao)
  })

  it(`bloqueia ao fim de ${MAX_TENTATIVAS} falhas e desbloqueia passados 15 minutos`, () => {
    const u = novo()
    const t0 = new Date('2026-01-01T10:00:00Z')
    for (let i = 1; i < MAX_TENTATIVAS; i++) assert.equal(u.registarFalha(t0), false)
    assert.equal(u.registarFalha(t0), true)
    assert.ok(u.bloqueado(t0))
    assert.throws(() => u.garantirPodeEntrar(t0), ContaBloqueada)
    const depois = new Date(t0.getTime() + 15 * 60_000 + 1)
    assert.equal(u.bloqueado(depois), false)
    assert.doesNotThrow(() => u.garantirPodeEntrar(depois))
  })

  it('entrar com sucesso limpa as falhas', () => {
    const u = novo()
    u.registarFalha(new Date())
    u.registarEntrada(new Date())
    assert.equal(u.tentativasFalhadas, 0)
    assert.equal(u.bloqueadoAte, null)
  })

  it('mudar a palavra-passe invalida as sessões e retira a obrigação de mudar', () => {
    const u = novo()
    u.deveMudarSenha = true
    u.mudarSenha('novo-hash')
    assert.equal(u.versaoToken, 1)
    assert.equal(u.deveMudarSenha, false)
  })

  it('publico() nunca expõe o hash nem dados de segurança', () => {
    const p = novo().publico()
    for (const k of ['senha', 'versaoToken', 'tentativasFalhadas', 'bloqueadoAte']) assert.ok(!(k in p), k)
  })
})

describe('papéis e permissões', () => {
  it('o administrador tem sempre todas as permissões', () => {
    assert.deepEqual(new Papel({ id: 'administrador', nome: 'Admin', permissoes: [] }).permissoes, TODAS)
  })

  it('limparPermissoes descarta lixo e acrescenta "ver"', () => {
    assert.deepEqual(limparPermissoes(['noticias.publicar', 'hackear.tudo', 42]), ['noticias.ver', 'noticias.publicar'])
    assert.deepEqual(limparPermissoes('nada'), [])
  })

  it('papéis de sistema não se alteram', () => {
    const p = new Papel({ id: 'administrador', nome: 'Admin', sistema: true })
    assert.throws(() => p.alterar({ nome: 'Outro' }), SemPermissao)
  })

  it('valida o nome ao alterar', () => {
    const p = new Papel({ id: 'x', nome: 'X' })
    assert.throws(() => p.alterar({ nome: 'a' }), ErroValidacao)
    p.alterar({ nome: 'Revisor', permissoes: ['artigos.editar'] })
    assert.deepEqual(p.permissoes, ['artigos.ver', 'artigos.editar'])
  })

  it('actor.exigir aceita qualquer uma das permissões', () => {
    const a = new Actor({ id: 1, permissoes: ['noticias.ver'] })
    assert.doesNotThrow(() => a.exigir('eventos.ver', 'noticias.ver'))
    assert.throws(() => a.exigir('noticias.apagar'), SemPermissao)
  })

  it('normalizarEmail rejeita endereços inválidos', () => {
    for (const e of ['', 'sem-arroba', 'a@b', 'a b@c.ao', `${'a'.repeat(250)}@b.ao`]) assert.throws(() => normalizarEmail(e), ErroValidacao, e)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validarDados } from '../../src/dominio/conteudos/colecoes.js'
import { estadoFinal, garantirPodeEditar } from '../../src/dominio/conteudos/politicaPublicacao.js'
import { validarPagina } from '../../src/dominio/conteudos/paginas.js'
import { Conteudo } from '../../src/dominio/conteudos/conteudo.js'
import { Actor } from '../../src/dominio/identidade/actor.js'
import { urlSegura, validarUrls, relativizar } from '../../src/dominio/comum/urls.js'
import { slugificar, limparTexto } from '../../src/dominio/comum/texto.js'
import { ErroValidacao, SemPermissao } from '../../src/dominio/comum/erros.js'

const actor = (...permissoes) => new Actor({ id: 1, permissoes })

describe('validação dos dados das coleções', () => {
  it('retira campos internos e mantém campos livres', () => {
    const d = validarDados('noticias', { titulo: 'Olá', _estado: 'publicado', _x: 1, extra: 'ok' })
    assert.deepEqual(d, { titulo: 'Olá', extra: 'ok' })
  })

  it('exige título (ou nome, em cursos e pessoas)', () => {
    assert.throws(() => validarDados('noticias', { titulo: '  ' }), /título/)
    assert.throws(() => validarDados('cursos', { titulo: 'x' }), /título/)
    assert.doesNotThrow(() => validarDados('cursos', { nome: 'Curso' }))
  })

  it('valida tipos e formatos', () => {
    assert.throws(() => validarDados('noticias', { titulo: 'x', data: '10/10/2026' }), /Data inválida/)
    assert.throws(() => validarDados('eventos', { titulo: 'x', horaInicio: '9h' }), /Hora inválida/)
    assert.throws(() => validarDados('publicidade', { titulo: 'x', posicao: 'popup' }), ErroValidacao)
    assert.throws(() => validarDados('noticias', { titulo: 'x'.repeat(301) }), /longo/)
  })

  it('rejeita coleções desconhecidas e dados que não são objetos', () => {
    assert.throws(() => validarDados('segredos', { titulo: 'x' }), ErroValidacao)
    assert.throws(() => validarDados('noticias', ['x']), ErroValidacao)
  })

  it('rejeita endereços perigosos em qualquer profundidade', () => {
    assert.throws(() => validarDados('noticias', { titulo: 'x', capa: 'javascript:alert(1)' }), /capa/)
    assert.throws(() => validarDados('noticias', { titulo: 'x', conteudo: [{ tipo: 'imagem', src: 'data:text/html,<script>' }] }), /src/)
  })

  it('limita o tamanho total', () => {
    assert.throws(() => validarDados('pessoas', { nome: 'x', bio: 'a'.repeat(1_000_001) }), /grande/)
  })
})

describe('endereços seguros', () => {
  it('aceita caminhos locais, http(s) e mailto', () => {
    for (const u of ['', '/uploads/a.jpg', 'https://esg.ao', 'http://x.ao/a', 'mailto:a@b.ao']) assert.ok(urlSegura(u), u)
  })

  it('recusa javascript:, data:, protocolo relativo e lixo', () => {
    for (const u of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:image/png;base64,x', '//mal.com/x', 'vbscript:x', 42]) assert.ok(!urlSegura(u), String(u))
  })

  it('validarUrls ignora campos que não são endereços', () => {
    assert.doesNotThrow(() => validarUrls({ texto: 'javascript: é uma palavra' }))
  })

  it('relativizar guarda /uploads/… sem domínio', () => {
    assert.deepEqual(relativizar({ a: ['https://api.ao/uploads/x.jpg'], b: '/uploads/y.png', c: 'https://outro.ao/z' }),
      { a: ['/uploads/x.jpg'], b: '/uploads/y.png', c: 'https://outro.ao/z' })
  })
})

describe('texto', () => {
  it('slugificar retira acentos e símbolos', () => {
    assert.equal(slugificar('Formatura 2026: Estado-Maior à Noite!'), 'formatura-2026-estado-maior-a-noite')
    assert.equal(slugificar('***'), 'item')
  })

  it('limparTexto retira caracteres de controlo', () => {
    assert.equal(limparTexto(' a\u0000b\u0007c\n '), 'abc')
  })
})

describe('regras de publicação', () => {
  it('sem permissão de publicar fica sempre em rascunho', () => {
    assert.equal(estadoFinal({ actor: actor('noticias.criar'), colecao: 'noticias', pedido: 'publicado' }), 'rascunho')
  })

  it('quem publica escolhe o estado; um conteúdo novo é publicado por omissão', () => {
    const chefe = actor('noticias.publicar')
    assert.equal(estadoFinal({ actor: chefe, colecao: 'noticias' }), 'publicado')
    assert.equal(estadoFinal({ actor: chefe, colecao: 'noticias', pedido: 'rascunho' }), 'rascunho')
    assert.equal(estadoFinal({ actor: chefe, colecao: 'noticias', atual: 'rascunho' }), 'rascunho')
  })

  it('quem não publica não altera conteúdos já publicados', () => {
    assert.throws(() => garantirPodeEditar({ actor: actor('noticias.editar'), colecao: 'noticias', atual: 'publicado' }), /já está publicado/)
    assert.doesNotThrow(() => garantirPodeEditar({ actor: actor('noticias.editar'), colecao: 'noticias', atual: 'rascunho' }))
  })

  it('quem só publica pode mudar o estado mas não editar', () => {
    const so = actor('noticias.publicar')
    assert.doesNotThrow(() => garantirPodeEditar({ actor: so, colecao: 'noticias', atual: 'rascunho', pedido: 'publicado' }))
    assert.throws(() => garantirPodeEditar({ actor: so, colecao: 'noticias', atual: 'rascunho', pedido: 'rascunho' }), SemPermissao)
  })

  it('camposAlterados lista só o que mudou', () => {
    const c = new Conteudo({ colecao: 'noticias', id: 'a', dados: { titulo: 'A', resumo: 'x' } })
    assert.deepEqual(c.camposAlterados({ titulo: 'B', resumo: 'x', data: '2026-01-01' }), ['titulo', 'data'])
    assert.equal(c.titulo, 'A')
  })
})

describe('páginas', () => {
  it('só aceita páginas conhecidas e endereços seguros', () => {
    assert.throws(() => validarPagina('admin', {}), ErroValidacao)
    assert.throws(() => validarPagina('home', { heroi: { imagem: 'javascript:x' } }), /imagem/)
    assert.deepEqual(validarPagina('home', { titulo: 'x' }), { titulo: 'x' })
  })
})

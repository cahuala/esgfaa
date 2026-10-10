import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { filtrarHtml, filtrarCamposHtml } from '../../src/infraestrutura/html/filtroHtml.js'
import { assinaturaValida } from '../../src/infraestrutura/ficheiros/armazenamento.js'
import { CacheLimitada } from '../../src/infraestrutura/seguranca/cacheLimitada.js'
import { CifraSenhas } from '../../src/infraestrutura/seguranca/cifra.js'
import { Tokens } from '../../src/infraestrutura/seguranca/tokens.js'
import { abrirBaseDados } from '../../src/infraestrutura/bd/ligacao.js'
import { MIGRACOES } from '../../src/infraestrutura/bd/migracoes.js'
import { criarConfig } from '../../src/infraestrutura/config.js'
import { gerarSenha } from '../../src/aplicacao/arranque.js'
import { motivoSenhaFraca } from '../../src/dominio/identidade/politicaSenha.js'

describe('filtro de HTML', () => {
  it('retira scripts, eventos e javascript:', () => {
    const r = filtrarHtml('<p onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src=x onerror=alert(1)></p>')
    assert.ok(!/script|onclick|onerror|javascript/i.test(r), r)
    assert.match(r, /<p>a<a>b<\/a><img src="x" \/><\/p>/)
  })

  it('mantém o que o editor produz', () => {
    const html = [
      '<h2 style="text-align:center">Título</h2>',
      '<p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s> <sub>1</sub><sup>2</sup> <mark data-color="#fde68a" style="background-color:#fde68a;color:inherit">m</mark> <span style="color:#1e3a5f;font-size:18px">s</span></p>',
      '<figure data-tipo="imagem" data-posicao="esquerda" data-largura="45" style="width:45%"><img src="/uploads/2026-10/a.jpg" alt="x" /><figcaption>Legenda</figcaption></figure>',
      '<div data-tipo="galeria" data-colunas="2"><figure><img src="/uploads/a.jpg" alt="" /></figure></div>',
      '<aside data-tipo="destaque"><p>Nota</p></aside>',
      '<table style="min-width:50px"><colgroup><col style="min-width:25px" /></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>c</p></th></tr></tbody></table>',
    ].join('')
    const r = filtrarHtml(html)
    for (const parte of ['text-align:center', 'data-posicao="esquerda"', 'width:45%', 'data-tipo="galeria"', 'data-tipo="destaque"', 'background-color:#fde68a', 'font-size:18px', '<figcaption>Legenda</figcaption>', 'colspan="1"']) {
      assert.ok(r.includes(parte), `falta ${parte} em ${r}`)
    }
  })

  it('só aceita iframes do YouTube', () => {
    const yt = filtrarHtml('<figure data-tipo="video"><div class="video"><iframe src="https://www.youtube-nocookie.com/embed/abc" allowfullscreen="true"></iframe></div></figure>')
    assert.match(yt, /<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/abc"/)
    assert.match(yt, /class="video"/)
    assert.doesNotMatch(filtrarHtml('<iframe src="https://mal.com/x"></iframe>'), /mal\.com/)
  })

  it('retira estilos e classes arbitrários', () => {
    const r = filtrarHtml('<p style="position:fixed;top:0;text-align:right" class="x">a</p><span style="background:url(javascript:x)">b</span><div class="hack video">c</div>')
    assert.doesNotMatch(r, /position|url\(|class="x"|hack/)
    assert.match(r, /text-align:right/)
  })

  it('ligações para outra janela levam rel seguro', () => {
    assert.match(filtrarHtml('<a href="https://x.ao" target="_blank">x</a>'), /rel="noopener noreferrer nofollow"/)
  })

  it('filtrarCamposHtml só toca em campos "html"', () => {
    const r = filtrarCamposHtml({ titulo: '<b>t</b>', conteudo: [{ tipo: 'texto', html: '<p>ok</p><script>x</script>' }] })
    assert.deepEqual(r, { titulo: '<b>t</b>', conteudo: [{ tipo: 'texto', html: '<p>ok</p>' }] })
  })
})

describe('assinaturas de ficheiros', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
  const jpg = Buffer.from('ffd8ffe000104a4649460001', 'hex')
  const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1')
  const mp4 = Buffer.from('000000206674797069736f6d00000200', 'hex')
  const webp = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1')

  it('confirma o tipo real', () => {
    assert.ok(assinaturaValida(png, 'image/png'))
    assert.ok(assinaturaValida(jpg, 'image/jpeg'))
    assert.ok(assinaturaValida(pdf, 'application/pdf'))
    assert.ok(assinaturaValida(mp4, 'video/mp4'))
    assert.ok(assinaturaValida(webp, 'image/webp'))
  })

  it('rejeita disfarces e tipos não permitidos', () => {
    assert.ok(!assinaturaValida(Buffer.from('<html><script>alert(1)</script>'), 'image/png'))
    assert.ok(!assinaturaValida(png, 'image/jpeg'))
    assert.ok(!assinaturaValida(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'), 'image/svg+xml'))
    assert.ok(!assinaturaValida(Buffer.alloc(3), 'image/png'))
  })
})

describe('cache limitada', () => {
  it('não cresce além do máximo e expira', () => {
    let t = 0
    const c = new CacheLimitada({ maximo: 3, validadeMs: 100, relogio: () => t })
    assert.ok(c.marcarSeNova('a'))
    assert.ok(!c.marcarSeNova('a'))
    for (const k of ['b', 'c', 'd', 'e']) c.marcarSeNova(k)
    assert.equal(c.tamanho, 3)
    t = 101
    assert.ok(c.marcarSeNova('e'))
  })
})

describe('cifra de palavras-passe', () => {
  const cifra = new CifraSenhas()
  it('cifra com sal aleatório e verifica', async () => {
    const a = await cifra.cifrar('Segredo2026x')
    const b = await cifra.cifrar('Segredo2026x')
    assert.notEqual(a, b)
    assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/)
    assert.ok(await cifra.verificar('Segredo2026x', a))
    assert.ok(!(await cifra.verificar('segredo2026x', a)))
    assert.ok(!(await cifra.verificar('x', 'md5$abc')))
    assert.equal(await cifra.verificarFicticio('x'), false)
  })
})

describe('tokens de sessão', () => {
  const tokens = new Tokens({ segredo: 's'.repeat(40), duracao: '1h' })
  const u = { id: 7, versaoToken: 3 }

  it('emite e verifica', () => {
    const s = tokens.verificar(tokens.emitir(u))
    assert.equal(s.utilizadorId, 7)
    assert.equal(s.versao, 3)
    assert.match(s.jti, /^[0-9a-f-]{36}$/)
  })

  it('rejeita assinatura errada, algoritmo "none", outra audiência e expirados', () => {
    assert.equal(new Tokens({ segredo: 'o'.repeat(40), duracao: '1h' }).verificar(tokens.emitir(u)), null)
    const none = jwt.sign({ ver: 3 }, null, { algorithm: 'none', subject: '7', jwtid: 'x', issuer: 'esgfaa-api', audience: 'esgfaa-painel' })
    assert.equal(tokens.verificar(none), null)
    const outra = jwt.sign({ ver: 3 }, 's'.repeat(40), { subject: '7', jwtid: 'x', issuer: 'esgfaa-api', audience: 'outro' })
    assert.equal(tokens.verificar(outra), null)
    const expirado = jwt.sign({ ver: 3, exp: Math.floor(Date.now() / 1000) - 10 }, 's'.repeat(40), { subject: '7', jwtid: 'x', issuer: 'esgfaa-api', audience: 'esgfaa-painel' })
    assert.equal(tokens.verificar(expirado), null)
    assert.equal(tokens.verificar('lixo'), null)
  })
})

describe('base de dados', () => {
  it('aplica todas as migrações uma única vez', () => {
    const { bd, fechar } = abrirBaseDados(':memory:')
    const aplicadas = bd.prepare('SELECT versao FROM migracoes ORDER BY versao').all().map((l) => l.versao)
    assert.deepEqual(aplicadas, MIGRACOES.map((m) => m.versao))
    fechar()
  })

  it('transações aninhadas desfazem só a parte que falhou', () => {
    const { bd, transacao, fechar } = abrirBaseDados(':memory:')
    transacao(() => {
      bd.prepare("INSERT INTO paginas (chave, dados) VALUES ('a', '{}')").run()
      assert.throws(() => transacao(() => {
        bd.prepare("INSERT INTO paginas (chave, dados) VALUES ('b', '{}')").run()
        throw new Error('falha')
      }))
    })
    assert.deepEqual(bd.prepare('SELECT chave FROM paginas').all().map((l) => l.chave), ['a'])
    fechar()
  })
})

describe('configuração', () => {
  it('exige JWT_SECRET forte em produção', () => {
    assert.throws(() => criarConfig({ NODE_ENV: 'production' }), /JWT_SECRET/)
    assert.throws(() => criarConfig({ NODE_ENV: 'production', JWT_SECRET: 'curto' }), /curto/)
    assert.doesNotThrow(() => criarConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }))
  })

  it('valida valores e lê listas', () => {
    assert.throws(() => criarConfig({ PORT: 'abc' }), /PORT/)
    assert.throws(() => criarConfig({ SESSION_TTL: 'para sempre' }), /SESSION_TTL/)
    const c = criarConfig({ CORS_ORIGINS: 'https://a.ao/, https://b.ao', TRUST_PROXY: '1' })
    assert.deepEqual(c.origens, ['https://a.ao', 'https://b.ao'])
    assert.equal(c.confiarProxy, 1)
  })

  it('gera palavras-passe iniciais que cumprem a política', () => {
    for (let i = 0; i < 50; i++) assert.equal(motivoSenhaFraca(gerarSenha()), null)
  })
})

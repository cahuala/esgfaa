import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classificarPedido, deveBloquear, ipValido, nivelDeAlerta } from '../../src/dominio/seguranca/eventos.js'

describe('Centro de segurança: classificar pedidos e medir o alerta', () => {
  it('reconhece ataques pelo endereço e pela resposta', () => {
    const c = (url, estado = 404, metodo = 'GET') => classificarPedido({ metodo, url, estado })
    assert.equal(c('/.env'), 'sondagem')
    assert.equal(c('/wp-admin/install.php'), 'sondagem')
    assert.equal(c('/phpmyadmin/'), 'sondagem')
    assert.equal(c('/api/publico/conteudo?id=1%27%20UNION%20SELECT%20senha%20FROM%20utilizadores', 200), 'injecao')
    assert.equal(c('/api/portal/ficheiros/..%252F..%252Fetc%252Fpasswd'), 'injecao') // codificado duas vezes
    assert.equal(c('/pesquisa?q=%3Cscript%3Ealert(1)%3C/script%3E', 200), 'injecao')
    assert.equal(c('/x?a=${jndi:ldap://mau}', 400), 'injecao')
    assert.equal(c('/api/admin/entrar', 401, 'POST'), 'login_falhado')
    assert.equal(c('/api/portal/entrar', 423, 'POST'), 'conta_bloqueada')
    assert.equal(c('/api/publico/conteudo', 429), 'limite')
    assert.equal(c('/api/admin/utilizadores', 403), 'acesso_negado')
    assert.equal(c('/api/admin/eu', 401), 'sessao_invalida')
    assert.equal(c('/api/publico/x', 500), 'erro_interno')
    // pedidos normais não são eventos
    assert.equal(c('/api/publico/conteudo', 200), null)
    assert.equal(c('/Noticias/uma-noticia-que-nao-existe', 404), null)
    assert.equal(c('/api/portal/pesquisa?q=estrat%C3%A9gia%20naval', 200), null)
  })

  it('nível de alerta e bloqueio automático', () => {
    assert.equal(nivelDeAlerta({}).nivel, 'normal')
    assert.equal(nivelDeAlerta({ login_falhado: 20 }).nivel, 'atencao')
    const a = nivelDeAlerta({ login_falhado: 60, injecao: 1 })
    assert.equal(a.nivel, 'ataque')
    assert.deepEqual(a.motivos.map((m) => m.tipo), ['login_falhado', 'injecao'])
    assert.equal(deveBloquear({ sondagem: 19 }), false)
    assert.equal(deveBloquear({ sondagem: 20 }), true)
    assert.equal(deveBloquear({ injecao: 5 }), true)
    assert.ok(ipValido('203.0.113.9') && ipValido('2001:db8::1') && !ipValido('999.1.1.1') && !ipValido('abc'))
  })
})

describe('Defesa activa: que serviço é cada pedido e o que fica fechado', async () => {
  const { confiavel, decidirPedido, servicoDoPedido } = await import('../../src/dominio/seguranca/protecao.js')
  const p = (nivel, extra = {}) => ({ nivel, desligados: [], confianca: [], ...extra })

  it('reconhece o serviço pelo endereço e pelo método', () => {
    assert.equal(servicoDoPedido('POST', '/api/portal/entrar'), 'portal')
    assert.equal(servicoDoPedido('GET', '/api/publico/conteudo'), 'sitePublico')
    assert.equal(servicoDoPedido('POST', '/api/publico/contactos'), 'escritaPublica')
    assert.equal(servicoDoPedido('GET', '/uploads/foto.png'), 'ficheiros')
    assert.equal(servicoDoPedido('POST', '/api/integracao/pessoal/contas'), 'integracao')
    assert.equal(servicoDoPedido('GET', '/api/saude'), null)
  })

  it('no normal tudo passa; na emergência fecha o portal mas o site continua a ler', () => {
    assert.equal(decidirPedido(p('normal'), { metodo: 'POST', caminho: '/api/portal/entrar', ip: '8.8.8.8' }), null)
    assert.equal(decidirPedido(p('emergencia'), { metodo: 'POST', caminho: '/api/portal/entrar', ip: '8.8.8.8' }).estado, 503)
    assert.equal(decidirPedido(p('emergencia'), { metodo: 'GET', caminho: '/api/publico/conteudo', ip: '8.8.8.8' }), null)
  })

  it('a entrada no painel e o Centro de segurança nunca fecham; a lista de confiança passa sempre', () => {
    for (const caminho of ['/api/admin/entrar', '/api/admin/eu', '/api/admin/seguranca', '/api/admin/seguranca/protecao', '/api/saude']) {
      assert.equal(decidirPedido(p('isolamento'), { metodo: 'GET', caminho, ip: '8.8.8.8' }), null, caminho)
    }
    assert.equal(decidirPedido(p('isolamento'), { metodo: 'GET', caminho: '/api/admin/utilizadores', ip: '8.8.8.8' }).codigo, 'servico_fechado')
    assert.equal(decidirPedido(p('isolamento', { confianca: ['10.20.0.0/16'] }), { metodo: 'GET', caminho: '/api/admin/utilizadores', ip: '10.20.5.9' }), null)
    assert.equal(confiavel('::ffff:192.168.1.7', ['192.168.1.0/24']), true)
    assert.equal(confiavel('192.168.2.7', ['192.168.1.0/24']), false)
    assert.equal(confiavel('192.168.1.7', ['192.168.1.0/20']), false) // só /8, /16 e /24
  })

  it('um serviço desligado à mão fecha só esse', () => {
    const x = p('normal', { desligados: ['ficheiros'] })
    assert.equal(decidirPedido(x, { metodo: 'GET', caminho: '/uploads/a.pdf', ip: '8.8.8.8' }).servico, 'ficheiros')
    assert.equal(decidirPedido(x, { metodo: 'POST', caminho: '/api/portal/entrar', ip: '8.8.8.8' }), null)
  })
})

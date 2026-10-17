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

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'

// o painel de gestão só abre na rede interna da Escola (PAINEL_REDES); o site e o portal continuam abertos
describe('Painel de gestão só na rede interna', () => {
  it('fora das redes configuradas: 403 no painel; o portal e o site respondem', async () => {
    const amb = await criarAmbiente({ env: { PAINEL_REDES: '10.0.0.0/8, 192.168.10.0/24' } })
    try {
      const r = await amb.http().post('/api/admin/entrar').send({ email: 'x@esgfaa.gov.ao', senha: 'qualquer-coisa-1' })
      assert.equal(r.status, 403)
      assert.match(r.body.erro, /rede interna da Escola/)
      assert.notEqual((await amb.http().post('/api/portal/entrar').send({ email: 'x@esgfaa.gov.ao', senha: 'qualquer-coisa-1' })).status, 403)
    } finally { await amb.fechar() }
  })

  it('de dentro da rede (aqui, o próprio computador) entra-se', async () => {
    const amb = await criarAmbiente({ env: { PAINEL_REDES: '127.0.0.1, ::1' } })
    try {
      await amb.entrar()
    } finally { await amb.fechar() }
  })
})

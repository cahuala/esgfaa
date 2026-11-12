import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { criarAmbiente } from '../apoio/ambiente.js'

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBozCCAUmgAwIBAgIQTeste+/=\nAbCdEf123\n-----END CERTIFICATE-----\n'

describe('Pessoal: página do certificado e verificação em dois passos opcional', () => {
  let amb
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'esg-cert-'))
  const crt = path.join(pasta, 'raiz.crt')
  before(async () => {
    fs.writeFileSync(crt, PEM)
    amb = await criarAmbiente({ env: { CERTIFICADO_RAIZ: crt, ENDERECO: 'esg.emfaa.gov.ao', PORTA_WEB: '8443', SERVIDOR_IP: '10.1.2.3' } })
  })
  after(() => { fs.rmSync(pasta, { recursive: true, force: true }); return amb.fechar() })

  it('a página, o certificado e o .bat abrem sem entrar', async () => {
    const p = await amb.http().get('/certificado').expect(200)
    assert.match(p.text, /preparar-computador\.bat/)
    assert.match(p.text, /https:\/\/esg\.emfaa\.gov\.ao:8443/)
    assert.doesNotMatch(p.headers['content-security-policy'], /upgrade-insecure-requests/)
    const c = await amb.http().get('/certificado/esg-pessoal-raiz.crt').expect(200)
    assert.equal(c.text, PEM)
    const b = await amb.http().get('/certificado/preparar-computador.bat').expect(200)
    const bat = b.text ?? b.body.toString()
    assert.match(bat, />>"%CRT%" echo MIIBozCCAUmgAwIBAgIQTeste\+\/=\r\n/)
    assert.match(bat, /certutil -addstore -f Root/)
    assert.match(bat, /echo 10\.1\.2\.3 esg\.emfaa\.gov\.ao # esg-pessoal/)
    assert.match(bat, /start "" "https:\/\/esg\.emfaa\.gov\.ao:8443"/)
  })

  it('sem certificado: a página diz que não há, os ficheiros dão 404', async () => {
    fs.rmSync(crt)
    assert.match((await amb.http().get('/certificado').expect(200)).text, /não tem certificado/)
    await amb.http().get('/certificado/esg-pessoal-raiz.crt').expect(404)
  })

  it('por omissão a verificação em dois passos não é exigida', async () => {
    const adm = amb.com(await amb.entrar())
    assert.equal((await adm.get('/api/eu').expect(200)).body.deveAtivar2fa, false)
    await adm.get('/api/pessoas').expect(200)
  })
})

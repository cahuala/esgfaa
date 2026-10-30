import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, noticia } from '../apoio/ambiente.js'

const tique = () => new Promise((r) => setTimeout(r, 50))
// os avisos saem depois da resposta: espera até chegarem (no máximo 2 s)
async function esperarEnviados(correio, n) {
  for (let i = 0; i < 40 && correio.enviados.length < n; i++) await tique()
}

describe('o Comandante: avisos por e-mail e acontecimentos importantes', () => {
  let amb, admin, cmd, correio
  before(async () => {
    amb = await criarAmbiente()
    admin = amb.com(await amb.entrar())
    cmd = await amb.oComandante()
    correio = amb.contentor.correio
    correio.real = true // como com SMTP_URL: os e-mails «saem» (ficam em correio.enviados)
  })
  after(() => amb.fechar())

  it('o que fica à espera dele chega-lhe por e-mail (e não ao Administrador)', async () => {
    const n = correio.enviados.length
    const chefe = amb.com((await amb.criarUtilizador('editor_chefe')).token)
    await chefe.post('/api/admin/colecoes/noticias').send(noticia({ titulo: 'Visita do Ministro', _estado: 'publicado' })).expect(201)
    await admin.post('/api/admin/utilizadores').send({ nome: 'Rui Novo', email: 'rui.novo@teste.ao', papel: 'redator', senha: 'Segura2026xyz' }).expect(201)
    await esperarEnviados(correio, n + 2)
    const novos = correio.enviados.slice(n)
    assert.deepEqual(novos.map((m) => m.para), [cmd.email, cmd.email])
    assert.match(novos[0].assunto, /Publicação do site por aprovar: Visita do Ministro/)
    assert.match(novos[1].assunto, /Conta nova do painel por aprovar: Rui Novo/)
    assert.match(novos[1].texto, /«Por aprovar»/)
    // o e-mail não leva o endereço reservado do painel
    assert.ok(!novos.some((m) => /https?:\/\//.test(m.texto)))
  })

  it('sem SMTP não envia nada', async () => {
    correio.real = false
    const n = correio.enviados.length
    await admin.post('/api/admin/utilizadores').send({ nome: 'Sem Correio', email: 'sem.correio@teste.ao', papel: 'redator', senha: 'Segura2026xyz' }).expect(201)
    await tique()
    assert.equal(correio.enviados.length, n)
    correio.real = true
  })

  it('acontecimentos importantes da semana, por grupo; só para quem vê o registo de atividades', async () => {
    const r = await amb.com(cmd.token).get('/api/admin/acontecimentos?dias=7')
    assert.equal(r.status, 200)
    const g = Object.fromEntries(r.body.grupos.map((x) => [x.id, x]))
    assert.deepEqual(Object.keys(g), ['decisoes', 'contas', 'notas', 'publicacoes', 'seguranca'])
    assert.ok(g.contas.total >= 2)
    assert.ok(g.contas.linhas.some((l) => l.acao === 'pedir_aprovacao_conta' && l.alvo_titulo === 'Rui Novo'))
    assert.ok(g.publicacoes.linhas.some((l) => l.acao === 'pedir_aprovacao'))
    const redator = amb.com((await amb.criarUtilizador('redator')).token)
    assert.equal((await redator.get('/api/admin/acontecimentos')).status, 403)
  })
})

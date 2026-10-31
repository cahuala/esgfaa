import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente } from '../apoio/ambiente.js'
import { ordenarDia } from '../../src/aplicacao/ponto.js'

// terça-feira, 17h em Luanda
const HOJE = '2026-10-20T16:00:00Z'
const SN = 'CKJ7210360001'

describe('livro de ponto digital (aparelhos de impressão digital)', () => {
  let amb, adm, ana, rui, aparelhoId
  // o aparelho fala em texto simples, sem sessão
  const aparelho = () => ({
    apresentar: () => amb.http().get(`/iclock/cdata?SN=${SN}&options=all&pushver=2.4.1&DeviceType=MB360`),
    enviar: (tabela, linhas) => amb.http().post(`/iclock/cdata?SN=${SN}&table=${tabela}`).set('Content-Type', 'text/plain').send(linhas.join('\n')),
    ordens: () => amb.http().get(`/iclock/getrequest?SN=${SN}`),
    responder: (corpo) => amb.http().post(`/iclock/devicecmd?SN=${SN}`).set('Content-Type', 'text/plain').send(corpo),
  })

  before(async () => {
    amb = await criarAmbiente({ hoje: HOJE })
    adm = amb.com(await amb.entrar())
    ana = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Ana Maria Kiala', genero: 'F', carreiraCivil: 'auxiliar_servicos_gerais' }).expect(201)).body
    rui = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Rui Domingos Bumba', genero: 'M', carreiraCivil: 'tecnico_medio' }).expect(201)).body
  })
  after(() => amb.fechar())

  it('o aparelho novo apresenta-se e fica por aprovar: as marcações não contam', async () => {
    const r = await aparelho().apresentar().expect(200)
    assert.match(r.text, new RegExp(`GET OPTION FROM: ${SN}`))
    assert.match(r.text, /TimeZone=1/)
    const l = (await adm.get('/api/ponto/aparelhos').expect(200)).body
    assert.equal(l.length, 1)
    assert.equal(l[0].aprovado, false)
    assert.equal(l[0].modelo, 'MB360')
    aparelhoId = l[0].id
    await aparelho().enviar('ATTLOG', [`${ana.id}\t2026-10-20 07:55:10\t0\t1\t0\t0\t0`]).expect(403)
    assert.equal((await aparelho().ordens()).text, 'OK')
  })

  it('aprovado, recebe a lista do pessoal civil e diz como correu', async () => {
    await adm.put(`/api/ponto/aparelhos/${aparelhoId}`).send({ aprovado: true, nome: 'Portão principal', local: 'Entrada da Escola' }).expect(200)
    const r = await aparelho().ordens().expect(200)
    const linhas = r.text.split('\n')
    assert.equal(linhas.length, 2)
    assert.match(linhas[0], new RegExp(`^C:\\d+:DATA UPDATE USERINFO PIN=${ana.id}\\tName=Ana Maria Kiala\\t`))
    const id = linhas[0].split(':')[1]
    await aparelho().responder(`ID=${id}&Return=0&CMD=DATA`).expect(200)
    assert.equal((await aparelho().ordens()).text, 'OK')
    const a = (await adm.get('/api/ponto/aparelhos')).body[0]
    assert.equal(a.ligado, true)
    assert.equal(a.ordensPendentes, 1)
  })

  it('as marcações entram: entrada, saída, atraso e quem não marcou', async () => {
    const r = await aparelho().enviar('ATTLOG', [
      `${ana.id}\t2026-10-20 07:55:10\t0\t1\t0\t0\t0`,
      `${ana.id}\t2026-10-20 07:55:40\t0\t1\t0\t0\t0`, // o dedo duas vezes seguidas: conta uma
      `${ana.id}\t2026-10-20 15:35:00\t0\t1\t0\t0\t0`,
      `${rui.id}\t2026-10-20 08:40:00\t0\t1\t0\t0\t0`,
      '99999\t2026-10-20 08:00:00\t0\t1\t0\t0\t0', // número que não existe: ignora-se
    ]).expect(200)
    assert.equal(r.text, 'OK: 5')
    // a mesma marcação outra vez não se repete
    await aparelho().enviar('ATTLOG', [`${rui.id}\t2026-10-20 08:40:00\t0\t1\t0\t0\t0`]).expect(200)

    const l = (await adm.get('/api/ponto/livro?data=2026-10-20').expect(200)).body
    const a = l.pessoas.find((p) => p.id === ana.id)
    const b = l.pessoas.find((p) => p.id === rui.id)
    assert.equal(a.entrada, '07:55')
    assert.equal(a.saida, '15:35')
    assert.equal(a.estado, 'saiu')
    assert.equal(a.atraso, 0)
    assert.equal(a.marcacoes.length, 2)
    assert.equal(a.marcacoes[0].verificacao, 'digital')
    assert.equal(b.estado, 'dentro')
    assert.equal(b.atraso, 40)
    assert.equal(l.resumo.dentro, 1)
    assert.equal(l.resumo.atrasos, 1)
  })

  it('marcação manual exige justificação; só as manuais se apagam', async () => {
    await adm.post('/api/ponto/marcacoes').send({ pessoaId: rui.id, data: '2026-10-20', hora: '16:00', justificacao: '' }).expect(400)
    // no futuro não (agora são 17h em Luanda)
    await adm.post('/api/ponto/marcacoes').send({ pessoaId: rui.id, data: '2026-10-20', hora: '18:00', justificacao: 'Saiu tarde' }).expect(400)
    const m = (await adm.post('/api/ponto/marcacoes').send({ pessoaId: rui.id, data: '2026-10-20', hora: '16:00', justificacao: 'O aparelho não leu o dedo' }).expect(201)).body
    const b = (await adm.get('/api/ponto/livro?data=2026-10-20')).body.pessoas.find((p) => p.id === rui.id)
    assert.equal(b.saida, '16:00')
    assert.equal(b.marcacoes[1].origem, 'manual')
    await adm.delete(`/api/ponto/marcacoes/${b.marcacoes[0].id}`).expect(400)
    await adm.delete(`/api/ponto/marcacoes/${m.id}`).expect(200)
  })

  it('as digitais registadas no aparelho contam (sem guardar a digital)', async () => {
    await adm.post(`/api/ponto/aparelhos/${aparelhoId}/digital`).send({ pessoaId: ana.id, dedo: 6 }).expect(200)
    const ordens = (await aparelho().ordens()).text
    assert.match(ordens, new RegExp(`ENROLL_FP PIN=${ana.id}\\tFID=6`))
    await aparelho().enviar('OPERLOG', [`FP PIN=${ana.id}\tFID=6\tSize=1024\tValid=1\tTMP=AAAABBBB`, `USER PIN=${ana.id}\tName=Ana`]).expect(200)
    const a = (await adm.get('/api/ponto/livro?data=2026-10-20')).body.pessoas.find((p) => p.id === ana.id)
    assert.equal(a.digitais, 1)
  })

  it('o mês e o fecho do dia (falta a quem não marcou)', async () => {
    const z = (await adm.post('/api/pessoas').send({ tipo: 'civil', vinculo: 'funcionario', nome: 'Zeca Faltoso Ndala', genero: 'M' }).expect(201)).body
    await adm.post('/api/ponto/faltas').send({ data: '2026-10-20' }).expect(400) // o dia ainda não acabou
    await adm.post('/api/ponto/faltas').send({ data: '2026-10-18' }).expect(400) // domingo
    const r = (await adm.post('/api/ponto/faltas').send({ data: '2026-10-19' }).expect(200)).body
    assert.equal(r.faltas, 3)
    const l = (await adm.get('/api/ponto/livro?data=2026-10-19')).body
    assert.equal(l.pessoas.find((p) => p.id === z.id).estado, 'falta')
    const m = (await adm.get('/api/ponto/mes?mes=2026-10').expect(200)).body
    const a = m.pessoas.find((p) => p.id === ana.id)
    assert.equal(a.diasPresente, 1)
    assert.equal(m.pessoas.find((p) => p.id === rui.id).atrasos, 1)
    assert.ok(a.semMarcacao > 10)
  })

  it('o horário muda-se e só o administrador o muda', async () => {
    await adm.put('/api/ponto/horario').send({ entrada: '08:30', saida: '08:00', tolerancia: 10 }).expect(400)
    await adm.put('/api/ponto/horario').send({ entrada: '08:30', saida: '16:00', tolerancia: 5 }).expect(200)
    const b = (await adm.get('/api/ponto/livro?data=2026-10-20')).body.pessoas.find((p) => p.id === rui.id)
    assert.equal(b.atraso, 10)
  })

  it('entrada e saída alternam; o dedo repetido em menos de 2 minutos conta uma vez', () => {
    const t = (h) => ({ quando: new Date(`2026-10-20T${h}:00+01:00`) })
    const d = ordenarDia([t('12:00'), t('08:00'), t('08:01'), t('13:00')])
    assert.deepEqual(d.map((x) => x.tipo), ['entrada', 'saida', 'entrada'])
  })
})

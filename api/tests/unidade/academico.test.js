import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assiduidade, emailDaEscola, estadoPrazo, entregaAtrasada, mediaPonderada, numeroConta, validarHorario, validarNota, validarPeso,
} from '../../src/dominio/academico/regras.js'
import { assinaturaPrivadaValida } from '../../src/infraestrutura/ficheiros/privados.js'
import { ErroValidacao } from '../../src/dominio/comum/erros.js'

describe('portal académico: regras', () => {
  it('contas com o e-mail da Escola e números sequenciais', () => {
    assert.equal(emailDaEscola(' Ana.Silva@ESGFAA.gov.ao ', 'esgfaa.gov.ao'), 'ana.silva@esgfaa.gov.ao')
    assert.throws(() => emailDaEscola('ana@gmail.com', 'esgfaa.gov.ao'), /e-mail da Escola/)
    assert.equal(emailDaEscola('ana@gmail.com', ''), 'ana@gmail.com')
    assert.equal(numeroConta('estudante', 2026, 7), 'E2026-0007')
    assert.equal(numeroConta('docente', 2026, 12), 'D2026-0012')
  })

  it('notas de 0 a 20 (vírgula ou ponto) e vazio apaga', () => {
    assert.equal(validarNota('14,5'), 14.5)
    assert.equal(validarNota(20), 20)
    assert.equal(validarNota(''), null)
    for (const n of [-1, 20.5, 'abc', '1e9']) assert.throws(() => validarNota(n), ErroValidacao, String(n))
  })

  it('a soma dos pesos não passa de 100 %', () => {
    assert.equal(validarPeso(40, [30, 30]), 40)
    assert.throws(() => validarPeso(50, [30, 30]), /110 %/)
    assert.throws(() => validarPeso(0, []), ErroValidacao)
    assert.throws(() => validarPeso(12.5, []), ErroValidacao)
  })

  it('média ponderada: parcial enquanto faltam notas, aprovação só no fim', () => {
    const parcial = mediaPonderada([{ peso: 40, nota: 15 }, { peso: 60, nota: null }])
    assert.deepEqual(parcial, { media: 15, completa: false, aprovado: null })
    const final = mediaPonderada([{ peso: 40, nota: 15 }, { peso: 60, nota: 8 }])
    assert.deepEqual(final, { media: 10.8, completa: true, aprovado: true })
    assert.equal(mediaPonderada([{ peso: 100, nota: 9.4 }]).aprovado, false)
    assert.equal(mediaPonderada([]).media, null)
  })

  it('prazos de entrega e atrasos', () => {
    const prazo = '2026-10-20T23:59:00Z'
    assert.equal(estadoPrazo(prazo, new Date('2026-10-20T10:00:00Z'), false), 'aberto')
    assert.equal(estadoPrazo(prazo, new Date('2026-10-21T00:00:00Z'), false), 'fechado')
    assert.equal(estadoPrazo(prazo, new Date('2026-10-21T00:00:00Z'), true), 'atrasado')
    assert.ok(entregaAtrasada('2026-10-21T08:00:00Z', prazo))
  })

  it('horário e assiduidade', () => {
    assert.deepEqual(validarHorario({ diaSemana: '2', inicio: '08:00', fim: '10:00', sala: 'A1' }), { diaSemana: 2, inicio: '08:00', fim: '10:00', sala: 'A1' })
    assert.throws(() => validarHorario({ diaSemana: 7, inicio: '08:00', fim: '10:00' }), ErroValidacao)
    assert.throws(() => validarHorario({ diaSemana: 1, inicio: '10:00', fim: '09:00' }), /depois/)
    assert.equal(assiduidade([{ estado: 'presente' }, { estado: 'falta' }, { estado: 'justificada' }, { estado: 'presente' }]), 67)
    assert.equal(assiduidade([]), null)
  })

  it('ficheiros privados: Office e ZIP confirmados pela assinatura', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])
    assert.ok(assinaturaPrivadaValida(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    assert.ok(!assinaturaPrivadaValida(Buffer.from('<html>…</html>'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    assert.ok(assinaturaPrivadaValida(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'application/msword'))
    assert.ok(assinaturaPrivadaValida(Buffer.from('%PDF-1.7\n%âãÏÓ\n'), 'application/pdf'))
  })
})

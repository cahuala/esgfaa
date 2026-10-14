import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deLuanda, gerarIcal } from '../../src/dominio/academico/ical.js'

describe('calendário iCal', () => {
  it('horas de Luanda passam a UTC; dias inteiros; momentos exatos; texto escapado e dobrado', () => {
    assert.equal(deLuanda('2026-11-20', '09:00').toISOString(), '2026-11-20T08:00:00.000Z')
    const ics = gerarIcal([
      { id: 'e1', tipo: 'p1', data: '2026-11-20', inicio: '09:00', fim: '12:00', titulo: '1.ª Prova', cadeira: 'Estratégia', local: 'Anfiteatro A, piso 1' },
      { id: 'f1', tipo: 'feriado', data: '2026-11-11', titulo: 'Dia da Independência' },
      { id: 't1', tipo: 'prazo', data: '2026-11-30', momento: '2026-11-30T22:59:00Z', titulo: 'Entrega: Ensaio; parte 1', cadeira: 'Estratégia', descricao: 'Linha 1\nLinha 2' },
      { id: 'longo', tipo: 'aula', data: '2026-11-21', inicio: '08:00', titulo: 'Á'.repeat(60) },
    ], { agora: new Date('2026-11-01T00:00:00Z') })
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0'))
    assert.ok(ics.includes('DTSTART:20261120T080000Z\r\nDTEND:20261120T110000Z'))
    assert.ok(ics.includes('SUMMARY:1.ª Prova — Estratégia'))
    assert.ok(ics.includes('LOCATION:Anfiteatro A\\, piso 1'))
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20261111\r\nDTEND;VALUE=DATE:20261112'))
    assert.ok(ics.includes('DTSTART:20261130T225900Z'))
    assert.ok(ics.includes('SUMMARY:Entrega: Ensaio\\; parte 1 — Estratégia'))
    assert.ok(ics.includes('DESCRIPTION:Linha 1\\nLinha 2'))
    // nenhuma linha passa de 75 octetos
    for (const linha of ics.split('\r\n')) assert.ok(new TextEncoder().encode(linha).length <= 75, linha)
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  })
})

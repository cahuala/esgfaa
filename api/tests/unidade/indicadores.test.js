import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { media, motivosDeRisco, pautasEmAtraso, taxaAprovacao } from '../../src/dominio/academico/indicadores.js'

const agora = new Date('2026-12-01T12:00:00Z')

describe('indicadores: regras', () => {
  it('motivos de risco: faltas, negativas, situação e acesso', () => {
    const m = motivosDeRisco({
      assiduidades: [{ cadeira: 'EST101', valor: 60 }, { cadeira: 'GEO103', valor: 90 }, { cadeira: 'LID102', valor: null }],
      notas: [{ cadeira: 'EST101', p1: 8, p2: 12, situacao: 'em_curso' }, { cadeira: 'GEO103', p1: 9, p2: 6, situacao: 'recurso' }],
      ultimoAcesso: '2026-11-10T12:00:00Z', agora,
    })
    assert.deepEqual(m.map((x) => [x.tipo, x.cadeira, x.texto]), [
      ['faltas', 'EST101', '60% de presenças'],
      ['nota', 'EST101', 'Negativa na 1.ª prova (8)'],
      ['situacao', 'GEO103', 'Vai a recurso'],
      ['acesso', undefined, 'Sem entrar no portal há 21 dias'],
    ])
    assert.deepEqual(motivosDeRisco({ ultimoAcesso: null, agora }).map((x) => x.texto), ['Nunca entrou no portal'])
    assert.deepEqual(motivosDeRisco({ assiduidades: [{ valor: 80 }], notas: [{ p1: 14, p2: 10, situacao: 'dispensado' }], ultimoAcesso: '2026-11-30T00:00:00Z', agora }), [])
  })

  it('pautas em atraso: 15 dias depois da prova, só quem devia ter nota', () => {
    const linhas = [{ p1: 12, p2: null, exame: null, situacao: 'em_curso' }, { p1: null, p2: null, exame: null, situacao: 'em_curso' }, { p1: 15, p2: 16, exame: null, situacao: 'dispensado' }]
    const eventos = [{ tipo: 'p1', data: '2026-11-01' }, { tipo: 'p2', data: '2026-11-25' }, { tipo: 'exame', data: '2026-11-01' }, { tipo: 'geral', data: '2026-10-01' }]
    assert.deepEqual(pautasEmAtraso(eventos, linhas, agora), [{ componente: 'p1', data: '2026-11-01', diasAtraso: 29, faltam: 1 }])
  })

  it('taxa de aprovação e média', () => {
    assert.equal(taxaAprovacao([{ situacao: 'aprovado' }, { situacao: 'dispensado' }, { situacao: 'reprovado' }, { situacao: 'em_curso' }]), 67)
    assert.equal(taxaAprovacao([{ situacao: 'exame' }]), null)
    assert.equal(media([10, 13, null]), 11.5)
    assert.equal(media([]), null)
  })
})

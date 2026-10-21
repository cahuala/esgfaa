import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MODELOS_PLANO, faltasDoCurso, mencao, notaDaProva, prazoRecuperacao, recuperacaoPossivel, resultadoCurso, resultadoUc, validarPlano, verificarCargaHoraria } from '../../src/dominio/academico/avaliacao/planoCurso.js'

const CSCD = validarPlano({ ...MODELOS_PLANO['cscd-2026'].plano, curso: 'cscd' })

describe('avaliação pelos planos de curso da ESG', () => {
  it('menção da ESG: Muito Bom 18–20, Bom 14–17,99, Regular 10–13,99, Reprovado', () => {
    assert.deepEqual([mencao(20), mencao(18), mencao(17.99), mencao(14), mencao(13.99), mencao(10), mencao(9.99)], ['Muito Bom', 'Muito Bom', 'Bom', 'Bom', 'Regular', 'Regular', 'Reprovado'])
  })

  it('teste de recuperação: a nota desse TAI nunca passa de 10; fica a melhor', () => {
    assert.equal(notaDaProva(7, 16), 10)
    assert.equal(notaDaProva(7, 8), 8)
    assert.equal(notaDaProva(7, 5), 7)
    assert.equal(notaDaProva(12, null), 12)
  })

  it('prazo da recuperação: 17h (Luanda) do dia útil seguinte; a sexta passa para segunda', () => {
    assert.equal(prazoRecuperacao('2026-11-10T10:00:00Z'), '2026-11-11T16:00:00.000Z') // terça → quarta
    assert.equal(prazoRecuperacao('2026-11-13T15:00:00Z'), '2026-11-16T16:00:00.000Z') // sexta → segunda
    const tai = { tipo: 'TAI', publicadaEm: '2026-11-10T10:00:00Z' }
    assert.equal(recuperacaoPossivel(tai, { nota: 8 }, new Date('2026-11-11T15:59:00Z')).pode, true)
    assert.equal(recuperacaoPossivel(tai, { nota: 8 }, new Date('2026-11-11T16:01:00Z')).pode, false)
    assert.equal(recuperacaoPossivel(tai, { nota: 12 }, new Date('2026-11-10T12:00:00Z')).pode, false)
    assert.equal(recuperacaoPossivel(tai, { nota: 8, recuperacaoPedidaEm: '2026-11-10T12:00:00Z' }, new Date('2026-11-10T13:00:00Z')).pode, false)
    assert.equal(recuperacaoPossivel({ ...tai, tipo: 'TAG' }, { nota: 8 }, new Date('2026-11-10T12:00:00Z')).pode, false)
  })

  it('UC: média dos TAI e TAG às centésimas; um teste escrito negativo reprova mesmo com média ≥ 10', () => {
    const av = [{ id: 1, tipo: 'TAI', forma: 'teste', publicadaEm: '2020-01-01T10:00:00Z' }, { id: 2, tipo: 'TAG', forma: 'trabalho' }, { id: 3, tipo: 'TAI', forma: 'relatorio' }]
    const agora = new Date('2026-01-01')
    assert.deepEqual(resultadoUc(av, { 1: { nota: 14 }, 2: { nota: 15.5 }, 3: { nota: 13.25 } }, { agora }).final, 14.25)
    assert.equal(resultadoUc(av, { 1: { nota: 14 }, 2: { nota: 15 } }, { agora }).situacao, 'em_curso')
    const r = resultadoUc(av, { 1: { nota: 9 }, 2: { nota: 18 }, 3: { nota: 17 } }, { agora })
    assert.deepEqual([r.final, r.situacao], [14.67, 'reprovado'])
    // com a recuperação a 13, conta 10: aprovado
    assert.equal(resultadoUc(av, { 1: { nota: 9, recuperacao: 13 }, 2: { nota: 18 }, 3: { nota: 17 } }, { agora }).situacao, 'aprovado')
    // pedida e ainda sem nota: em recuperação
    assert.equal(resultadoUc(av, { 1: { nota: 9, recuperacaoPedidaEm: '2020-01-01T11:00:00Z' }, 2: { nota: 18 }, 3: { nota: 17 } }, { agora }).situacao, 'recuperacao')
  })

  it('CSCD: blocos ponderados pelos créditos e nota final (2·Adm + 3·Tac + 1·OCC + 2·Estr + 2·TII) / 10', () => {
    const ucs = MODELOS_PLANO['cscd-2026'].cadeiras.map((c) => ({ ...c, final: 14, situacao: 'aprovado' }))
    // Táctica toda a 16, o resto a 14: (2·14 + 3·16 + 14 + 2·14 + 2·14) / 10 = 14,6
    for (const u of ucs) if (u.bloco === 'TAC') u.final = 16
    const r = resultadoCurso(CSCD, ucs)
    assert.equal(r.blocos.find((b) => b.sigla === 'TAC').nota, 16)
    assert.deepEqual([r.final, r.concluido, r.mencao], [14.6, true, 'Bom'])
    // Bloco de Administração: (3×CEO + 3×GP + EFP + DAM + 3×LE + 3×AL) / 14
    const adm = ucs.map((u) => (u.bloco === 'ADM' ? { ...u, final: u.codigo === 'CEO' ? 6 : 10 } : u))
    adm.find((u) => u.codigo === 'CEO').situacao = 'reprovado'
    const r2 = resultadoCurso(CSCD, adm)
    assert.equal(r2.blocos.find((b) => b.sigla === 'ADM').nota, 9.14) // (3·6 + 11·10) / 14
    assert.equal(r2.concluido, false)
    assert.ok(r2.emFalta.some((t) => t.startsWith('CEO')) && r2.emFalta.some((t) => t.startsWith('Bloco ADM')))
  })

  it('COAMP: média das UC e o ajuste do Comandante, limitado a ±0,25', () => {
    const coamp = validarPlano({ ...MODELOS_PLANO['coamp-2026'].plano, curso: 'coamp' })
    const ucs = [{ codigo: 'A', nome: 'A', creditos: 2, final: 12, situacao: 'aprovado' }, { codigo: 'B', nome: 'B', creditos: 2, final: 13, situacao: 'aprovado' }]
    assert.equal(resultadoCurso(coamp, ucs).final, 12.5)
    assert.equal(resultadoCurso(coamp, ucs, { ajuste: 1 }).final, 12.75)
  })

  it('carga horária: 1 UCréd = 15 h; avisos de UC curta e de semestres acima do máximo', () => {
    const avisos = verificarCargaHoraria([{ codigo: 'X', nome: 'X', periodo: '1', horasContacto: 8, horasNaoContacto: 2, creditos: 1 }, { codigo: 'Y', nome: 'Y', periodo: '1', horasContacto: 600, horasNaoContacto: 30, creditos: 42 }])
    assert.ok(avisos.some((t) => t.includes('pelo menos 15 h')))
    assert.ok(avisos.some((t) => t.includes('UCréd (máximo 40)')) && avisos.some((t) => t.includes('h (máximo 600)')))
    // o modelo do CSCD respeita a regra dos 15 h por crédito
    assert.deepEqual(verificarCargaHoraria(MODELOS_PLANO['cscd-2026'].cadeiras).filter((t) => t.includes('UCréd para')), [])
  })

  it('faltas: no máximo 10 % de faltas justificadas sobre os tempos previstos; acima disso não conclui', () => {
    const f = faltasDoCurso([...Array(89)].map(() => ({ estado: 'justificada' })).concat([{ estado: 'falta' }]), 883)
    assert.deepEqual([f.justificadas, f.injustificadas, f.limite, f.excedido], [89, 1, 88, true])
    const ucs = MODELOS_PLANO['cscd-2026'].cadeiras.map((c) => ({ ...c, final: 14, situacao: 'aprovado' }))
    const r = resultadoCurso(CSCD, ucs, { faltas: f })
    assert.equal(r.concluido, false)
    assert.ok(r.emFalta.some((t) => t.startsWith('Faltas justificadas')))
    assert.equal(resultadoCurso(CSCD, ucs, { faltas: faltasDoCurso([{ estado: 'justificada' }], 883) }).concluido, true)
  })

  it('os modelos dos quatro cursos têm a carga e os créditos dos planos', () => {
    const soma = (k) => MODELOS_PLANO[k].cadeiras.reduce((s, c) => [s[0] + c.horasContacto + c.horasNaoContacto, s[1] + c.creditos], [0, 0])
    assert.deepEqual([soma('cscd-2026'), soma('cemc-2026'), soma('ceao-2026'), soma('coamp-2026')], [[1215, 81], [1215, 81], [1207, 80], [976, 62]])
    for (const k of Object.keys(MODELOS_PLANO)) {
      const p = validarPlano({ ...MODELOS_PLANO[k].plano, curso: k })
      for (const c of MODELOS_PLANO[k].cadeiras) assert.ok(p.blocos.some((b) => b.sigla === c.bloco), `${k}: ${c.codigo} sem bloco`)
      assert.equal(MODELOS_PLANO[k].cadeiras.filter((c) => c.tii).length, 1, k)
    }
  })
})

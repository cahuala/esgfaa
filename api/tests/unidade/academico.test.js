import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assiduidade } from '../../src/dominio/academico/atividades/presencas.js'
import { entregaAtrasada, estadoPrazo } from '../../src/dominio/academico/atividades/trabalhos.js'
import { classificacao, validarNota } from '../../src/dominio/academico/avaliacao/nota.js'
import { resultadoDisciplina } from '../../src/dominio/academico/avaliacao/resultado.js'
import { validarAlocacao } from '../../src/dominio/academico/organizacao/cadeira.js'
import { validarHorario } from '../../src/dominio/academico/organizacao/horario.js'
import { emailDaEscola, numeroConta } from '../../src/dominio/academico/pessoas/contas.js'
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

  it('MAC ≥ 14 sem provas negativas dispensa do exame', () => {
    assert.deepEqual(resultadoDisciplina({ p1: 15, p2: 16 }), { mac: 15.5, final: 16, situacao: 'dispensado', classificacao: 'Bom' })
    // MAC 14 mas uma prova negativa: vai a exame
    assert.equal(resultadoDisciplina({ p1: 19, p2: 9 }).situacao, 'exame')
    assert.equal(resultadoDisciplina({ p1: 13, p2: 14.5 }).situacao, 'exame')
  })

  it('exame: nota final = 40 % MAC + 60 % exame, arredondada às unidades', () => {
    // 0,4 × 12,5 + 0,6 × 11 = 11,6 → 12
    assert.deepEqual(resultadoDisciplina({ p1: 12, p2: 13, exame: 11 }), { mac: 12.5, final: 12, situacao: 'aprovado', classificacao: 'Suficiente' })
    // 0,4 × 12,5 + 0,6 × 7 = 9,2 → 9: vai a recurso
    assert.deepEqual(resultadoDisciplina({ p1: 16, p2: 9, exame: 7 }), { mac: 12.5, final: 9, situacao: 'recurso', classificacao: null })
    // 9,5 arredonda para 10
    assert.equal(resultadoDisciplina({ p1: 10, p2: 10, exame: 9.17 }).final, 10)
  })

  it('recurso substitui o exame na mesma fórmula', () => {
    assert.deepEqual(resultadoDisciplina({ p1: 16, p2: 9, exame: 7, recurso: 12 }), { mac: 12.5, final: 12, situacao: 'aprovado', classificacao: 'Suficiente' })
    assert.deepEqual(resultadoDisciplina({ p1: 8, p2: 10, exame: 6, recurso: 8 }), { mac: 9, final: 8, situacao: 'reprovado', classificacao: 'Reprovado' })
    // quem passou no exame não precisa do recurso: é ignorado
    assert.equal(resultadoDisciplina({ p1: 12, p2: 13, exame: 11, recurso: 2 }).final, 12)
  })

  it('sem as duas provas a disciplina está em curso', () => {
    assert.deepEqual(resultadoDisciplina({ p1: 15 }), { mac: null, final: null, situacao: 'em_curso', classificacao: null })
    assert.equal(resultadoDisciplina({}).situacao, 'em_curso')
    assert.equal(resultadoDisciplina({ p1: '', p2: 12 }).situacao, 'em_curso')
  })

  it('classificação qualitativa', () => {
    assert.deepEqual([9, 10, 13, 14, 16, 17, 20].map(classificacao), ['Reprovado', 'Suficiente', 'Suficiente', 'Bom', 'Bom', 'Muito bom', 'Muito bom'])
    assert.equal(classificacao(null), null)
  })

  it('alocação: um regente no máximo, docentes sem repetir, horas inteiras', () => {
    assert.deepEqual(validarAlocacao([{ docenteId: '3', papel: 'regente', horas: '60' }, { docenteId: 4 }]), [
      { docenteId: 3, papel: 'regente', horas: 60 }, { docenteId: 4, papel: 'assistente', horas: 0 },
    ])
    assert.deepEqual(validarAlocacao([]), []) // cadeira sem docentes
    assert.throws(() => validarAlocacao([{ docenteId: 1, papel: 'regente' }, { docenteId: 2, papel: 'regente' }]), /um regente/)
    assert.throws(() => validarAlocacao([{ docenteId: 1 }, { docenteId: 1 }]), /duas vezes/)
    assert.throws(() => validarAlocacao([{ docenteId: 1, papel: 'chefe' }]), ErroValidacao)
    assert.throws(() => validarAlocacao([{ docenteId: 1, horas: 1.5 }]), /Horas/)
    assert.throws(() => validarAlocacao('x'), ErroValidacao)
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

describe('livro de notas: componentes calculadas', async () => {
  const { notaComposta, validarComposicao } = await import('../../src/dominio/academico/avaliacao/composicao.js')
  it('média ponderada; falta uma nota, fica por calcular', () => {
    const itens = [{ tipo: 'trabalho', id: 1, peso: 60 }, { tipo: 'questionario', id: 2, peso: 40 }]
    assert.equal(notaComposta(itens, { 'trabalho-1': 15, 'questionario-2': 10 }), 13)
    assert.equal(notaComposta(itens, { 'trabalho-1': 15 }), null)
    assert.equal(notaComposta(itens, { 'trabalho-1': 0, 'questionario-2': 12.5 }), 5)
    assert.equal(notaComposta([{ tipo: 'trabalho', id: 1, peso: 1 }, { tipo: 'trabalho', id: 2, peso: 2 }], { 'trabalho-1': 10, 'trabalho-2': 11 }), 10.67)
  })
  it('validação', () => {
    assert.deepEqual(validarComposicao([{ tipo: 'trabalho', id: '3' }]), [{ tipo: 'trabalho', id: 3, peso: 1 }])
    assert.throws(() => validarComposicao([]), /1 a 20/)
    assert.throws(() => validarComposicao([{ tipo: 'trabalho', id: 3 }, { tipo: 'trabalho', id: 3 }]), /duas vezes/)
    assert.throws(() => validarComposicao([{ tipo: 'forum', id: 3 }]), ErroValidacao)
    assert.throws(() => validarComposicao([{ tipo: 'trabalho', id: 3, peso: 0 }]), /pesos/)
  })
})

describe('trabalhos: grelha de avaliação e prorrogações', async () => {
  const { avaliarGrelha, validarGrelha } = await import('../../src/dominio/academico/avaliacao/grelha.js')
  const { prazoDe } = await import('../../src/dominio/academico/atividades/trabalhos.js')
  const grelha = [{ criterio: 'Estrutura', pontos: 4 }, { criterio: 'Argumentação', pontos: 10 }, { criterio: 'Fontes', pontos: 6 }]
  it('nota de 0 a 20 a partir dos pontos de cada critério', () => {
    assert.deepEqual(avaliarGrelha(grelha, { 0: 4, 1: '7,5', 2: 4 }), { pontos: { 0: 4, 1: 7.5, 2: 4 }, obtidos: 15.5, total: 20, nota: 15.5 })
    assert.equal(avaliarGrelha(grelha, { 0: 4 }).nota, null) // faltam critérios
    assert.throws(() => avaliarGrelha(grelha, { 0: 5 }), /de 0 a 4/)
  })
  it('validação da grelha', () => {
    assert.deepEqual(validarGrelha(null), [])
    assert.equal(validarGrelha([{ criterio: 'Clareza', pontos: '5' }])[0].pontos, 5)
    assert.throws(() => validarGrelha([{ criterio: 'X', pontos: 5 }]), ErroValidacao)
    assert.throws(() => validarGrelha([{ criterio: 'Clareza', pontos: 0 }]), /pontos/)
  })
  it('prazo com prorrogação', () => {
    assert.equal(prazoDe({ prazo: 'a' }, null), 'a')
    assert.equal(prazoDe({ prazo: 'a' }, { prazo: 'b' }), 'b')
  })
})

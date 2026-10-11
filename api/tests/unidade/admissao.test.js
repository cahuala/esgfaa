import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { idade, validarAvaliacao, validarCandidatura } from '../../src/dominio/admissao/candidatura.js'
import { gerarCodigo } from '../../src/aplicacao/candidaturas.js'
import { ErroValidacao } from '../../src/dominio/comum/erros.js'

const HOJE = new Date('2026-10-11T12:00:00Z')
const ctx = { cursos: ['estado-maior'], hoje: HOJE }
export const candidaturaValida = (extra = {}) => ({
  curso: 'estado-maior',
  nome: 'João Manuel Fernandes',
  dataNascimento: '1985-04-20',
  bi: '004512345LA041',
  email: 'Joao.Fernandes@faa.ao',
  telefone: '+244 923 456 789',
  provincia: 'Luanda',
  morada: 'Rua da Missão, 12',
  ramo: 'Exército',
  posto: 'Major',
  nip: '19870123',
  unidade: 'Estado-Maior General',
  anosServico: 15,
  habilitacoes: 'Licenciatura',
  areaFormacao: 'Ciências Militares',
  motivacao: 'Pretendo aprofundar a minha preparação para funções de planeamento e comando.',
  declaracao: true,
  consentimento: true,
  ...extra,
})

const campoDoErro = (fn) => {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof ErroValidacao)
    return e.detalhes?.campo
  }
  assert.fail('devia ter falhado')
}

describe('candidatura: validação', () => {
  it('aceita e normaliza uma candidatura completa', () => {
    const c = validarCandidatura(candidaturaValida({ nome: '  João   Manuel  Fernandes ', bi: '004512345la041', nip: '19870123' }), ctx)
    assert.equal(c.nome, 'João Manuel Fernandes')
    assert.equal(c.email, 'joao.fernandes@faa.ao')
    assert.equal(c.dados.bi, '004512345LA041')
    assert.equal(c.dados.anosServico, 15)
    assert.ok(!('declaracao' in c.dados))
  })

  it('cada erro indica o campo, para o site o mostrar no sítio certo', () => {
    const casos = {
      curso: { curso: 'inventado' },
      nome: { nome: 'Joao' },
      dataNascimento: { dataNascimento: '20/04/1985' },
      bi: { bi: '12' },
      email: { email: 'sem-arroba' },
      telefone: { telefone: 'abc' },
      ramo: { ramo: 'Polícia' },
      posto: { posto: 'General de Exército' },
      nip: { nip: '!!' },
      anosServico: { anosServico: 99 },
      habilitacoes: { habilitacoes: 'Nenhuma' },
      motivacao: { motivacao: 'curta' },
      declaracao: { declaracao: 'true' },
      consentimento: { consentimento: false },
    }
    for (const [campo, extra] of Object.entries(casos)) {
      assert.equal(campoDoErro(() => validarCandidatura(candidaturaValida(extra), ctx)), campo, campo)
    }
  })

  it('a idade e os anos de serviço têm de ser coerentes', () => {
    assert.equal(campoDoErro(() => validarCandidatura(candidaturaValida({ dataNascimento: '2010-01-01' }), ctx)), 'dataNascimento')
    assert.equal(campoDoErro(() => validarCandidatura(candidaturaValida({ dataNascimento: '1995-01-01', anosServico: 20 }), ctx)), 'anosServico')
    assert.equal(idade('1985-10-12', HOJE), 40)
    assert.equal(idade('1985-10-11', HOJE), 41)
  })

  it('rejeita dados que não são um objeto', () => {
    for (const v of [null, 'texto', [1]]) assert.throws(() => validarCandidatura(v, ctx), ErroValidacao)
  })

  it('avaliação aceita só estados conhecidos e limita as notas', () => {
    assert.deepEqual(validarAvaliacao({ estado: 'admitida' }), { estado: 'admitida' })
    assert.throws(() => validarAvaliacao({ estado: 'aprovadissima' }), ErroValidacao)
    assert.equal(validarAvaliacao({ notas: 'x'.repeat(5000) }).notas.length, 4000)
  })

  it('códigos legíveis e sem caracteres ambíguos', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => gerarCodigo(2026)))
    assert.ok(codigos.size > 190)
    for (const c of codigos) assert.match(c, /^ESG-2026-[A-HJ-NP-Z2-9]{6}$/)
  })
})

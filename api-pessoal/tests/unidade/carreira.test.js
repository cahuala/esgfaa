import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { nomeDoPosto, postoAcima, quadroEspecial } from '../../src/dominio/pessoal/hierarquia.js'
import { ordenarAntiguidade, proximoPosto, reservaEReforma, verificarGraduacao, verificarLicenca, verificarNomeacao, verificarPromocao } from '../../src/dominio/pessoal/carreira.js'
import { verificarProgressaoCivil } from '../../src/dominio/pessoal/civis.js'

const HOJE = new Date('2026-10-17')
const militar = (extra = {}) => ({
  tipo: 'militar', ramo: 'EXE', posto: 'capitao', fps: 'QP', quadroEspecial: 'INF', situacao: 'activo', efectividade: 'comissao_normal',
  dataNascimento: '1985-03-10', dataIngresso: '2005-01-15', dataAntiguidadePosto: '2020-06-01', avaliacaoFavoravel: true, aptidaoFisica: true,
  processoPendente: false, cursos: [{ chave: 'promocao_oficial_superior', aproveitamento: true }], graduacoes: [], historico: [], ...extra,
})
const estado = (r, id) => r.condicoes.find((x) => x.id === id)?.estado

describe('Lei n.º 13/18: hierarquia', () => {
  it('postos equivalentes entre ramos e quadros especiais com posto limite', () => {
    assert.equal(nomeDoPosto('coronel', 'MGA'), 'Capitão-de-Mar-e-Guerra')
    assert.equal(nomeDoPosto('subtenente', 'MGA'), 'Tenente-de-Corveta')
    assert.equal(nomeDoPosto('general_exercito', 'FAN'), 'General de Aviação')
    assert.equal(postoAcima('major'), 'tenente_coronel')
    assert.equal(quadroEspecial('EXE', 'TPG').limiteOficiais, 'coronel') // art. 87.º, n.º 5
    assert.equal(quadroEspecial('FAN', 'JM').limiteOficiais, 'general') // comum aos três ramos (art. 84.º)
  })
})

describe('Lei n.º 13/18: promoção', () => {
  it('capitão do QP com 6 anos no posto e o curso de promoção a oficial superior: elegível a Major, por escolha (com vaga a confirmar)', () => {
    const r = verificarPromocao(militar(), { hoje: HOJE })
    assert.equal(r.postoProposto, 'major')
    assert.equal(r.modalidade, 'escolha') // art. 98.º, a), IV
    assert.equal(r.elegivel, true)
    assert.equal(estado(r, 'tempo'), 'ok') // art. 97.º: 6 anos
    assert.equal(estado(r, 'curso'), 'ok') // art. 52.º, 1, b)
    assert.equal(estado(r, 'vaga'), 'confirmar')
  })

  it('sem o tempo mínimo ou sem o curso só avisa (como no SIGP): continua a poder ser proposto', () => {
    const r = verificarPromocao(militar({ dataAntiguidadePosto: '2021-06-01' }), { hoje: HOJE })
    assert.equal(r.elegivel, true)
    assert.equal(estado(r, 'tempo'), 'alerta')
    assert.match(r.condicoes.find((x) => x.id === 'tempo').detalhe, /cumpre a 2027-06/)
    const semCurso = verificarPromocao(militar({ cursos: [] }), { hoje: HOJE })
    assert.equal(estado(semCurso, 'curso'), 'alerta')
    assert.equal(semCurso.elegivel, true)
    assert.equal(semCurso.alertas.length, 1)
  })

  it('exclusões: processo pendente, licença ilimitada, reserva, inactividade temporária, despromoção há menos de 2 anos', () => {
    assert.equal(verificarPromocao(militar({ processoPendente: true }), { hoje: HOJE }).elegivel, false) // art. 103.º
    assert.equal(verificarPromocao(militar({ efectividade: 'licenca_ilimitada' }), { hoje: HOJE }).elegivel, false)
    assert.equal(verificarPromocao(militar({ situacao: 'reserva' }), { hoje: HOJE }).elegivel, false) // art. 99.º
    assert.equal(estado(verificarPromocao(militar({ avaliacaoFavoravel: false }), { hoje: HOJE }), 'avaliacao'), 'alerta') // art. 50.º: avisa
    assert.equal(verificarPromocao(militar({ efectividade: 'inactividade_temporaria' }), { hoje: HOJE }).elegivel, false) // como no SIGP
    assert.equal(verificarPromocao(militar({ historico: [{ tipo: 'despromocao', data: '2025-12-01' }] }), { hoje: HOJE }).elegivel, false) // art. 63.º
    // a título excepcional, na reserva, pode
    assert.equal(estado(verificarPromocao(militar({ situacao: 'reserva' }), { hoje: HOJE, modalidade: 'excepcional' }), 'situacao'), 'ok')
  })

  it('posto limite do quadro especial e do Serviço Militar por Contrato', () => {
    const coronelTPG = militar({ posto: 'coronel', quadroEspecial: 'TPG', dataAntiguidadePosto: '2018-01-01', cursos: [{ chave: 'superior_guerra' }] })
    assert.equal(estado(verificarPromocao(coronelTPG, { hoje: HOJE }), 'quadro'), 'falta') // art. 87.º, n.º 5: até Coronel
    assert.equal(proximoPosto({ posto: 'tenente', fps: 'SMC' }), null) // art. 120.º: SMC oficiais até Tenente
    assert.equal(proximoPosto({ posto: 'segundo_sargento', fps: 'SMC' }), 'primeiro_sargento')
    assert.equal(proximoPosto({ posto: 'primeiro_sargento', fps: 'SMC' }), null)
    assert.equal(proximoPosto({ posto: 'sargento_maior', fps: 'QP' }), null)
    assert.equal(proximoPosto({ posto: 'aspirante', fps: 'SMO' }), 'subtenente') // art. 129.º
  })

  it('Coronel para Brigadeiro exige o Curso Superior de Guerra ou o de Comando e Direcção', () => {
    const r = verificarPromocao(militar({ posto: 'coronel', dataAntiguidadePosto: '2020-01-01', cursos: [{ chave: 'superior_guerra', aproveitamento: true }] }), { hoje: HOJE })
    assert.equal(r.postoProposto, 'brigadeiro')
    assert.equal(estado(r, 'curso'), 'ok')
  })
})

describe('Lei n.º 13/18: graduação, nomeação, reserva, reforma, licenças e antiguidade', () => {
  it('graduação: até 2 graus acima, no máximo 2 vezes na categoria e uma de cada vez', () => {
    assert.equal(verificarGraduacao(militar(), 'tenente_coronel').possivel, true)
    assert.equal(verificarGraduacao(militar(), 'coronel').possivel, false) // 3 graus
    assert.equal(verificarGraduacao(militar({ graduacoes: [{ posto: 'major', ativa: true, inicio: '2026-01-01' }] }), 'major').possivel, false)
    assert.equal(verificarGraduacao(militar({ graduacoes: [{ posto: 'major' }, { posto: 'major' }] }), 'major').possivel, false)
  })

  it('nomeação: nunca para cargo de posto inferior; para posto superior até 6 meses', () => {
    assert.equal(verificarNomeacao(militar(), { postoRequerido: 'tenente', tipo: 'militar' }).possivel, false) // art. 19.º
    assert.equal(verificarNomeacao(militar(), { postoRequerido: 'major', tipo: 'militar' }, { hoje: HOJE, fim: '2027-03-01' }).possivel, true) // art. 20.º
    assert.equal(verificarNomeacao(militar(), { postoRequerido: 'major', tipo: 'militar' }, { hoje: HOJE, fim: '2027-09-01' }).possivel, false)
    assert.equal(verificarNomeacao(militar(), { postoRequerido: 'capitao', tipo: 'militar', vagas: 1, ocupados: 1 }).possivel, false)
  })

  it('reserva por idade (art. 111.º) e reforma (art. 114.º)', () => {
    const r = reservaEReforma(militar({ posto: 'coronel', dataNascimento: '1970-05-20' }), HOJE)
    assert.deepEqual([r.reserva.idadeLimite, r.reserva.data], [59, '2029-05-20'])
    assert.equal(r.reforma.idadeLimite, 60)
    assert.equal(reservaEReforma(militar({ posto: 'brigadeiro' }), HOJE).reforma.idadeLimite, 65)
    assert.ok(reservaEReforma(militar({ dataIngresso: '1990-01-01' }), HOJE).podeRequererReserva) // 30 anos de serviço
  })

  it('licenças: parto só no feminino, doença até 30 dias seguidos, ilimitada só no QP com 8 anos', () => {
    assert.equal(verificarLicenca(militar({ genero: 'M' }), { tipo: 'parto', inicio: '2026-11-01', fim: '2027-01-29' }).possivel, false)
    assert.equal(verificarLicenca(militar(), { tipo: 'doenca', inicio: '2026-11-01', fim: '2026-12-15' }).possivel, false)
    assert.equal(verificarLicenca(militar({ fps: 'SMC' }), { tipo: 'ilimitada', inicio: '2026-11-01', fim: '2028-11-01' }).possivel, false)
    assert.equal(verificarLicenca(militar(), { tipo: 'ferias', inicio: '2026-11-01', fim: '2026-11-30' }).possivel, true)
  })

  it('lista de antiguidade: posto mais alto, depois a data de antiguidade, depois o tempo de serviço e a idade', () => {
    const l = ordenarAntiguidade([
      militar({ nome: 'C', dataAntiguidadePosto: '2021-01-01' }), militar({ nome: 'A', posto: 'major' }),
      militar({ nome: 'B', dataAntiguidadePosto: '2019-01-01' }), militar({ nome: 'D', dataAntiguidadePosto: '2021-01-01', dataIngresso: '2001-01-01' }),
    ])
    assert.deepEqual(l.map((x) => x.nome), ['A', 'B', 'D', 'C'])
  })
})

describe('Pessoal civil: progressão na carreira', () => {
  it('categoria seguinte depois do tempo mínimo e com avaliação favorável', () => {
    const p = { tipo: 'civil', carreiraCivil: 'tecnico_superior', categoriaCivil: 'Técnico Superior de 2.ª Classe', dataCategoria: '2022-01-01', avaliacaoFavoravel: true }
    const r = verificarProgressaoCivil(p, { hoje: HOJE })
    assert.equal(r.categoriaProposta, 'Técnico Superior de 1.ª Classe')
    assert.equal(r.elegivel, true)
    assert.equal(verificarProgressaoCivil({ ...p, dataCategoria: '2025-01-01' }, { hoje: HOJE }).elegivel, false)
  })
})

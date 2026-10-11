import { describe, it, expect } from 'vitest'
import { PASSOS, VAZIA, errosDoPasso, passoDoCampo, paraEnvio } from '../../src/pages/Candidatura/passos'

const HOJE = new Date(2026, 9, 11)
const opcoes = { cursos: ['estado-maior'], hoje: HOJE }
const completa = {
  ...VAZIA,
  curso: 'estado-maior', nome: 'João Manuel Fernandes', dataNascimento: '1985-04-20', bi: '004512345LA041',
  email: 'joao@faa.ao', telefone: '+244 923 456 789', provincia: 'Luanda',
  ramo: 'Exército', posto: 'Major', nip: '19870123', unidade: 'EMG', anosServico: '15', habilitacoes: 'Licenciatura',
  motivacao: 'Pretendo aprofundar a minha preparação para funções de planeamento.',
  declaracao: true, consentimento: true,
}

describe('candidatura por passos', () => {
  it('quatro passos, cada campo pertence a um passo', () => {
    expect(PASSOS.map((p) => p.id)).toEqual(['curso', 'pessoais', 'militares', 'confirmacao'])
    expect(passoDoCampo('email')).toBe(1)
    expect(passoDoCampo('nip')).toBe(2)
    expect(passoDoCampo('consentimento')).toBe(3)
    expect(passoDoCampo('desconhecido')).toBe(0)
  })

  it('uma candidatura completa passa todos os passos', () => {
    PASSOS.forEach((_, i) => expect(errosDoPasso(i, completa, opcoes)).toEqual({}))
  })

  it('cada passo só valida os seus campos', () => {
    expect(Object.keys(errosDoPasso(0, VAZIA, opcoes))).toEqual(['curso'])
    expect(Object.keys(errosDoPasso(1, VAZIA, opcoes)).sort()).toEqual(['bi', 'dataNascimento', 'email', 'nome', 'provincia', 'telefone'])
    expect(Object.keys(errosDoPasso(3, VAZIA, opcoes)).sort()).toEqual(['consentimento', 'declaracao'])
  })

  it('verifica idade, formatos e anos de serviço', () => {
    expect(errosDoPasso(1, { ...completa, dataNascimento: '2010-01-01' }, opcoes).dataNascimento).toMatch(/idade/)
    expect(errosDoPasso(1, { ...completa, nome: 'João' }, opcoes).nome).toBeTruthy()
    expect(errosDoPasso(2, { ...completa, anosServico: '50' }, opcoes).anosServico).toBeTruthy()
    expect(errosDoPasso(2, { ...completa, motivacao: 'curta' }, opcoes).motivacao).toBeTruthy()
  })

  it('envia os anos de serviço como número', () => {
    expect(paraEnvio(completa).anosServico).toBe(15)
  })
})

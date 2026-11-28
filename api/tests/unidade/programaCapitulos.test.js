import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { capitulosDoPrograma, sessoesDoPrograma } from '../../src/dominio/academico/atividades/programa.js'

const tabela = (linhas) => `<h4>Objectivo geral</h4><p>Saber.</p><h4>Plano das sessões</h4><table><thead><tr><th>Sessão</th><th>Tema / OE</th><th>Objectivo de aprendizagem</th><th>TE</th><th>Método</th></tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`

describe('capítulos a partir do programa (como os tópicos do Moodle)', () => {
  it('uma sessão por capítulo quando cada sessão tem o seu código (CSCD)', () => {
    const html = tabela([['CEO 01', '1.1', 'Compreender a comunicação &amp; os media', '02', 'T'], ['CEO 02', '1.1', 'Aplicar modelos', '02', 'T']])
    assert.equal(sessoesDoPrograma(html).length, 2)
    assert.deepEqual(capitulosDoPrograma(html).map((c) => c.titulo), ['CEO 01 — Compreender a comunicação & os media', 'CEO 02 — Aplicar modelos'])
    assert.match(capitulosDoPrograma(html)[0].resumo, /Objectivo específico: 1\.1 · Tempos escolares: 02 · Método: T/)
  })
  it('um capítulo por tema quando o plano agrupa as aulas (CEAO)', () => {
    const html = tabela([['1', '1. Segurança Nacional', 'Missões', '4 horas', 'Conferência'], ['2', '1. Segurança Nacional', 'Ameaças', '2 horas', 'Conferência'], ['3', '2. Domínios', 'Segurança política', '2 horas', 'Seminário']])
    const caps = capitulosDoPrograma(html)
    assert.deepEqual(caps.map((c) => c.titulo), ['1. Segurança Nacional', '2. Domínios'])
    assert.equal(caps[0].resumo, '• Missões (4 horas, Conferência)\n• Ameaças (2 horas, Conferência)')
  })
  it('sem o plano das sessões, nada', () => {
    assert.deepEqual(capitulosDoPrograma('<p>Programa em PDF.</p>'), [])
    assert.deepEqual(capitulosDoPrograma(null), [])
  })
})

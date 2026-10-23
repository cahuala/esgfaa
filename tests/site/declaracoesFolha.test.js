import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { CATALOGO } from '../../src/pessoal/docPessoal'
import { declaracao } from '../../src/pessoal/docPessoal/declaracoes'

/*
  Nenhuma declaração passa da folha: com nomes, cursos, finalidades e vencimentos compridos, tudo (até ao
  posto de quem assina) fica numa só página A4, acima da margem de baixo.
*/
const LIMITE = 287
const longo = {
  id: 1, tipo: 'militar', vinculo: 'estudante', discente: true, nome: 'Hermenegildo Florindo Quintino dos Santos Kapingala Tchissola Massanga', nip: '300512345678',
  postoNome: 'Capitão-de-Mar-e-Guerra', posto: 'coronel', ramo: 'MGA', fpsNome: 'Quadro Permanente', dataNascimento: '1975-03-05', pai: 'Moisés Inácio Kapingala Tchissola', mae: 'Engrácia Victória Massanga dos Santos',
  iban: 'AO06 0040 0000 1234 5678 1012 3', categoriaCivil: 'Técnico Superior Principal', militarAlocado: { nip: '300100200', postoNome: 'Tenente-General', nome: 'Celestino Abel Quintino Lukamba Ngola' },
}
const civil = { ...longo, tipo: 'civil', vinculo: 'funcionario', nip: null, numeroAgente: '70012' }
const domiciliar = { ...civil, vinculo: 'domiciliar' }
const quem = { local: 'Luanda', comandante: { cargo: 'O 2.º COMANDANTE DA ESG (EM EXERCÍCIO)', nome: 'Hermenegildo Florindo Quintino dos Santos Kapingala', posto: 'Vice-Almirante' } }
const opcoes = {
  numero: 412, ano: 2026, data: '2026-10-23', valor: 1987654.32, curso: '18.º Curso de Organização do Asseguramento Moral e Psicológico das Forças Armadas Angolanas e da Polícia Nacional de Angola',
  finalidade: 'efeito de obtenção de Visto de Estudo para a República Portuguesa, junto da Embaixada de Portugal em Luanda, para frequência de curso de pós-graduação em estratégia e relações internacionais',
}

async function medir(item, pessoa) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let max = 0
  const texto = doc.text.bind(doc)
  doc.text = (t, x, y, ...r) => { if (typeof y === 'number' && doc.getCurrentPageInfo().pageNumber === doc.getNumberOfPages()) max = Math.max(max, y); return texto(t, x, y, ...r) }
  // o que se apaga (tentativas que não couberam) deixa de contar
  const apagar = doc.deletePage.bind(doc)
  doc.deletePage = (n) => { max = 0; return apagar(n) }
  const d = { doc, autoTable, brasao: null, logo: null, fundo: null, paginas: 0 }
  await item.desenhar(d, pessoa, { ...opcoes, banco: undefined }, quem)
  return { paginas: doc.getNumberOfPages(), max }
}

describe('declarações: tudo numa folha, até com textos compridos', () => {
  for (const item of CATALOGO.filter((x) => x.grupo === 'declaracoes')) {
    it(item.nome, async () => {
      const pessoa = item.tipo.includes('domiciliar') ? domiciliar : item.tipo.includes('servico') ? civil : longo
      const r = await medir(item, pessoa)
      expect(r.paginas, 'passa para outra folha').toBe(1)
      expect(r.max, 'passa a margem de baixo').toBeLessThanOrEqual(LIMITE)
    })
  }

  it('com textos normais, fica com a medida do modelo (não aperta)', () => {
    const d = { doc: new jsPDF({ unit: 'mm', format: 'a4' }), brasao: null, logo: null, paginas: 0 }
    const normal = { tipo: 'militar', vinculo: 'funcionario', nome: 'João Kiala', nip: '100200', postoNome: 'Major' }
    expect(declaracao(d, normal, { tipo: 'efectividade', numero: 1, ano: 2026, data: '2026-10-23' }, quem)).toBe(1)
  })

  it('várias declarações no mesmo PDF: cada uma na sua folha, mesmo as que se apertam', () => {
    const d = { doc: new jsPDF({ unit: 'mm', format: 'a4' }), brasao: null, logo: null, paginas: 0 }
    declaracao(d, longo, { ...opcoes, tipo: 'salario' }, quem)
    declaracao(d, longo, { ...opcoes, tipo: 'efectividade' }, quem)
    declaracao(d, civil, { ...opcoes, tipo: 'servico' }, quem)
    expect(d.doc.getNumberOfPages()).toBe(3)
  })
})

import { t as tx } from '../i18n/linguas'

// as regras de avaliação de um plano de curso, em texto (o quadro RegrasPlano mostra-as): [[título, texto]]
const num = (v) => String(v).replace('.', ',')

export function regrasDoPlano(p) {
  if (!p) return []
  // por extenso (o nome do trabalho final do curso, e o dos blocos), sem siglas
  const tii = p.trabalho || tx('Trabalho de Investigação Individual')
  const blocos = p.blocos ?? []
  const total = blocos.reduce((s, b) => s + Number(b.coeficiente), 0)
  const formula = p.formula === 'media'
    ? tx('Média aritmética simples das notas finais das unidades curriculares (sem ponderação).')
    : p.formula === 'percentagem'
      ? blocos.map((b) => `${num(b.coeficiente)} % × ${b.nome}`).join(' + ')
      : `(${blocos.map((b) => `${num(b.coeficiente)} × ${b.nome}`).join(' + ')}) / ${num(total)}`
  const aprovarUc = [p.exigirUcs && tx('10 valores na nota final da unidade curricular'), p.exigirTesteEscrito && tx('10 valores em cada Trabalho de Aplicação Individual com a natureza de teste escrito')].filter(Boolean)
  const aprovarCurso = [p.exigirBlocos && tx('10 valores em cada bloco'), p.exigirTii && tx('10 valores no {0}', { 0: tii }), tx('média final de 10 valores')].filter(Boolean)
  return [
    [tx('Nota de cada unidade curricular'), tx('Média das provas — Trabalhos de Aplicação Individual (TAI) e Trabalhos de Aplicação de Grupo (TAG) — de 0 a 20 valores, às centésimas. Quando o plano da unidade curricular fixa o peso de cada prova (por exemplo, trabalho de grupo 50 % e defesa individual 50 %), a média é ponderada por esses pesos.')],
    aprovarUc.length > 0 && [tx('Aprovação na unidade curricular'), `${tx('Exige')} ${aprovarUc.join(` ${tx('e')} `)}.`],
    !p.exigirUcs && [tx('Aprovação na unidade curricular'), p.exigirBlocos ? tx('O plano não exige 10 em cada unidade curricular: conta a média dos blocos e a média final.') : tx('O plano não exige 10 em cada unidade curricular: conta a média final.')],
    p.recuperacaoAutomatica
      ? [tx('Recurso'), tx('Com nota negativa num Trabalho de Aplicação Individual, o recurso é obrigatório: não é preciso pedir nem há prazo. Seja qual for a nota do recurso, esse trabalho conta no máximo 10 valores.')]
      : [tx('Teste de recuperação'), tx('Com nota negativa num Trabalho de Aplicação Individual, pede-se um teste de recuperação até às 17h do dia útil seguinte à publicação da nota, uma só vez por trabalho. Seja qual for a nota, esse trabalho conta no máximo 10 valores.')],
    [tx('Revisão da prova'), tx('Quem não concordar com a classificação de uma prova pode reclamar por escrito ao Director do Curso, uma vez por prova. O Director de Ensino delibera e a nota pode subir, manter-se ou baixar.')],
    p.formula !== 'media' && blocos.length > 0 && [tx('Nota de cada bloco'), `${tx('Média das unidades curriculares do bloco, ponderada pelas unidades de crédito')}: ${blocos.map((b) => b.nome).join('; ')}.`],
    [tx('Nota final do curso'), formula],
    [tx('Aprovação no curso'), `${tx('Exige')} ${aprovarCurso.join(', ')}.`],
    p.ajusteMaximo > 0 && [tx('Ajuste do Comandante'), tx('Ouvido o Conselho de Curso, o Comandante da ESG pode ajustar a média final até ±{0} valores.', { 0: num(p.ajusteMaximo) })],
    [tx('Faltas'), Number(p.faltasMaximas) > 0 ? tx('No máximo {0} % de faltas justificadas sobre os tempos escolares previstos no plano; acima disso não conclui o curso.', { 0: p.faltasMaximas }) : tx('O plano não fixa um limite de faltas justificadas.')],
    [tx('Menção'), tx('Muito Bom de 18 a 20; Bom de 14 a 17,99; Regular de 10 a 13,99; Reprovado abaixo de 10.')],
    [tx('Conselho de Curso'), tx('O Director de Ensino faz o juízo ampliativo das qualidades pessoais ({0} factores) e propõe as classificações; o Conselho de Curso confirma e o Comandante da ESG homologa. Ouvido o Conselho, o Comandante pode atribuir o DISTINTO ao melhor do curso.', { 0: p.factoresJuizo ?? 11 })],
    [tx('Duração normal'), tx('{0} meses.', { 0: p.duracaoMeses ?? 10 })],
  ].filter(Boolean)
}


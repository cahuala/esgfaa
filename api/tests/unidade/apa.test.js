import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verificarApa, lerCitacoes } from '../../src/dominio/integridade/apa.js'
import { caracteresDisfarcados, comparar, sem, tokenizar } from '../../src/dominio/integridade/semelhanca.js'
import { normasDoTexto } from '../../src/aplicacao/integridade/originalidade.js'

const corpo = (texto, referencias) => `${'Introdução ao estudo da gestão de pessoal nas instituições militares. '.repeat(30)}\n\n${texto}\n\nREFERÊNCIAS BIBLIOGRÁFICAS\n\n${referencias.join('\n\n')}`
const regras = (r) => r.problemas.map((p) => p.regra)

describe('normas APA: citações e referências', () => {
  it('trabalho conforme: sem erros', () => {
    const r = verificarApa(corpo(
      'A pesquisa é qualitativa (Gil, 2019). Segundo Laudon e Laudon (2022), os sistemas integram a informação. O estudo de caso (Yin, 2018; Bondarouk et al., 2017) e “a análise de conteúdo é um conjunto de técnicas de análise das comunicações” (Bardin, 2011, p. 37).',
      ['Bardin, L. (2011). Análise de conteúdo. Edições 70.', 'Bondarouk, T., Parry, E., & Furtmueller, E. (2017). Electronic HRM. The International Journal of Human Resource Management, 28(1), 98–131. https://doi.org/10.1080/09585192.2016.1245672',
        'Gil, A. C. (2019). Métodos e técnicas de pesquisa social (7.ª ed.). Atlas.', 'Laudon, K. C., & Laudon, J. P. (2022). Management information systems (17th ed.). Pearson.', 'Yin, R. K. (2018). Case study research and applications (6th ed.). SAGE.'],
    ))
    assert.equal(r.erros, 0, JSON.stringify(r.problemas))
    assert.equal(r.avisos, 0, JSON.stringify(r.problemas))
    assert.equal(r.citacoes, 5)
    assert.equal(r.referencias, 5)
    assert.equal(r.referenciasCitadas, 5)
  })

  it('erros reais dos ante-projectos: ano trocado, apelido com gralha, maiúsculas ABNT, et al. sem espaço, citação direta sem página', () => {
    const r = verificarApa(corpo(
      'Os sistemas de RH (Kavanagh et al., 2018) apoiam a decisão. A população “é a totalidade de indivíduos que possuem as mesmas características definidas para um estudo” (KAUARK et al.,2010). Erl, Puttini e Mahmood (2013) definem a nuvem. Ver também (Severino, 2007).',
      ['Erl, T., Puttini, R., & Mahmood, Z. (2013). Cloud computing. Prentice Hall.', 'Kavanagh, M. J., Thite, M., & Johnson, R. D. (2015). Human resource information systems (3rd ed.). SAGE.', 'Kuark, F. S., Manhães, F. C., & Medeiros, C. H. (2010). Metodologia da pesquisa. Via Litterarum.', 'Armstrong, M. (2023). Handbook of human resource management practice. Kogan Page.'],
    ))
    const l = regras(r)
    assert.ok(l.includes('ano'))
    assert.equal(r.problemas.find((p) => p.regra === 'ano').detalhe, 'na lista: 2015')
    assert.ok(l.includes('apelido'))
    assert.match(r.problemas.find((p) => p.regra === 'apelido').sugestao, /^Kuark et al\., 2010$/)
    assert.ok(l.includes('maiusculas'))
    assert.ok(l.includes('espacos'))
    assert.ok(l.includes('citacao-direta'))
    assert.ok(l.includes('tres-autores')) // Erl, Puttini e Mahmood -> Erl et al.
    assert.ok(l.includes('sem-referencia')) // Severino
    assert.ok(l.includes('ordem')) // Armstrong depois de Kuark
    assert.ok(r.problemas.some((p) => p.regra === 'nao-citada' && /^Armstrong/.test(p.texto)))
  })

  it('lista em ABNT: um só erro a explicar a norma, e as citações continuam a encontrar o ano', () => {
    const r = verificarApa(corpo('Segundo ITU (2011), a monitorização é essencial; ver Akeela e Dezfouli (2018).', [
      'AKEELA, Rami; DEZFOULI, Behnam. Software-defined radios. Computer Communications, v. 128, p. 106–125, 2018.',
      'INTERNATIONAL TELECOMMUNICATION UNION (ITU). Spectrum Monitoring. Geneva: ITU, 2011.',
      'O Orientador', '_______________', 'Tte. Cor. José Mascarenhas, MSc.',
    ]))
    assert.deepEqual(regras(r), ['norma'])
    assert.equal(r.referencias, 2)
    assert.equal(r.referenciasCitadas, 2)
  })

  it('sem lista de referências; e o título do trabalho entre aspas não é citação', () => {
    const t = 'MODERNIZAÇÃO DO SISTEMA INTEGRADO DE GESTÃO DE RECURSOS HUMANOS DA ACADEMIA\n\nO tema «Modernização do Sistema Integrado de Gestão de Recursos Humanos da Academia» é actual (Gil, 2019).'
    const r = verificarApa(t)
    assert.deepEqual(regras(r), ['referencias'])
  })

  it('citações narrativas e entre parênteses; leis e figuras não contam', () => {
    const c = lerCitacoes('Segundo Gil (2019, p. 27) e (Bardin, 2011; Yin, 2018). A Lei n.º 13/18 (2018) e a Fonte: Elaboração própria (2026). (Decreto Presidencial, 2020)')
    assert.deepEqual(c.map((x) => [x.autores, x.ano, x.local]), [['Gil', '2019', 'p. 27'], ['Bardin', '2011', ''], ['Yin', '2018', '']])
  })
})

describe('anti-plágio: truques e modelo da Escola', () => {
  it('letras de outro alfabeto e caracteres invisíveis: avisa e compara como se fossem normais', () => {
    const limpo = 'O espectro radioelétrico tem sido submetido a uma utilização cada vez mais intensa pelas comunicações militares e civis da região'
    const disfarcado = limpo.replace('utiliza', 'utili\u200bza').replace(/o/g, '\u043e') // "о" cirílico e espaço de largura zero
    assert.equal(sem('AKЕELA'), 'akeela')
    const d = caracteresDisfarcados(disfarcado)
    assert.equal(d.length, 7)
    assert.ok(d.some((x) => x.palavra.startsWith('utili·zaç')), JSON.stringify(d.map((x) => x.palavra)))
    assert.deepEqual(caracteresDisfarcados('Москва e Αθήνα são capitais; a hifeni­zação é normal.'), []) // palavras estrangeiras inteiras e hífen opcional não contam
    const r = comparar({ texto: disfarcado, tokens: tokenizar(disfarcado) }, [{ id: 1, texto: limpo, tokens: tokenizar(limpo) }])
    assert.equal(r.percentagem, 100)
  })

  it('não compara a capa, o índice, as tabelas (cronograma) nem as citações (Autor, ano) e em bloco', () => {
    const t = [
      'ACADEMIA DA FORÇA AÉREA NACIONAL', 'ANTE-PROJECTO DO TRABALHO DE FIM DE CURSO PARA A OBTENÇÃO DO GRAU DE LICENCIADO EM CIÊNCIAS MILITARES',
      'ÍNDICE', 'INTRODUÇÃO 4', '1.1. Tema 4', '1.2. Problema de Investigação 4', '1.3. Justificativa 5',
      'INTRODUÇÃO', 'Texto próprio do estudante sobre a sua investigação na Academia (Bardin, 2011; Gil, 2019).',
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Elaboração do anteprojecto', 'Entrega do anteprojecto',
      `${'A citação longa em bloco tem muitas palavras copiadas de um autor conhecido e vai recuada. '.repeat(4)}(Gil, 2019, p. 27)`,
    ].join('\n\n')
    const n = tokenizar(t, { excluirCitacoes: true }).map((x) => x.n)
    for (const fora of ['academia', 'ante', 'tema', 'janeiro', 'entrega', 'bardin', 'recuada']) assert.ok(!n.slice(0, 3).includes(fora) && !n.includes(fora === 'academia' ? 'licenciado' : fora), fora)
    assert.deepEqual(n.slice(0, 3), ['texto', 'proprio', 'estudante'])
  })

  it('a análise guarda as normas e as letras disfarçadas', () => {
    const r = normasDoTexto(corpo('Texto (Gil, 2019) com a pаlavra disfarçada.', ['Gil, A. C. (2019). Métodos e técnicas de pesquisa social (7.ª ed.). Atlas.']))
    assert.equal(r.apa.erros, 0)
    assert.equal(r.disfarces.total, 1)
  })
})

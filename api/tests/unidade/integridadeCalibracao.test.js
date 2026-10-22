import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { comparar, tokenizar } from '../../src/dominio/integridade/semelhanca.js'
import { frase, frases, impressoesAproximadas, linguaDe, paraFrases, raiz } from '../../src/dominio/integridade/parafrase.js'

/*
  Calibração do anti-plágio: casos fixos com o mínimo que tem de apanhar e o máximo de falsos positivos.
  Se uma alteração ao motor baixar a deteção ou começar a acusar textos independentes, este teste falha.
*/
const FONTE = 'A segurança marítima no Golfo da Guiné tornou-se uma das principais preocupações dos Estados costeiros da África Ocidental e Central. A pirataria, o tráfico de droga, a pesca ilegal e o roubo de combustível afectam directamente as economias da região e a segurança das rotas comerciais internacionais. Para responder a estas ameaças, os países da região assinaram em 2013 o Código de Conduta de Yaoundé, que estabelece mecanismos de cooperação, partilha de informação e coordenação das operações navais. A eficácia destes mecanismos depende, contudo, da capacidade das marinhas nacionais, que continuam a enfrentar limitações de meios, de formação e de financiamento. Angola, pela extensão da sua costa e pelo peso da sua economia petrolífera, tem um papel central nesta arquitectura regional de segurança.'
const trocar = (cada, onde) => FONTE.split(' ').map((w, i) => (i % cada === onde ? `xx${w}` : w)).join(' ')
const CASOS = {
  'cópia integral': [FONTE, 100],
  'cópia com outra introdução e conclusão': [`Este trabalho começa por uma nota pessoal sobre o tema escolhido. ${FONTE} Termina aqui o enquadramento.`, 80],
  'frases por outra ordem': [FONTE.split(/(?<=\.)\s+/).reverse().join(' '), 100],
  'uma palavra trocada em cada 4': [trocar(4, 2), 90],
  'uma palavra trocada em cada 3': [trocar(3, 1), 45],
  'paráfrase feita à mão': ['No Golfo da Guiné, a segurança no mar passou a ser uma grande inquietação para os países costeiros da África Ocidental e Central. Actividades como a pirataria, o narcotráfico, a pesca não autorizada e o furto de combustível prejudicam as economias regionais e põem em risco o comércio internacional. Em resposta, os Estados da região adoptaram em 2013 o Código de Yaoundé, prevendo cooperação, troca de informações e coordenação naval. Porém, o sucesso depende das marinhas de cada país, ainda com poucos meios, pouca formação e pouco dinheiro. Angola, com a sua longa costa e economia baseada no petróleo, ocupa um lugar central nesta segurança regional.', 30],
}
const NEGATIVOS = {
  'mesmo tema, texto independente': 'O Golfo da Guiné concentra grande parte das reservas de petróleo da costa africana, o que atrai investimento estrangeiro e também a atenção de grupos criminosos. A Marinha de Guerra Angolana tem participado em exercícios multinacionais, como o Obangame Express, que treinam a interdição marítima e a troca de dados entre centros de operações. Estes exercícios mostram progressos, mas revelam falta de navios de patrulha oceânica e de aeronaves de vigilância.',
  'outro tema': 'A formação de oficiais superiores exige um equilíbrio entre a teoria estratégica e a prática do comando. Os cursos da Escola combinam seminários, exercícios de estado-maior e trabalhos de investigação orientados, permitindo aos oficiais alunos desenvolver capacidade de análise e de decisão em contextos complexos e incertos.',
}

// o que o serviço faz: comparação exacta e, nas palavras que sobram, as frases parafraseadas
function analisar(texto, fontes) {
  const tokens = tokenizar(texto)
  const fs2 = fontes.map((f) => ({ ...f, tokens: tokenizar(f.texto) }))
  const fa = frases(texto, tokens)
  const achadas = paraFrases(fa, fs2.map((f) => ({ id: f.id, frases: frases(f.texto, f.tokens) })))
  const parecidas = achadas.map((x) => ({ inicio: fa[x.k].inicio, fim: fa[x.k].fim, fonte: x.fonte, excerto: x.b.texto, valor: x.valor, tipo: 'parafrase' }))
  return comparar({ texto, tokens }, fs2, { parecidas })
}

describe('anti-plágio: calibração (o que tem de apanhar e o que não pode acusar)', () => {
  for (const [nome, [texto, minimo]] of Object.entries(CASOS)) {
    it(`${nome}: pelo menos ${minimo} %`, () => {
      const r = analisar(texto, [{ id: 'F', texto: FONTE }])
      assert.ok(r.percentagem >= minimo, `${r.percentagem} %`)
    })
  }

  for (const [nome, texto] of Object.entries(NEGATIVOS)) {
    it(`${nome}: 0 %`, () => assert.equal(analisar(texto, [{ id: 'F', texto: FONTE }]).percentagem, 0))
  }

  it('a fonte é encontrada (impressões aproximadas) mesmo com uma palavra trocada em cada 4', () => {
    const f = new Set(impressoesAproximadas(tokenizar(FONTE)).map((x) => x.h))
    assert.ok(impressoesAproximadas(tokenizar(trocar(4, 2))).filter((x) => f.has(x.h)).length >= 2)
  })

  it('tradução: a versão automática em inglês coincide com a fonte em inglês', () => {
    const en = 'Maritime security in the Gulf of Guinea has become one of the main concerns of the coastal states of West and Central Africa. Piracy, drug trafficking, illegal fishing and fuel theft directly affect the economies of the region and the security of international trade routes.'
    const maquina = ['Maritime security in the Gulf of Guinea has become one of the major concerns of the coastal States of Western and Central Africa.', 'Piracy, drug trafficking, illegal fishing and the theft of fuel directly affect the economies of the region and the safety of international commercial routes.']
    assert.equal(linguaDe(en), 'en')
    assert.equal(linguaDe(FONTE), 'pt')
    const achadas = paraFrases(maquina.map((t, i) => frase(t, i * 200, i * 200 + 150, 20)), [{ id: 'EN', frases: frases(en, tokenizar(en)) }])
    assert.equal(achadas.length, 2)
  })

  it('radicais: a forma da palavra não esconde a cópia', () => {
    assert.equal(raiz('operações'), raiz('operação'))
    assert.equal(raiz('coordenação'), raiz('coordenações'))
    assert.equal(raiz('securities'), raiz('security'))
  })

  it('textos independentes do site (artigos, notícias, cursos, páginas): menos de 2 % das frases acusadas', () => {
    const docs = []
    for (const f of ['artigos', 'noticias', 'cursos', 'paginas', 'eventos', 'privacidade', 'revistas']) {
      const s = fs.readFileSync(new URL(`../../../src/data/${f}.js`, import.meta.url), 'utf8')
      ;[...s.matchAll(/'((?:[^'\\]|\\.){120,})'/g)].forEach((m, i) => docs.push({ id: `${f}#${i}`, texto: m[1] }))
    }
    const todos = docs.map((d) => ({ ...d, frases: frases(d.texto, tokenizar(d.texto)) }))
    let total = 0
    let acusadas = 0
    for (const a of todos) {
      total += a.frases.length
      // os cursos vêm dos mesmos planos-tipo da ESG (frases oficiais repetidas): não se comparam entre si
      const mesmoModelo = (b) => a.id.startsWith('cursos#') && b.id.startsWith('cursos#')
      acusadas += paraFrases(a.frases, todos.filter((b) => b.id !== a.id && b.texto !== a.texto && !mesmoModelo(b))).length
    }
    assert.ok(total > 100, String(total))
    assert.ok(acusadas / total < 0.02, `${acusadas} de ${total}`)
  })
})

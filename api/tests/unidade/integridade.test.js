import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { comparar, impressoes, pedacos, tokenizar, nivelDe } from '../../src/dominio/integridade/semelhanca.js'
import { lerDoZip, limparTextoExtraido } from '../../src/infraestrutura/texto/extrair.js'

const ORIGINAL = 'A logística militar compreende o planeamento e a execução do movimento e da manutenção das forças. Nas operações conjuntas, o apoio logístico deve ser coordenado entre os ramos para evitar duplicações e garantir a sustentação do esforço principal durante toda a campanha.'
const OUTRO = 'O estudo da geopolítica do Atlântico Sul exige compreender as rotas marítimas, os recursos energéticos e a presença de potências externas na região, bem como a cooperação entre os Estados ribeirinhos.'

const doc = (id, texto, o) => ({ id, texto, tokens: tokenizar(texto, o) })

describe('anti-plágio: semelhança entre textos', () => {
  it('normaliza acentos e maiúsculas e tira palavras vazias', () => {
    const t = tokenizar('A Logística é ESSENCIAL às operações')
    assert.deepEqual(t.map((x) => x.n), ['logistica', 'essencial', 'operacoes'])
    assert.equal('A Logística é ESSENCIAL às operações'.slice(t[0].i, t[0].f), 'Logística')
  })

  it('cópia integral = 100 %; texto diferente = 0 %', () => {
    const a = doc(0, ORIGINAL)
    assert.equal(comparar(a, [doc(1, ORIGINAL)]).percentagem, 100)
    assert.equal(comparar(a, [doc(2, OUTRO)]).percentagem, 0)
  })

  it('cópia de metade, com outras maiúsculas e pontuação, encontra o trecho e o excerto da fonte', () => {
    const copiado = 'Nas OPERAÇÕES conjuntas o apoio logístico deve ser coordenado entre os ramos, para evitar duplicações e garantir a sustentação do esforço principal'
    const texto = `${OUTRO} ${copiado}.`
    const r = comparar(doc(0, texto), [doc(7, ORIGINAL), doc(8, 'Nada a ver com o resto do texto, apenas palavras soltas sem relação nenhuma.')])
    assert.ok(r.percentagem > 40 && r.percentagem < 70, String(r.percentagem))
    assert.deepEqual(r.fontes.map((f) => f.id), [7])
    assert.equal(r.trechos.length, 1)
    assert.match(texto.slice(r.trechos[0].inicio, r.trechos[0].fim), /^OPERAÇÕES conjuntas .* esforço principal$/)
    assert.match(r.trechos[0].excerto, /^operações conjuntas, o apoio logístico .* esforço principal$/)
  })

  it('citações entre aspas e referências no fim podem ficar de fora', () => {
    const texto = `${OUTRO} Como escreveu o autor, «${ORIGINAL}» E assim concluímos o trabalho com uma reflexão própria sobre o tema, sem repetir ninguém e com palavras nossas.\n\nReferências\n${ORIGINAL}`
    assert.ok(comparar(doc(0, texto), [doc(1, ORIGINAL)]).percentagem > 40)
    assert.equal(comparar(doc(0, texto, { excluirCitacoes: true, excluirReferencias: true }), [doc(1, ORIGINAL)]).percentagem, 0)
  })

  it('o winnowing guarda menos pedaços mas apanha passagens com K + JANELA - 1 palavras', () => {
    const t = tokenizar(`${ORIGINAL} ${OUTRO}`)
    const imp = impressoes(t)
    assert.ok(imp.length < pedacos(t).length && imp.length > 0)
    const trecho = tokenizar('apoio logístico deve ser coordenado entre os ramos para evitar duplicações')
    const hs = new Set(imp.map((x) => x.h))
    assert.ok(pedacos(trecho).some((x) => hs.has(x.h)))
  })

  it('níveis de alerta', () => {
    assert.equal(nivelDe(8).nivel, 'baixo')
    assert.equal(nivelDe(20).nivel, 'medio')
    assert.equal(nivelDe(60).nivel, 'alto')
    assert.equal(nivelDe(null), null)
  })
})

describe('anti-plágio: extração de texto', () => {
  it('lê um ficheiro de dentro de um ZIP (como os .docx) e limpa o texto', () => {
    const nome = 'word/document.xml'
    const dados = Buffer.from('<w:p><w:t>Olá</w:t></w:p>')
    const comp = zlib.deflateRawSync(dados)
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt16LE(nome.length, 26)
    const corpo = Buffer.concat([local, Buffer.from(nome), comp])
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(comp.length, 20); central.writeUInt16LE(nome.length, 28); central.writeUInt32LE(0, 42)
    const cd = Buffer.concat([central, Buffer.from(nome)])
    const fim = Buffer.alloc(22); fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(1, 10); fim.writeUInt32LE(corpo.length, 16)
    const zip = Buffer.concat([corpo, cd, fim])
    assert.equal(lerDoZip(zip, nome).toString(), '<w:p><w:t>Olá</w:t></w:p>')
    assert.equal(lerDoZip(zip, 'outro.xml'), null)
    assert.equal(limparTextoExtraido('estraté-\ngia   militar\r\n\n\n\nfim'), 'estratégia militar\n\nfim')
  })
})

import { frasesParaPesquisa, indicadoresIA, paragrafos } from '../../src/dominio/integridade/ia.js'
import { enderecoPublico, htmlParaTexto } from '../../src/infraestrutura/web/paginas.js'

const IA = `A liderança militar desempenha um papel crucial no sucesso das operações modernas. É importante notar que os comandantes devem equilibrar a disciplina com a motivação das tropas. Além disso, a comunicação eficaz permite alinhar os objetivos estratégicos com a execução tática. Nesse sentido, a formação contínua assume uma importância fundamental para todos os oficiais.

No cenário atual, as forças armadas enfrentam desafios cada vez mais complexos e multifacetados. Por outro lado, a tecnologia oferece novas oportunidades para melhorar a coordenação entre as unidades. Além disso, a cooperação internacional permite partilhar boas práticas e experiências relevantes. Desta forma, é crucial promover uma cultura de inovação em todas as estruturas.

Em suma, a liderança eficaz depende de múltiplos fatores interligados e complementares. É fundamental que os líderes desenvolvam competências técnicas e humanas de forma equilibrada. Além disso, a avaliação regular do desempenho contribui para a melhoria contínua das organizações. Em última análise, o sucesso depende da capacidade de adaptação às mudanças do ambiente.`
const HUMANO = `Comandei a companhia durante dois anos no Cunene. Foi duro. Logo na primeira semana perdemos um camião numa picada que nenhum mapa mostrava, e percebi que a informação que vinha de Luanda estava atrasada meses.

O sargento Muteka, que conhecia a zona desde miúdo, passou a acompanhar todas as patrulhas; foi ele quem sugeriu trocarmos os horários de abastecimento para a madrugada, quando o calor ainda deixava os motores trabalhar sem aquecer. Resultou? Em parte. Os furos continuaram, mas deixámos de ter viaturas paradas mais de um dia.

Aprendi ali que a doutrina ajuda, claro, mas o que decide é ouvir quem está no terreno há mais tempo do que nós, mesmo quando tem menos galões no ombro. Hoje, ao preparar os oficiais mais novos, conto-lhes sempre a história do camião.`

describe('anti-plágio: utilização de IA e pesquisa na internet', () => {
  it('os indicadores locais distinguem texto "de assistente" de escrita pessoal', () => {
    const a = indicadoresIA(IA)
    const h = indicadoresIA(HUMANO)
    assert.ok(a.pontuacao >= 60, `IA: ${a.pontuacao} ${JSON.stringify(a.sinais)}`)
    assert.ok(h.pontuacao <= 35, `humano: ${h.pontuacao} ${JSON.stringify(h.sinais)}`)
    assert.ok(a.sinais.some((s) => /fórmulas/.test(s.sinal)))
    assert.ok(a.paragrafos.length >= 2)
    assert.equal(indicadoresIA('Texto curto.').pontuacao, null)
    assert.equal(paragrafos(HUMANO).length, 3)
  })

  it('escolhe frases com conteúdo espalhadas pelo texto, para pesquisar', () => {
    const f = frasesParaPesquisa(`${IA}\n\n${HUMANO}`, 4)
    assert.equal(f.length, 4)
    assert.ok(f.every((x) => x.split(' ').length >= 8))
    assert.ok(f.some((x) => /liderança|comunicação|cooperação/.test(x)) && f.some((x) => /camião|sargento|doutrina|Comandei/.test(x)))
  })

  it('só lê páginas públicas e tira o que não é texto', async () => {
    for (const u of ['http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/admin', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://localhost/', 'file:///etc/passwd', 'http://exemplo.ao:8080/']) {
      assert.equal(await enderecoPublico(u), false, u)
    }
    assert.deepEqual(htmlParaTexto('<html><head><title>Título</title><style>x{}</style></head><body><nav>menu</nav><p>Olá &amp; adeus</p><script>alert(1)</script></body></html>'), { titulo: 'Título', texto: 'Olá & adeus' })
  })
})

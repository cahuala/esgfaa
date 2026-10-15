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

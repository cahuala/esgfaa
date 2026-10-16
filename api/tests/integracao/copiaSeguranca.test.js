import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync, unzipSync, zipSync } from 'fflate'
import { criarAmbiente } from '../apoio/ambiente.js'

const NOVA = 'Portal2026segura'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const enc = (s) => new TextEncoder().encode(s)

// arquivo tar (ustar) para simular uma cópia do Moodle (.mbz)
function tar(entradas) {
  const blocos = []
  for (const [nome, dados] of Object.entries(entradas)) {
    const d = typeof dados === 'string' ? enc(dados) : dados
    const h = new Uint8Array(512)
    h.set(enc(nome).slice(0, 100), 0)
    h.set(enc('0000644\0'), 100)
    h.set(enc(`${d.length.toString(8).padStart(11, '0')}\0`), 124)
    h.set(enc('00000000000\0'), 136)
    h.set(enc('        '), 148)
    h[156] = 48
    h.set(enc('ustar\0'), 257)
    h.set(enc(`${h.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0')}\0 `), 148)
    blocos.push(h, d, new Uint8Array((512 - (d.length % 512)) % 512))
  }
  blocos.push(new Uint8Array(1024))
  const total = blocos.reduce((a, b) => a + b.length, 0)
  const r = new Uint8Array(total)
  let p = 0
  for (const b of blocos) { r.set(b, p); p += b.length }
  return r
}

function cursoMoodle() {
  const hash = 'a'.repeat(40)
  return Buffer.from(gzipSync(tar({
    'moodle_backup.xml': `<?xml version="1.0"?><moodle_backup><information><original_course_fullname>Estratégia (Moodle)</original_course_fullname><contents>
      <activities>
        <activity><moduleid>1</moduleid><sectionid>10</sectionid><modulename>page</modulename><title>Introdução</title><directory>activities/page_1</directory></activity>
        <activity><moduleid>2</moduleid><sectionid>11</sectionid><modulename>url</modulename><title>Sítio</title><directory>activities/url_2</directory></activity>
        <activity><moduleid>3</moduleid><sectionid>11</sectionid><modulename>resource</modulename><title>Sebenta</title><directory>activities/resource_3</directory></activity>
        <activity><moduleid>4</moduleid><sectionid>11</sectionid><modulename>assign</modulename><title>Ensaio</title><directory>activities/assign_4</directory></activity>
        <activity><moduleid>5</moduleid><sectionid>11</sectionid><modulename>quiz</modulename><title>Teste</title><directory>activities/quiz_5</directory></activity>
        <activity><moduleid>6</moduleid><sectionid>11</sectionid><modulename>url</modulename><title>Perigo</title><directory>activities/url_6</directory></activity>
      </activities>
      <sections>
        <section><sectionid>10</sectionid><title>0</title><directory>sections/section_10</directory></section>
        <section><sectionid>11</sectionid><title>Tema 1</title><directory>sections/section_11</directory></section>
      </sections></contents></information></moodle_backup>`,
    'sections/section_10/section.xml': '<section id="10"><number>0</number><name></name><summary></summary><visible>1</visible></section>',
    'sections/section_11/section.xml': '<section id="11"><number>1</number><name>Tema 1: estratégia</name><summary>&lt;p&gt;Resumo&lt;/p&gt;</summary><visible>1</visible></section>',
    'activities/page_1/page.xml': '<activity id="1" moduleid="1" modulename="page"><page id="1"><name>Introdução</name><intro></intro><content>&lt;p&gt;Bem-vindos&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</content></page></activity>',
    'activities/url_2/url.xml': '<activity id="2" moduleid="2" modulename="url"><url id="2"><name>Sítio do ministério</name><intro></intro><externalurl>https://www.exemplo.ao/defesa</externalurl></url></activity>',
    'activities/resource_3/resource.xml': '<activity id="3" moduleid="3" modulename="resource"><resource id="3"><name>Sebenta</name><intro></intro></resource></activity>',
    'activities/resource_3/inforef.xml': '<inforef><fileref><file><id>45</id></file></fileref></inforef>',
    'activities/assign_4/assign.xml': '<activity id="4" moduleid="4" modulename="assign"><assign id="4"><name>Ensaio final</name><intro>&lt;p&gt;Escreva 5 páginas.&lt;/p&gt;</intro><duedate>1924992000</duedate></assign></activity>',
    'activities/quiz_5/quiz.xml': '<activity id="5" moduleid="5" modulename="quiz"><quiz id="5"><name>Teste</name></quiz></activity>',
    'activities/url_6/url.xml': '<activity id="6" moduleid="6" modulename="url"><url id="6"><name>Perigo</name><externalurl>javascript:alert(1)</externalurl></url></activity>',
    'files.xml': `<files><file id="45"><contenthash>${hash}</contenthash><component>mod_resource</component><filearea>content</filearea><filename>sebenta.pdf</filename><mimetype>application/pdf</mimetype></file></files>`,
    [`files/aa/${hash}`]: PDF,
  })))
}

describe('cópia de segurança da cadeira e importação do Moodle', () => {
  let amb, c1, c2
  const tokens = {}
  const como = (quem) => amb.com(tokens[quem])
  const cadeira = async (id) => (await como('prof').get(`/api/portal/cadeiras/${id}`)).body
  const restaurar = (quem, id, dados, nome = 'copia.zip') => como(quem).post(`/api/portal/cadeiras/${id}/restaurar`).attach('ficheiro', dados, { filename: nome, contentType: 'application/octet-stream' })

  before(async () => {
    amb = await criarAmbiente()
    const admin = await amb.entrar()
    await amb.com(admin).post('/api/admin/colecoes/cursos').send({ nome: 'Curso de Estado-Maior' })
    const s = await amb.criarUtilizador('administrador')
    const sec = () => amb.com(s.token)
    const turma = (await sec().post('/api/admin/academico/turmas').send({ curso: 'curso-de-estado-maior', anoLetivo: '2026/2027', nome: 'CEM A' })).body
    const prof = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })).body
    const outro = (await sec().post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Outro Teste', email: 'outro@esgfaa.gov.ao' })).body
    await amb.registarEMatricular(sec(), turma.id, { nome: 'Estudante ana Teste', email: 'ana@esgfaa.gov.ao' })
    c1 = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST101', nome: 'Estratégia' })).body
    c2 = (await sec().post(`/api/admin/academico/turmas/${turma.id}/cadeiras`).send({ codigo: 'EST201', nome: 'Estratégia II' })).body
    for (const c of [c1, c2]) await sec().put(`/api/admin/academico/cadeiras/${c.id}/docentes`).send({ docentes: [{ docenteId: prof.id, papel: 'regente' }] })
    void outro
    for (const k of ['prof', 'outro', 'ana']) {
      const email = `${k}@esgfaa.gov.ao`
      const r = await amb.http().post('/api/portal/entrar').send({ email, senha: email })
      tokens[k] = (await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: email, nova: NOVA })).body.token
    }
  })
  after(() => amb.fechar())

  it('exporta para .zip e restaura noutra cadeira: capítulos, páginas, ficheiros, trabalhos e questionários', async () => {
    const P = como('prof')
    const cap = (await P.post(`/api/portal/cadeiras/${c1.id}/secoes`).send({ titulo: 'Capítulo 1 — Teoria' })).body
    await P.post(`/api/portal/cadeiras/${c1.id}/materiais`).send({ tipo: 'pagina', titulo: 'Leitura', conteudo: '<p>Texto da aula</p>', secaoId: cap.id })
    const f = await P.post(`/api/portal/cadeiras/${c1.id}/materiais`).field('tipo', 'ficheiro').field('titulo', 'Sebenta').attach('ficheiro', PDF, { filename: 'sebenta.pdf', contentType: 'application/pdf' })
    assert.equal(f.status, 201, f.body.erro)
    await P.post(`/api/portal/cadeiras/${c1.id}/trabalhos`).send({ titulo: 'Ensaio', prazo: '2030-11-20T23:59:00Z', grelha: [{ criterio: 'Estrutura', pontos: 10 }, { criterio: 'Fontes', pontos: 10 }] })
    const q = (await P.post(`/api/portal/cadeiras/${c1.id}/questionarios`).send({ titulo: 'Teste formativo' })).body
    await P.post(`/api/portal/questionarios/${q.id}/perguntas`).send({ enunciado: 'Quem escreveu Da Guerra?', tipo: 'unica', opcoes: [{ texto: 'Clausewitz', correta: true }, { texto: 'Sun Tzu', correta: false }] })

    const e = await P.get(`/api/portal/cadeiras/${c1.id}/copia-seguranca`).buffer(true).parse((res, cb) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))) })
    assert.equal(e.status, 200)
    assert.match(e.headers['content-type'], /zip/)
    const dentro = unzipSync(new Uint8Array(e.body))
    const json = JSON.parse(new TextDecoder().decode(dentro['cadeira.json']))
    assert.equal(json.formato, 'esgfaa-cadeira')
    assert.ok(!JSON.stringify(json).includes('caminho'), 'a cópia não leva caminhos do disco')
    assert.equal(Object.keys(dentro).filter((k) => k.startsWith('ficheiros/')).length, 1)

    const r = await restaurar('prof', c2.id, e.body)
    assert.equal(r.status, 200, r.body.erro)
    assert.deepEqual([r.body.formato, r.body.capitulos, r.body.materiais, r.body.trabalhos, r.body.questionarios], ['esgfaa', 1, 2, 1, 1])
    const d = await cadeira(c2.id)
    const sebenta = d.materiais.find((m) => m.titulo === 'Sebenta')
    assert.equal((await P.get(`/api/portal/ficheiros/${sebenta.ficheiroId}`)).status, 200)
    assert.equal(d.trabalhos[0].grelha.length, 2)
    const qs = (await P.get(`/api/portal/cadeiras/${c2.id}/questionarios`)).body
    assert.equal((qs.questionarios || qs)[0].publicado, false) // restaurado como rascunho
  })

  it('importa um curso do Moodle (.mbz): tópicos, página, ligação, ficheiro e trabalho; diz o que não importou', async () => {
    const antes = (await cadeira(c2.id)).materiais.length
    const r = await restaurar('prof', c2.id, cursoMoodle(), 'curso.mbz')
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.formato, 'moodle')
    assert.equal(r.body.origem, 'Estratégia (Moodle)')
    assert.deepEqual([r.body.capitulos, r.body.materiais, r.body.trabalhos], [1, 3, 1])
    assert.equal(r.body.ignorados.quiz, 1)
    assert.equal(r.body.ignorados.ligacoes, 1) // a ligação javascript: não entra
    const d = await cadeira(c2.id)
    assert.equal(d.materiais.length, antes + 3)
    const pagina = d.materiais.find((m) => m.titulo === 'Introdução')
    assert.equal(pagina.secaoId, null) // o tópico 0 do Moodle é a secção geral
    assert.ok(pagina.conteudo.includes('Bem-vindos') && !pagina.conteudo.includes('<script'))
    assert.equal(d.materiais.find((m) => m.tipo === 'ligacao' && m.titulo === 'Sítio do ministério').url, 'https://www.exemplo.ao/defesa')
    assert.equal(d.trabalhos.find((t) => t.titulo === 'Ensaio final').prazo, '2031-01-01T00:00:00.000Z')
  })

  it('recusa: quem não é docente da cadeira, ficheiros que não são cópias e conteúdo malicioso', async () => {
    assert.ok([403, 404].includes((await como('ana').get(`/api/portal/cadeiras/${c1.id}/copia-seguranca`)).status))
    assert.ok([403, 404].includes((await como('outro').get(`/api/portal/cadeiras/${c1.id}/copia-seguranca`)).status))
    assert.ok([403, 404].includes((await restaurar('outro', c1.id, cursoMoodle(), 'curso.mbz')).status))
    assert.equal((await restaurar('prof', c1.id, PDF, 'x.zip')).status, 400)
    assert.equal((await restaurar('prof', c1.id, Buffer.from(zipSync({ 'outra.txt': enc('olá') })))).status, 400)
    // uma "cópia" forjada: script na página, ligação javascript:, ficheiro que diz ser PDF mas é HTML
    const forjada = Buffer.from(zipSync({
      'cadeira.json': enc(JSON.stringify({
        formato: 'esgfaa-cadeira', versao: 1, cadeira: { codigo: 'X', nome: 'X' },
        ficheiros: [{ id: 'f1', nome: 'mau.pdf', tipo: 'application/pdf' }],
        secoes: [], materiais: [
          { id: 1, tipo: 'pagina', titulo: 'Página', conteudo: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>' },
          { id: 2, tipo: 'ligacao', titulo: 'Ligação', url: 'javascript:alert(1)' },
          { id: 3, tipo: 'ficheiro', titulo: 'Ficheiro', ficheiroId: 'f1' },
          { id: 4, tipo: 'programa-malicioso', titulo: 'Não existe' },
        ],
        trabalhos: [], questionarios: [{ id: 1, titulo: 'Q', perguntas: [{ tipo: 'inventado', enunciado: 'x' }] }],
      })),
      'ficheiros/f1': enc('<html><script>alert(1)</script></html>'),
    }))
    const r = await restaurar('prof', c1.id, forjada)
    assert.equal(r.status, 200, r.body.erro)
    assert.equal(r.body.ignorados.ficheiros, 1)
    const d = await cadeira(c1.id)
    const pag = d.materiais.find((m) => m.titulo === 'Página' && m.conteudo.includes('ok'))
    assert.ok(pag && !pag.conteudo.includes('<script') && !pag.conteudo.includes('onerror'))
    assert.equal(d.materiais.find((m) => m.titulo === 'Ligação').url, '')
    assert.equal(d.materiais.find((m) => m.titulo === 'Ficheiro').ficheiroId, null)
    assert.ok(!d.materiais.some((m) => m.titulo === 'Não existe'))
  })
})

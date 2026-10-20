import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { criarAmbiente, relogioFalso } from '../apoio/ambiente.js'
import { DOCX, docxComTexto, pdfComTexto } from '../apoio/documentos.js'

const NOVA = 'Portal2026segura'
// fonte em português (manual de referência) e o estudante a reescrevê-la com outras palavras
const REF_PT = 'A segurança marítima no Golfo da Guiné tornou-se uma das principais preocupações dos Estados costeiros da África Ocidental e Central. A pirataria, o tráfico de droga, a pesca ilegal e o roubo de combustível afectam directamente as economias da região e a segurança das rotas comerciais internacionais. A eficácia destes mecanismos depende, contudo, da capacidade das marinhas nacionais, que continuam a enfrentar limitações de meios, de formação e de financiamento.'
const PARAFRASE = 'A segurança no mar do Golfo da Guiné passou a ser uma das grandes preocupações dos Estados costeiros da África Ocidental e Central. A pirataria, o narcotráfico, a pesca ilegal e o furto de combustível afectam de forma directa as economias da região e a segurança das rotas comerciais internacionais. O êxito destes mecanismos depende, porém, da capacidade das marinhas nacionais, que ainda enfrentam limitações de meios, de formação e de financiamento.'
// fonte em inglês e o estudante a traduzi-la para português
const REF_EN = 'Hybrid warfare combines conventional military force with cyber attacks, disinformation campaigns and economic pressure to weaken an adversary without open war. Democracies are particularly vulnerable because their open media and political systems can be exploited by hostile actors seeking to divide public opinion.'
const TRADUZIDO = 'A guerra híbrida combina a força militar convencional com ataques cibernéticos, campanhas de desinformação e pressão económica para enfraquecer um adversário sem guerra aberta. As democracias são particularmente vulneráveis porque os seus meios de comunicação abertos e sistemas políticos podem ser explorados por actores hostis que procuram dividir a opinião pública.'
// o que o tradutor automático (simulado) devolve para cada frase do trabalho
const EM_INGLES = {
  'guerra híbrida combina': 'Hybrid war combines conventional military force with cyber attacks, disinformation campaigns and economic pressure to weaken an opponent without open war.',
  'democracias são': 'Democracies are particularly vulnerable because their open media and political systems can be exploited by hostile actors who seek to divide public opinion.',
}
const PROPRIO = 'No meu batalhão fizemos três exercícios com a protecção civil em Benguela e todos falharam no mesmo ponto: ninguém sabia quem coordenava o transporte das reservas. Proponho uma ficha única por província, revista em cada exercício, com nomes e telefones e não apenas cargos.'
const anexo = (b, nome, tipo = 'application/pdf') => [b, { filename: nome, contentType: tipo }]

describe('anti-plágio: paráfrase, tradução e PDF digitalizado (OCR)', () => {
  let amb, escola, prof
  const pedidosTradutor = []
  const ocrLidos = []
  const esperar = () => amb.contentor.servicos.integridade.esvaziar()

  before(async () => {
    const tradutor = {
      nome: 'Simulado',
      traduzirMapa: async (mapa, lingua) => {
        pedidosTradutor.push(lingua)
        if (lingua !== 'en') return {}
        return Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, Object.entries(EM_INGLES).find(([ini]) => v.toLowerCase().includes(ini))?.[1] ?? v]))
      },
    }
    // OCR simulado: a «digitalização» tem o texto do manual
    const ocr = Object.assign(async (caminho) => { ocrLidos.push(caminho); return `${REF_PT}\n\n${PROPRIO}` }, { disponivel: async () => true })
    amb = await criarAmbiente({ relogio: relogioFalso('2026-11-09T09:00:00Z'), externos: { tradutor, ocr, pesquisaWeb: null, claude: null } })
    escola = amb.com((await amb.criarUtilizador('secretaria')).token)
    const sec = amb.com((await amb.criarUtilizador('administrador')).token)
    await sec.post('/api/admin/academico/contas').send({ tipo: 'docente', nome: 'Docente Prof Teste', email: 'prof@esgfaa.gov.ao' })
    const r = await amb.http().post('/api/portal/entrar').send({ email: 'prof@esgfaa.gov.ao', senha: 'prof@esgfaa.gov.ao' })
    prof = amb.com((await amb.com(r.body.token).put('/api/portal/eu/senha').send({ atual: 'prof@esgfaa.gov.ao', nova: NOVA })).body.token)
    for (const [titulo, texto] of [['Segurança marítima', REF_PT], ['Hybrid warfare', REF_EN]]) {
      assert.equal((await escola.post('/api/admin/integridade/repositorio').field('titulo', titulo).attach('ficheiro', ...anexo(docxComTexto(texto), 'ref.docx', DOCX))).status, 201)
    }
  })
  after(() => amb.fechar())

  it('apanha a paráfrase (mesma língua) e a tradução (fonte em inglês), e diz o que verificou', async () => {
    const v = await prof.post('/api/portal/integridade').field('titulo', 'Ensaio').attach('ficheiro', ...anexo(docxComTexto(`${PARAFRASE}\n\n${TRADUZIDO}\n\n${PROPRIO}`), 'ensaio.docx', DOCX))
    assert.equal(v.status, 201, v.body.erro)
    await esperar()
    const rel = (await prof.get(`/api/portal/integridade/${v.body.id}`)).body
    assert.equal(rel.estado, 'concluida', rel.erro)
    const tipos = new Set(rel.trechos.map((t) => t.tipo))
    assert.ok(tipos.has('parafrase'), JSON.stringify(rel.trechos.map((t) => t.tipo)))
    assert.ok(tipos.has('traducao'))
    assert.deepEqual(rel.fontes.map((f) => f.titulo).sort(), ['Hybrid warfare', 'Segurança marítima'])
    // o texto próprio não conta: fica bem abaixo dos 100 %
    assert.ok(rel.percentagem > 40 && rel.percentagem < 90, String(rel.percentagem))
    const t = rel.trechos.find((x) => x.tipo === 'traducao')
    assert.match(t.excerto, /^Hybrid warfare|^Democracies/)
    assert.equal(rel.verificacoes.traducao.estado, 'feita')
    assert.deepEqual(rel.verificacoes.traducao.linguas, ['en'])
    assert.ok(rel.verificacoes.percentagens.parafrase > 0 && rel.verificacoes.percentagens.traducao > 0)
    assert.equal(rel.verificacoes.internet, 'sem-servico')
    assert.deepEqual([...new Set(pedidosTradutor)].sort(), ['en', 'fr'])
  })

  it('sem a paráfrase, a mesma reescrita conta muito menos (só os trechos que ficaram iguais)', async () => {
    const repo = amb.contentor.repositorios.integridade
    const d = await repo.gravarDocumento({ origem: 'verificacao', titulo: 'Reescrita', texto: PARAFRASE, palavras: 50, fonte: false, impressoes: [] })
    const opcoes = { excluirCitacoes: true, excluirReferencias: true, internet: false, ia: false }
    const sem = await repo.criarAnalise(d.id, { ...opcoes, parafrase: false })
    const com = await repo.criarAnalise(d.id, { ...opcoes, parafrase: true, traducao: false })
    await amb.contentor.servicos.integridade.retomar()
    await esperar()
    const [a, b] = [await repo.analise(sem.id), await repo.analise(com.id)]
    assert.ok(b.percentagem >= a.percentagem + 30, `${a.percentagem} -> ${b.percentagem}`)
    assert.equal(a.verificacoes.traducao.estado, 'desligada')
    assert.equal(a.verificacoes.parafrase, false)
  })

  it('PDF digitalizado (sem texto): o OCR lê-o e o relatório diz que foi lido por OCR', async () => {
    ocrLidos.length = 0
    const v = await prof.post('/api/portal/integridade').field('titulo', 'Digitalizado').attach('ficheiro', ...anexo(pdfComTexto(''), 'scan.pdf'))
    assert.equal(v.status, 201, v.body.erro)
    await esperar()
    assert.equal(ocrLidos.length, 1)
    const rel = (await prof.get(`/api/portal/integridade/${v.body.id}`)).body
    assert.equal(rel.estado, 'concluida', rel.erro)
    assert.equal(rel.verificacoes.ocr, true)
    assert.ok(rel.percentagem > 50, String(rel.percentagem))
  })
})

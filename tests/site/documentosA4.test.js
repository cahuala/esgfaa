/*
  Os documentos do Pessoal cabem na folha A4: gera cada um com uma ficha de dados compridos (nomes, unidades,
  cargos, muitos cursos, louvores e familiares) e mede cada texto, linha, rectângulo e imagem que vai para o PDF.
  Nada pode passar da folha nem ficar a menos de 5 mm do bordo (o que as impressoras já não imprimem).
*/
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({ docs: [], pessoa: null }))
const MARGEM_IMPRESSORA = 5

vi.mock('jspdf', async (original) => {
  const m = await original()
  function medir(doc) {
    doc.problemas = []
    const pagina = () => doc.getCurrentPageInfo().pageNumber
    const tamanho = () => ({ W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight() })
    const fora = (tipo, x0, y0, x1, y1, detalhe) => {
      const { W, H } = tamanho()
      const e = MARGEM_IMPRESSORA - 0.01
      if (x0 < e || y0 < e || x1 > W - e || y1 > H - e) doc.problemas.push({ pagina: pagina(), texto: `${tipo} [${x0.toFixed(1)}, ${y0.toFixed(1)} → ${x1.toFixed(1)}, ${y1.toFixed(1)}] ${detalhe ?? ''}`.trim() })
    }
    // uma página apagada (o documento volta a desenhar-se mais apertado para caber) leva os seus problemas
    const apagar = doc.deletePage
    doc.deletePage = function (n) {
      doc.problemas = doc.problemas.filter((x) => x.pagina !== n).map((x) => (x.pagina > n ? { ...x, pagina: x.pagina - 1 } : x))
      return apagar.call(this, n)
    }
    const texto = doc.text
    doc.text = function (t, x, y, o, ...r) {
      if (typeof x === 'number' && typeof y === 'number' && !o?.angle) {
        let linhas = (Array.isArray(t) ? t : [t]).flatMap((l) => String(l).split('\n'))
        if (o?.maxWidth) linhas = doc.splitTextToSize(linhas.join('\n'), o.maxWidth)
        const k = doc.internal.scaleFactor
        const alto = doc.getFontSize() / k
        const entre = (doc.getFontSize() * (o?.lineHeightFactor ?? doc.getLineHeightFactor())) / k
        linhas.forEach((l, i) => {
          if (!l.trim()) return
          const w = o?.align === 'justify' && o?.maxWidth ? Math.min(doc.getTextWidth(l), o.maxWidth) : doc.getTextWidth(l)
          const x0 = o?.align === 'center' ? x - w / 2 : o?.align === 'right' ? x - w : x
          const base = y + i * entre
          const cima = o?.baseline === 'middle' ? base - alto / 2 : o?.baseline === 'top' ? base : base - alto * 0.75
          fora('texto', x0, cima, x0 + w, cima + alto * 0.95, `«${l.slice(0, 50)}»`)
        })
      }
      return texto.call(this, t, x, y, o, ...r)
    }
    const linha = doc.line
    doc.line = function (x1, y1, x2, y2, ...r) { fora('linha', Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)); return linha.call(this, x1, y1, x2, y2, ...r) }
    const rect = doc.rect
    doc.rect = function (x, y, w, h, ...r) { if (w > 0 && h > 0) fora('rectângulo', x, y, x + w, y + h); return rect.call(this, x, y, w, h, ...r) }
    const imagem = doc.addImage
    doc.addImage = function (img, f, x, y, w, h, ...r) { if (typeof x === 'number') fora('imagem', x, y, x + w, y + h); return imagem.call(this, img, f, x, y, w, h, ...r) }
    doc.save = () => {}
  }
  class Medido extends m.jsPDF {
    constructor(...a) {
      super(...a)
      medir(this)
      estado.docs.push(this)
    }
  }
  return { ...m, jsPDF: Medido, default: Medido }
})

const COMANDANTE = { cargo: 'O Comandante da Escola Superior de Guerra', nome: 'Domingos Afonso Sebastião Kiala Manuel', posto: 'Tenente-General' }
vi.mock('../../src/pessoal/api', () => ({
  api: vi.fn(async (caminho) => (caminho.startsWith('/pessoas/') ? estado.pessoa : caminho === '/definicoes/assinaturas' ? { comandante: COMANDANTE, chefe: { cargo: 'O Chefe da Repartição de Pessoal e Quadros', nome: 'Rosa Maria Francisco Lopes da Conceição', posto: 'Coronel' } } : {})),
  urlFoto: vi.fn(async () => null),
}))

// no jsdom as imagens não carregam: o brasão e os logótipos ficam de fora (o lugar deles mede-se na mesma)
class ImagemQueFalha {
  set src(_) { setTimeout(() => this.onerror?.(), 0) }
}

const longo = (n) => 'Departamento de Planeamento, Organização e Coordenação do Ensino Superior Militar e da Investigação Científica'.slice(0, n)
const evento = (tipo, i, extra = {}) => ({ tipo, tipoNome: tipo, data: `20${String(5 + i).padStart(2, '0')}-0${(i % 9) + 1}-15`, descricao: `Pela dedicação exemplar, elevado espírito de sacrifício e competência técnica demonstrados no cumprimento das missões atribuídas (registo ${i + 1}).`, documento: `Ordem de Serviço n.º ${100 + i}/CEMGFAA/20${10 + i}`, entidade: 'Chefe do Estado Maior General das FAA', ...extra })

function fichaComprida(tipo = 'militar', extra = {}) {
  return {
    id: 4321, tipo, vinculo: 'funcionario', nome: 'Francisco Domingos Sebastião Kiala Manuel dos Santos Neto', nomeGuerra: 'Kiala',
    nip: '0012345678', numeroAgente: '1234567890', bi: '001234567LA041', biLocalEmissao: 'Luanda', biEmitidoEm: '2018-03-12', biValidade: '2028-03-12',
    ramo: 'exercito', ramoNome: 'Exército', posto: 'tenente_coronel', postoNome: 'Tenente-Coronel', postoAbreviatura: 'TCor', quadroEspecial: 'infantaria', quadroNome: 'Quadro Especial de Infantaria e Comandos',
    fps: 'qp', fpsNome: 'Quadro Permanente', situacaoNome: 'Activo', situacaoCaminho: 'Activo › Em efectividade › Comissão normal', estadoNome: 'Ao serviço',
    categoriaCivil: 'Técnico Superior Principal de 1.ª Classe', categoriaNome: 'Técnico Superior Principal', carreiraNome: 'Carreira Técnica Superior', vinculoCivilNome: 'Contrato por tempo indeterminado', dataCategoria: '2016-05-01',
    unidadeNome: longo(90), cargoNome: 'Chefe do Departamento de Planeamento e Coordenação do Ensino Superior Militar', funcaoActual: '',
    dataNascimento: '1975-08-21', idade: 51, genero: 'M', estadoCivil: 'casado', nacionalidade: 'Angolana', paisNascimento: 'Angola', naturalidade: 'Mbanza Kongo', provincia: 'Zaire', municipio: 'Mbanza Kongo', comuna: 'Kiende',
    pai: 'Sebastião Domingos Kiala Manuel dos Santos', mae: 'Maria da Conceição Francisco Lopes Neto', conjuge: 'Teresa Joana Fernandes da Silva Kiala', conjugeLocalServico: 'Hospital Militar Principal / Instituto Superior',
    morada: 'Rua Comandante Gika, n.º 125, 3.º andar, apartamento 12, Bairro Alvalade, Luanda', bairro: 'Alvalade', rua: 'Rua Comandante Gika', casa: '125', caixaPostal: '1234', telefone: '+244 923 456 789', telefoneAlternativo: '+244 912 345 678',
    email: 'francisco.kiala.neto@esgfaa.gov.ao', emailPessoal: 'francisco.kiala.neto.pessoal@gmail.com', habilitacao: 'mestrado', habilitacaoNome: 'Mestrado', areaFormacao: 'Ciências Militares e Estudos Estratégicos de Segurança e Defesa',
    especialidade: 'Infantaria, Comandos e Operações Especiais', grupoSanguineo: 'O+', inss: '123456789', iban: 'AO06 0040 0000 1234 5678 9012 3', banco: 'BAI', numeroConta: '1234567890123',
    dataIngresso: '1993-02-01', dataIngressoQP: '1998-11-11', dataAntiguidadePosto: '2019-11-11', dataAdmissao: '2001-04-02', dataEntradaEscola: '2015-01-10', tempoServico: 33.6, tempoNoPosto: 7, localIncorporacao: 'Centro de Instrução Militar de Cabo Ledo',
    voluntario: true, aptidaoFisica: true, processoPendente: false, vencimento: 1234567.89, vencimentoTabela: { liquido: 1234567.89 }, remuneracao: { liquido: 987654.32 }, diasFerias: 30,
    observacoes: 'Militar com elevado sentido de responsabilidade; participou em várias missões de manutenção de paz e em exercícios conjuntos com a SADC.',
    processo: { numero: 'PI-2026/00123', estante: 'B', prateleira: '4', posicao: '17' },
    promocao: { elegivel: true, postoPropostoNome: 'Coronel' },
    cursos: [
      ...Array.from({ length: 6 }, (_, i) => ({ tipo: 'militar', nome: `Curso de Comando e Estado-Maior Conjunto das Forças Armadas (edição ${i + 1})`, local: 'Escola Superior de Guerra, Luanda', inicio: `20${10 + i}-01-10`, fim: `20${10 + i}-07-20`, classificacao: 16, aproveitamento: true })),
      { tipo: 'promocao', nome: 'Curso de Promoção a Oficial Superior', local: 'Academia Militar do Exército', fim: '2018-06-30', aproveitamento: true },
      { tipo: 'academico', nome: 'Licenciatura em Relações Internacionais e Estudos Diplomáticos', local: 'Universidade Agostinho Neto', fim: '2005-07-30' },
      { tipo: 'academico', nome: 'Mestrado em Ciências Militares e Estudos Estratégicos', local: 'Instituto de Estudos Superiores Militares, Lisboa', fim: '2012-07-30' },
    ],
    eventos: [
      ...Array.from({ length: 6 }, (_, i) => evento('promocao', i, { postoNovoNome: ['Alferes', 'Tenente', 'Capitão', 'Major', 'Tenente-Coronel', 'Coronel'][i] })),
      ...Array.from({ length: 6 }, (_, i) => evento('nomeacao', i, { cargoNome: `Chefe da Secção de Operações e Planeamento do Batalhão de Infantaria n.º ${i + 10}` })),
      ...Array.from({ length: 5 }, (_, i) => evento(['louvor', 'referencia_elogiosa', 'condecoracao'][i % 3], i)),
      ...Array.from({ length: 4 }, (_, i) => evento(['punicao', 'condenacao'][i % 2], i, { pena: '5 dias de detenção', classe: '2.ª' })),
    ],
    agregado: Array.from({ length: 8 }, (_, i) => ({ nome: `Filho(a) Kiala Manuel dos Santos Neto número ${i + 1}`, parentesco: i ? 'Filho(a)' : 'Cônjuge', dataNascimento: `20${String(i + 2).padStart(2, '0')}-04-10`, bi: '00765432LA04' + i })),
    registo: {
      comuna: 'Kiende',
      estudos: Array.from({ length: 6 }, (_, i) => ({ classe: `${i + 7}.ª classe`, ano: String(1990 + i) })),
      linguas: [{ lingua: 'Inglês', nivel: 'Bom' }, { lingua: 'Francês', nivel: 'Razoável' }, { lingua: 'Português', nivel: 'Muito bom' }, { lingua: 'Kikongo', nivel: 'Muito bom' }],
      locaisAnteriores: Array.from({ length: 3 }, (_, i) => ({ local: 'Ministério da Defesa Nacional e dos Veteranos da Pátria', de: `200${i}-01-01`, ate: `200${i + 1}-01-01`, profissao: 'Técnico de planeamento e estatística' })),
      colocacoes: Array.from({ length: 6 }, (_, i) => ({ categoria: 'Técnico Superior de 1.ª Classe', despacho: `Despacho n.º ${10 + i}/2020`, data: '2020-01-01', dr: 'I Série n.º 12', inicio: '2020-02-01', situacao: 'Efectivo', colocacao: 'Repartição de Pessoal e Quadros', responsabilidade: 'Chefe de Secção' })),
      situacaoMilitar: { tipo: 'Disponibilidade', desde: '2000-01-01', reiniciou: '2001-01-01' },
      saude: { dador: true, defeitoFisico: 'Nenhum', doencas: 'Nenhuma doença crónica conhecida até à data' },
      classificacoes: Array.from({ length: 3 }, (_, i) => ({ ano: String(2023 + i), classificacao: 'Muito Bom' })),
      assiduidade: Array.from({ length: 16 }, (_, i) => ({ ano: String(2010 + i), faltas: i % 3 })),
      outrasInformacoes: 'Participou em comissões de serviço no estrangeiro e em grupos de trabalho interministeriais sobre a reforma do ensino superior militar. '.repeat(3),
    },
    planoFerias: [{ ano: 2026, inicio: '2026-12-01', fim: '2026-12-30' }],
    docente: true, tipoDocente: 'efectivo', categoriaDocente: 'Professor auxiliar', discente: false, cursosDiscente: [],
    ...extra,
  }
}

const OPCOES = {
  valor: 1234567.89, finalidade: 'Efeitos de crédito bancário junto do Banco Angolano de Investimentos para aquisição de habitação própria', data: '2026-11-11',
  curso: 'Curso de Comando e Direcção Conjunto das Forças Armadas Angolanas', comVencimento: 'Sim', numero: 1234, ano: 2026,
  inicio: '2026-12-01', fim: '2026-12-30', dias: 30, motivo: 'Assuntos pessoais e familiares de natureza urgente na província do Zaire', provincia: 'Zaire',
  destino: 'Direcção de Pessoal e Quadros do Estado Maior General das Forças Armadas Angolanas', sigla: 'DPQ/EMGFAA',
  referencia: 'Ofício n.º 7028/11.RGC/DPPQ/EMGFAA/2025, Fim da CNS no EMG de Sargento do Exército', fundamento: 'Por ter transitado à condição de Inactividade Temporária, na base da Ordem n.º 17/CEMGFAA/2024.',
  cargoProposto: 'Chefe do Departamento de Ensino e Investigação Científica da Escola Superior de Guerra', unidadeProposta: 'Escola Superior de Guerra', banco: 'bfa_credito',
}
const QUEM = { comandante: COMANDANTE, nome: 'Rosa Maria Francisco Lopes da Conceição', posto: 'Coronel', local: 'Luanda' }

const problemas = () => estado.docs.flatMap((d) => d.problemas.map((x) => `p.${x.pagina} ${x.texto}`))

beforeAll(() => { globalThis.Image = ImagemQueFalha })
afterEach(() => { estado.docs.length = 0 })

describe('documentos do Pessoal cabem na folha A4', async () => {
  const { CATALOGO } = await import('../../src/pessoal/docPessoal/index.js')
  const { novoDocumento } = await import('../../src/pessoal/docPessoal/base.js')
  const PESSOAS = {
    militar: fichaComprida('militar'),
    'militar discente': fichaComprida('militar', { vinculo: 'estudante', discente: true }),
    civil: fichaComprida('civil'),
    domiciliar: fichaComprida('civil', { vinculo: 'domiciliar', militarAlocado: { nome: 'Francisco Domingos Sebastião Kiala Manuel', postoNome: 'Tenente-General', cargoNome: 'Comandante da Escola Superior de Guerra' } }),
  }
  for (const c of CATALOGO) {
    for (const [quem, p] of Object.entries(PESSOAS)) {
      if (!c.para(p) && !c.proposta) continue
      it(`${c.nome} (${quem})`, async () => {
        const d = await novoDocumento()
        await c.desenhar(d, p, { ...OPCOES, variante: undefined }, QUEM)
        expect(problemas()).toEqual([])
      })
    }
  }

  it('síntese biográfica, referência elogiosa, etiqueta, fichas de proposta e contas', async () => {
    const doc = await import('../../src/pessoal/documentos.js')
    const p = fichaComprida('militar')
    estado.pessoa = p
    await doc.sinteseBiografica(p)
    await doc.referenciaElogiosa(p, evento('referencia_elogiosa', 3))
    await doc.etiquetaProcesso(p)
    await doc.fichasDeProposta({ id: 77, tipo: 'promocao', titulo: 'Promoções de 2026 — oficiais superiores do Quadro Permanente', fundamentacao: 'Cumpre as condições da Lei n.º 13/18. '.repeat(6), itens: [{ pessoaId: p.id, postoPropostoNome: 'Coronel', modalidadeNome: 'Escolha', justificacao: 'Excelente desempenho. '.repeat(10), verificacao: { condicoes: Array.from({ length: 8 }, (_, i) => ({ texto: 'Tempo mínimo de permanência no posto cumprido', detalhe: 'Desde 11/11/2019', artigo: `Art. ${50 + i}.º`, estado: 'ok' })) } }] })
    await doc.credenciaisPdf(Array.from({ length: 40 }, (_, i) => ({ nome: `Francisco Domingos Sebastião Kiala Manuel ${i}`, entrar: `00123456${i}`, senha: 'Abcdef123456' })))
    expect(problemas()).toEqual([])
  })

  it('listas e mapas (tabelas) com muitas colunas e textos compridos', async () => {
    const { documentoPdf } = await import('../../src/pessoal/exportar.js')
    const colunas = ['N.º', 'NIP', 'Posto', 'Nome', 'Unidade', 'Cargo', 'Situação', 'Habilitações'].map((titulo, i) => ({ titulo, valor: (l) => l[i] }))
    colunas.push({ titulo: 'Nascimento', data: true, valor: () => '1975-08-21' }, { titulo: 'Ingresso', data: true, valor: () => '1993-02-01' })
    const linhas = Array.from({ length: 60 }, (_, i) => [i + 1, '0012345678', 'Tenente-Coronel', 'Francisco Domingos Sebastião Kiala Manuel dos Santos Neto', longo(90), 'Chefe do Departamento de Planeamento e Coordenação', 'Activo › Em efectividade › Comissão normal', 'Mestrado em Ciências Militares'])
    await documentoPdf({ titulo: 'Lista de efectividade', subtitulo: 'Todas as unidades', seccoes: [{ titulo: 'Oficiais', colunas, linhas }] })
    await documentoPdf({ titulo: 'Mapa de controlo estatístico', modelo: 'Mod. 2/DPQ', orientacao: 'portrait', seccoes: [{ titulo: 'Efectivo', colunas, linhas }] })
    expect(problemas()).toEqual([])
  })
})

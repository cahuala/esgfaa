/*
  «Descarregar os meus dados» (Portal e Pessoal, Lei n.º 22/11): o que a API devolve passa a um livro de
  Excel que qualquer pessoa lê — uma folha de resumo e uma folha por tipo de dados (matrículas, notas,
  mensagens, agregado familiar…), com os cabeçalhos em português, as datas em dd/mm/aaaa e Sim/Não.
  Os identificadores internos da base de dados ficam de fora (não dizem nada a quem lê).
*/

const PALAVRAS = {
  numero: 'número', titulo: 'título', codigo: 'código', situacao: 'situação', descricao: 'descrição', conteudo: 'conteúdo',
  questionario: 'questionário', inicio: 'início', funcao: 'função', area: 'área', provincia: 'província', municipio: 'município',
  telemovel: 'telemóvel', nivel: 'nível', vinculo: 'vínculo', vinculos: 'vínculos', mae: 'mãe', conjuge: 'cônjuge', genero: 'género',
  habilitacao: 'habilitação', formacao: 'formação', incorporacao: 'incorporação', emissao: 'emissão', sanguineo: 'sanguíneo',
  profissao: 'profissão', servico: 'serviço', classificacao: 'classificação', promocao: 'promoção', nomeacao: 'nomeação',
  renovacoes: 'renovações', posicao: 'posição', observacao: 'observação', observacoes: 'observações', correcao: 'correção',
  comentario: 'comentário', anotacoes: 'anotações', ligacao: 'ligação', notificacoes: 'notificações', matriculas: 'matrículas', inscricoes: 'inscrições',
  emprestimos: 'empréstimos', ultimo: 'último', ultima: 'última', sessao: 'sessão', as: 'às', pais: 'país', avaliacao: 'avaliação',
  presencas: 'presenças', previsao: 'previsão', devolucao: 'devolução', endereco: 'endereço', residencia: 'residência', orgao: 'órgão',
  habilitacoes: 'habilitações', conclusao: 'conclusão', categoria: 'categoria', lingua: 'língua', publico: 'público',
  licencas: 'licenças', ferias: 'férias', mes: 'mês', voluntario: 'voluntário', favoravel: 'favorável', aptidao: 'aptidão',
  fisica: 'física', proximo: 'próximo', elegivel: 'elegível', condicoes: 'condições', condicao: 'condição', representacao: 'representação',
  iliquido: 'ilíquido', liquido: 'líquido', psiquica: 'psíquica', antiguidade: 'antiguidade', biblioteca: 'da biblioteca',
  bi: 'BI', nip: 'NIP', iban: 'IBAN', inss: 'INSS', qp: 'QP', fps: 'FPS', email: 'e-mail', p1: 'P1', p2: 'P2',
}

// criadoEm -> «Criado em»; acessosAsCadeiras -> «Acessos às cadeiras»
export function rotulo(chave) {
  const palavras = String(chave).replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase().split(/\s+/).filter(Boolean)
  const t = palavras.map((p) => PALAVRAS[p] ?? p).join(' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const interno = (k) => k === 'id' || /Id$/.test(k) || k === 'fotoCaminho'
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
// só se abrem em colunas os objetos com campos com nome (não as grelhas 0, 1, 2… nem as chaves internas)
const comCampos = (v) => objeto(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => /^[a-z][a-zA-Z]*$/.test(k))
const dois = (n) => String(n).padStart(2, '0')

// o valor como aparece na folha: datas legíveis, Sim/Não, listas numa só célula
export function valor(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return v.map((x) => (objeto(x) ? Object.entries(x).filter(([k]) => !interno(k)).map(([, y]) => valor(y)).filter((y) => y !== null).join(' / ') : valor(x))).filter((x) => x !== null && x !== '').join('; ') || null
  if (objeto(v)) return Object.values(v).map(valor).filter((x) => x !== null).join('; ') || null
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    if (/T00:00:00(\.000)?Z$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`
    return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`
  }
  return s
}

// uma linha: os objetos dentro ficam em colunas «Turma (nome)»; os outros (grelhas, anotações) numa célula
function achatar(o, pai = '', r = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (interno(k)) continue
    const nome = pai ? `${pai} (${rotulo(k).toLowerCase()})` : rotulo(k)
    if (comCampos(v)) achatar(v, nome, r)
    else r[nome] = valor(v)
  }
  return r
}

// uma tabela: as colunas pela ordem em que aparecem; as que estão sempre vazias saem
function tabela(itens) {
  const linhas = itens.map((x) => (objeto(x) ? achatar(x) : { Valor: valor(x) }))
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter((c) => linhas.some((l) => l[c] !== null && l[c] !== undefined))
  return { colunas, linhas: linhas.map((l) => colunas.map((c) => l[c] ?? null)) }
}

/*
  dados (o que /eu/dados devolve) -> { resumo: [[rótulo, valor]], folhas: [{ nome, colunas, linhas }] }.
  Listas -> uma folha cada; objetos -> uma folha «campo / valor» (as listas dentro, como o agregado
  familiar, têm a sua folha); { total } e valores soltos -> no resumo.
*/
export function folhasDosDados(dados) {
  const resumo = []
  const folhas = []
  const lista = (nome, itens) => {
    resumo.push([nome, itens.length])
    if (itens.length) folhas.push({ nome, ...tabela(itens) })
  }
  for (const [k, v] of Object.entries(dados ?? {})) {
    if (k === 'aviso' || k === 'geradoEm') continue
    const nome = rotulo(k)
    if (Array.isArray(v)) lista(nome, v)
    else if (objeto(v)) {
      const chaves = Object.keys(v)
      if (chaves.length === 1 && chaves[0] === 'total') { resumo.push([nome, v.total]); continue }
      // { enviadas: [], recebidas: [] } -> «Mensagens enviadas», «Mensagens recebidas»
      const soListas = chaves.every((y) => Array.isArray(v[y]))
      const campos = []
      for (const [c, x] of Object.entries(v)) {
        if (interno(c)) continue
        if (Array.isArray(x) && (x.some(objeto) || soListas)) lista(soListas ? `${nome} ${rotulo(c).toLowerCase()}` : rotulo(c), x)
        else if (comCampos(x)) for (const [n, y] of Object.entries(achatar(x, rotulo(c)))) campos.push([n, y])
        else campos.push([rotulo(c), valor(x)])
      }
      const cheios = campos.filter(([, x]) => x !== null)
      if (cheios.length) folhas.unshift({ nome, colunas: ['Campo', 'Valor'], linhas: cheios })
    } else resumo.push([nome, valor(v)])
  }
  return { resumo, folhas }
}

// nome de folha válido no Excel (31 caracteres, sem []:*?/\) e sem repetir
function nomesDasFolhas(nomes) {
  const usados = new Set()
  return nomes.map((n) => {
    const base = n.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
    let r = base
    for (let i = 2; usados.has(r.toLowerCase()); i++) r = `${base.slice(0, 27)} (${i})`
    usados.add(r.toLowerCase())
    return r
  })
}

const celula = (v) => (v === null || v === undefined ? null : typeof v === 'number' ? { value: v, type: Number } : { value: String(v), type: String })
const cabecalho = (t) => ({ value: t, fontWeight: 'bold', backgroundColor: '#1f3a2d', textColor: '#ffffff' })
const largura = (colunas, linhas) => colunas.map((c, i) => ({ width: Math.min(60, Math.max(String(c).length, ...linhas.slice(0, 300).map((l) => String(l[i] ?? '').length)) + 2) }))

// descarrega o livro de Excel; titulo vai na primeira folha e no nome do ficheiro
export async function descarregarMeusDados(dados, { titulo = 'Os meus dados', sistema = '' } = {}) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const { resumo, folhas } = folhasDosDados(dados)
  const nomes = nomesDasFolhas(['Resumo', ...folhas.map((f) => f.nome)])
  const topo = [
    [{ value: titulo, fontWeight: 'bold', fontSize: 14 }],
    ...(sistema ? [[celula(sistema)]] : []),
    ...(dados?.aviso ? [[celula(dados.aviso)]] : []),
    ...(dados?.geradoEm ? [[celula(`Gerado em ${valor(dados.geradoEm)}`)]] : []),
    [],
    [cabecalho('Dados'), cabecalho('Registos')],
    ...resumo.map(([n, v]) => [celula(n), celula(v)]),
  ]
  const livro = [
    { data: topo, sheet: nomes[0], columns: [{ width: 40 }, { width: 14 }] },
    ...folhas.map((f, i) => ({
      data: [f.colunas.map(cabecalho), ...f.linhas.map((l) => l.map(celula))],
      sheet: nomes[i + 1],
      columns: largura(f.colunas, f.linhas),
      stickyRowsCount: 1,
    })),
  ]
  await writeXlsxFile(livro).toFile(`os-meus-dados-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

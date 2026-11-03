/*
  O que cada conta pode fazer, ecrã a ecrã (área): «ver» e/ou «alterar». O papel dá o ponto de partida
  (os mesmos direitos de sempre); o administrador afina conta a conta, com o despacho do Comandante.
  Das áreas saem as permissões largas que os serviços verificam (ver, editar, propor, decidir, administrar,
  supervisionar, despachar); a verificação de cada rota (rotaDaArea) garante que só se mexe no ecrã dado.
  Expediente, mensagens e a própria conta ficam sempre (COMUNS).
*/
export const COMUNS = ['expediente', 'mensagens']

// ver / alterar: as permissões largas que dão; soVer / soAlterar: a área só tem um dos níveis
export const AREAS = {
  fichas: { grupo: 'Pessoal', nome: 'Fichas do pessoal (militares e civis, domiciliares, colocar civis nos cargos)', alterar: ['editar'] },
  academicos: { grupo: 'Pessoal', nome: 'Estudantes e docentes (registo, fichas de acesso ao portal)', alterar: ['editar'] },
  importar: { grupo: 'Pessoal', nome: 'Importar Excel e fotografias', soAlterar: true, alterar: ['editar'] },
  processos: { grupo: 'Pessoal', nome: 'Processos individuais e documentos digitalizados', alterar: ['editar'] },
  propostas: { grupo: 'Carreiras', nome: 'Propostas e extractos (preparar e submeter)', alterar: ['propor', 'editar'] },
  decidirPropostas: { grupo: 'Carreiras', nome: 'Decidir as propostas (aprovar ou rejeitar)', soAlterar: true, alterar: ['decidir'] },
  carreiras: { grupo: 'Carreiras', nome: 'Em condições de promoção, antiguidade, reserva e reforma', soVer: true },
  licencas: { grupo: 'Carreiras', nome: 'Licenças e plano de férias', alterar: ['editar'] },
  ausencias: { grupo: 'Carreiras', nome: 'Faltas e ausências (militares e civis)', alterar: ['editar'] },
  ponto: { grupo: 'Carreiras', nome: 'Livro de ponto (civis): o dia, o mês, marcações e faltas', alterar: ['editar'] },
  pontoAparelhos: { grupo: 'Carreiras', nome: 'Livro de ponto: aparelhos de impressão digital e horário', soAlterar: true, alterar: ['editar', 'administrar'] },
  salarios: { grupo: 'Carreiras', nome: 'Tabelas salariais (militares e civis)', alterar: ['administrar'] },
  documentos: { grupo: 'Documentos', nome: 'Declarações, mapas, listas e histórico dos efectivos', alterar: ['editar'] },
  organica: { grupo: 'Organização', nome: 'Orgânica: unidades, cargos e o quadro orgânico', alterar: ['administrar'] },
  secretaria: { grupo: 'Comunicação', nome: 'Secretária digital (despachar como o Comandante)', soAlterar: true, alterar: ['despachar'] },
  utilizadores: { grupo: 'Administração', nome: 'Utilizadores e permissões', ver: ['supervisionar'], alterar: ['administrar'] },
  auditoria: { grupo: 'Administração', nome: 'Auditoria e livro de expediente', soVer: true, ver: ['supervisionar'] },
  configuracoes: { grupo: 'Administração', nome: 'Listas do sistema, assinaturas e ligação ao portal', alterar: ['administrar'] },
  privacidade: { grupo: 'Administração', nome: 'Pedidos sobre dados pessoais (Lei n.º 22/11)', alterar: ['editar'] },
}

const todas = (nivel, excepto = []) => Object.fromEntries(Object.keys(AREAS).filter((a) => !excepto.includes(a)).map((a) => [a, AREAS[a].soVer ? 'ver' : AREAS[a].soAlterar ? 'alterar' : nivel]))
const TRABALHO = ['fichas', 'academicos', 'importar', 'processos', 'propostas', 'licencas', 'ausencias', 'ponto', 'documentos', 'privacidade']
const verTudo = (excepto) => Object.fromEntries(Object.keys(AREAS).filter((a) => !excepto.includes(a) && !AREAS[a].soAlterar).map((a) => [a, 'ver']))

// o ponto de partida de cada papel (dá as mesmas permissões que o papel sempre deu)
export const MODELOS = {
  administrador: todas('alterar', ['secretaria']),
  chefe: { ...verTudo([]), ...Object.fromEntries(TRABALHO.map((a) => [a, 'alterar'])), decidirPropostas: 'alterar' },
  comandante: { ...verTudo([]), secretaria: 'alterar' },
  operador: { ...verTudo(['utilizadores', 'auditoria']), ...Object.fromEntries(TRABALHO.map((a) => [a, 'alterar'])) },
  consulta: verTudo(['utilizadores', 'auditoria']),
  utente: {},
}

// as áreas da conta: as escolhidas para ela ou, se nunca se mudaram, as do papel
export function areasDe(u) {
  const proprias = u?.permissoes && typeof u.permissoes === 'object' && !Array.isArray(u.permissoes) ? u.permissoes : null
  return proprias ?? MODELOS[u?.papel] ?? {}
}

// as permissões largas que as áreas dão
export function permissoesDe(u) {
  const p = new Set(COMUNS)
  for (const [a, nivel] of Object.entries(areasDe(u))) {
    const d = AREAS[a]
    if (!d || !nivel) continue
    p.add('ver')
    for (const x of d.ver ?? []) p.add(x)
    if (nivel === 'alterar') for (const x of d.alterar ?? []) p.add(x)
  }
  return [...p]
}

// limpa um conjunto de áreas vindo do formulário (só áreas e níveis que existem)
export function limparAreas(v) {
  const r = {}
  for (const [a, nivel] of Object.entries(v ?? {})) {
    const d = AREAS[a]
    if (!d || !['ver', 'alterar'].includes(nivel)) continue
    if (d.soVer && nivel === 'alterar') r[a] = 'ver'
    else if (d.soAlterar) r[a] = 'alterar'
    else r[a] = nivel
  }
  return r
}

/*
  Cada rota da API e a área (ou áreas: basta uma) que precisa. Nas leituras (GET) chega «ver»; nas escritas,
  «alterar». As leituras partilhadas (listas de pessoas, unidades, cargos…) não têm área: servem vários ecrãs
  e os serviços já pedem «ver». LIVRES: o que qualquer conta faz (a própria conta, expediente, mensagens).
*/
// leitura: uma escrita que só consulta (ex.: verificar uma licença antes de a marcar) — chega «ver»
const R = (metodo, caminho, areas, leitura = false) => ({ metodo, re: new RegExp(`^${caminho.replace(/:[a-z]+/g, '[^/]+')}$`), areas: [].concat(areas), leitura: leitura || metodo === 'GET' })
export const LIVRES = [/^\/eu(\/|$)/, /^\/mudar-senha$/, /^\/sair$/, /^\/eventos$/, /^\/avisos$/, /^\/referencias$/, /^\/expediente(\/|$)/, /^\/anexos\//, /^\/mensagens\//]
export const ROTAS = [
  // leituras partilhadas por vários ecrãs
  R('GET', '/painel', null), R('GET', '/pessoas', null), R('GET', '/pessoas/:id', null), R('GET', '/pessoas/:id/foto', null), R('GET', '/unidades', null), R('GET', '/cargos', null),
  R('GET', '/organica', null), R('GET', '/organica/:id', null), R('GET', '/listas', null), R('GET', '/definicoes/assinaturas', null), R('GET', '/pedidos-despacho', null),
  R('GET', '/domiciliares', null), R('GET', '/academicos', ['academicos', 'fichas']), R('GET', '/propostas/itens', null),
  // pessoal
  R('POST', '/pessoas', ['fichas', 'academicos']), R('PUT', '/pessoas/:id', ['fichas', 'academicos']), R('GET', '/bi/:numero', ['fichas', 'academicos']),
  R('POST', '/pessoas/:id/cursos', 'fichas'), R('PUT', '/pessoas/:id/cursos/:sub', 'fichas'), R('DELETE', '/pessoas/:id/cursos/:sub', 'fichas'),
  R('POST', '/pessoas/:id/eventos', 'fichas'), R('DELETE', '/pessoas/:id/eventos/:sub', 'fichas'), R('POST', '/pessoas/:id/graduacoes/:sub/terminar', 'fichas'),
  R('PUT', '/pessoas/:id/foto', ['fichas', 'academicos']), R('POST', '/cargos/:id/colocar', 'fichas'), R('POST', '/cargos/:id/retirar', 'fichas'),
  R('POST', '/pessoas/importar', 'importar'), R('POST', '/fotos/lote', 'importar'),
  R('POST', '/fichas-acesso', 'academicos'), R('POST', '/pessoas/:id/ficha-acesso', 'academicos'),
  R('GET', '/processos', 'processos'), R('PUT', '/processos/:id', 'processos'), R('GET', '/pessoas/:id/documentos', 'processos'), R('POST', '/pessoas/:id/documentos', 'processos'),
  R('GET', '/documentos/:id/ficheiro', 'processos'), R('DELETE', '/documentos/:id', 'processos'),
  // carreiras
  R('GET', '/carreira/antiguidade', 'carreiras'), R('GET', '/carreira/elegiveis', ['carreiras', 'propostas']), R('GET', '/carreira/reserva', 'carreiras'),
  R('GET', '/propostas', 'propostas'), R('POST', '/propostas', 'propostas'), R('GET', '/propostas/:id', ['propostas', 'decidirPropostas', 'secretaria']), R('PUT', '/propostas/:id', 'propostas'),
  R('POST', '/propostas/:id/itens', 'propostas'), R('PUT', '/propostas/:id/itens/:sub', 'propostas'), R('DELETE', '/propostas/:id/itens/:sub', 'propostas'),
  R('POST', '/propostas/:id/anexos', 'propostas'), R('GET', '/propostas/anexos/:id/ficheiro', ['propostas', 'decidirPropostas', 'secretaria']), R('DELETE', '/propostas/anexos/:id', 'propostas'),
  R('POST', '/propostas/:id/submeter', 'propostas'), R('POST', '/propostas/:id/cancelar', 'propostas'),
  R('POST', '/propostas/:id/indeferir', 'decidirPropostas'), R('POST', '/propostas/:id/devolver', 'decidirPropostas'),
  R('GET', '/extractos', 'propostas'), R('POST', '/extractos', 'propostas'), R('GET', '/extractos/:id', 'propostas'), R('GET', '/extractos/:id/ficheiro', 'propostas'),
  R('POST', '/extractos/:id/itens', 'propostas'), R('PUT', '/extractos/:id/itens/:sub', 'propostas'), R('DELETE', '/extractos/:id/itens/:sub', 'propostas'),
  R('POST', '/extractos/:id/aplicar', 'propostas'), R('DELETE', '/extractos/:id', 'propostas'),
  R('GET', '/licencas', 'licencas'), R('POST', '/licencas/verificar', 'licencas', true), R('POST', '/licencas', 'licencas'), R('DELETE', '/licencas/:id', 'licencas'),
  R('GET', '/plano-ferias', 'licencas'), R('PUT', '/plano-ferias', 'licencas'), R('POST', '/plano-ferias/importar', 'licencas'),
  R('GET', '/ausencias', 'ausencias'), R('POST', '/ausencias', 'ausencias'), R('PUT', '/ausencias/:id', 'ausencias'), R('DELETE', '/ausencias/:id', 'ausencias'),
  R('GET', '/faltas-civis', 'ausencias'), R('PUT', '/faltas-civis', 'ausencias'),
  R('GET', '/ponto/livro', 'ponto'), R('GET', '/ponto/mes', 'ponto'), R('POST', '/ponto/marcacoes', 'ponto'), R('DELETE', '/ponto/marcacoes/:id', 'ponto'), R('POST', '/ponto/faltas', 'ponto'),
  R('GET', '/ponto/horario', ['ponto', 'pontoAparelhos']), R('PUT', '/ponto/horario', 'pontoAparelhos'), R('GET', '/ponto/aparelhos', ['ponto', 'pontoAparelhos']), R('PUT', '/ponto/aparelhos/:id', 'pontoAparelhos'), R('DELETE', '/ponto/aparelhos/:id', 'pontoAparelhos'),
  R('POST', '/ponto/aparelhos/:id/enviar-pessoal', ['ponto', 'pontoAparelhos']), R('POST', '/ponto/aparelhos/:id/digital', ['ponto', 'pontoAparelhos']),
  R('GET', '/tabela-salarial', 'salarios'), R('PUT', '/tabela-salarial/:posto', 'salarios'), R('GET', '/tabela-salarial-civis', 'salarios'), R('PUT', '/tabela-salarial-civis/:categoria', 'salarios'),
  R('GET', '/tabela-salarial-civis/cargos', 'salarios'), R('PUT', '/tabela-salarial-civis/cargos', 'salarios'),
  // documentos
  R('GET', '/declaracoes', 'documentos'), R('POST', '/declaracoes/impressoes', 'documentos'), R('GET', '/pessoas/:id/documentos-emitidos', 'documentos'), R('POST', '/pessoas/:id/documentos-emitidos', 'documentos'),
  // organização
  R('POST', '/organica/importar', 'organica'), R('POST', '/unidades', 'organica'), R('PUT', '/unidades/:id', 'organica'), R('DELETE', '/unidades/:id', 'organica'),
  R('POST', '/cargos', 'organica'), R('PUT', '/cargos/:id', 'organica'), R('DELETE', '/cargos/:id', 'organica'),
  // Comandante
  R('GET', '/secretaria', 'secretaria'), R('POST', '/pedidos-despacho/:id/decidir', 'secretaria'), R('POST', '/propostas/:id/despachar', 'secretaria'),
  // administração
  R('GET', '/utilizadores', ['utilizadores', 'secretaria']), R('POST', '/utilizadores', 'utilizadores'), R('PUT', '/utilizadores/:id', 'utilizadores'), R('POST', '/utilizadores/contas-pessoas', 'utilizadores'),
  R('POST', '/utilizadores/:id/2fa/repor', 'utilizadores'),
  // o Comandante escolhe o que cada conta pode fazer (e vê a lista das contas)
  R('PUT', '/utilizadores/:id/permissoes', 'secretaria'),
  R('GET', '/auditoria', 'auditoria'),
  // o registo de cada exportação para Excel/PDF (de qualquer tabela, de qualquer ecrã)
  R('POST', '/auditoria/exportacao', null),
  R('PUT', '/listas/:id', 'configuracoes'), R('POST', '/listas/:id/repor', 'configuracoes'), R('PUT', '/definicoes/assinaturas', 'configuracoes'),
  R('GET', '/portal', 'configuracoes'), R('POST', '/portal/enviar', 'configuracoes'), R('POST', '/portal/reenviar-todos', 'configuracoes'),
  R('GET', '/privacidade/pedidos', 'privacidade'), R('PUT', '/privacidade/pedidos/:id', 'privacidade'),
]

// a regra de um pedido: null = livre ou leitura partilhada; undefined = rota que não está na lista (recusa-se)
export function rotaDaArea(metodo, caminho) {
  if (LIVRES.some((re) => re.test(caminho))) return null
  const r = ROTAS.find((x) => x.metodo === metodo && x.re.test(caminho))
  if (!r) return undefined
  return r.areas[0] === null ? null : r
}

export function podeNaRota(u, metodo, caminho) {
  const r = rotaDaArea(metodo, caminho)
  if (r === null) return true
  if (r === undefined) return false
  const minhas = areasDe(u)
  return r.areas.some((a) => (r.leitura ? Boolean(minhas[a]) : minhas[a] === 'alterar'))
}

import { conflito, invalido, naoEncontrado } from '../erros.js'
import { CATEGORIAS, FUNCOES, POSTOS, abreviaturaDoPosto, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'

// colunas do planeamento: escalões dos oficiais, sargentos, praças e civis
const CURTOS = { oficial_general: 'Of. Gen.', oficial_superior: 'Of. Sup.', oficial_capitao: 'Of. Cap.', oficial_subalterno: 'Of. Sub.', sargento: 'Sarg.', praca: 'Praças' }
export const COLUNAS_PLANEAMENTO = [...Object.entries(CATEGORIAS).map(([k, v]) => [k, CURTOS[k], v.nome]), ['civil', 'Civis', 'Pessoal civil']]
const categoriaDe = (p) => (p.tipo === 'civil' ? 'civil' : POSTOS[p.posto]?.categoria ?? null)
const categoriaDoCargo = (c) => (c.tipo === 'civil' || !c.postoRequerido ? 'civil' : POSTOS[c.postoRequerido].categoria)
export const TIPOS_UNIDADE = { direccao: 'Direcção', gabinete: 'Gabinete', departamento: 'Departamento', reparticao: 'Repartição', seccao: 'Secção', servico: 'Serviço', companhia: 'Companhia', curso: 'Curso', outro: 'Outro' }
const vazio = () => Object.fromEntries(COLUNAS_PLANEAMENTO.map(([k]) => [k, 0]))
import { exigir } from './sessao.js'

// quadro orgânico da Escola: unidades (órgãos e serviços) e os cargos de cada uma, com os lugares
export class ServicoOrganica {
  constructor({ bd, auditoria }) {
    Object.assign(this, { bd, auditoria })
  }

  async unidades(u) {
    exigir(u, 'ver')
    const l = await this.bd.unidade.findMany({ include: { _count: { select: { pessoas: { where: { ativo: true } }, cargos: true } } }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] })
    return l.map(({ _count, ...x }) => ({ ...x, pessoas: _count.pessoas, cargos: _count.cargos }))
  }

  /*
    Árvore orgânica com os números do planeamento (como no SIGP): para cada unidade e para a Escola toda,
    o efectivo previsto (lugares dos cargos) e o existente (pessoas colocadas), por categoria — contando as
    subunidades. As empregadas domiciliares não entram.
  */
  async arvore(u) {
    exigir(u, 'ver')
    const [unidades, cargos, pessoas] = await Promise.all([
      this.bd.unidade.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
      this.bd.cargo.findMany({ select: { id: true, unidadeId: true, vagas: true, tipo: true, postoRequerido: true } }),
      this.bd.pessoa.findMany({ where: { ativo: true, vinculo: { not: 'domiciliar' } }, select: { unidadeId: true, cargoId: true, tipo: true, posto: true, genero: true, vinculo: true } }),
    ])
    const no = new Map(unidades.map((x) => [x.id, { id: x.id, nome: x.nome, sigla: x.sigla, tipo: x.tipo, tipoNome: TIPOS_UNIDADE[x.tipo] ?? '', paiId: x.paiId, filhos: [], previsto: vazio(), existente: vazio(), lugares: 0, ocupados: 0, cargos: 0, mulheres: 0, pessoas: 0, estudantes: 0 }]))
    const somar = (n, campo, cat, q = 1) => { if (n && cat) n[campo][cat] += q }
    for (const c of cargos) {
      const n = no.get(c.unidadeId)
      if (!n) continue
      n.cargos++
      n.lugares += c.vagas
      somar(n, 'previsto', categoriaDoCargo(c), c.vagas)
    }
    const ocupadosPorCargo = new Map()
    for (const p of pessoas) {
      const n = no.get(p.unidadeId)
      if (!n) continue
      // os estudantes dos cursos não fazem parte do efectivo da unidade: contam-se à parte
      if (p.vinculo === 'estudante') { n.estudantes++; continue }
      n.pessoas++
      if (p.genero === 'F') n.mulheres++
      somar(n, 'existente', categoriaDe(p))
      if (p.cargoId) ocupadosPorCargo.set(p.cargoId, (ocupadosPorCargo.get(p.cargoId) ?? 0) + 1)
    }
    for (const c of cargos) { const n = no.get(c.unidadeId); if (n) n.ocupados += Math.min(c.vagas, ocupadosPorCargo.get(c.id) ?? 0) }
    const raizes = []
    for (const n of no.values()) (no.get(n.paiId)?.filhos ?? raizes).push(n)
    // os totais de cada unidade incluem as subunidades
    const total = (n) => {
      for (const f of n.filhos) {
        total(f)
        for (const k of ['lugares', 'ocupados', 'cargos', 'mulheres', 'pessoas', 'estudantes']) n[k] += f[k]
        for (const cat of Object.keys(n.previsto)) { n.previsto[cat] += f.previsto[cat]; n.existente[cat] += f.existente[cat] }
      }
      return n
    }
    raizes.forEach(total)
    const escola = { id: null, nome: 'Escola Superior de Guerra', sigla: 'ESG', filhos: raizes, previsto: vazio(), existente: vazio(), lugares: 0, ocupados: 0, cargos: 0, mulheres: 0, pessoas: 0, estudantes: 0 }
    for (const r of raizes) {
      for (const k of ['lugares', 'ocupados', 'cargos', 'mulheres', 'pessoas', 'estudantes']) escola[k] += r[k]
      for (const cat of Object.keys(escola.previsto)) { escola.previsto[cat] += r.previsto[cat]; escola.existente[cat] += r.existente[cat] }
    }
    // pessoas sem unidade também contam no existente da Escola
    for (const p of pessoas.filter((x) => !no.has(x.unidadeId))) { if (p.vinculo === 'estudante') { escola.estudantes++; continue } escola.pessoas++; escola.existente[categoriaDe(p)] = (escola.existente[categoriaDe(p)] ?? 0) + 1; if (p.genero === 'F') escola.mulheres++ }
    return { escola, colunas: COLUNAS_PLANEAMENTO }
  }

  // detalhe de uma unidade: caminho até à raiz, subunidades, cargos com os ocupantes (com foto)
  async detalhe(u, id) {
    exigir(u, 'ver')
    const unidades = await this.bd.unidade.findMany()
    const atual = unidades.find((x) => x.id === id)
    if (!atual) throw naoEncontrado('Unidade não encontrada.')
    const caminho = []
    for (let x = atual; x; x = unidades.find((y) => y.id === x.paiId)) caminho.unshift({ id: x.id, nome: x.nome, sigla: x.sigla })
    const cargos = await this.bd.cargo.findMany({ where: { unidadeId: id }, include: { pessoas: { where: { ativo: true }, select: { id: true, nome: true, posto: true, ramo: true, fotoId: true, nip: true, numeroAgente: true, categoriaCivil: true, tipo: true } } }, orderBy: [{ funcao: 'asc' }, { nome: 'asc' }] })
    const semCargo = await this.bd.pessoa.findMany({ where: { unidadeId: id, ativo: true, cargoId: null, vinculo: { not: 'domiciliar' } }, select: { id: true, nome: true, posto: true, ramo: true, fotoId: true, nip: true, numeroAgente: true, categoriaCivil: true, tipo: true, vinculo: true } })
    const pessoa = (p) => ({ id: p.id, nome: p.nome, fotoId: p.fotoId, ident: p.nip || p.numeroAgente || '', descricao: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil || 'Civil', abreviatura: p.posto ? abreviaturaDoPosto(p.posto, p.ramo) : '', ramo: p.ramo })
    return {
      ...atual, caminho,
      cargos: cargos.map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao, funcaoNome: FUNCOES[c.funcao] ?? '', tipo: c.tipo, postoRequeridoNome: c.postoRequerido ? nomeDoPosto(c.postoRequerido) : c.categoriaCivil || 'Civil', categoria: CATEGORIAS[categoriaDoCargo(c)]?.nome ?? 'Civil', vagas: c.vagas, ocupados: c.pessoas.length, livres: Math.max(0, c.vagas - c.pessoas.length), excesso: Math.max(0, c.pessoas.length - c.vagas), ocupantes: c.pessoas.map(pessoa) })),
      semCargo: semCargo.map((p) => ({ ...pessoa(p), vinculo: p.vinculo })),
    }
  }

  async guardarUnidade(u, id, { nome, sigla = '', tipo = 'outro', paiId = null, ordem = 0 }) {
    exigir(u, 'administrar')
    if (!TIPOS_UNIDADE[tipo]) throw invalido('Tipo de unidade desconhecido.', 'tipo')
    if (id && paiId) {
      // não pode ficar dentro de si própria nem de uma das suas subunidades (a árvore não pode ter voltas)
      const todas = await this.bd.unidade.findMany({ select: { id: true, paiId: true } })
      for (let x = paiId; x; x = todas.find((y) => y.id === x)?.paiId) if (x === id) throw invalido('Uma unidade não pode ficar dentro de si própria nem de uma subunidade sua.', 'paiId')
    }
    const data = { nome, sigla, tipo, paiId, ordem }
    const r = id ? await this.bd.unidade.update({ where: { id }, data }) : await this.bd.unidade.create({ data })
    await this.auditoria.registar(u, id ? 'editar_unidade' : 'criar_unidade', nome)
    return r
  }

  async removerUnidade(u, id) {
    exigir(u, 'administrar')
    if (await this.bd.pessoa.count({ where: { unidadeId: id, ativo: true } })) throw conflito('Há pessoas nesta unidade: mude-as primeiro.')
    const r = await this.bd.unidade.deleteMany({ where: { id } })
    if (!r.count) throw naoEncontrado('Unidade não encontrada.')
    await this.auditoria.registar(u, 'remover_unidade', `#${id}`)
  }

  // cargos com quem os ocupa e os lugares livres (art. 18.º)
  async cargos(u, { unidadeId } = {}) {
    exigir(u, 'ver')
    const l = await this.bd.cargo.findMany({
      where: unidadeId ? { unidadeId: Number(unidadeId) } : {},
      include: { unidade: { select: { nome: true, sigla: true } }, pessoas: { where: { ativo: true }, select: { id: true, nome: true, posto: true, ramo: true, categoriaCivil: true, fotoId: true, nip: true } } },
      orderBy: [{ unidadeId: 'asc' }, { nome: 'asc' }],
    })
    const unidades = await this.bd.unidade.findMany({ select: { id: true, nome: true, sigla: true, paiId: true } })
    const caminho = (id) => { const r = []; for (let x = unidades.find((y) => y.id === id); x; x = unidades.find((y) => y.id === x.paiId)) r.unshift(x.sigla || x.nome); return r.join(' › ') }
    return l.map((c) => ({
      ...c, unidadeNome: c.unidade?.nome ?? '', unidadeCaminho: c.unidadeId ? caminho(c.unidadeId) : '', funcaoNome: FUNCOES[c.funcao] ?? '', postoRequeridoNome: c.postoRequerido ? nomeDoPosto(c.postoRequerido) : '',
      ocupados: c.pessoas.length, livres: Math.max(0, c.vagas - c.pessoas.length),
      ocupantes: c.pessoas.map((p) => ({ id: p.id, nome: p.nome, fotoId: p.fotoId, nip: p.nip, descricao: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil ?? 'Civil' })),
      unidade: undefined, pessoas: undefined,
    }))
  }

  async guardarCargo(u, id, d) {
    exigir(u, 'administrar')
    if (d.postoRequerido && !POSTOS[d.postoRequerido]) throw invalido('Posto desconhecido.', 'postoRequerido')
    if (!FUNCOES[d.funcao]) throw invalido('Função desconhecida.', 'funcao')
    const data = { nome: d.nome, unidadeId: d.unidadeId ?? null, funcao: d.funcao, tipo: d.tipo, postoRequerido: d.postoRequerido || null, categoriaCivil: d.categoriaCivil || null, vagas: d.vagas }
    const r = id ? await this.bd.cargo.update({ where: { id }, data }) : await this.bd.cargo.create({ data })
    await this.auditoria.registar(u, id ? 'editar_cargo' : 'criar_cargo', d.nome)
    return r
  }

  async removerCargo(u, id) {
    exigir(u, 'administrar')
    if (await this.bd.pessoa.count({ where: { cargoId: id, ativo: true } })) throw conflito('O cargo está ocupado: faça primeiro a exoneração.')
    const r = await this.bd.cargo.deleteMany({ where: { id } })
    if (!r.count) throw naoEncontrado('Cargo não encontrado.')
    await this.auditoria.registar(u, 'remover_cargo', `#${id}`)
  }
}

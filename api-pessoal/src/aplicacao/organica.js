import { conflito, invalido, naoEncontrado } from '../erros.js'
import { FUNCOES, POSTOS, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
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

  async guardarUnidade(u, id, { nome, sigla = '', paiId = null, ordem = 0 }) {
    exigir(u, 'administrar')
    if (id && paiId === id) throw invalido('Uma unidade não pode estar dentro de si própria.', 'paiId')
    const data = { nome, sigla, paiId, ordem }
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
      include: { unidade: { select: { nome: true, sigla: true } }, pessoas: { where: { ativo: true }, select: { id: true, nome: true, posto: true, ramo: true, categoriaCivil: true } } },
      orderBy: [{ unidadeId: 'asc' }, { nome: 'asc' }],
    })
    return l.map((c) => ({
      ...c, unidadeNome: c.unidade?.nome ?? '', funcaoNome: FUNCOES[c.funcao] ?? '', postoRequeridoNome: c.postoRequerido ? nomeDoPosto(c.postoRequerido) : '',
      ocupados: c.pessoas.length, livres: Math.max(0, c.vagas - c.pessoas.length),
      ocupantes: c.pessoas.map((p) => ({ id: p.id, nome: p.nome, descricao: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil ?? 'Civil' })),
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

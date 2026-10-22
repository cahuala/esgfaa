import { conflito, invalido, naoEncontrado } from '../erros.js'
import { ABREVIATURAS, CATEGORIAS, FUNCOES, POSTOS, abreviaturaDoPosto, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS } from '../dominio/pessoal/civis.js'

// colunas do planeamento: escalões dos oficiais, sargentos, praças e civis
const CURTOS = { oficial_general: 'Of. Gen.', oficial_superior: 'Of. Sup.', oficial_capitao: 'Of. Cap.', oficial_subalterno: 'Of. Sub.', sargento: 'Sarg.', praca: 'Praças' }
export const COLUNAS_PLANEAMENTO = [...Object.entries(CATEGORIAS).map(([k, v]) => [k, CURTOS[k], v.nome]), ['civil', 'Civis', 'Pessoal civil']]
const categoriaDe = (p) => (p.tipo === 'civil' ? 'civil' : POSTOS[p.posto]?.categoria ?? null)
const categoriaDoCargo = (c) => (c.tipo === 'civil' || !c.postoRequerido ? 'civil' : POSTOS[c.postoRequerido].categoria)
export const TIPOS_UNIDADE = { comando: 'Comando', direccao: 'Direcção', gabinete: 'Gabinete', departamento: 'Departamento', reparticao: 'Repartição', seccao: 'Secção', servico: 'Serviço', batalhao: 'Batalhão', companhia: 'Companhia', pelotao: 'Pelotão', curso: 'Curso', outro: 'Outro' }
// os lugares da orgânica como no Mapa de Controlo Estatístico (Mod. 2): oficiais, sargentos, cabos, soldados e civis
const grausVazio = () => ({ oficiais: 0, sargentos: 0, cabos: 0, soldados: 0, civil: 0 })
function grauDoCargo(c) {
  if (c.tipo === 'civil' || !c.postoRequerido) return 'civil'
  const cat = POSTOS[c.postoRequerido].categoria
  return cat === 'sargento' ? 'sargentos' : cat === 'praca' ? (c.postoRequerido === 'soldado' ? 'soldados' : 'cabos') : 'oficiais'
}
const vazio = () => Object.fromEntries(COLUNAS_PLANEAMENTO.map(([k]) => [k, 0]))
import { exigir } from './sessao.js'
import { comparadorHierarquico, posicoesDasUnidades } from '../dominio/pessoal/ordem.js'

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
    Árvore orgânica com os números do planeamento : para cada unidade e para a Escola toda,
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
    const no = new Map(unidades.map((x) => [x.id, { id: x.id, nome: x.nome, sigla: x.sigla, tipo: x.tipo, tipoNome: TIPOS_UNIDADE[x.tipo] ?? '', paiId: x.paiId, filhos: [], previsto: vazio(), existente: vazio(), previstoGraus: grausVazio(), lugares: 0, ocupados: 0, cargos: 0, mulheres: 0, pessoas: 0, estudantes: 0 }]))
    const somar = (n, campo, cat, q = 1) => { if (n && cat) n[campo][cat] += q }
    for (const c of cargos) {
      const n = no.get(c.unidadeId)
      if (!n) continue
      n.cargos++
      n.lugares += c.vagas
      somar(n, 'previsto', categoriaDoCargo(c), c.vagas)
      n.previstoGraus[grauDoCargo(c)] += c.vagas
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
        for (const g of Object.keys(n.previstoGraus)) n.previstoGraus[g] += f.previstoGraus[g]
      }
      return n
    }
    raizes.forEach(total)
    const escola = { id: null, nome: 'Escola Superior de Guerra', sigla: 'ESG', filhos: raizes, previsto: vazio(), existente: vazio(), previstoGraus: grausVazio(), lugares: 0, ocupados: 0, cargos: 0, mulheres: 0, pessoas: 0, estudantes: 0 }
    for (const r of raizes) {
      for (const k of ['lugares', 'ocupados', 'cargos', 'mulheres', 'pessoas', 'estudantes']) escola[k] += r[k]
      for (const cat of Object.keys(escola.previsto)) { escola.previsto[cat] += r.previsto[cat]; escola.existente[cat] += r.existente[cat] }
      for (const g of Object.keys(escola.previstoGraus)) escola.previstoGraus[g] += r.previstoGraus[g]
    }
    // pessoas sem unidade também contam no existente da Escola
    for (const p of pessoas.filter((x) => !no.has(x.unidadeId))) { if (p.vinculo === 'estudante') { escola.estudantes++; continue } escola.pessoas++; escola.existente[categoriaDe(p)] = (escola.existente[categoriaDe(p)] ?? 0) + 1; if (p.genero === 'F') escola.mulheres++ }
    return { escola, colunas: COLUNAS_PLANEAMENTO }
  }

  /*
    Detalhe de uma unidade: caminho até à raiz, os cargos da unidade e de todas as subunidades (agrupados
    por subunidade, com quem os ocupa e a fotografia) e o efectivo completo — todos os militares e civis
    colocados na unidade ou numa subunidade, com o cargo de cada um.
  */
  async detalhe(u, id) {
    exigir(u, 'ver')
    const unidades = await this.bd.unidade.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] })
    const atual = unidades.find((x) => x.id === id)
    if (!atual) throw naoEncontrado('Unidade não encontrada.')
    const caminho = []
    for (let x = atual; x; x = unidades.find((y) => y.id === x.paiId)) caminho.unshift({ id: x.id, nome: x.nome, sigla: x.sigla })
    // a unidade e as subunidades, pela ordem da árvore (com o nível, para o recuo)
    const ramo = []
    const andar = (uid, nivel) => { const x = unidades.find((y) => y.id === uid); ramo.push({ id: x.id, nome: x.nome, sigla: x.sigla, tipo: x.tipo, tipoNome: TIPOS_UNIDADE[x.tipo] ?? '', nivel }); for (const f of unidades.filter((y) => y.paiId === uid)) andar(f.id, nivel + 1) }
    andar(id, 0)
    const ids = ramo.map((x) => x.id)
    const SELECT = { id: true, nome: true, posto: true, ramo: true, fotoId: true, nip: true, numeroAgente: true, categoriaCivil: true, tipo: true, vinculo: true, genero: true, unidadeId: true, cargoId: true, dataAntiguidadePosto: true, cargo: { select: { funcao: true } } }
    // os cargos pela ordem do quadro orgânico (a ordem em que foram carregados)
    const [cargos, pessoas] = await Promise.all([
      this.bd.cargo.findMany({ where: { unidadeId: { in: ids } }, include: { pessoas: { where: { ativo: true }, select: SELECT } }, orderBy: { id: 'asc' } }),
      this.bd.pessoa.findMany({ where: { unidadeId: { in: ids }, ativo: true, vinculo: { not: 'domiciliar' } }, select: SELECT, orderBy: { nome: 'asc' } }),
    ])
    const nomeCargo = new Map(cargos.map((c) => [c.id, c.nome]))
    const cmp = comparadorHierarquico(posicoesDasUnidades(unidades))
    pessoas.sort(cmp)
    const ordem = new Map(pessoas.map((p, i) => [p.id, i + 1]))
    for (const c of cargos) c.pessoas.sort(cmp)
    const pessoa = (p) => ({ id: p.id, nome: p.nome, fotoId: p.fotoId, ident: p.nip || p.numeroAgente || '', tipo: p.tipo, vinculo: p.vinculo, genero: p.genero, descricao: p.posto ? nomeDoPosto(p.posto, p.ramo) : p.categoriaCivil || 'Civil', abreviatura: p.posto ? abreviaturaDoPosto(p.posto, p.ramo) : '', grau: POSTOS[p.posto]?.grau ?? 0, ramo: p.ramo, unidadeId: p.unidadeId, cargoNome: p.cargoId ? nomeCargo.get(p.cargoId) ?? '' : '', hierarquia: ordem.get(p.id) })
    const cargo = (c) => ({ id: c.id, nome: c.nome, unidadeId: c.unidadeId, funcao: c.funcao, funcaoNome: FUNCOES[c.funcao] ?? '', tipo: c.tipo, postoRequeridoNome: c.postoRequerido ? nomeDoPosto(c.postoRequerido) : c.categoriaCivil || 'Civil', categoria: CATEGORIAS[categoriaDoCargo(c)]?.nome ?? 'Civil', vagas: c.vagas, ocupados: c.pessoas.length, livres: Math.max(0, c.vagas - c.pessoas.length), excesso: Math.max(0, c.pessoas.length - c.vagas), ocupantes: c.pessoas.map(pessoa) })
    const nomeUnidade = new Map(ramo.map((x) => [x.id, x.sigla || x.nome]))
    return {
      ...atual, caminho, tipoNome: TIPOS_UNIDADE[atual.tipo] ?? '',
      // só os desta unidade (compatível) e os de todo o ramo, agrupados por unidade
      cargos: cargos.filter((c) => c.unidadeId === id).map(cargo),
      grupos: ramo.map((x) => ({ ...x, cargos: cargos.filter((c) => c.unidadeId === x.id).map(cargo) })).filter((g) => g.cargos.length),
      efectivo: pessoas.map((p) => ({ ...pessoa(p), unidadeNome: nomeUnidade.get(p.unidadeId) ?? '' })),
      semCargo: pessoas.filter((p) => p.unidadeId === id && !p.cargoId).map(pessoa),
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
    if (await this.bd.unidade.count({ where: { paiId: id } })) throw conflito('A unidade tem subunidades: apague-as ou mude-as primeiro.')
    if (await this.bd.cargo.count({ where: { unidadeId: id } })) throw conflito('A unidade tem cargos: apague-os ou mude-os primeiro.')
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
      orderBy: [{ unidadeId: 'asc' }, { id: 'asc' }],
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

  /*
    Carregar o quadro orgânico de uma folha de Excel (como no SIGP): cada linha é uma unidade e, se tiver
    cargo, um cargo dessa unidade. As unidades encontram-se pelo nome ou pela sigla; as que não existem
    criam-se dentro da «unidade superior» (que tem de vir antes na folha, ou já existir). Os cargos
    encontram-se pelo nome dentro da unidade: os novos criam-se, os que existem ficam com os lugares, o posto
    e a função da folha. Nada se apaga. Com simular, só diz o que faria.
    linha = { unidade, sigla, tipo, superior, cargo, funcao, posto, categoriaCivil, lugares }
  */
  async importarQuadro(u, { linhas, simular = true }) {
    exigir(u, 'administrar')
    if (!Array.isArray(linhas) || !linhas.length) throw invalido('A folha não tem linhas.')
    if (linhas.length > 3000) throw invalido('No máximo 3000 linhas de cada vez.')
    const sem = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.\s]+/g, ' ').trim()
    const unidades = (await this.bd.unidade.findMany()).map((x) => ({ ...x }))
    const cargos = (await this.bd.cargo.findMany()).map((x) => ({ ...x }))
    let novoId = -1
    const acoes = [] // [{ tipo: 'unidade'|'cargo', criar, dados, id }]
    const acharUnidade = (t) => unidades.filter((x) => sem(x.nome) === sem(t) || (x.sigla && sem(x.sigla) === sem(t)))
    const escolher = (v, opcoes, campo) => {
      const k = opcoes.find(([, ...nomes]) => nomes.some((n) => sem(n) === sem(v)))
      if (!k) throw invalido(`${campo} «${v}» não corresponde a nenhum da lista.`)
      return k[0]
    }
    const TIPOS = Object.entries(TIPOS_UNIDADE).map(([k, v]) => [k, k, v])
    const POSTOS_OP = Object.values(POSTOS).map((p) => [p.id, ...new Set([...Object.values(p.nomes), ...Object.values(p.nomes).map((n) => ABREVIATURAS[n]).filter(Boolean)])])
    const FUNCOES_OP = Object.entries(FUNCOES).map(([k, v]) => [k, k, v, v.split(' ')[0]])
    const CIVIS_OP = Object.values(CARREIRAS_CIVIS).map((c) => [c.nome, c.nome])
    const resultado = []
    const ordemSeguinte = (paiId) => Math.max(-1, ...unidades.filter((x) => x.paiId === paiId).map((x) => x.ordem ?? 0)) + 1
    for (const [i, l] of linhas.entries()) {
      const r = { linha: i + 2, unidade: String(l.unidade ?? '').trim(), cargo: String(l.cargo ?? '').trim(), acoes: [] }
      try {
        if (!r.unidade) throw invalido('Falta o nome da unidade.')
        const v = (k) => String(l[k] ?? '').trim()
        // a unidade superior
        let paiId
        if (v('superior')) {
          const p = acharUnidade(v('superior'))
          if (!p.length) throw invalido(`A unidade superior «${v('superior')}» não existe (tem de vir numa linha antes desta).`)
          if (p.length > 1) throw invalido(`Há várias unidades «${v('superior')}»: use a sigla.`)
          paiId = p[0].id
        }
        const tipo = v('tipo') ? escolher(v('tipo'), TIPOS, 'Tipo de unidade') : undefined
        const achadas = acharUnidade(r.unidade).filter((x) => paiId === undefined || x.paiId === paiId)
        if (achadas.length > 1) throw invalido(`Há várias unidades «${r.unidade}»: indique a unidade superior ou a sigla.`)
        let un = achadas[0]
        if (!un) {
          un = { id: novoId--, nome: r.unidade, sigla: v('sigla'), tipo: tipo ?? 'outro', paiId: paiId ?? null, ordem: ordemSeguinte(paiId ?? null) }
          unidades.push(un)
          acoes.push({ tipo: 'unidade', criar: true, ref: un })
          r.acoes.push('unidade nova')
        } else {
          const muda = {}
          if (v('sigla') && v('sigla') !== un.sigla) muda.sigla = v('sigla')
          if (tipo && tipo !== un.tipo) muda.tipo = tipo
          if (paiId !== undefined && paiId !== un.paiId) {
            for (let x = paiId; x; x = unidades.find((y) => y.id === x)?.paiId) if (x === un.id) throw invalido('A unidade não pode ficar dentro de si própria nem de uma subunidade sua.')
            muda.paiId = paiId
          }
          if (Object.keys(muda).length) { Object.assign(un, muda); acoes.push({ tipo: 'unidade', criar: false, ref: un, muda }); r.acoes.push(`unidade actualizada (${Object.keys(muda).join(', ')})`) }
        }
        // o cargo
        if (r.cargo) {
          const posto = v('posto') ? escolher(v('posto'), POSTOS_OP, 'Posto') : null
          const categoriaCivil = v('categoriaCivil') ? escolher(v('categoriaCivil'), CIVIS_OP, 'Categoria civil') : null
          const funcao = v('funcao') ? escolher(v('funcao'), FUNCOES_OP, 'Função') : undefined
          const lugares = v('lugares') ? Number(v('lugares')) : undefined
          if (lugares !== undefined && (!Number.isInteger(lugares) || lugares < 1 || lugares > 500)) throw invalido('Os lugares têm de ser um número inteiro de 1 a 500.')
          const tipoCargo = posto && categoriaCivil ? 'ambos' : categoriaCivil ? 'civil' : 'militar'
          const c = cargos.find((x) => x.unidadeId === un.id && sem(x.nome) === sem(r.cargo))
          if (!c) {
            const novo = { id: novoId--, nome: r.cargo, unidadeId: un.id, funcao: funcao ?? 'execucao', tipo: tipoCargo, postoRequerido: posto, categoriaCivil, vagas: lugares ?? 1 }
            cargos.push(novo)
            acoes.push({ tipo: 'cargo', criar: true, ref: novo })
            r.acoes.push(`cargo novo (${novo.vagas} lugar(es))`)
          } else {
            const muda = {}
            if (lugares !== undefined && lugares !== c.vagas) muda.vagas = lugares
            if (posto && posto !== c.postoRequerido) muda.postoRequerido = posto
            if (categoriaCivil && categoriaCivil !== c.categoriaCivil) muda.categoriaCivil = categoriaCivil
            if ((posto || categoriaCivil) && tipoCargo !== c.tipo) muda.tipo = tipoCargo
            if (funcao && funcao !== c.funcao) muda.funcao = funcao
            if (Object.keys(muda).length) { Object.assign(c, muda); acoes.push({ tipo: 'cargo', criar: false, ref: c, muda }); r.acoes.push(`cargo actualizado (${Object.keys(muda).join(', ')})`) }
          }
        }
        r.acao = r.acoes.length ? 'alterar' : 'igual'
      } catch (e) {
        if (e.codigo !== 'validacao') throw e
        r.acao = 'erro'
        r.erro = e.message
      }
      resultado.push(r)
    }
    const resumo = {
      unidades: acoes.filter((a) => a.tipo === 'unidade' && a.criar).length, cargos: acoes.filter((a) => a.tipo === 'cargo' && a.criar).length,
      actualizados: acoes.filter((a) => !a.criar).length, lugares: acoes.filter((a) => a.tipo === 'cargo' && a.criar).reduce((n, a) => n + a.ref.vagas, 0), erros: resultado.filter((x) => x.acao === 'erro').length,
    }
    if (!simular) {
      if (resumo.erros) throw invalido(`Corrija primeiro as ${resumo.erros} linha(s) com erro: nada foi gravado.`)
      // aplica por ordem, trocando os números provisórios (negativos) pelos verdadeiros
      await this.bd.$transaction(async (tx) => {
        const real = new Map()
        const id = (x) => (x !== null && x < 0 ? real.get(x) : x)
        for (const a of acoes) {
          const x = a.ref
          if (a.tipo === 'unidade') {
            if (a.criar) real.set(x.id, (await tx.unidade.create({ data: { nome: x.nome, sigla: x.sigla, tipo: x.tipo, paiId: id(x.paiId), ordem: x.ordem } })).id)
            else await tx.unidade.update({ where: { id: x.id }, data: { ...a.muda, ...('paiId' in a.muda ? { paiId: id(a.muda.paiId) } : {}) } })
          } else if (a.criar) {
            await tx.cargo.create({ data: { nome: x.nome, unidadeId: id(x.unidadeId), funcao: x.funcao, tipo: x.tipo, postoRequerido: x.postoRequerido, categoriaCivil: x.categoriaCivil, vagas: x.vagas } })
          } else await tx.cargo.update({ where: { id: x.id }, data: a.muda })
        }
      }, { timeout: 60_000 })
      await this.auditoria.registar(u, 'importar_quadro_organico', `${resumo.unidades} unidade(s), ${resumo.cargos} cargo(s), ${resumo.actualizados} actualização(ões)`, resumo)
    }
    return { simulacao: simular, resumo, linhas: resultado }
  }
}

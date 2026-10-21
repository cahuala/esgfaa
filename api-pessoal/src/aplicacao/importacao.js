import { invalido } from '../erros.js'
import { ABREVIATURAS, EFECTIVIDADES, FORMAS_SERVICO, POSTOS, RAMOS, SITUACOES, quadrosDoRamo } from '../dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS, CATEGORIA_ANTIGA, VINCULOS_CIVIS } from '../dominio/pessoal/civis.js'
import { ESTADOS_CIVIS, HABILITACOES, PROVINCIAS, VINCULOS, problemaNaFicha } from '../dominio/pessoal/ficha.js'
import { exigir } from './sessao.js'

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.\s]+/g, ' ').trim()
// nomes guardados em "Primeira Letra Maiúscula", com as partículas em minúscula
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
export const nomeProprio = (n) => String(n ?? '').trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map((p, i) => (i && PARTICULAS.has(p) ? p : p.replace(/(^|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()))).join(' ')

// datas: 31/12/1980, 1980-12-31 ou o número de série do Excel
export function data(v) {
  const t = String(v ?? '').trim()
  if (!t) return null
  let d
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) d = new Date(`${t.slice(0, 10)}T00:00:00Z`)
  else if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(t)) {
    const [a, b, c] = t.split(/[/.-]/).map(Number)
    d = new Date(Date.UTC(c, b - 1, a))
  } else if (/^\d{4,5}(\.\d+)?$/.test(t)) d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86_400_000)
  if (!d || Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) throw invalido(`Data inválida: «${t}» (use dd/mm/aaaa).`)
  return d
}

// procura um valor numa lista de [chave, ...nomes aceites]; exacto (sem acentos nem maiúsculas)
function corresponder(v, opcoes, campo) {
  const t = sem(v)
  if (!t) return null
  const r = opcoes.find(([, ...nomes]) => nomes.some((n) => sem(n) === t))
  if (!r) throw invalido(`${campo} sem correspondência: «${v}».`)
  return r[0]
}
const daLista = (obj) => Object.entries(obj).map(([k, v]) => [k, k, typeof v === 'string' ? v : v.nome])
const SIM = new Set(['sim', 's', 'x', '1', 'verdadeiro', 'true'])

/*
  Importação em massa a partir de uma folha (lida no navegador). Dois modos:
  "novos" cria fichas (NIP ou n.º de agente que já exista bloqueia a linha); "actualizar" altera as fichas
  existentes pelo NIP/n.º de agente, só nas colunas preenchidas. Todas as correspondências (posto, ramo, unidade,
  cargo…) são exactas: o que não corresponde bloqueia a linha. Com simular, só diz o que faria.
*/
export class ServicoImportacao {
  constructor({ bd, pessoas, auditoria }) {
    Object.assign(this, { bd, pessoas, auditoria })
  }

  async importar(u, { modo = 'novos', linhas, simular = true }) {
    exigir(u, 'editar')
    if (!Array.isArray(linhas) || !linhas.length) throw invalido('A folha não tem linhas.')
    if (linhas.length > 3000) throw invalido('No máximo 3000 linhas de cada vez.')
    const unidades = await this.bd.unidade.findMany()
    const cargos = await this.bd.cargo.findMany({ include: { _count: { select: { pessoas: { where: { ativo: true } } } } } })
    const ocupacao = new Map(cargos.map((c) => [c.id, c._count.pessoas]))
    const vistos = new Set()
    const resultado = []
    for (const [i, l] of linhas.entries()) {
      const r = { linha: i + 2, nome: String(l.nome ?? '').trim(), identificacao: String(l.nip || l.numeroAgente || '').trim() }
      try {
        const ident = r.identificacao.toUpperCase()
        if (!ident) throw invalido('Falta o NIP (ou o n.º de agente, para civis).')
        if (vistos.has(ident)) throw invalido('Repetido na folha.')
        vistos.add(ident)
        const existente = await this.bd.pessoa.findFirst({ where: { OR: [{ nip: ident }, { numeroAgente: ident }] } })
        if (modo === 'novos' && existente) throw invalido(`Já existe: ${existente.nome}.`)
        if (modo === 'actualizar' && !existente) throw invalido('Não existe nenhuma ficha com esse NIP/n.º de agente.')
        const d = this.#converter(l, { unidades, cargos, base: existente })
        if (modo === 'novos') {
          if (!d.nome || d.nome.length < 5) throw invalido('Falta o nome completo.')
          d.tipo ??= l.nip ? 'militar' : 'civil'
          if (d.tipo === 'militar') d.nip = ident
          else d.numeroAgente = ident
        }
        const final = { ...(existente ?? {}), ...d }
        const problema = problemaNaFicha(final)
        if (problema) throw invalido(problema[1])
        if (d.cargoId && d.cargoId !== existente?.cargoId) {
          const c = cargos.find((x) => x.id === d.cargoId)
          if (ocupacao.get(c.id) >= c.vagas) throw invalido(`O cargo «${c.nome}» não tem lugar livre (${c.vagas} previsto(s)).`)
          ocupacao.set(c.id, ocupacao.get(c.id) + 1)
        }
        r.acao = modo === 'novos' ? 'criar' : 'actualizar'
        r.campos = Object.keys(d).filter((k) => !['tipo', 'nip', 'numeroAgente'].includes(k))
        if (!simular) {
          const g = modo === 'novos' ? await this.pessoas.criar(u, this.#paraServico(d), { silencioso: true }) : await this.pessoas.editar(u, existente.id, this.#paraServico(d), { silencioso: true })
          r.id = g.id
          r.acao = modo === 'novos' ? 'criado' : 'actualizado'
        }
      } catch (e) {
        if (e.codigo !== 'validacao' && e.codigo !== 'conflito') throw e
        r.acao = 'erro'
        r.erro = e.message
      }
      resultado.push(r)
    }
    const conta = (...k) => resultado.filter((x) => k.includes(x.acao)).length
    const resumo = { validas: conta('criar', 'actualizar', 'criado', 'actualizado'), erros: conta('erro') }
    if (!simular) await this.auditoria.registar(u, 'importar_excel', `${resumo.validas} ficha(s) (${modo})`, resumo)
    return { simulacao: simular, modo, resumo, linhas: resultado }
  }

  // passa as datas para texto, como o serviço de fichas espera
  #paraServico(d) {
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v]))
  }

  #converter(l, { unidades, cargos, base }) {
    const d = {}
    const tem = (k) => l[k] !== undefined && String(l[k]).trim() !== ''
    if (tem('tipo')) d.tipo = corresponder(l.tipo, [['militar', 'militar', 'mil'], ['civil', 'civil']], 'Tipo')
    if (tem('nome')) d.nome = nomeProprio(l.nome)
    if (tem('nomeGuerra')) d.nomeGuerra = nomeProprio(l.nomeGuerra)
    if (tem('bi')) d.bi = String(l.bi).trim().toUpperCase().replace(/\s/g, '')
    if (tem('email')) d.email = String(l.email).trim().toLowerCase()
    for (const k of ['telefone', 'morada', 'naturalidade', 'nacionalidade', 'areaFormacao', 'especialidade', 'observacoes']) if (tem(k)) d[k] = String(l[k]).trim()
    for (const k of ['pai', 'mae']) if (tem(k)) d[k] = nomeProprio(l[k])
    for (const k of ['dataNascimento', 'dataIngresso', 'dataIngressoQP', 'dataAntiguidadePosto', 'dataCargo', 'dataAdmissao', 'dataCategoria']) if (tem(k)) d[k] = data(l[k])
    if (tem('genero')) d.genero = corresponder(l.genero, [['M', 'M', 'masculino', 'homem'], ['F', 'F', 'feminino', 'mulher']], 'Género')
    if (tem('estadoCivil')) d.estadoCivil = corresponder(l.estadoCivil, [...daLista(ESTADOS_CIVIS), ['solteiro', 'solteira'], ['casado', 'casada'], ['viuvo', 'viuva'], ['divorciado', 'divorciada']], 'Estado civil')
    if (tem('provincia')) d.provincia = corresponder(l.provincia, PROVINCIAS.map((p) => [p, p]), 'Província')
    if (tem('habilitacao')) d.habilitacao = corresponder(l.habilitacao, [...daLista(HABILITACOES), ['medio', 'ensino medio', 'medio'], ['base', 'ensino de base', 'basico'], ['pos_graduacao', 'pos graduacao', 'pos-graduacao'], ['primeiro_ciclo', '1 ciclo', 'i ciclo'], ['segundo_ciclo', '2 ciclo', 'ii ciclo']], 'Habilitação')
    if (tem('vinculo')) d.vinculo = corresponder(l.vinculo, daLista(VINCULOS).filter(([k]) => k !== 'domiciliar'), 'Vínculo')
    const tipo = d.tipo ?? base?.tipo ?? (l.nip ? 'militar' : 'civil')
    if (tipo === 'militar') {
      if (tem('ramo')) d.ramo = corresponder(l.ramo, [...daLista(RAMOS), ['EXE', 'exercito', 'fat', 'exército'], ['FAN', 'forca aerea', 'força aérea'], ['MGA', 'marinha', 'marinha de guerra']], 'Ramo')
      const ramo = d.ramo ?? base?.ramo ?? 'EXE'
      if (tem('posto')) {
        // o nome do posto no ramo, o de qualquer ramo (equivalentes) ou a abreviatura
        const opcoes = Object.values(POSTOS).map((p) => [p.id, ...new Set([...Object.values(p.nomes), ...Object.values(p.nomes).map((n) => ABREVIATURAS[n]).filter(Boolean)])])
        d.posto = corresponder(l.posto, opcoes, 'Posto')
      }
      if (tem('fps')) d.fps = corresponder(l.fps, [...daLista(FORMAS_SERVICO), ['QP', 'quadro permanente'], ['SMC', 'contratado', 'contrato'], ['SMO', 'servico militar obrigatorio']], 'Forma de prestação de serviço')
      if (tem('quadroEspecial')) d.quadroEspecial = corresponder(l.quadroEspecial, quadrosDoRamo(ramo).map((q) => [q.sigla, q.sigla, q.nome]), 'Quadro especial')
      if (tem('situacao')) d.situacao = corresponder(l.situacao, daLista(SITUACOES), 'Situação')
      if (tem('efectividade')) d.efectividade = corresponder(l.efectividade, daLista(EFECTIVIDADES), 'Efectividade')
    } else {
      // categoria do pessoal civil (Técnico Superior, Técnico Médio, Administrativo…) e, dentro dela, a classe
      if (tem('carreiraCivil')) d.carreiraCivil = corresponder(l.carreiraCivil, [...daLista(CARREIRAS_CIVIS), ...Object.entries(CATEGORIA_ANTIGA).map(([a, n]) => [n, a])], 'Categoria')
      const carreira = d.carreiraCivil ?? base?.carreiraCivil
      if (tem('categoriaCivil')) d.categoriaCivil = corresponder(l.categoriaCivil, (CARREIRAS_CIVIS[carreira]?.categorias ?? []).map((c) => [c, c]), 'Classe')
      else if (d.carreiraCivil && !base?.categoriaCivil) d.categoriaCivil = CARREIRAS_CIVIS[d.carreiraCivil].categorias[0]
      if (tem('vinculoCivil')) d.vinculoCivil = corresponder(l.vinculoCivil, daLista(VINCULOS_CIVIS), 'Vínculo')
    }
    if (tem('unidade')) d.unidadeId = corresponder(l.unidade, unidades.map((x) => [x.id, x.nome, x.sigla].filter(Boolean)), 'Unidade')
    if (tem('cargo')) {
      const unidadeId = d.unidadeId ?? base?.unidadeId
      const lista = cargos.filter((c) => !unidadeId || c.unidadeId === unidadeId)
      const id = corresponder(l.cargo, lista.map((c) => [c.id, c.nome]), unidadeId ? 'Cargo (na unidade indicada)' : 'Cargo')
      if (lista.filter((c) => sem(c.nome) === sem(l.cargo)).length > 1) throw invalido(`Há vários cargos «${l.cargo}»: indique a unidade.`)
      d.cargoId = id
      d.unidadeId ??= cargos.find((c) => c.id === id).unidadeId
    }
    for (const [k, nome] of [['avaliacaoFavoravel', 'avaliacao'], ['processoPendente', 'processo']]) if (tem(nome)) d[k] = SIM.has(sem(l[nome]))
    return d
  }
}

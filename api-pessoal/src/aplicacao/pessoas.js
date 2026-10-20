import { ErroDominio, conflito, invalido, naoEncontrado } from '../erros.js'
import { eDuplicado } from '../infraestrutura/bd.js'
import { CURSOS_PROMOCAO, ordenarAntiguidade, reservaEReforma, verificarPromocao } from '../dominio/pessoal/carreira.js'
import { verificarProgressaoCivil } from '../dominio/pessoal/civis.js'
import { EFECTIVIDADES, ESTADOS, SITUACOES, nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { PROVINCIAS, comDerivados, problemaNaFicha, vinculosDe } from '../dominio/pessoal/ficha.js'
import { vencimentoDoPosto } from '../dominio/pessoal/tabelaSalarial.js'
import { remuneracaoDaCategoria } from '../dominio/pessoal/civis.js'
import { diasDeFerias, feriasAdicionais } from './planoFerias.js'
import { chaveCargo } from './tabelaSalarial.js'
import { nomeProprio } from './importacao.js'
import { pedirJson } from '../infraestrutura/https.js'
import { limiteDomiciliares, temDireitoDomiciliar } from '../dominio/pessoal/domiciliares.js'
import { exigir } from './sessao.js'

// tipos de registo no histórico (os das propostas e os que se lançam à mão)
export const TIPOS_EVENTO = {
  registo: 'Registo no sistema',
  ingresso: 'Ingresso nas FAA',
  admissao: 'Admissão',
  promocao: 'Promoção',
  graduacao: 'Graduação',
  fim_graduacao: 'Fim de graduação',
  nomeacao: 'Nomeação',
  exoneracao: 'Exoneração',
  progressao: 'Progressão na carreira',
  despromocao: 'Despromoção',
  situacao: 'Mudança de situação',
  estado: 'Mudança de estado',
  curso: 'Nomeação para curso',
  colocacao: 'Colocação na Escola',
  transferencia: 'Transferência',
  louvor: 'Louvor',
  condecoracao: 'Condecoração',
  punicao: 'Punição',
  saida: 'Saída da Escola',
  correcao: 'Correção de dados',
  outro: 'Outro',
}
export const EVENTOS_MANUAIS = ['ingresso', 'admissao', 'colocacao', 'transferencia', 'louvor', 'condecoracao', 'punicao', 'despromocao', 'outro']

const INCLUIR_LISTA = { unidade: { select: { nome: true } }, cargo: { select: { nome: true } }, militarAlocado: { select: { nome: true, posto: true, ramo: true } }, cursos: { select: { chave: true, aproveitamento: true, fim: true } }, eventos: { where: { tipo: 'despromocao' }, select: { tipo: true, data: true } }, graduacoes: { where: { ativa: true }, select: { posto: true, ativa: true, inicio: true } } }
const vazioANulo = (v) => (v === '' ? null : v)
const CAMPOS_UNICOS = { nip: 'NIP', numeroAgente: 'número de agente', bi: 'bilhete de identidade', email: 'e-mail' }

// precisa de conta no portal: docentes e estudantes com e-mail
const vaiParaPortal = (p) => p.ativo && vinculosDe(p).some((v) => ['docente', 'estudante'].includes(v)) && Boolean(p.email)

export class ServicoPessoas {
  constructor({ bd, auditoria, config, tabelaSalarial, enviar = pedirJson, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, config, tabelaSalarial, enviar, agora })
  }

  async #todas(where) {
    return this.bd.pessoa.findMany({ where, include: INCLUIR_LISTA, orderBy: { nome: 'asc' } })
  }

  /*
    Lista com os filtros dos gráficos e das pesquisas. Os filtros que dependem de cálculos (categoria,
    elegíveis, faixa etária, reserva próxima) aplicam-se depois de calcular a ficha.
  */
  async listar(u, f = {}) {
    exigir(u, 'ver')
    const where = { ativo: f.ativo === 'nao' ? false : f.ativo === 'todos' ? undefined : true }
    for (const k of ['tipo', 'ramo', 'posto', 'fps', 'situacao', 'efectividade', 'estado', 'genero', 'provincia', 'habilitacao', 'carreiraCivil', 'categoriaCivil', 'vinculoCivil', 'quadroEspecial', 'estadoCivil']) if (f[k]) where[k] = f[k]
    if (f.cargoId) where.cargoId = f.cargoId === 'nenhum' ? null : Number(f.cargoId)
    // a unidade é uma árvore: filtrar por uma unidade inclui as suas subunidades
    if (f.unidadeId) where.unidadeId = f.unidadeId === 'nenhum' ? null : { in: await this.#comSubunidades(Number(f.unidadeId)) }
    // o vínculo conta também quando é uma das outras funções (o funcionário que também é docente)
    if (f.vinculo) where.OR = [{ vinculo: f.vinculo }, ...(f.vinculo === 'domiciliar' ? [] : [{ outrosVinculos: { has: f.vinculo } }])]
    // as empregadas domiciliares não são trabalhadores civis da Escola: só aparecem quando se pedem
    if (!f.vinculo) where.vinculo = { not: 'domiciliar' }
    if (f.militarAlocadoId) where.militarAlocadoId = Number(f.militarAlocadoId)
    const hoje = this.agora()
    let lista = (await this.#todas(where)).map((p) => comDerivados(p, hoje))
    if (f.grupo) lista = lista.filter((p) => p.grupo === f.grupo)
    if (f.categoria) lista = lista.filter((p) => p.categoria === f.categoria)
    if (f.elegivel) lista = lista.filter((p) => p.elegivelPromocao)
    if (f.graduado) lista = lista.filter((p) => p.graduacoes?.length)
    if (f.idade) {
      const [a, b] = f.idade.split('-').map(Number)
      lista = lista.filter((p) => p.idade !== null && p.idade >= a && p.idade <= (b || 200))
    }
    if (f.reservaAte) lista = lista.filter((p) => p.dataReserva && p.dataReserva <= `${f.reservaAte}-12-31`)
    if (f.semCargo) lista = lista.filter((p) => !p.cargoId)
    return lista.map(({ cursos, eventos, ...p }) => (void cursos, void eventos, p))
  }

  async #comSubunidades(id) {
    const todas = await this.bd.unidade.findMany({ select: { id: true, paiId: true } })
    const ids = [id]
    for (let i = 0; i < ids.length; i++) for (const u of todas) if (u.paiId === ids[i] && !ids.includes(u.id)) ids.push(u.id)
    return ids
  }

  // ficha completa do militar ou do civil, com o histórico e o que a lei diz da sua carreira
  async perfil(u, id) {
    // cada um vê a sua própria ficha (o utente não vê as dos outros)
    if (u.pessoaId !== id) exigir(u, 'ver')
    const p = await this.bd.pessoa.findUnique({
      where: { id },
      include: {
        unidade: true, cargo: true, sincronizacao: true, processo: true,
        militarAlocado: { select: { id: true, nome: true, posto: true, ramo: true, nip: true } },
        domiciliares: { where: { ativo: true }, select: { id: true, nome: true, numeroAgente: true, telefone: true, fotoId: true } },
        documentos: { orderBy: [{ data: 'desc' }, { id: 'desc' }] },
        cursos: { orderBy: [{ fim: 'desc' }, { id: 'desc' }] },
        eventos: { orderBy: [{ data: 'desc' }, { id: 'desc' }] },
        graduacoes: { orderBy: { inicio: 'desc' } },
        licencas: { orderBy: { inicio: 'desc' } },
        itens: { include: { proposta: { select: { id: true, tipo: true, estado: true, titulo: true, criadoEm: true, documento: true } } }, orderBy: { id: 'desc' } },
      },
    })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const hoje = this.agora()
    const f = comDerivados(p, hoje)
    f.unidade = p.unidade
    f.cargo = p.cargo
    if (p.militarAlocado) f.militarAlocado = { ...p.militarAlocado, postoNome: nomeDoPosto(p.militarAlocado.posto, p.militarAlocado.ramo) }
    f.limiteDomiciliares = p.tipo === 'militar' ? limiteDomiciliares(p.posto) : 0
    if (p.tipo === 'militar' && this.tabelaSalarial) f.vencimentoTabela = vencimentoDoPosto(p.posto, p.fps, await this.tabelaSalarial.bases())
    // plano de férias (as guias de férias saem dele) e os dias a que tem direito (art. 32.º)
    f.planoFerias = (await this.bd.planoFerias.findMany({ where: { pessoaId: p.id }, orderBy: { ano: 'desc' }, take: 5 })).map(({ ano, mes }) => ({ ano, mes }))
    f.diasFerias = diasDeFerias(p, hoje)
    f.feriasAdicionais = feriasAdicionais(p, hoje)
    if (p.tipo === 'civil' && this.tabelaSalarial) {
      f.remuneracao = remuneracaoDaCategoria(p.carreiraCivil, await this.tabelaSalarial.basesCivis())
      // vencimento do cargo (tabela dos civis por cargo), antes do da categoria
      f.vencimentoCargo = p.cargo ? (await this.tabelaSalarial.basesCargos())[chaveCargo(p.cargo.nome)] ?? null : null
    }
    f.eventos = p.eventos.map((e) => ({ ...e, tipoNome: TIPOS_EVENTO[e.tipo] ?? e.tipo, postoAnteriorNome: e.postoAnterior ? nomeDoPosto(e.postoAnterior, p.ramo) : '', postoNovoNome: e.postoNovo ? nomeDoPosto(e.postoNovo, p.ramo) : '' }))
    f.graduacoes = p.graduacoes.map((g) => ({ ...g, postoNome: nomeDoPosto(g.posto, p.ramo) }))
    f.cursos = p.cursos.map((c) => ({ ...c, chaveNome: CURSOS_PROMOCAO[c.chave] ?? '' }))
    if (p.tipo === 'militar') {
      f.promocao = verificarPromocao({ ...p, historico: p.eventos }, { hoje })
      f.promocao.postoPropostoNome = f.promocao.postoProposto ? nomeDoPosto(f.promocao.postoProposto, p.ramo) : ''
      f.reservaReforma = reservaEReforma(p, hoje)
    } else f.progressao = verificarProgressaoCivil(p, { hoje })
    await this.auditoria.registar(u, 'ver_ficha', `${p.nome} (#${p.id})`)
    return f
  }

  #dados(d) {
    const x = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, vazioANulo(v)]))
    if (x.tipo === 'civil') for (const k of ['ramo', 'posto', 'fps', 'quadroEspecial', 'situacao', 'efectividade', 'estado', 'dataIngresso', 'dataIngressoQP', 'dataAntiguidadePosto', 'dataSituacao']) x[k] = null
    if (x.tipo === 'militar') {
      x.situacao ??= 'activo'
      x.efectividade ??= 'comissao_normal'
    }
    for (const k of Object.keys(x)) if (k.startsWith('data') && x[k]) x[k] = new Date(x[k])
    for (const k of ['nomeGuerra', 'naturalidade', 'provincia', 'pai', 'mae', 'telefone', 'morada', 'areaFormacao', 'especialidade', 'observacoes', 'municipio', 'bairro', 'rua', 'casa', 'caixaPostal', 'telefoneAlternativo', 'biLocalEmissao', 'grupoSanguineo', 'conjuge', 'conjugeLocalServico', 'inss', 'banco', 'iban', 'numeroConta', 'localIncorporacao', 'categoriaDocente']) if (k in x) x[k] ??= ''
    if (x.tipoDocente === '') x.tipoDocente = null
    // agregado familiar e vencimento ficam como texto (cifrado na base de dados)
    if ('agregado' in d) x.agregado = d.agregado?.length ? JSON.stringify(d.agregado) : ''
    if ('vencimento' in d) x.vencimento = d.vencimento === '' || d.vencimento === null || d.vencimento === undefined ? '' : String(Number(d.vencimento))
    if (x.email) x.email = x.email.toLowerCase()
    // empregados domiciliares têm a categoria própria (Trabalhador Domiciliar)
    if (x.vinculo === 'domiciliar') Object.assign(x, { carreiraCivil: 'trabalhador_domiciliar', categoriaCivil: 'Trabalhador Domiciliar' })
    // outras funções na Escola: sem repetir a principal; a domiciliar não acumula
    if ('outrosVinculos' in d) x.outrosVinculos = x.vinculo === 'domiciliar' ? [] : [...new Set(d.outrosVinculos ?? [])].filter((v) => v !== x.vinculo)
    for (const k of ['motivoSaida', 'destinoSaida']) if (k in x) x[k] ??= ''
    // saiu da Escola: fica a data de saída (hoje, se não se escreveu outra); voltou: apaga a saída
    if (x.ativo === false && !x.dataSaidaEscola) x.dataSaidaEscola = new Date(this.agora().toISOString().slice(0, 10))
    if (x.ativo === true) Object.assign(x, { dataSaidaEscola: null, motivoSaida: '', destinoSaida: '' })
    return x
  }

  async #gravar(fn) {
    try {
      return await fn()
    } catch (e) {
      if (eDuplicado(e)) {
        const campo = Object.keys(CAMPOS_UNICOS).find((k) => String(e.meta?.target ?? e.meta?.driverAdapterError?.cause?.constraint?.fields ?? e.message).includes(k === 'numeroAgente' ? 'numero_agente' : k))
        throw conflito(`Já existe uma ficha com esse ${CAMPOS_UNICOS[campo] ?? 'identificador'}.`)
      }
      throw e
    }
  }

  async #marcarSincronizacao(tx, p) {
    if (vaiParaPortal(p)) {
      await tx.sincronizacao.upsert({ where: { pessoaId: p.id }, create: { pessoaId: p.id }, update: { estado: 'pendente', tentativas: 0, erro: '' } })
      this.aoMudarPortal?.()
    }
  }

  // a(o) domiciliar só fica afecta(o) a oficial superior ou general, dentro do limite do posto
  async #verificarDomiciliar(d, id = null) {
    if (d.vinculo !== 'domiciliar') {
      d.militarAlocadoId = null
      return
    }
    const m = await this.bd.pessoa.findUnique({ where: { id: d.militarAlocadoId }, include: { _count: { select: { domiciliares: { where: { ativo: true, ...(id ? { id: { not: id } } : {}) } } } } } })
    if (!m || !temDireitoDomiciliar(m)) throw invalido('Só os oficiais superiores e generais têm empregados domiciliares.', 'militarAlocadoId')
    if (m._count.domiciliares >= limiteDomiciliares(m.posto)) throw invalido(`${m.nome} já tem ${m._count.domiciliares} empregado(s) domiciliar(es), o limite do posto.`, 'militarAlocadoId')
  }

  async criar(u, dados, { silencioso = false } = {}) {
    exigir(u, 'editar')
    const d = this.#dados(dados)
    const problema = problemaNaFicha(d)
    if (problema) throw invalido(problema[1], problema[0])
    if (d.tipo === 'civil') await this.#verificarDomiciliar(d)
    const p = await this.#gravar(() => this.bd.$transaction(async (tx) => {
      const n = await tx.pessoa.create({ data: d })
      await tx.evento.create({ data: { pessoaId: n.id, tipo: 'registo', data: this.agora(), descricao: 'Ficha criada no sistema.', criadoPor: u.email } })
      await this.#marcarSincronizacao(tx, n)
      return n
    }))
    if (!silencioso) await this.auditoria.registar(u, 'criar_ficha', `${p.nome} (#${p.id})`)
    return comDerivados(p, this.agora())
  }

  async editar(u, id, dados, { silencioso = false } = {}) {
    exigir(u, 'editar')
    const antes = await this.bd.pessoa.findUnique({ where: { id } })
    if (!antes) throw naoEncontrado('Ficha não encontrada.')
    const d = this.#dados({ ...dados, tipo: dados.tipo ?? antes.tipo })
    const problema = problemaNaFicha({ ...antes, ...d })
    if (problema) throw invalido(problema[1], problema[0])
    if ((d.tipo ?? antes.tipo) === 'civil' && ('vinculo' in d || 'militarAlocadoId' in d)) {
      const junto = { ...antes, ...d }
      await this.#verificarDomiciliar(junto, id)
      if (junto.vinculo !== 'domiciliar') d.militarAlocadoId = null
    }
    const p = await this.#gravar(() => this.bd.$transaction(async (tx) => {
      const n = await tx.pessoa.update({ where: { id }, data: d })
      const evento = (tipo, descricao, extra = {}) => tx.evento.create({ data: { pessoaId: id, tipo, data: this.agora(), descricao, criadoPor: u.email, ...extra } })
      if (antes.situacao && n.situacao !== antes.situacao) await evento('situacao', `${SITUACOES[antes.situacao]} → ${SITUACOES[n.situacao]}`)
      else if (n.situacao === 'activo' && antes.efectividade && n.efectividade !== antes.efectividade) await evento('situacao', `${EFECTIVIDADES[antes.efectividade]?.nome} → ${EFECTIVIDADES[n.efectividade]?.nome}`)
      if ((antes.estado ?? null) !== (n.estado ?? null)) await evento('estado', `${ESTADOS[antes.estado] ?? 'Ao serviço'} → ${ESTADOS[n.estado] ?? 'Ao serviço'}`)
      if (antes.posto && n.posto !== antes.posto) await evento('correcao', 'Posto corrigido na ficha (sem proposta).', { postoAnterior: antes.posto, postoNovo: n.posto })
      if (antes.ativo && !n.ativo) await evento('saida', [n.motivoSaida, n.destinoSaida && `Destino: ${n.destinoSaida}`].filter(Boolean).join(' · ') || d.observacoes || 'Deixou de servir na Escola.')
      if (!antes.ativo && n.ativo) await evento('colocacao', 'Voltou a servir na Escola.')
      if (vaiParaPortal(n) && ['nome', 'email', 'vinculo', 'outrosVinculos', 'posto', 'ramo', 'telefone', 'nip', 'unidadeId', 'ativo'].some((k) => String(antes[k]) !== String(n[k]))) await this.#marcarSincronizacao(tx, n)
      // deixou de ser docente/estudante ou saiu: o portal desativa a conta
      if (vaiParaPortal(antes) && !vaiParaPortal(n)) {
        await tx.sincronizacao.upsert({ where: { pessoaId: id }, create: { pessoaId: id }, update: { estado: 'pendente', tentativas: 0, erro: '' } })
        this.aoMudarPortal?.()
      }
      // a conta do sistema acompanha a unidade (expediente e mensagens) e fecha quando a pessoa sai
      if (n.unidadeId !== antes.unidadeId || n.ativo !== antes.ativo || n.nome !== antes.nome) await tx.utilizador.updateMany({ where: { pessoaId: id }, data: { unidadeId: n.unidadeId, nome: n.nome, ...(n.ativo ? {} : { ativo: false, versaoToken: { increment: 1 } }) } })
      return n
    }))
    if (!silencioso) await this.auditoria.registar(u, 'editar_ficha', `${p.nome} (#${p.id})`, { campos: Object.keys(dados) })
    return comDerivados(p, this.agora())
  }

  /*
    Consulta do Bilhete de Identidade na base de dados do Estado (API do Estado):
    devolve os dados para preencher a ficha. Sem chave configurada, diz que está desligada.
  */
  async consultarBi(u, numero) {
    exigir(u, 'editar')
    const bi = String(numero ?? '').trim().toUpperCase().replace(/\s/g, '')
    if (!/^[0-9]{9}[A-Z]{2}[0-9]{3}$/.test(bi)) throw invalido('Número de BI inválido (ex.: 001234567LA041).', 'bi')
    const { url, chave } = this.config.bi
    if (!chave) throw new ErroDominio('A consulta do BI não está configurada (BI_API_KEY no servidor).', 'indisponivel')
    let j
    try {
      const r = await this.enviar(`${url}?bi=${encodeURIComponent(bi)}`, { headers: { Authorization: `Basic ${chave}`, Accept: 'application/json' }, timeout: 15_000 })
      j = await r.json().catch(() => null)
    } catch {
      throw new ErroDominio('O serviço do BI não respondeu. Tente mais tarde ou preencha à mão.', 'indisponivel')
    }
    // 204: o BI não existe na base de dados do Estado
    if (!j || Number(j.code) !== 200 || !j.data) throw naoEncontrado(Number(j?.code) === 204 || !j?.message ? 'Não há dados deste BI na base de dados do Estado. Confirme o número.' : j.message)
    const x = j.data
    const junta = (...p) => p.map((v) => String(v ?? '').trim()).filter(Boolean).join(' ')
    const genero = /^f/i.test(x.gender_name ?? '') ? 'F' : /^m/i.test(x.gender_name ?? '') ? 'M' : null
    const estado = { solteiro: 'solteiro', solteira: 'solteiro', casado: 'casado', casada: 'casado', divorciado: 'divorciado', divorciada: 'divorciado', viuvo: 'viuvo', viuva: 'viuvo' }[String(x.marital_status_name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] ?? null
    const provincia = PROVINCIAS.find((p) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === String(x.birth_province_name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) ?? ''
    await this.auditoria.registar(u, 'consultar_bi', bi)
    return {
      bi, nome: nomeProprio(junta(x.first_name, x.last_name)), dataNascimento: x.birth_date ? String(x.birth_date).slice(0, 10) : null, genero, estadoCivil: estado,
      pai: nomeProprio(junta(x.father_first_name, x.father_last_name)), mae: nomeProprio(junta(x.mother_first_name, x.mother_last_name)),
      naturalidade: x.birth_municipality_name ?? '', provincia,
      morada: [x.residence_neighbor, x.residence_commune_name, x.residence_municipality_name, x.residence_province_name].filter(Boolean).join(', '),
    }
  }

  // oficiais superiores e generais com as(os) suas(seus) domiciliares e os lugares livres
  async domiciliares(u) {
    exigir(u, 'ver')
    const oficiais = await this.bd.pessoa.findMany({ where: { tipo: 'militar', ativo: true, situacao: { not: 'reforma' } }, include: { domiciliares: { where: { ativo: true }, select: { id: true, nome: true, numeroAgente: true, telefone: true, bi: true, dataAdmissao: true, fotoId: true } } } })
    return oficiais.filter(temDireitoDomiciliar).map((m) => ({
      id: m.id, nome: m.nome, nip: m.nip, ramo: m.ramo, postoNome: nomeDoPosto(m.posto, m.ramo), grau: comDerivados(m).grau, fotoId: m.fotoId,
      limite: limiteDomiciliares(m.posto), alocados: m.domiciliares.length, livres: Math.max(0, limiteDomiciliares(m.posto) - m.domiciliares.length),
      domiciliares: m.domiciliares.map((x) => ({ ...x, dataAdmissao: x.dataAdmissao?.toISOString().slice(0, 10) ?? null })),
    })).sort((a, b) => b.grau - a.grau || a.nome.localeCompare(b.nome))
  }

  async porIdentificacao(ident) {
    return this.bd.pessoa.findFirst({ where: { OR: [{ nip: ident }, { numeroAgente: ident }] }, select: { id: true, nome: true } })
  }

  async #existe(id) {
    if (!(await this.bd.pessoa.count({ where: { id } }))) throw naoEncontrado('Ficha não encontrada.')
  }

  // cursos (art. 48.º)
  async guardarCurso(u, pessoaId, cursoId, dados) {
    exigir(u, 'editar')
    await this.#existe(pessoaId)
    const d = { ...dados, chave: dados.chave || null, inicio: dados.inicio ? new Date(dados.inicio) : null, fim: dados.fim ? new Date(dados.fim) : null }
    if (d.chave && !CURSOS_PROMOCAO[d.chave]) throw invalido('Curso de promoção desconhecido.', 'chave')
    const c = cursoId
      ? await this.bd.curso.update({ where: { id: cursoId, pessoaId }, data: d })
      : await this.bd.curso.create({ data: { ...d, pessoaId } })
    await this.auditoria.registar(u, cursoId ? 'editar_curso' : 'adicionar_curso', `${c.nome} (ficha #${pessoaId})`)
    return c
  }

  async removerCurso(u, pessoaId, cursoId) {
    exigir(u, 'editar')
    const r = await this.bd.curso.deleteMany({ where: { id: cursoId, pessoaId } })
    if (!r.count) throw naoEncontrado('Curso não encontrado.')
    await this.auditoria.registar(u, 'remover_curso', `#${cursoId} (ficha #${pessoaId})`)
  }

  // registos do histórico lançados à mão (louvores, punições, transferências…)
  async adicionarEvento(u, pessoaId, { tipo, data, descricao, documento, entidade }) {
    exigir(u, 'editar')
    await this.#existe(pessoaId)
    if (!EVENTOS_MANUAIS.includes(tipo)) throw invalido('Este tipo de registo faz-se por proposta.', 'tipo')
    const e = await this.bd.evento.create({ data: { pessoaId, tipo, data: new Date(data), descricao, documento, entidade, criadoPor: u.email } })
    await this.auditoria.registar(u, 'adicionar_evento', `${TIPOS_EVENTO[tipo]} (ficha #${pessoaId})`)
    return e
  }

  async removerEvento(u, pessoaId, eventoId) {
    exigir(u, 'editar')
    const e = await this.bd.evento.findFirst({ where: { id: eventoId, pessoaId } })
    if (!e) throw naoEncontrado('Registo não encontrado.')
    if (!EVENTOS_MANUAIS.includes(e.tipo)) throw invalido('Os registos que vêm de extractos não se apagam.')
    await this.bd.evento.delete({ where: { id: eventoId } })
    await this.auditoria.registar(u, 'remover_evento', `${TIPOS_EVENTO[e.tipo]} (ficha #${pessoaId})`)
  }

  // termina uma graduação (art. 67.º: cessa com o fim do cargo, a promoção ou por despacho)
  async terminarGraduacao(u, pessoaId, graduacaoId, { fim, motivo = '' }) {
    exigir(u, 'editar')
    const g = await this.bd.graduacao.findFirst({ where: { id: graduacaoId, pessoaId, ativa: true } })
    if (!g) throw naoEncontrado('Graduação em curso não encontrada.')
    await this.bd.$transaction([
      this.bd.graduacao.update({ where: { id: g.id }, data: { ativa: false, fim: new Date(fim) } }),
      this.bd.evento.create({ data: { pessoaId, tipo: 'fim_graduacao', data: new Date(fim), postoNovo: g.posto, descricao: motivo, criadoPor: u.email } }),
    ])
    await this.auditoria.registar(u, 'terminar_graduacao', `ficha #${pessoaId}`)
  }

  async guardarFoto(u, pessoaId, fotoId) {
    exigir(u, 'editar')
    await this.#existe(pessoaId)
    const antes = await this.bd.pessoa.findUnique({ where: { id: pessoaId }, select: { fotoId: true } })
    await this.bd.pessoa.update({ where: { id: pessoaId }, data: { fotoId } })
    await this.auditoria.registar(u, 'mudar_foto', `ficha #${pessoaId}`)
    return antes.fotoId
  }

  // a fotografia vê-se em todo o sistema (listas, mensagens, expediente)
  async fotoDe(u, pessoaId) {
    return (await this.bd.pessoa.findUnique({ where: { id: pessoaId }, select: { fotoId: true } }))?.fotoId ?? null
  }

  // lista de antiguidade (arts. 26.º e 29.º) dos militares no activo, por posto (ou todos)
  async antiguidade(u, { posto, ramo } = {}) {
    exigir(u, 'ver')
    const lista = await this.bd.pessoa.findMany({ where: { tipo: 'militar', ativo: true, situacao: 'activo', ...(posto ? { posto } : {}), ...(ramo ? { ramo } : {}) }, include: { ...INCLUIR_LISTA, graduacoes: { select: { posto: true } } } })
    const hoje = this.agora()
    return ordenarAntiguidade(lista).map((p, i) => ({ ordem: i + 1, ...comDerivados(p, hoje), cursos: undefined, eventos: undefined, graduacoes: undefined }))
  }

  // quem está em condições de ser promovido (militares) ou de progredir (civis), com as condições da lei
  async elegiveis(u, { tipo = 'militar' } = {}) {
    exigir(u, 'ver')
    const hoje = this.agora()
    const lista = await this.bd.pessoa.findMany({ where: { tipo, ativo: true }, include: { ...INCLUIR_LISTA, eventos: { select: { tipo: true, data: true } } }, orderBy: { nome: 'asc' } })
    const emPropostaAberta = new Set((await this.bd.itemProposta.findMany({ where: { proposta: { estado: { in: ['rascunho', 'enviada'] }, tipo: { in: ['promocao', 'progressao'] } } }, select: { pessoaId: true } })).map((i) => i.pessoaId))
    return lista.map((p) => {
      const v = tipo === 'militar' ? verificarPromocao({ ...p, historico: p.eventos }, { hoje }) : verificarProgressaoCivil(p, { hoje })
      const f = comDerivados(p, hoje)
      return { id: p.id, nome: p.nome, fotoId: p.fotoId, nip: p.nip, numeroAgente: p.numeroAgente, ramo: p.ramo, postoNome: f.postoNome, postoAbreviatura: f.postoAbreviatura, categoriaCivil: p.categoriaCivil, unidadeId: p.unidadeId, unidadeNome: f.unidadeNome, cargoId: p.cargoId, cargoNome: f.cargoNome, grau: f.grau, tempoNoPosto: f.tempoNoPosto ?? f.tempoNaCategoria, elegivel: v.elegivel, proposto: v.postoProposto ? nomeDoPosto(v.postoProposto, p.ramo) : v.categoriaProposta, modalidade: v.modalidade ?? null, emProposta: emPropostaAberta.has(p.id), faltas: v.condicoes.filter((c) => c.estado === 'falta').map((c) => c.texto), confirmar: v.condicoes.filter((c) => c.estado === 'confirmar').map((c) => c.texto) }
    }).filter((x) => x.proposto)
  }

  // militares que passam à reserva ou à reforma nos próximos anos (art. 111.º e 114.º)
  async projecaoReserva(u, { anos = 5 } = {}) {
    exigir(u, 'ver')
    const hoje = this.agora()
    const limite = `${hoje.getUTCFullYear() + anos}-12-31`
    const lista = await this.bd.pessoa.findMany({ where: { tipo: 'militar', ativo: true, situacao: { in: ['activo', 'reserva'] } }, include: { unidade: { select: { nome: true } }, cargo: { select: { nome: true } } } })
    const r = []
    for (const p of lista) {
      const rr = reservaEReforma(p, hoje)
      const f = comDerivados(p, hoje)
      const base = { id: p.id, nome: p.nome, fotoId: p.fotoId, nip: p.nip, ramo: p.ramo, postoNome: f.postoNome, postoAbreviatura: f.postoAbreviatura, idade: f.idade, unidadeNome: f.unidadeNome, cargoNome: f.cargoNome }
      // com a data já passada fica marcado «em atraso»: a situação na ficha ainda não foi mudada
      const hojeTxt = hoje.toISOString().slice(0, 10)
      if (p.situacao === 'activo' && rr?.reserva && rr.reserva.data <= limite) r.push({ ...base, passagem: 'reserva', data: rr.reserva.data, artigo: rr.reserva.artigo, idadeLimite: rr.reserva.idadeLimite, atrasado: rr.reserva.data < hojeTxt })
      const reforma = [rr?.reforma?.data, rr?.reformaPorTempo?.data].filter(Boolean).sort()[0]
      if (reforma && reforma <= limite) r.push({ ...base, passagem: 'reforma', data: reforma, artigo: 'art. 114.º', atrasado: reforma < hojeTxt })
    }
    return r.sort((a, b) => a.data.localeCompare(b.data))
  }
}

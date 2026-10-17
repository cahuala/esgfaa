import { invalido, naoEncontrado } from '../erros.js'
import { TIPOS_LICENCA, verificarLicenca } from '../dominio/pessoal/carreira.js'
import { nomeDoPosto } from '../dominio/pessoal/hierarquia.js'
import { exigir } from './sessao.js'

const dia = (d) => new Date(d).toISOString().slice(0, 10)
const LICENCAS_CIVIS = { ferias: 'Férias', doenca: 'Doença', parto: 'Parto', nascimento_filho: 'Nascimento de filho', casamento: 'Casamento', luto: 'Luto', estudos: 'Estudos', sem_vencimento: 'Sem vencimento' }
export const NOMES_LICENCA = { ...Object.fromEntries(Object.entries(TIPOS_LICENCA).map(([k, v]) => [k, v.nome])), sem_vencimento: 'Sem vencimento' }

// licenças dos militares (arts. 31.º a 41.º) e do pessoal civil
export class ServicoLicencas {
  constructor({ bd, auditoria, agora = () => new Date() }) {
    Object.assign(this, { bd, auditoria, agora })
  }

  async listar(u, { pessoaId, tipo, estado, ano } = {}) {
    exigir(u, 'ver')
    const hoje = dia(this.agora())
    const where = { ...(pessoaId ? { pessoaId: Number(pessoaId) } : {}), ...(tipo ? { tipo } : {}) }
    if (ano) where.inicio = { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) }
    if (estado === 'em_curso') Object.assign(where, { inicio: { lte: new Date(hoje) }, fim: { gte: new Date(hoje) } })
    if (estado === 'futura') where.inicio = { gt: new Date(hoje) }
    const l = await this.bd.licenca.findMany({ where, include: { pessoa: { select: { id: true, nome: true, nip: true, numeroAgente: true, tipo: true, posto: true, ramo: true, fotoId: true } } }, orderBy: { inicio: 'desc' }, take: 5000 })
    return l.map((x) => ({ ...x, inicio: dia(x.inicio), fim: dia(x.fim), tipoNome: NOMES_LICENCA[x.tipo] ?? x.tipo, nome: x.pessoa.nome, fotoId: x.pessoa.fotoId, identificacao: x.pessoa.nip || x.pessoa.numeroAgente || '', postoNome: x.pessoa.posto ? nomeDoPosto(x.pessoa.posto, x.pessoa.ramo) : 'Civil', estado: dia(x.inicio) > hoje ? 'futura' : dia(x.fim) < hoje ? 'terminada' : 'em_curso', pessoa: undefined }))
  }

  // verifica sem gravar (o formulário mostra as condições antes de confirmar)
  async verificar(u, dados) {
    exigir(u, 'ver')
    const { p, anteriores } = await this.#contexto(dados.pessoaId)
    return this.#regras(p, dados, anteriores)
  }

  async #contexto(pessoaId) {
    const p = await this.bd.pessoa.findUnique({ where: { id: pessoaId } })
    if (!p) throw naoEncontrado('Ficha não encontrada.')
    const anteriores = await this.bd.licenca.findMany({ where: { pessoaId } })
    return { p, anteriores }
  }

  #regras(p, { tipo, inicio, fim }, anteriores) {
    if (new Date(fim) < new Date(inicio)) throw invalido('O fim tem de ser depois do início.', 'fim')
    const sobrepoe = anteriores.find((l) => new Date(l.inicio) <= new Date(fim) && new Date(l.fim) >= new Date(inicio))
    const extra = sobrepoe ? [{ id: 'sobreposicao', texto: 'Não coincide com outra licença', artigo: '—', estado: 'falta', detalhe: `${NOMES_LICENCA[sobrepoe.tipo]} de ${dia(sobrepoe.inicio)} a ${dia(sobrepoe.fim)}.` }] : []
    if (p.tipo === 'civil') {
      if (!LICENCAS_CIVIS[tipo]) throw invalido('Tipo de licença desconhecido.', 'tipo')
      const dias = Math.round((new Date(fim) - new Date(inicio)) / 86_400_000) + 1
      const condicoes = [{ id: 'regime', texto: 'Licença do regime geral da função pública', artigo: 'regime geral (a confirmar)', estado: 'confirmar', detalhe: '' }, ...extra]
      return { possivel: !extra.length, dias, condicoes }
    }
    const v = verificarLicenca(p, { tipo, inicio, fim }, anteriores, this.agora())
    v.condicoes.push(...extra)
    return { ...v, possivel: v.possivel && !extra.length }
  }

  async criar(u, dados) {
    exigir(u, 'editar')
    const { p, anteriores } = await this.#contexto(dados.pessoaId)
    const v = this.#regras(p, dados, anteriores)
    if (!v.possivel) throw invalido(`Não pode ser concedida: ${v.condicoes.filter((c) => c.estado === 'falta').map((c) => `${c.texto} (${c.artigo})`).join('; ')}.`)
    const l = await this.bd.licenca.create({ data: { pessoaId: p.id, tipo: dados.tipo, inicio: new Date(dados.inicio), fim: new Date(dados.fim), dias: v.dias, despacho: dados.despacho ?? '', observacoes: dados.observacoes ?? '', criadoPor: u.email } })
    await this.auditoria.registar(u, 'registar_licenca', `${p.nome}: ${NOMES_LICENCA[l.tipo]} ${dia(l.inicio)}–${dia(l.fim)}`)
    return { ...l, inicio: dia(l.inicio), fim: dia(l.fim) }
  }

  async remover(u, id) {
    exigir(u, 'editar')
    const l = await this.bd.licenca.findUnique({ where: { id } })
    if (!l) throw naoEncontrado('Licença não encontrada.')
    await this.bd.licenca.delete({ where: { id } })
    await this.auditoria.registar(u, 'remover_licenca', `#${id} (ficha #${l.pessoaId})`)
  }
}

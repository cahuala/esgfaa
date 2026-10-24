import { CATEGORIAS, EFECTIVIDADES, ESTADOS, FORMAS_SERVICO, GRUPOS, POSTOS, RAMOS, SITUACOES, quadroEspecial } from '../dominio/pessoal/hierarquia.js'
import { CARREIRAS_CIVIS } from '../dominio/pessoal/civis.js'
import { GENEROS, HABILITACOES, TIPOS, VINCULOS } from '../dominio/pessoal/ficha.js'
import { ESTADOS_PROPOSTA, TIPOS_PROPOSTA } from './propostas.js'
import { NOMES_LICENCA } from './licencas.js'
import { exigir } from './sessao.js'

// o painel é o mesmo para todos os que o vêem: calcula-se no máximo uma vez a cada 30 segundos (são as
// ~700 fichas com as carreiras, ~1,5 s no servidor), e outra vez logo depois de qualquer gravação
const VALIDADE_MS = 30_000

const FAIXAS = [['18-29', 'Menos de 30'], ['30-39', '30 a 39'], ['40-49', '40 a 49'], ['50-59', '50 a 59'], ['60-200', '60 ou mais']]

/*
  Painel: números e gráficos do pessoal. Cada barra/fatia traz o filtro que abre a lista correspondente
  (o navegador só tem de passar o filtro à página das pessoas).
*/
export class ServicoPainel {
  #memoria = null // { ate, promessa }

  constructor({ pessoas, bd, agora = () => new Date() }) {
    Object.assign(this, { pessoas, bd, agora })
  }

  // uma gravação (ficha, proposta, licença…) torna os números antigos: o próximo painel volta a calcular
  esquecer() {
    this.#memoria = null
  }

  resumo(u) {
    exigir(u, 'ver')
    const agora = Date.now()
    if (!this.#memoria || this.#memoria.ate < agora) {
      const promessa = this.#calcular(u)
      this.#memoria = { ate: agora + VALIDADE_MS, promessa }
      // um erro não fica guardado: o pedido seguinte volta a tentar
      promessa.catch(() => { if (this.#memoria?.promessa === promessa) this.#memoria = null })
    }
    return this.#memoria.promessa
  }

  async #calcular(u) {
    // a projecção da reserva corre ao mesmo tempo que a lista (eram uma depois da outra)
    const projecaoPedida = this.pessoas.projecaoReserva(u, { anos: 5 })
    projecaoPedida.catch(() => {})
    const todos = await this.pessoas.listar(u, {})
    const mil = todos.filter((p) => p.tipo === 'militar')
    const mulheres = todos.filter((p) => p.genero === 'F')
    const milF = mil.filter((p) => p.genero === 'F')
    const domiciliares = await this.bd.pessoa.count({ where: { ativo: true, vinculo: 'domiciliar' } })
    const civ = todos.filter((p) => p.tipo === 'civil')
    const hoje = this.agora()
    const anoAtual = hoje.getUTCFullYear()
    const hojeTxt = hoje.toISOString().slice(0, 10)

    // contagem por uma chave; rotulos: nome de cada valor; filtro: como se chama o filtro na lista
    const contar = (lista, chave, rotulos, filtro = chave, ordem) => {
      const m = new Map()
      for (const p of lista) {
        const v = typeof chave === 'function' ? chave(p) : p[chave]
        if (v === null || v === undefined || v === '') continue
        m.set(v, (m.get(v) || 0) + 1)
      }
      let r = [...m].map(([v, n]) => ({ chave: v, rotulo: (typeof rotulos === 'function' ? rotulos(v) : rotulos?.[v]) ?? String(v), valor: n, filtro: { [filtro]: v } }))
      if (ordem) r.sort(ordem)
      else r.sort((a, b) => b.valor - a.valor)
      return r
    }
    const base = (extra) => (g) => ({ ...g, filtro: { ...extra, ...g.filtro } })

    const faixa = (p) => FAIXAS.find(([k]) => { const [a, b] = k.split('-').map(Number); return p.idade !== null && p.idade >= a && p.idade <= b })?.[0]
    const [licencas, propostas, eventos, cargos] = await Promise.all([
      this.bd.licenca.findMany({ where: { fim: { gte: new Date(`${anoAtual}-01-01`) } }, select: { tipo: true, inicio: true, fim: true, pessoaId: true } }),
      this.bd.proposta.findMany({ select: { estado: true, tipo: true, id: true, titulo: true, submetidaEm: true, _count: { select: { itens: true } } } }),
      this.bd.evento.findMany({ where: { data: { gte: new Date(Date.UTC(anoAtual - 1, hoje.getUTCMonth() + 1, 1)) }, tipo: { in: ['promocao', 'graduacao', 'nomeacao', 'exoneracao', 'progressao'] } }, select: { tipo: true, data: true } }),
      this.bd.cargo.findMany({ select: { vagas: true, tipo: true, _count: { select: { pessoas: { where: { ativo: true } } } } } }),
    ])
    const emLicenca = new Set(licencas.filter((l) => l.inicio.toISOString().slice(0, 10) <= hojeTxt && l.fim.toISOString().slice(0, 10) >= hojeTxt).map((l) => l.pessoaId))
    const lugares = cargos.reduce((s, c) => s + c.vagas, 0)
    const ocupados = cargos.reduce((s, c) => s + Math.min(c.vagas, c._count.pessoas), 0)

    // promoções, graduações e nomeações dos últimos 12 meses
    const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(anoAtual, hoje.getUTCMonth() - 11 + i, 1)); return d.toISOString().slice(0, 7) })
    const movimentos = ['promocao', 'graduacao', 'nomeacao', 'progressao'].map((t) => ({ tipo: t, rotulo: { promocao: 'Promoções', graduacao: 'Graduações', nomeacao: 'Nomeações', progressao: 'Progressões (civis)' }[t], valores: meses.map((m) => eventos.filter((e) => e.tipo === t && e.data.toISOString().startsWith(m)).length) }))

    const reservaAnos = Array.from({ length: 6 }, (_, i) => anoAtual + i)
    const projecao = await projecaoPedida

    return {
      totais: {
        total: todos.length, militares: mil.length, civis: civ.length,
        docentes: todos.filter((p) => p.docente).length, estudantes: todos.filter((p) => p.discente).length, funcionarios: todos.filter((p) => p.vinculo === 'funcionario').length,
        oficiais: mil.filter((p) => p.grupo === 'oficiais').length, sargentos: mil.filter((p) => p.grupo === 'sargentos').length, pracas: mil.filter((p) => p.grupo === 'pracas').length,
        mulheres: mulheres.length, mulheresMilitares: milF.length, mulheresOficiais: milF.filter((p) => p.grupo === 'oficiais').length,
        domiciliares,
        elegiveis: todos.filter((p) => p.elegivelPromocao && (p.tipo === 'civil' || p.situacao === 'activo')).length,
        emLicenca: emLicenca.size,
        graduados: mil.filter((p) => p.graduacoes?.length).length,
        semCargo: todos.filter((p) => !p.cargoId && p.vinculo !== 'estudante').length,
        propostasDespacho: propostas.filter((p) => p.estado === 'enviada').length,
        propostasPreparacao: propostas.filter((p) => p.estado === 'rascunho').length,
        reservaEsteAno: projecao.filter((x) => x.passagem === 'reserva' && x.data.startsWith(String(anoAtual))).length,
        lugares, lugaresOcupados: ocupados,
      },
      graficos: {
        tipo: contar(todos, 'tipo', TIPOS),
        vinculo: contar(todos, 'vinculo', VINCULOS),
        ramo: contar(mil, 'ramo', Object.fromEntries(Object.entries(RAMOS).map(([k, v]) => [k, v.nome]))).map(base({ tipo: 'militar' })),
        grupo: contar(mil, 'grupo', GRUPOS).map(base({ tipo: 'militar' })),
        categoria: contar(mil, 'categoria', Object.fromEntries(Object.entries(CATEGORIAS).map(([k, v]) => [k, v.nome])), 'categoria', (a, b) => Object.keys(CATEGORIAS).indexOf(a.chave) - Object.keys(CATEGORIAS).indexOf(b.chave))
          .map(base({ tipo: 'militar' })),
        posto: contar(mil, 'posto', (v) => POSTOS[v]?.nomes.EXE, 'posto', (a, b) => POSTOS[b.chave].grau - POSTOS[a.chave].grau).map(base({ tipo: 'militar' })),
        postoPorRamo: Object.keys(RAMOS).map((r) => ({ ramo: r, rotulo: RAMOS[r].nome, valores: Object.keys(CATEGORIAS).map((c) => mil.filter((p) => p.ramo === r && p.categoria === c).length) })),
        categorias: Object.keys(CATEGORIAS).map((c) => ({ chave: c, rotulo: CATEGORIAS[c].nome })),
        fps: contar(mil, 'fps', Object.fromEntries(Object.entries(FORMAS_SERVICO).map(([k, v]) => [k, v.nome]))).map(base({ tipo: 'militar' })),
        situacao: contar(mil, 'situacao', SITUACOES).map(base({ tipo: 'militar' })),
        // no activo: cada ramo da árvore (em efectividade / fora de efectividade)
        efectividade: contar(mil.filter((p) => p.situacao === 'activo'), 'efectividade', Object.fromEntries(Object.entries(EFECTIVIDADES).map(([k, v]) => [k, v.nome]))).map(base({ tipo: 'militar', situacao: 'activo' })),
        estado: contar(mil, (p) => p.estado || 'ao_servico', { ao_servico: 'Ao serviço', ...ESTADOS }, 'estado').filter((x) => x.chave !== 'ao_servico').map(base({ tipo: 'militar' })),
        quadro: contar(mil, (p) => p.quadroEspecial && `${p.quadroEspecial}`, (v) => mil.map((p) => p.quadroEspecial === v && quadroEspecial(p.ramo, v)?.nome).find(Boolean) || v, 'quadroEspecial').slice(0, 12).map(base({ tipo: 'militar' })),
        genero: contar(todos, 'genero', GENEROS),
        // mulheres: por ramo, por categoria, por posto, por vínculo e a proporção em cada ramo
        mulheresRamo: contar(milF, 'ramo', Object.fromEntries(Object.entries(RAMOS).map(([k, v]) => [k, v.nome]))).map(base({ tipo: 'militar', genero: 'F' })),
        mulheresCategoria: contar(milF, 'categoria', Object.fromEntries(Object.entries(CATEGORIAS).map(([k, v]) => [k, v.nome])), 'categoria', (a, b) => Object.keys(CATEGORIAS).indexOf(a.chave) - Object.keys(CATEGORIAS).indexOf(b.chave)).map(base({ tipo: 'militar', genero: 'F' })),
        mulheresPosto: contar(milF, 'posto', (v) => POSTOS[v]?.nomes.EXE, 'posto', (a, b) => POSTOS[b.chave].grau - POSTOS[a.chave].grau).map(base({ tipo: 'militar', genero: 'F' })),
        mulheresVinculo: contar(mulheres, 'vinculo', VINCULOS).map(base({ genero: 'F' })),
        generoPorRamo: Object.keys(RAMOS).map((r) => ({ ramo: r, rotulo: RAMOS[r].nome, homens: mil.filter((p) => p.ramo === r && p.genero !== 'F').length, mulheres: milF.filter((p) => p.ramo === r).length })),
        faixaEtaria: contar(todos, faixa, Object.fromEntries(FAIXAS), 'idade', (a, b) => a.chave.localeCompare(b.chave)),
        habilitacao: contar(todos, 'habilitacao', HABILITACOES, 'habilitacao', (a, b) => Object.keys(HABILITACOES).indexOf(a.chave) - Object.keys(HABILITACOES).indexOf(b.chave)),
        provincia: contar(todos, 'provincia', null),
        unidade: contar(todos, 'unidadeId', Object.fromEntries(todos.map((p) => [p.unidadeId, p.unidadeNome]))).slice(0, 15),
        carreiraCivil: contar(civ, 'carreiraCivil', Object.fromEntries(Object.entries(CARREIRAS_CIVIS).map(([k, v]) => [k, v.nome])), 'carreiraCivil', (a, b) => (CARREIRAS_CIVIS[a.chave]?.nivel ?? 9) - (CARREIRAS_CIVIS[b.chave]?.nivel ?? 9)).map(base({ tipo: 'civil' })),
        licencas: contar(licencas.filter((l) => l.inicio.getUTCFullYear() === anoAtual), 'tipo', NOMES_LICENCA, 'tipo'),
        propostas: contar(propostas, 'estado', ESTADOS_PROPOSTA, 'estado'),
        propostasTipo: contar(propostas, 'tipo', Object.fromEntries(Object.entries(TIPOS_PROPOSTA).map(([k, v]) => [k, v.nome])), 'tipo'),
        movimentos: { meses, series: movimentos },
        reserva: reservaAnos.map((a) => ({ chave: a, rotulo: String(a), reserva: projecao.filter((x) => x.passagem === 'reserva' && x.data.startsWith(String(a))).length, reforma: projecao.filter((x) => x.passagem === 'reforma' && x.data.startsWith(String(a))).length })),
        ocupacao: ['militar', 'civil', 'ambos'].map((t) => {
          const cs = cargos.filter((c) => c.tipo === t)
          const v = cs.reduce((s, c) => s + c.vagas, 0)
          const o = cs.reduce((s, c) => s + Math.min(c.vagas, c._count.pessoas), 0)
          return { chave: t, rotulo: { militar: 'Cargos militares', civil: 'Cargos civis', ambos: 'Militar ou civil' }[t], ocupados: o, livres: v - o }
        }).filter((x) => x.ocupados + x.livres),
      },
      listas: {
        despacho: propostas.filter((p) => p.estado === 'enviada').sort((a, b) => a.submetidaEm - b.submetidaEm).slice(0, 8).map((p) => ({ id: p.id, titulo: p.titulo, tipoNome: TIPOS_PROPOSTA[p.tipo]?.nome, pessoas: p._count.itens, submetidaEm: p.submetidaEm })),
        reserva: projecao.slice(0, 8),
        aniversarios: todos.filter((p) => p.dataNascimento?.slice(5, 7) === hojeTxt.slice(5, 7)).sort((a, b) => a.dataNascimento.slice(8).localeCompare(b.dataNascimento.slice(8))).slice(0, 10).map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, dia: p.dataNascimento.slice(8), idade: p.idade + (p.dataNascimento.slice(5) > hojeTxt.slice(5) ? 1 : 0) })),
      },
    }
  }
}

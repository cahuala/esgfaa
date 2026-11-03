import { invalido, naoEncontrado } from '../erros.js'
import { exigir } from './sessao.js'
import { CATEGORIAS_DOCENTE, CATEGORIAS_DOCENTE_CONTRATADO, MOTIVOS_SAIDA, PROVINCIAS } from '../dominio/pessoal/ficha.js'
import { TIPOS_DOCUMENTO } from './processos.js'
import { TIPOS_EXPEDIENTE } from './expediente.js'
import { TIPOS_UNIDADE } from './organica.js'

// bancos angolanos (sigla → nome); as cores dos cartões ficam no navegador
export const BANCOS = {
  BAI: 'Banco Angolano de Investimentos', BPC: 'Banco de Poupança e Crédito', BFA: 'Banco de Fomento Angola', BIC: 'Banco BIC',
  BNI: 'Banco de Negócios Internacional', ATL: 'Banco Millennium Atlântico', BCI: 'Banco de Comércio e Indústria', BSOL: 'Banco Sol',
  KEVE: 'Banco Keve', SBA: 'Standard Bank Angola', BCGA: 'Banco Caixa Geral Angola', BE: 'Banco Económico', BYETU: 'Banco Yetu',
}

/*
  Listas do sistema que a Repartição muda em Configurações (o que vem da lei com regras — postos, ramos,
  formas de prestação de serviço, situações, licenças — fica no código).
  Listas de texto: o que se escolhe fica escrito na ficha, por isso tirar uma entrada não estraga nada.
  Listas com chave (chaves: true): a ficha guarda a chave; as que vêm de origem mudam de nome mas não se tiram.
*/
export const LISTAS = {
  categoriasDocente: { grupo: 'Docentes', nome: 'Categorias do docente — carreira', fonte: 'Decreto Presidencial n.º 191/18, art. 4.º', padrao: CATEGORIAS_DOCENTE },
  categoriasDocenteContratado: { grupo: 'Docentes', nome: 'Categorias do docente — especialmente contratado', fonte: 'Decreto Presidencial n.º 191/18, art. 5.º', padrao: CATEGORIAS_DOCENTE_CONTRATADO },
  provincias: { grupo: 'Ficha individual', nome: 'Províncias', padrao: PROVINCIAS },
  motivosSaida: { grupo: 'Ficha individual', nome: 'Motivos de saída da Escola', padrao: MOTIVOS_SAIDA },
  bancos: { grupo: 'Ficha individual', nome: 'Bancos', chaves: true, rotuloChave: 'Sigla', padrao: BANCOS },
  tiposDocumento: { grupo: 'Processo individual', nome: 'Tipos de documento do processo', chaves: true, padrao: TIPOS_DOCUMENTO },
  tiposExpediente: { grupo: 'Expediente', nome: 'Tipos de expediente', chaves: true, padrao: TIPOS_EXPEDIENTE },
  tiposUnidade: { grupo: 'Orgânica', nome: 'Tipos de unidade', chaves: true, padrao: TIPOS_UNIDADE },
}

const CHAVE = 'listas'
const CHAVE_VALIDA = /^[A-Za-z0-9_]{1,30}$/
const igual = (a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }) === 0

export class ServicoListas {
  constructor({ bd, auditoria }) {
    Object.assign(this, { bd, auditoria })
    this.cache = null
  }

  // as listas em uso (as mudadas por cima das de origem); guardadas em memória até alguém mudar
  async todas() {
    if (!this.cache) {
      const d = await this.bd.definicao.findUnique({ where: { chave: CHAVE } })
      const mudadas = d?.valor ?? {}
      this.cache = Object.fromEntries(Object.entries(LISTAS).map(([k, l]) => [k, mudadas[k] ?? l.padrao]))
    }
    return this.cache
  }

  async listar(u) {
    exigir(u, 'ver')
    const atuais = await this.todas()
    return Object.entries(LISTAS).map(([id, l]) => ({
      id, grupo: l.grupo, nome: l.nome, fonte: l.fonte ?? '', chaves: Boolean(l.chaves), rotuloChave: l.rotuloChave ?? 'Código',
      valor: atuais[id], fixas: l.chaves ? Object.keys(l.padrao) : [], mudada: JSON.stringify(atuais[id]) !== JSON.stringify(l.padrao),
    }))
  }

  async guardar(u, id, valor) {
    exigir(u, 'administrar')
    const l = LISTAS[id]
    if (!l) throw naoEncontrado('Lista desconhecida.')
    const limpo = l.chaves ? validarComChave(l, valor) : validarTexto(valor)
    await this.#gravar((m) => ({ ...m, [id]: limpo }))
    await this.auditoria.registar(u, 'mudar_lista', l.nome)
    return (await this.listar(u)).find((x) => x.id === id)
  }

  // volta à lista de origem
  async repor(u, id) {
    exigir(u, 'administrar')
    const l = LISTAS[id]
    if (!l) throw naoEncontrado('Lista desconhecida.')
    await this.#gravar((m) => { const n = { ...m }; delete n[id]; return n })
    await this.auditoria.registar(u, 'repor_lista', l.nome)
    return (await this.listar(u)).find((x) => x.id === id)
  }

  async #gravar(mudar) {
    const d = await this.bd.definicao.findUnique({ where: { chave: CHAVE } })
    const valor = mudar(d?.valor ?? {})
    await this.bd.definicao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor }, update: { valor } })
    this.cache = null
  }
}

function validarTexto(valor) {
  if (!Array.isArray(valor)) throw invalido('A lista deve ser uma lista de nomes.', 'valor')
  const l = []
  for (const v of valor) {
    const t = String(v ?? '').trim().replace(/\s+/g, ' ')
    if (!t) continue
    if (t.length > 120) throw invalido(`«${t.slice(0, 40)}…» é demasiado comprido (até 120 letras).`, 'valor')
    if (l.some((x) => igual(x, t))) throw invalido(`«${t}» está repetido.`, 'valor')
    l.push(t)
  }
  if (!l.length) throw invalido('A lista não pode ficar vazia.', 'valor')
  if (l.length > 300) throw invalido('A lista tem entradas a mais (até 300).', 'valor')
  return l
}

function validarComChave(lista, valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw invalido('A lista deve ter código e nome.', 'valor')
  const r = {}
  for (const [k, v] of Object.entries(valor)) {
    const chave = String(k).trim()
    const nome = String(v ?? '').trim().replace(/\s+/g, ' ')
    if (!CHAVE_VALIDA.test(chave)) throw invalido(`O código «${chave}» só pode ter letras sem acentos, algarismos e _ (até 30).`, 'valor')
    if (!nome) throw invalido(`Falta o nome de «${chave}».`, 'valor')
    if (nome.length > 120) throw invalido(`O nome de «${chave}» é demasiado comprido (até 120 letras).`, 'valor')
    if (Object.keys(r).some((x) => x.toLowerCase() === chave.toLowerCase())) throw invalido(`O código «${chave}» está repetido.`, 'valor')
    if (Object.values(r).some((x) => igual(x, nome))) throw invalido(`«${nome}» está repetido.`, 'valor')
    r[chave] = nome
  }
  // as de origem (a ficha e o sistema guardam o código) não se tiram
  const falta = Object.keys(lista.padrao).filter((k) => !(k in r))
  if (falta.length) throw invalido(`Estas não se podem tirar (o sistema usa-as): ${falta.map((k) => lista.padrao[k]).join(', ')}. Pode mudar-lhes o nome.`, 'valor')
  if (Object.keys(r).length > 300) throw invalido('A lista tem entradas a mais (até 300).', 'valor')
  return r
}

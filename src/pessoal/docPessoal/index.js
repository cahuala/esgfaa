import { M, novoDocumento, rodape } from './base'
import { declaracao, guiaMarcha } from './declaracoes'
import { anexoFichaIndividual, fichaAvaliacao, fichaDisciplinar, fichaIndividualCivil, fichaIndividualMilitar, fichaMecanografica, fichaRegistoBiografico, processoPromocao, propostaNomeacao } from './fichas'

/*
  Documentos pessoais que se tiram da ficha (botão «Documentos»): para quem servem, as opções que pedem e
  como se desenham. Vários escolhidos saem num só PDF, cada um a começar numa página nova.
*/
const militar = (p) => p.tipo === 'militar'
const civil = (p) => p.tipo === 'civil'
const hoje = () => new Date().toISOString().slice(0, 10)

const FINALIDADE = { campo: 'finalidade', rotulo: 'Finalidade (OBS)', tipo: 'texto', ajuda: 'Ex.: efeito de Actualização de Conta Bancária; obtenção de Visto para Portugal.' }
const VALOR = (p, obrigatorio = false) => ({ campo: 'valor', rotulo: 'Vencimento mensal (KZ)', tipo: 'numero', inicial: p.vencimento ?? '', obrigatorio, ajuda: obrigatorio ? '' : 'Vazio = a declaração não fala do vencimento.' })
const DIAS = (n) => ({ campo: 'dias', rotulo: 'Dias', tipo: 'numero', inicial: n, obrigatorio: true })
const INICIO = { campo: 'inicio', rotulo: 'A partir de', tipo: 'data', inicial: hoje(), obrigatorio: true }

export const GRUPOS_DOC = [['declaracoes', 'Declarações'], ['guias', 'Guias de marcha'], ['fichas', 'Fichas']]

export const CATALOGO = [
  { tipo: 'declaracao_efectividade', grupo: 'declaracoes', nome: 'Declaração de efectividade', para: (p) => militar(p), opcoes: (p) => [FINALIDADE, VALOR(p), ...(p.vinculo === 'estudante' ? [{ campo: 'curso', rotulo: 'Discente do (curso)', tipo: 'texto', inicial: (p.cursos ?? []).find((c) => !c.fim)?.nome ?? '' }] : [])],
    desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'efectividade' }, q) },
  { tipo: 'declaracao_salario', grupo: 'declaracoes', nome: 'Declaração de salário', para: militar, opcoes: (p) => [VALOR(p, true), FINALIDADE], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'salario' }, q) },
  { tipo: 'declaracao_servico', grupo: 'declaracoes', nome: 'Declaração de serviço', para: civil, opcoes: (p) => [VALOR(p), FINALIDADE], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'servico' }, q) },

  { tipo: 'guia_ferias', grupo: 'guias', nome: 'Guia de marcha — férias', para: (p) => p.vinculo !== 'domiciliar', opcoes: () => [DIAS(30), INICIO], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'ferias' }, q) },
  { tipo: 'guia_licenca', grupo: 'guias', nome: 'Guia de marcha — licença disciplinar', para: militar, opcoes: () => [DIAS(15), INICIO], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'licenca' }, q) },
  { tipo: 'guia_dispensa', grupo: 'guias', nome: 'Guia de marcha — dispensa', para: () => true, opcoes: () => [DIAS(5), INICIO, { campo: 'motivo', rotulo: 'A fim de tratar', tipo: 'escolha', inicial: 'Assuntos Pessoais', valores: ['Assuntos Pessoais', 'Assunto Familiar', 'Assuntos de Saúde'] }, { campo: 'provincia', rotulo: 'Na província de', tipo: 'texto', inicial: '' }], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'dispensa' }, q) },
  { tipo: 'guia_apresentacao', grupo: 'guias', nome: 'Guia de marcha — apresentação', para: (p) => p.vinculo !== 'domiciliar', opcoes: () => [{ campo: 'destino', rotulo: 'Apresentar-se à', tipo: 'texto', obrigatorio: true, ajuda: 'Ex.: Direcção de Pessoal e Quadros do Comando do Exército' }, { campo: 'referencia', rotulo: 'Em conformidade com', tipo: 'texto', ajuda: 'Ex.: Ofício nº 7028/11.RGC/DPPQ/EMGFAA/2025' }, { campo: 'fundamento', rotulo: 'Motivo', tipo: 'texto' }, DIAS(7)], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'apresentacao' }, q) },

  { tipo: 'ficha_individual', grupo: 'fichas', nome: 'Ficha individual', para: () => true, opcoes: () => [], desenhar: async (d, p) => (militar(p) ? (await fichaIndividualMilitar(d, p), anexoFichaIndividual(d, p)) : fichaIndividualCivil(d, p)) },
  { tipo: 'ficha_mecanografica', grupo: 'fichas', nome: 'Ficha mecanográfica', para: militar, opcoes: () => [], desenhar: (d, p) => fichaMecanografica(d, p) },
  { tipo: 'ficha_registo_biografico', grupo: 'fichas', nome: 'Ficha de registo biográfico', para: civil, opcoes: () => [], desenhar: (d, p) => fichaRegistoBiografico(d, p) },
  { tipo: 'ficha_disciplinar', grupo: 'fichas', nome: 'Ficha disciplinar', para: () => true, opcoes: () => [], desenhar: (d, p) => fichaDisciplinar(d, p) },
  { tipo: 'ficha_avaliacao', grupo: 'fichas', nome: 'Ficha de avaliação individual (FAI)', para: militar, opcoes: () => [], desenhar: (d, p) => fichaAvaliacao(d, p) },
  { tipo: 'proposta_nomeacao', grupo: 'fichas', nome: 'Proposta de nomeação', para: militar, opcoes: () => [{ campo: 'cargoProposto', rotulo: 'Cargo proposto', tipo: 'texto', obrigatorio: true }, { campo: 'unidadeProposta', rotulo: 'U/E/O do cargo', tipo: 'texto', inicial: 'Escola Superior de Guerra' }, { campo: 'fundamento', rotulo: 'Fundamento da proposta', tipo: 'texto' }], desenhar: (d, p, o, q) => propostaNomeacao(d, p, o, q) },
  { tipo: 'processo_promocao', grupo: 'fichas', nome: 'Processo individual de promoção (PIP)', para: militar, opcoes: () => [], desenhar: (d, p) => processoPromocao(d, p) },
]

export const documentosPara = (p) => CATALOGO.filter((c) => c.para(p))

// escolhas: [{ tipo, dados }]; emitidos: o que o servidor registou (com o número das declarações)
export async function gerarDocumentosPessoais(p, escolhas, emitidos, quem) {
  const d = await novoDocumento()
  for (const [i, e] of escolhas.entries()) {
    const c = CATALOGO.find((x) => x.tipo === e.tipo)
    await c.desenhar(d, p, { ...e.dados, numero: emitidos[i]?.numero, ano: emitidos[i]?.ano }, quem)
  }
  rodape(d)
  const nome = `${M(p.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-documentos-${new Date().toISOString().slice(0, 10)}.pdf`
  d.doc.save(nome)
}

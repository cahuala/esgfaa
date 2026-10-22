import { M, dataExtenso, kwanzas, novoDocumento } from './base'
import { declaracao, declaracaoBanco, guiaMarcha } from './declaracoes'
import { fichaDocente, anexoFichaIndividual, fichaAvaliacao, fichaDisciplinar, fichaIndividualCivil, fichaIndividualMilitar, fichaMecanografica, fichaRegistoBiografico, processoPromocao, propostaNomeacao } from './fichas'

/*
  Documentos pessoais que se tiram da ficha (botão «Documentos»): para quem servem, as opções que pedem e
  como se desenham. Vários escolhidos saem num só PDF, cada um a começar numa página nova.
*/
const militar = (p) => p.tipo === 'militar'
const civil = (p) => p.tipo === 'civil'
const hoje = () => new Date().toISOString().slice(0, 10)

const FINALIDADE = { campo: 'finalidade', rotulo: 'Finalidade (OBS)', tipo: 'texto', ajuda: 'Ex.: efeito de Actualização de Conta Bancária; obtenção de Visto para Portugal.' }
// vencimento da tabela salarial (líquido): do posto (militares); do cargo e, sem ele, da categoria (civis)
export const vencimentoDaTabela = (p) => (militar(p) ? p.vencimentoTabela?.liquido : p.vencimentoCargo ?? p.remuneracao?.liquido) ?? null
/*
  O vencimento escreve-se ao emitir; se ficar vazio, vai o da ficha e, sem ele, o líquido da tabela salarial.
  Nas declarações de efectividade e de serviço pode escolher-se não falar do vencimento.
*/
const VALOR = (p) => {
  const tabela = vencimentoDaTabela(p)
  return { campo: 'valor', rotulo: 'Vencimento mensal (KZ)', tipo: 'numero', inicial: p.vencimento ?? '', ajuda: `Vazio = ${p.vencimento ? 'o da ficha' : tabela ? `o da tabela salarial (${kwanzas(tabela)} KZ líquido)` : 'sem vencimento (falta a tabela)'}.` }
}
const semDomiciliar = (f) => (p) => f(p) && p.vinculo !== 'domiciliar'
// o dia que vai no documento («ESG em Luanda, 24 de Junho de 2026»): por defeito hoje, mas pode ser outro
const DATA_DOC = { campo: 'data', rotulo: 'Data', tipo: 'data', inicial: hoje(), obrigatorio: true }
const DIAS = (n) => ({ campo: 'dias', rotulo: 'Dias', tipo: 'numero', inicial: n, obrigatorio: true })
const INICIO = { campo: 'inicio', rotulo: 'A partir de', tipo: 'data', inicial: hoje(), obrigatorio: true }
const DATA_GUIA = { ...DATA_DOC, rotulo: 'Data da guia' }
const opcoesDispensa = (motivo) => [INICIO, DIAS(5), FIM, { campo: 'motivo', rotulo: 'A fim de tratar', tipo: 'escolha', inicial: motivo, valores: ['Assuntos Pessoais', 'Assunto Familiar', 'Assuntos de Saúde'] }, { campo: 'provincia', rotulo: 'Na província de', tipo: 'texto', inicial: '' }, DATA_GUIA]
const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(n) - 1); return d.toISOString().slice(0, 10) }
// fim calculado (art. 32.º): o último dia do período, contado a partir do início
const FIM = { campo: 'fim', rotulo: 'Termina em (automático)', tipo: 'calculado', calcular: (v) => (v.inicio && Number(v.dias) > 0 ? dataExtenso(somarDias(v.inicio, v.dias)) : '') }
/*
  Guia de férias: sai do plano de férias (início no dia 1 do mês planeado, os dias a que tem direito).
  Fora do plano escreve-se o início e o fim conta-se sozinho pela lei (Lei n.º 13/18, art. 32.º).
*/
function opcoesFerias(p) {
  const ano = new Date().getFullYear()
  const plano = (p.planoFerias ?? []).find((x) => x.ano === ano) ?? (p.planoFerias ?? []).find((x) => x.ano === ano + 1)
  const inicio = plano ? `${plano.ano}-${String(plano.mes).padStart(2, '0')}-01` : hoje()
  const dias = p.diasFerias ?? 30
  const aviso = (v) => {
    if (!plano) return `Não está no plano de férias de ${ano}: escreva o início; o fim conta-se pelos ${v.dias || dias} dias a que tem direito (art. 32.º).`
    const fora = v.inicio && v.inicio.slice(0, 7) !== inicio.slice(0, 7)
    return fora ? `Fora do plano (planeado para ${dataExtenso(inicio).slice(6)}): o fim conta-se pelos ${v.dias || dias} dias (art. 32.º).` : `Do plano de férias: ${dataExtenso(inicio).slice(6)}, ${dias} dias.`
  }
  return [{ campo: 'inicio', rotulo: 'A partir de', tipo: 'data', inicial: inicio, obrigatorio: true }, DIAS(dias), FIM, { campo: 'aviso', tipo: 'aviso', texto: aviso }]
}

export const GRUPOS_DOC = [['declaracoes', 'Declarações'], ['guias', 'Guias de marcha'], ['fichas', 'Fichas']]

export const CATALOGO = [
  // os sete modelos de declaração da ESG (a caixa do canto do modelo diz para quem é)
  { tipo: 'declaracao_efectividade', grupo: 'declaracoes', nome: 'Efectividade — para efectivo militar', para: semDomiciliar(militar), semVencimento: true, opcoes: () => [DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'efectividade', semObs: true }, q) },
  { tipo: 'declaracao_efectividade_vencimento', grupo: 'declaracoes', nome: 'Efectividade com o vencimento — para efectivo militar', para: semDomiciliar(militar), opcoes: (p) => [VALOR(p), FINALIDADE, DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'efectividade' }, q) },
  { tipo: 'declaracao_efectividade_discente', grupo: 'declaracoes', nome: 'Efectividade — para discentes', para: (p) => militar(p) && Boolean(p.discente || p.vinculo === 'estudante'), opcoes: (p) => [{ campo: 'curso', rotulo: 'Discente do (curso)', tipo: 'texto', obrigatorio: true, inicial: (p.cursos ?? []).find((c) => !c.fim)?.nome || (p.vinculo === 'estudante' ? p.unidadeNome : '') || '' }, VALOR(p), FINALIDADE, DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'efectividade' }, q) },
  { tipo: 'declaracao_salario', grupo: 'declaracoes', nome: 'Salário — para efectivo militar', para: semDomiciliar(militar), opcoes: (p) => [VALOR(p), FINALIDADE, DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'salario' }, q) },
  { tipo: 'declaracao_servico', grupo: 'declaracoes', nome: 'Serviço — para civil', para: semDomiciliar(civil), opcoes: (p) => [VALOR(p), FINALIDADE, DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'servico' }, q) },
  { tipo: 'declaracao_servico_efectividade', grupo: 'declaracoes', nome: 'Serviço — para civil, para confirmar a efectividade', para: semDomiciliar(civil), opcoes: (p) => [VALOR(p), DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'servico', semObs: true }, q) },
  { tipo: 'declaracao_servico_domiciliar', grupo: 'declaracoes', nome: 'Serviço — para empregada(o) domiciliar (civil)', para: (p) => p.vinculo === 'domiciliar', opcoes: (p) => [VALOR(p), FINALIDADE, DATA_DOC], desenhar: (d, p, o, q) => declaracao(d, p, { ...o, tipo: 'servico' }, q) },

  // as declarações para os bancos (modelos do SIGP): militares e civis
  ...[['bfa_credito', 'Crédito Pessoal (BFA)'], ['bfa_adiantamento', 'Adiantamento Salarial (BFA)'], ['bpc_salario', 'BPC Salário'], ['bpc_credito', 'Crédito Bancário (BPC)']].map(([b, nome]) => ({
    tipo: `declaracao_${b}`, grupo: 'declaracoes', nome: `Declaração — ${nome}`, banco: true, para: (p) => p.vinculo !== 'domiciliar', opcoes: (p) => [VALOR(p)],
    desenhar: (d, p, o, q) => declaracaoBanco(d, p, { ...o, banco: b }, q),
  })),

  // as seis guias dos modelos da ESG; cada uma com o dia da guia (por defeito, hoje)
  { tipo: 'guia_ferias', grupo: 'guias', nome: 'Guia de férias (30 dias)', para: (p) => p.vinculo !== 'domiciliar', opcoes: (p) => [...opcoesFerias(p), DATA_GUIA], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'ferias' }, q) },
  { tipo: 'guia_licenca', grupo: 'guias', nome: 'Guia de férias adicionais (licença disciplinar, 15 dias)', para: militar, opcoes: () => [INICIO, DIAS(15), FIM, DATA_GUIA], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'licenca' }, q) },
  { tipo: 'guia_dispensa', grupo: 'guias', nome: 'Guia de dispensa militar', para: (p) => militar(p) && p.vinculo !== 'estudante', opcoes: () => opcoesDispensa('Assuntos Pessoais'), desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'dispensa', variante: 'militar' }, q) },
  { tipo: 'guia_dispensa_civil', grupo: 'guias', nome: 'Guia de dispensa civil', para: civil, opcoes: () => opcoesDispensa('Assuntos Pessoais'), desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'dispensa', variante: 'civil' }, q) },
  { tipo: 'guia_dispensa_discente', grupo: 'guias', nome: 'Guia de dispensa do discente', para: (p) => p.vinculo === 'estudante' || Boolean(p.discente), opcoes: (p) => [...opcoesDispensa('Assunto Familiar'), { campo: 'curso', rotulo: 'Discente do (curso)', tipo: 'texto', obrigatorio: true, inicial: (p.cursos ?? []).find((c) => !c.fim)?.nome || (p.vinculo === 'estudante' ? p.unidadeNome : '') || '' }], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'dispensa', variante: 'discente' }, q) },
  { tipo: 'guia_apresentacao', grupo: 'guias', nome: 'Guia de apresentação (instituição, unidade, curso)', para: (p) => p.vinculo !== 'domiciliar', opcoes: () => [{ campo: 'destino', rotulo: 'Apresentar-se à', tipo: 'texto', obrigatorio: true, ajuda: 'Ex.: Direcção de Pessoal e Quadros do Comando do Exército' }, { campo: 'sigla', rotulo: 'Em «Outras indicações» (sigla)', tipo: 'texto', ajuda: 'Ex.: DPQ/EXE; vazio = o nome acima' }, { campo: 'referencia', rotulo: 'Em conformidade com', tipo: 'texto', ajuda: 'Ex.: Ofício nº 7028/11.RGC/DPPQ/EMGFAA/2025, Fim da CNS no EMG de Sargento do Exército' }, { campo: 'fundamento', rotulo: 'Motivo', tipo: 'texto', ajuda: 'Ex.: por ter transitado à condição de Inactividade Temporária, na base da Ordem nº 17/CEMGFAA/2024.' }, DIAS(7), DATA_GUIA], desenhar: (d, p, o, q) => guiaMarcha(d, p, { ...o, tipo: 'apresentacao' }, q) },

  { tipo: 'ficha_individual', grupo: 'fichas', nome: 'Ficha individual', para: () => true, opcoes: () => [], desenhar: async (d, p) => (militar(p) ? (await fichaIndividualMilitar(d, p), anexoFichaIndividual(d, p)) : fichaIndividualCivil(d, p)) },
  { tipo: 'ficha_docente', grupo: 'fichas', nome: 'Ficha para cadastramento dos docentes', para: (p) => Boolean(p.docente), opcoes: () => [], desenhar: (d, p) => fichaDocente(d, p) },
  { tipo: 'ficha_mecanografica', grupo: 'fichas', nome: 'Ficha mecanográfica', para: militar, opcoes: () => [], desenhar: (d, p) => fichaMecanografica(d, p) },
  { tipo: 'ficha_registo_biografico', grupo: 'fichas', nome: 'Ficha de registo biográfico', para: civil, opcoes: () => [], desenhar: (d, p) => fichaRegistoBiografico(d, p) },
  { tipo: 'ficha_disciplinar', grupo: 'fichas', nome: 'Ficha disciplinar', para: () => true, opcoes: () => [], desenhar: (d, p) => fichaDisciplinar(d, p) },
  { tipo: 'ficha_avaliacao', grupo: 'fichas', nome: 'Ficha de avaliação individual (FAI)', para: militar, opcoes: () => [], desenhar: (d, p) => fichaAvaliacao(d, p) },
  { tipo: 'proposta_nomeacao', grupo: 'fichas', nome: 'Proposta de nomeação', proposta: 'nomeacao', para: militar, opcoes: () => [{ campo: 'cargoProposto', rotulo: 'Cargo proposto', tipo: 'texto', obrigatorio: true }, { campo: 'unidadeProposta', rotulo: 'U/E/O do cargo', tipo: 'texto', inicial: 'Escola Superior de Guerra' }, { campo: 'fundamento', rotulo: 'Fundamento da proposta', tipo: 'texto' }], desenhar: (d, p, o, q) => propostaNomeacao(d, p, o, q) },
  { tipo: 'processo_promocao', grupo: 'fichas', nome: 'Processo individual de promoção (PIP)', proposta: 'promocao', para: militar, opcoes: () => [], desenhar: (d, p) => processoPromocao(d, p) },
]

// os da ficha (a proposta de nomeação e o PIP saem na tela da proposta de nomeação ou de promoção)
export const documentosPara = (p) => CATALOGO.filter((c) => !c.proposta && c.para(p))
// os modelos da ESG de cada tipo de proposta, por esta ordem, para cada militar: promoção e graduação levam
// o PIP e a FAI (a avaliação que o PIP resume); a nomeação, a proposta de nomeação e a FAI
const MODELOS_PROPOSTA = { promocao: ['processo_promocao', 'ficha_avaliacao'], graduacao: ['processo_promocao', 'ficha_avaliacao'], nomeacao: ['proposta_nomeacao', 'ficha_avaliacao'] }
export const documentosDaProposta = (tipo) => (MODELOS_PROPOSTA[tipo] ?? []).map((t) => CATALOGO.find((c) => c.tipo === t))

/*
  Regista no servidor os documentos a emitir. Se uma declaração igual (mesma finalidade) já saiu há menos de
  24 h, o servidor recusa; pergunta-se se é para emitir outra vez (como no SIGP) e, se sim, repete com «repetir».
*/
export async function registarEmissao(api, pessoaId, escolhas) {
  const enviar = (docs) => api(`/pessoas/${pessoaId}/documentos-emitidos`, { metodo: 'POST', corpo: { documentos: docs } })
  try {
    return await enviar(escolhas)
  } catch (e) {
    if (!/\[repetir\]/.test(e.message)) throw e
    if (!window.confirm(`${e.message.replace(' [repetir]', '')}\n\nEmitir outra vez?`)) throw new Error('Emissão cancelada.', { cause: e })
    return enviar(escolhas.map((x) => ({ ...x, dados: { ...x.dados, repetir: true } })))
  }
}

// escolhas: [{ tipo, dados }]; emitidos: o que o servidor registou (com o número das declarações)
export async function gerarDocumentosPessoais(p, escolhas, emitidos, quem) {
  const nome = `${M(p.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase()}-documentos-${new Date().toISOString().slice(0, 10)}.pdf`
  await gerarLote(escolhas.map((escolha, i) => ({ p, escolha, emitido: emitidos[i] })), quem, nome)
}

// vários documentos (de uma ou mais pessoas) num só PDF: [{ p, escolha: { tipo, dados }, emitido: { numero, ano } }]
export async function gerarLote(itens, quem, nomeFicheiro) {
  const d = await novoDocumento()
  for (const { p, escolha: e, emitido } of itens) {
    const c = CATALOGO.find((x) => x.tipo === e.tipo)
    const o = { ...e.dados, numero: emitido?.numero, ano: emitido?.ano }
    // vencimento: o escrito, o da ficha ou o da tabela salarial; ou nenhum, se se escolheu não falar dele
    if (c.grupo === 'declaracoes') o.valor = c.semVencimento || o.comVencimento === 'Não' ? null : o.valor || p.vencimento || vencimentoDaTabela(p)
    await c.desenhar(d, p, o, quem)
  }
  d.doc.save(nomeFicheiro)
}

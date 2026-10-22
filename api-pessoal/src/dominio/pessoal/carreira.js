import { CATEGORIAS, EFECTIVIDADES, POSTOS, POSTOS_POR_GRAU, grupoDoPosto, nomeDoPosto, quadroEspecial } from './hierarquia.js'

/*
  Regras da carreira militar segundo a Lei n.º 13/18. Cada verificação devolve condições com o artigo da lei:
  estado "ok" (cumpre), "falta" (não cumpre — impede), "alerta" (não cumpre, mas só avisa: quem propõe decide,
  como no SIGP) ou "confirmar" (depende de algo que o sistema não sabe, ex.: existir vaga no quadro especial).
  Funções puras: a data de "hoje" entra sempre por parâmetro.
*/
const ANO = 365.2425 * 86_400_000
export const anosEntre = (de, ate) => (de ? (new Date(ate) - new Date(de)) / ANO : null)
export const somarAnos = (data, anos) => { const d = new Date(data); d.setUTCFullYear(d.getUTCFullYear() + Math.floor(anos)); d.setUTCDate(d.getUTCDate() + Math.round((anos % 1) * 365.2425)); return d }
const dia = (d) => new Date(d).toISOString().slice(0, 10)
const c = (id, texto, artigo, estado, detalhe = '') => ({ id, texto, artigo, estado, detalhe })

export const idade = (p, hoje) => (p.dataNascimento ? Math.floor(anosEntre(p.dataNascimento, hoje)) : null)
export const tempoServico = (p, hoje) => anosEntre(p.dataIngresso, hoje)
export const tempoNoPosto = (p, hoje) => anosEntre(p.dataAntiguidadePosto, hoje)

// (as tabelas da lei vão pelo posto, não pelo número do grau: assim um posto novo não as desloca)
// tempo mínimo no posto para acesso ao imediato, no Quadro Permanente (art. 97.º) — pelo posto atual
const TEMPO_MINIMO_QP = { subtenente: 1, tenente: 4, capitao: 6, major: 6, tenente_coronel: 5, coronel: 3, segundo_sargento: 5, primeiro_sargento: 8, sargento_ajudante: 7, sargento_chefe: 5 }
// no Serviço Militar por Contrato (art. 121.º)
const TEMPO_MINIMO_SMC = { subtenente: 4, segundo_sargento: 4 }
// modalidade de promoção ao posto de destino, no QP (art. 98.º)
const MODALIDADE_QP = { subtenente: 'diuturnidade', tenente: 'diuturnidade', capitao: 'antiguidade', major: 'escolha', tenente_coronel: 'antiguidade', coronel: 'escolha', brigadeiro: 'escolha', tenente_general: 'escolha', general: 'escolha', general_exercito: 'escolha', segundo_sargento: 'diuturnidade', primeiro_sargento: 'diuturnidade', sargento_ajudante: 'escolha', sargento_chefe: 'antiguidade', sargento_maior: 'escolha' }
export const MODALIDADES = { diuturnidade: 'Diuturnidade', antiguidade: 'Antiguidade', escolha: 'Escolha', distincao: 'Distinção', excepcional: 'Título excepcional' }
// cursos que são condição especial de promoção ao posto de destino (arts. 52.º, 104.º a 109.º)
export const CURSOS_PROMOCAO = {
  promocao_cabo: 'Curso de Promoção a Cabo',
  formacao_sargentos: 'Curso de Formação de Sargentos',
  promocao_sargento_ajudante: 'Curso de Promoção a Sargento-Ajudante',
  promocao_sargento_chefe: 'Curso de Promoção a Sargento-Chefe',
  promocao_capitao: 'Curso de Promoção a Oficial Capitão',
  promocao_oficial_superior: 'Curso de Promoção a Oficial Superior',
  comando_direccao: 'Curso de Comando e Direcção (ou equivalente)',
  superior_guerra: 'Curso Superior de Guerra',
}
const CURSO_EXIGIDO = { segundo_cabo: ['promocao_cabo'], segundo_sargento: ['formacao_sargentos'], sargento_ajudante: ['promocao_sargento_ajudante'], sargento_chefe: ['promocao_sargento_chefe'], capitao: ['promocao_capitao'], major: ['promocao_oficial_superior'], brigadeiro: ['comando_direccao', 'superior_guerra'] }
// postos a que pode chegar o Serviço Militar por Contrato (art. 120.º)
const SMC_ATE = { oficiais: 'tenente', sargentos: 'primeiro_sargento' }
// limites de idade de passagem à reserva no QP (art. 111.º), pelo grau
const IDADE_RESERVA = { coronel: 59, tenente_coronel: 55, major: 50, sargento_maior: 59, sargento_chefe: 55 }

// posto a que o militar pode ser promovido, pela forma de prestação de serviço (null = não há)
export function proximoPosto(p) {
  const atual = POSTOS[p.posto]
  if (!atual) return null
  if (p.fps === 'SMO') return { aspirante: 'subtenente', soldado: 'segundo_cabo' }[p.posto] ?? null // art. 127.º e 129.º
  // topo da carreira de sargentos/oficiais; praças e subsargento só no SMO
  if (['sargento_maior', 'general_exercito', 'primeiro_cabo', 'segundo_cabo', 'subsargento', 'soldado'].includes(p.posto)) return null
  if (p.posto === 'aspirante') return 'subtenente'
  const destino = POSTOS_POR_GRAU[atual.grau + 1]
  if (p.fps === 'SMC' && destino.grau > POSTOS[SMC_ATE[grupoDoPosto(p.posto)]].grau) return null
  return destino.id
}

const temCurso = (p, chaves) => (p.cursos || []).find((x) => chaves.includes(x.chave) && x.aproveitamento !== false && (!x.fim || x.concluido !== false))

/*
  Verifica a promoção ao posto imediato (ou a outro indicado). modalidade: a da lei (art. 98.º/122.º) ou
  "distincao"/"excepcional" (arts. 57.º e 58.º), que dispensam as condições de promoção.
*/
export function verificarPromocao(p, { hoje = new Date(), modalidade } = {}) {
  const destino = proximoPosto(p)
  const condicoes = []
  if (p.tipo !== 'militar') return { elegivel: false, condicoes: [c('militar', 'É militar', 'art. 2.º', 'falta')] }
  if (!destino) {
    return { elegivel: false, postoProposto: null, condicoes: [c('topo', 'Há posto acima na sua carreira e forma de prestação de serviço', p.fps === 'SMC' ? 'art. 120.º' : 'arts. 71.º e 73.º', 'falta', 'Está no posto mais alto da sua carreira.')] }
  }
  const gDestino = POSTOS[destino].grau
  const legal = p.fps === 'SMC' ? 'diuturnidade' : p.fps === 'SMO' ? 'diuturnidade' : MODALIDADE_QP[destino]
  const mod = modalidade || legal
  const especial = mod === 'distincao' || mod === 'excepcional'

  // situação (arts. 6.º, 99.º e 103.º)
  if (p.situacao !== 'activo') condicoes.push(c('situacao', 'Está no activo', 'art. 99.º', especial && mod === 'excepcional' ? 'ok' : 'falta', 'Na reserva ou na reforma só há promoção a título excepcional.'))
  else condicoes.push(c('situacao', 'Está no activo', 'art. 7.º', 'ok'))
  // inactividade temporária: como no SIGP, não pode ser incluído numa proposta de promoção
  if (p.situacao === 'activo' && p.efectividade === 'inactividade_temporaria' && !especial) condicoes.push(c('inactividade', 'Não está em inactividade temporária', 'art. 13.º', 'falta'))
  if (p.efectividade === 'licenca_ilimitada') condicoes.push(c('licenca', 'Não está em licença ilimitada', 'art. 103.º, n.º 1, c)', 'falta'))
  if (p.processoPendente) condicoes.push(c('processo', 'Não tem processo disciplinar ou criminal em curso', 'arts. 50.º, n.º 1, f) e 103.º, n.º 1, d)', especial ? 'confirmar' : 'falta'))
  else condicoes.push(c('processo', 'Não tem processo disciplinar ou criminal em curso', 'art. 50.º, n.º 1, f)', 'ok'))
  // despromovido: 2 anos sem promoção (art. 63.º)
  const despromocao = (p.historico || []).filter((h) => h.tipo === 'despromocao').map((h) => h.data).sort().at(-1)
  if (despromocao && anosEntre(despromocao, hoje) < 2) condicoes.push(c('despromocao', 'Passaram 2 anos desde a despromoção', 'art. 63.º, n.º 1', 'falta', `Pode voltar a ser promovido a partir de ${dia(somarAnos(despromocao, 2))}.`))

  if (!especial) {
    // condições gerais (art. 50.º) e especiais (art. 51.º): como no SIGP, avisam mas não impedem a proposta
    condicoes.push(c('avaliacao', 'Desempenho e qualidades exigidas, com avaliação favorável', 'art. 50.º, n.º 1, a) a c)', p.avaliacaoFavoravel === false ? 'alerta' : 'ok'))
    condicoes.push(c('aptidao', 'Aptidão física e psíquica para o posto imediato', 'art. 50.º, n.º 1, d)', p.aptidaoFisica === false ? 'alerta' : 'ok'))
    // tempo mínimo no posto (art. 97.º / 121.º / 129.º)
    const minimo = p.fps === 'SMC' ? TEMPO_MINIMO_SMC[p.posto] : p.fps === 'SMO' ? (p.posto === 'aspirante' ? 1 : null) : TEMPO_MINIMO_QP[p.posto]
    if (minimo) {
      const t = tempoNoPosto(p, hoje)
      if (t === null) condicoes.push(c('tempo', `${minimo} ano(s) no posto de ${nomeDoPosto(p.posto, p.ramo)}`, p.fps === 'SMC' ? 'art. 121.º' : 'art. 97.º', 'confirmar', 'Falta a data de antiguidade no posto.'))
      else condicoes.push(c('tempo', `${minimo} ano(s) no posto de ${nomeDoPosto(p.posto, p.ramo)}`, p.fps === 'SMC' ? 'art. 121.º' : p.fps === 'SMO' ? 'art. 129.º' : 'art. 97.º', t >= minimo ? 'ok' : 'alerta',
        t >= minimo ? `Tem ${t.toFixed(1)} anos.` : `Tem ${t.toFixed(1)} anos; cumpre a ${dia(somarAnos(p.dataAntiguidadePosto, minimo))}.`))
    }
    // curso de promoção (art. 52.º): não é obrigatório no sistema, só avisa (promoção com decisão fundamentada)
    const cursos = CURSO_EXIGIDO[destino]
    if (cursos) {
      const feito = temCurso(p, cursos)
      condicoes.push(c('curso', cursos.map((k) => CURSOS_PROMOCAO[k]).join(' ou '), destino === 'brigadeiro' ? 'arts. 52.º e 104.º, n.º 4' : 'art. 52.º', feito ? 'ok' : 'alerta', feito ? `${CURSOS_PROMOCAO[feito.chave]}, com aproveitamento.` : 'Sem registo do curso com aproveitamento: a promoção pode seguir com decisão fundamentada.'))
    }
    // posto limite do quadro especial (arts. 84.º a 95.º)
    const qe = quadroEspecial(p.ramo, p.quadroEspecial)
    if (qe) {
      const limite = grupoDoPosto(destino) === 'oficiais' ? qe.limiteOficiais : qe.limiteSargentos
      if (limite) condicoes.push(c('quadro', `O quadro especial ${qe.sigla} vai até ${nomeDoPosto(limite, p.ramo)}`, 'arts. 84.º a 95.º', gDestino <= POSTOS[limite].grau ? 'ok' : 'falta'))
    }
    // vaga no quadro especial, exceto na diuturnidade (arts. 50.º, n.º 1, e), 54.º a 56.º)
    if (mod !== 'diuturnidade') condicoes.push(c('vaga', 'Existe vaga no quadro especial', `arts. 50.º, n.º 1, e) e ${mod === 'antiguidade' ? '55.º' : '56.º'}`, 'confirmar', 'A confirmar pela entidade que aprova.'))
    if (p.fps === 'SMC' || p.fps === 'SMO') condicoes.push(c('modalidade', 'Promoção por diuturnidade', p.fps === 'SMC' ? 'art. 122.º' : 'art. 129.º', 'ok'))
  } else {
    condicoes.push(c('modalidade', mod === 'distincao' ? 'Promoção por distinção: dispensa as condições de promoção' : 'Promoção a título excepcional (deficiente das FAA ou reabilitação)', mod === 'distincao' ? 'art. 57.º' : 'art. 58.º', 'confirmar', 'Exige fundamentação e decisão da entidade competente.'))
  }
  const elegivel = condicoes.every((x) => x.estado !== 'falta')
  return { elegivel, postoProposto: destino, modalidade: mod, modalidadeLegal: legal, condicoes, alertas: condicoes.filter((x) => x.estado === 'alerta').map((x) => x.texto) }
}

// graduação num posto superior (arts. 64.º a 67.º)
export function verificarGraduacao(p, postoGraduado, { hoje = new Date() } = {}) {
  const condicoes = []
  const atual = POSTOS[p.posto]
  const alvo = POSTOS[postoGraduado]
  if (!atual || !alvo) return { possivel: false, condicoes: [c('posto', 'Posto válido', 'art. 64.º', 'falta')] }
  const graus = alvo.grau - atual.grau
  condicoes.push(c('superior', 'O posto é superior ao que ostenta', 'art. 64.º', graus > 0 ? 'ok' : 'falta'))
  condicoes.push(c('graus', 'No máximo 2 graus acima do posto', 'art. 65.º, n.º 2', graus <= 2 ? 'ok' : 'falta', `${graus} grau(s) acima.`))
  const grupo = CATEGORIAS[atual.categoria].grupo
  const naCategoria = (p.graduacoes || []).filter((g) => grupoDoPosto(g.posto) === grupo).length
  condicoes.push(c('vezes', 'No máximo 2 graduações dentro da mesma categoria', 'art. 65.º, n.º 2', naCategoria < 2 ? 'ok' : 'falta', `Já teve ${naCategoria}.`))
  const ativa = (p.graduacoes || []).find((g) => g.ativa)
  condicoes.push(c('ativa', 'Não tem outra graduação em curso', 'art. 65.º, n.º 3', ativa ? 'falta' : 'ok', ativa ? `Graduado em ${nomeDoPosto(ativa.posto, p.ramo)} desde ${dia(ativa.inicio)}.` : ''))
  condicoes.push(c('motivo', 'Exercício de cargo indispensável que não se pode prover com militar desse posto', 'art. 65.º, n.º 1', 'confirmar', 'Tem carácter excepcional e temporário.'))
  if (p.situacao !== 'activo') condicoes.push(c('situacao', 'Está no activo', 'art. 65.º', 'falta'))
  void hoje
  return { possivel: condicoes.every((x) => x.estado !== 'falta'), condicoes }
}

/*
  Nomeação para um cargo (arts. 18.º a 20.º): não para cargo de posto inferior; para cargo de posto superior
  só a título excepcional e temporário, até 6 meses.
*/
export function verificarNomeacao(p, cargo, { hoje = new Date(), fim } = {}) {
  const condicoes = []
  if (p.tipo === 'militar' && cargo.postoRequerido && POSTOS[p.posto]) {
    const g = POSTOS[p.posto].grau
    const gc = POSTOS[cargo.postoRequerido].grau
    if (g > gc) condicoes.push(c('inferior', 'O cargo não corresponde a posto inferior ao do militar', 'art. 19.º', 'falta', `O cargo é de ${nomeDoPosto(cargo.postoRequerido, p.ramo)}.`))
    else if (g < gc) {
      const meses = fim ? (new Date(fim) - new Date(hoje)) / (30.44 * 86_400_000) : null
      condicoes.push(c('superior', 'Cargo de posto superior: excepcional, temporário e até 6 meses', 'art. 20.º', meses !== null && meses <= 6.05 ? 'confirmar' : 'falta', meses === null ? 'Indique a data de fim (no máximo 6 meses).' : `Duração prevista: ${meses.toFixed(1)} meses.`))
    } else condicoes.push(c('posto', 'O posto corresponde ao do cargo', 'art. 18.º', 'ok'))
  }
  if (p.tipo === 'militar' && p.situacao !== 'activo') condicoes.push(c('situacao', 'Está no activo', 'art. 9.º, n.º 2', p.situacao === 'reforma' ? 'falta' : 'confirmar', p.situacao === 'reforma' ? 'Na reforma não exerce funções militares (pode exercer docência e investigação).' : ''))
  if (cargo.tipo === 'militar' && p.tipo !== 'militar') condicoes.push(c('tipo', 'O cargo é para militares', 'art. 18.º', 'falta'))
  if (cargo.tipo === 'civil' && p.tipo === 'militar') condicoes.push(c('tipo', 'O cargo é para pessoal civil', '—', 'falta'))
  if (cargo.ocupados !== undefined && cargo.vagas !== undefined && cargo.ocupados >= cargo.vagas) condicoes.push(c('vagas', 'O cargo tem lugar livre no quadro orgânico', 'art. 18.º', 'falta', `${cargo.ocupados} de ${cargo.vagas} ocupados.`))
  if (!condicoes.length) condicoes.push(c('cargo', 'Cargo adequado', 'art. 18.º', 'ok'))
  return { possivel: condicoes.every((x) => x.estado !== 'falta'), condicoes }
}

// reserva e reforma (arts. 110.º, 111.º e 114.º): datas-limite e o que pode requerer
export function reservaEReforma(p, hoje = new Date()) {
  if (p.tipo !== 'militar' || !POSTOS[p.posto]) return null
  const anos = idade(p, hoje)
  const servico = tempoServico(p, hoje)
  const limiteReserva = p.fps === 'QP' ? IDADE_RESERVA[p.posto] : undefined
  const general = POSTOS[p.posto].categoria === 'oficial_general'
  const idadeReforma = general ? 65 : 60
  return {
    idade: anos,
    tempoServico: servico === null ? null : Math.floor(servico),
    reserva: limiteReserva && p.dataNascimento ? { idadeLimite: limiteReserva, data: dia(somarAnos(p.dataNascimento, limiteReserva)), artigo: 'art. 111.º' } : null,
    podeRequererReserva: p.fps === 'QP' && servico !== null && servico >= 30 ? { artigo: 'art. 110.º, n.º 1, b)' } : null,
    reforma: p.dataNascimento ? { idadeLimite: idadeReforma, data: dia(somarAnos(p.dataNascimento, idadeReforma)), artigo: general ? 'art. 114.º, n.º 1' : 'art. 114.º, n.º 3' } : null,
    reformaPorTempo: !general && p.dataIngresso ? { anos: 35, data: dia(somarAnos(p.dataIngresso, 35)), artigo: 'art. 114.º, n.º 3' } : null,
  }
}

// licenças (arts. 31.º a 41.º): tipos, quem pode e a duração máxima
export const TIPOS_LICENCA = {
  ferias: { nome: 'Férias', artigo: 'art. 32.º' },
  doenca: { nome: 'Doença', artigo: 'art. 33.º', maximo: 30 },
  parto: { nome: 'Parto', artigo: 'art. 34.º', maximo: 90, genero: 'F' },
  nascimento_filho: { nome: 'Nascimento de filho', artigo: 'art. 35.º', maximo: 6, genero: 'M' },
  casamento: { nome: 'Casamento', artigo: 'art. 36.º, n.º 1, a)', maximo: 6 },
  bodas: { nome: 'Bodas de prata ou de ouro', artigo: 'art. 36.º, n.º 1, b)', maximo: 3 },
  luto: { nome: 'Luto', artigo: 'art. 37.º', maximo: 8 },
  merito: { nome: 'Mérito', artigo: 'art. 38.º', maximo: 30 },
  estudos: { nome: 'Estudos', artigo: 'art. 39.º', fps: ['QP'] },
  registada: { nome: 'Registada', artigo: 'art. 40.º' },
  ilimitada: { nome: 'Ilimitada', artigo: 'art. 41.º', fps: ['QP'] },
}
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000) + 1
export function verificarLicenca(p, { tipo, inicio, fim }, anteriores = [], hoje = new Date()) {
  const t = TIPOS_LICENCA[tipo]
  if (!t) return { possivel: false, condicoes: [c('tipo', 'Tipo de licença', 'art. 31.º', 'falta')] }
  const condicoes = []
  const dias = diasEntre(inicio, fim)
  if (dias < 1) condicoes.push(c('datas', 'O fim é depois do início', '—', 'falta'))
  if (p.situacao !== 'activo') condicoes.push(c('activo', 'Está no activo', 'art. 31.º, n.º 1', 'falta'))
  if (t.genero && p.genero && p.genero !== t.genero) condicoes.push(c('genero', t.genero === 'F' ? 'Militar do sexo feminino' : 'Militar do sexo masculino', t.artigo, 'falta'))
  if (t.fps && !t.fps.includes(p.fps)) condicoes.push(c('fps', 'Só para militares do Quadro Permanente', t.artigo, 'falta'))
  const ano = new Date(inicio).getUTCFullYear()
  const doAno = anteriores.filter((l) => l.tipo === tipo && new Date(l.inicio).getUTCFullYear() === ano)
  const usados = doAno.reduce((s, l) => s + diasEntre(l.inicio, l.fim), 0)
  if (tipo === 'ferias') {
    const servico = tempoServico(p, hoje) || 0
    const direito = 30 + (servico > 20 ? 15 : 0)
    condicoes.push(c('dias', `Até ${direito} dias de férias por ano`, servico > 20 ? 'art. 32.º, n.º 1 e n.º 2, b)' : 'art. 32.º, n.º 1', usados + dias <= direito ? 'ok' : 'falta', `${usados + dias} de ${direito} dias.`))
    if ((tempoServico(p, hoje) || 0) < 1) condicoes.push(c('ano', 'Está em serviço há mais de um ano', 'art. 32.º, n.º 1, a)', 'falta'))
  } else if (tipo === 'doenca') {
    condicoes.push(c('dias', 'Até 30 dias seguidos, ou 90 interpolados por ano', 'art. 33.º, n.º 2', dias <= 30 && usados + dias <= 90 ? 'ok' : 'falta', `${dias} dias seguidos; ${usados + dias} no ano. Depois disso, Junta Médica Militar.`))
  } else if (tipo === 'registada') {
    const limite = p.fps === 'QP' ? 183 : p.fps === 'SMC' ? 92 : 15
    condicoes.push(c('dias', p.fps === 'QP' ? 'Até 6 meses por cada 5 anos' : p.fps === 'SMC' ? 'Até 3 meses por cada 3 anos de efectividade' : 'Até 15 dias por ano', 'art. 40.º', dias <= limite ? 'ok' : 'falta', `${dias} dias. Sem remuneração (n.º 9); concedida por Despacho do CEMG (art. 31.º, n.º 2).`))
  } else if (tipo === 'ilimitada') {
    const desdeQP = anosEntre(p.dataIngressoQP || p.dataIngresso, hoje) || 0
    condicoes.push(c('servico', 'Pelo menos 8 anos de serviço no Quadro Permanente', 'art. 41.º, n.º 2', desdeQP >= 8 ? 'ok' : 'falta', `${Math.floor(desdeQP)} anos.`))
    condicoes.push(c('dias', 'Por período não inferior a um ano (e no máximo 10 anos)', 'art. 41.º, n.os 1 e 7', dias >= 365 && dias <= 3653 ? 'ok' : 'falta'))
  } else if (t.maximo) {
    condicoes.push(c('dias', `No máximo ${t.maximo} dias`, t.artigo, dias <= t.maximo ? 'ok' : 'falta', `${dias} dias.`))
  }
  if (!condicoes.length) condicoes.push(c('tipo', t.nome, t.artigo, 'ok'))
  return { possivel: condicoes.every((x) => x.estado !== 'falta'), dias, condicoes }
}

/*
  Lista de antiguidade de um posto (arts. 26.º e 29.º): mais antigo primeiro, pela data no documento de
  promoção; empate: maior graduação anterior, maior tempo de serviço militar activo, mais idade.
*/
export function ordenarAntiguidade(lista) {
  const t = (d) => (d ? new Date(d).getTime() : Infinity)
  return [...lista].sort((a, b) => (POSTOS[b.posto]?.grau || 0) - (POSTOS[a.posto]?.grau || 0)
    || t(a.dataAntiguidadePosto) - t(b.dataAntiguidadePosto)
    || (b.graduacoes?.length || 0) - (a.graduacoes?.length || 0)
    || t(a.dataIngresso) - t(b.dataIngresso)
    || t(a.dataNascimento) - t(b.dataNascimento))
}

export const emEfectividade = (p) => Boolean(EFECTIVIDADES[p.efectividade]?.efectividade)

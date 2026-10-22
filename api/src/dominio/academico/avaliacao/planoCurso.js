import { erro } from '../comum/validacao.js'

/*
  Avaliação pelos planos de curso da ESG (Plano de Curso 2026/2027, Secção III, n.º 4):
  - cada unidade curricular (UC) é avaliada por Trabalhos de Aplicação Individual (TAI) e de Grupo (TAG),
    de 0 a 20; a nota da UC é a média dessas provas, arredondada às centésimas;
  - um TAI negativo dá direito a um teste de recuperação, pedido até às 17h do dia útil seguinte à
    publicação da nota, uma só vez por TAI; a nota desse instrumento nunca passa de 10;
  - as UC agrupam-se em blocos; a nota do bloco é a média das UC ponderada pelas unidades de crédito;
  - a nota final é a média dos blocos ponderada pelos coeficientes do plano (ou, nos planos sem blocos
    obrigatórios, a média ponderada das UC), com o ajuste do Comandante quando o plano o prevê (±0,25);
  - a nota da UC é a média das provas (ponderada pelo peso de cada prova, quando o plano da UC o fixa)
  - aprovação: ≥ 10 em cada UC, em cada TAI de teste escrito, em cada bloco, no TII (cada uma se o plano o exigir)
    e na média final;
  - menção: Muito Bom 18–20, Bom 14–17,99, Regular 10–13,99, Reprovado < 10; Distinto pelo Comandante.
  O plano de cada curso (blocos, coeficientes, regras) fica na base de dados e edita-se no painel.
*/
export const NOTA_MINIMA = 10
export const NOTA_MAXIMA_RECUPERACAO = 10
export const TIPOS_AVALIACAO = { TAI: 'Trabalho de Aplicação Individual', TAG: 'Trabalho de Aplicação de Grupo' }
export const FORMAS_AVALIACAO = { teste: 'Teste escrito', relatorio: 'Relatório individual', oral: 'Teste oral', trabalho: 'Trabalho' }
export const TERMOS = { auditor: 'Auditor', discente: 'Discente' }
export const FORMULAS = { ponderada: 'Média dos blocos ponderada pelos coeficientes', percentagem: 'Média dos blocos com pesos em percentagem', media: 'Média das unidades curriculares (ponderada pelos créditos)' }
// horas e créditos (Decreto Presidencial n.º 193/18): 1 UCréd = 15 horas; limites por semestre e por ano
export const CREDITO_HORAS = 15
export const LIMITES = { creditosSemestre: 40, horasSemestre: 600, creditosAno: 80, horasAno: 1200, horasMinimasUc: 15 }

const centesimas = (n) => Math.round(n * 100) / 100
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

export function mencao(nota) {
  if (nota === null || nota === undefined) return null
  if (nota < NOTA_MINIMA) return 'Reprovado'
  if (nota < 14) return 'Regular'
  if (nota < 18) return 'Bom'
  return 'Muito Bom'
}

// ---------- o plano ----------

export function validarPlano(d) {
  const t = (v, campo, rotulo, { min = 1, max = 200 } = {}) => {
    const s = String(v ?? '').trim()
    if (s.length < min || s.length > max) throw erro(campo, `${rotulo}: entre ${min} e ${max} caracteres.`)
    return s
  }
  const formula = FORMULAS[d.formula] ? d.formula : null
  if (!formula) throw erro('formula', 'Escolha a fórmula da nota final.')
  const blocos = (Array.isArray(d.blocos) ? d.blocos : []).map((b, i) => {
    const coef = Number(String(b.coeficiente ?? '').replace(',', '.'))
    if (!Number.isFinite(coef) || coef <= 0 || coef > 100) throw erro('blocos', `Bloco ${i + 1}: coeficiente inválido.`)
    return { sigla: t(b.sigla, 'blocos', `Bloco ${i + 1} (sigla)`, { max: 12 }).toUpperCase(), nome: t(b.nome, 'blocos', `Bloco ${i + 1} (nome)`, { max: 120 }), coeficiente: coef }
  })
  if (formula !== 'media' && !blocos.length) throw erro('blocos', 'Indique os blocos de unidades curriculares e os coeficientes.')
  if (new Set(blocos.map((b) => b.sigla)).size !== blocos.length) throw erro('blocos', 'As siglas dos blocos têm de ser diferentes.')
  const ajuste = Number(String(d.ajusteMaximo ?? 0).replace(',', '.'))
  if (!Number.isFinite(ajuste) || ajuste < 0 || ajuste > 2) throw erro('ajusteMaximo', 'Ajuste do Comandante: de 0 a 2 valores.')
  return {
    curso: t(d.curso, 'curso', 'Curso', { max: 120 }),
    anoLetivo: t(d.anoLetivo, 'anoLetivo', 'Ano lectivo', { min: 4, max: 20 }),
    nome: t(d.nome, 'nome', 'Nome do plano', { min: 3, max: 200 }),
    termo: TERMOS[d.termo] ? d.termo : 'discente',
    formula, blocos, ajusteMaximo: ajuste,
    exigirBlocos: d.exigirBlocos !== false && formula !== 'media',
    exigirTesteEscrito: d.exigirTesteEscrito !== false,
    // o CEAO e o COAMP não exigem 10 em cada UC (só nos blocos, no TII e na média); o COAMP nem no TFC
    exigirUcs: d.exigirUcs !== false,
    exigirTii: d.exigirTii !== false,
    faltasMaximas: Math.min(100, Math.max(0, Number(d.faltasMaximas ?? 10) || 0)),
    duracaoMeses: Math.min(48, Math.max(1, Math.round(Number(d.duracaoMeses ?? 10)) || 10)),
    // os factores do juízo ampliativo (vazio = os 11 do plano-tipo; o COAMP não tem «Cultura científica e académica»)
    factoresJuizo: Array.isArray(d.factoresJuizo) ? d.factoresJuizo.map(String).slice(0, 20) : [],
  }
}

// ---------- uma prova (TAI ou TAG) ----------

// nota que conta numa prova: com recuperação, a melhor das duas, mas a recuperação não passa de 10
export function notaDaProva(nota, recuperacao) {
  const n = num(nota)
  const r = num(recuperacao)
  if (r === null) return n
  const rec = Math.min(r, NOTA_MAXIMA_RECUPERACAO)
  return n === null ? rec : Math.max(n, rec)
}

/*
  Prazo para pedir o teste de recuperação: as 17h (de Luanda, UTC+1) do dia útil seguinte ao da
  publicação da nota. Devolve a data-hora ISO.
*/
export function prazoRecuperacao(publicadaEm) {
  if (!publicadaEm) return null
  const luanda = new Date(new Date(publicadaEm).getTime() + 3600_000) // a hora de Luanda vista como UTC
  const d = new Date(Date.UTC(luanda.getUTCFullYear(), luanda.getUTCMonth(), luanda.getUTCDate()))
  do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay()))
  return new Date(d.getTime() + 16 * 3600_000).toISOString() // 17h em Luanda = 16h UTC
}

/*
  Pode pedir a recuperação deste TAI? Só num TAI publicado, com nota negativa, ainda sem pedido e dentro
  do prazo. Devolve { pode, motivo, prazo }.
*/
export function recuperacaoPossivel(avaliacao, nota, agora = new Date()) {
  const prazo = prazoRecuperacao(avaliacao.publicadaEm)
  if (avaliacao.tipo !== 'TAI') return { pode: false, motivo: 'A recuperação só existe nos TAI.', prazo }
  if (!avaliacao.publicadaEm) return { pode: false, motivo: 'A nota ainda não foi publicada.', prazo }
  const n = num(nota?.nota)
  if (n === null || n >= NOTA_MINIMA) return { pode: false, motivo: 'Só há recuperação com nota negativa.', prazo }
  if (nota?.recuperacaoPedidaEm) return { pode: false, motivo: 'A recuperação já foi pedida (uma só vez por TAI).', prazo }
  if (new Date(agora) > new Date(prazo)) return { pode: false, motivo: 'O prazo para pedir a recuperação já passou.', prazo }
  return { pode: true, motivo: '', prazo }
}

/*
  Revisão da prova (regulamento da ESG): quem não concordar com a classificação de uma prova publicada pode
  reclamar por escrito, ao Director do Curso, uma só vez por prova; o Director de Ensino delibera e a nota pode
  subir, manter-se ou baixar. Enquanto a classificação da turma não for proposta ao Conselho de Curso.
*/
export function revisaoPossivel(avaliacao, nota) {
  if (!avaliacao?.publicadaEm) return { pode: false, motivo: 'A prova ainda não foi publicada.' }
  if (num(nota?.nota) === null) return { pode: false, motivo: 'Não há nota nesta prova.' }
  if (nota?.revisao) return { pode: false, motivo: 'A revisão desta prova já foi pedida (uma só vez por prova).' }
  return { pode: true, motivo: '' }
}
export const DECISOES_REVISAO = { subiu: 'A nota subiu', manteve: 'A nota manteve-se', baixou: 'A nota baixou' }
export const decisaoRevisao = (antes, depois) => (depois > antes ? 'subiu' : depois < antes ? 'baixou' : 'manteve')

/*
  Resultado de uma UC a partir das provas e das notas de um estudante.
  avaliacoes: [{ id, tipo, forma, publicadaEm }]; notas: { avaliacaoId: { nota, recuperacao, recuperacaoPedidaEm } }.
  situacao: sem_provas | em_curso (faltam notas) | recuperacao (TAI de teste negativo com recuperação pedida
  ou ainda possível) | aprovado | reprovado.
*/
export function resultadoUc(avaliacoes, notas, { exigirTesteEscrito = true, agora = new Date() } = {}) {
  if (!avaliacoes.length) return { final: null, situacao: 'sem_provas', mencao: null, provas: [] }
  const provas = avaliacoes.map((a) => {
    const n = notas[a.id] ?? {}
    return { id: a.id, tipo: a.tipo, forma: a.forma, peso: num(a.peso), nota: num(n.nota), recuperacao: num(n.recuperacao), conta: notaDaProva(n.nota, n.recuperacao), pedida: Boolean(n.recuperacaoPedidaEm) }
  })
  if (provas.some((p) => p.conta === null)) return { final: null, situacao: 'em_curso', mencao: null, provas }
  // a média das provas; com o peso de cada prova (ex.: TAG 50 % + defesa individual 50 %), quando todas o têm
  const pesos = avaliacoes.map((a) => Number(a.peso) || 0)
  const comPesos = pesos.every((p) => p > 0)
  const final = comPesos
    ? centesimas(provas.reduce((s, p, i) => s + p.conta * pesos[i], 0) / pesos.reduce((s, p) => s + p, 0))
    : centesimas(provas.reduce((s, p) => s + p.conta, 0) / provas.length)
  // os TAI de teste escrito também têm de ter 10 (cada um)
  const testesNegativos = exigirTesteEscrito ? provas.filter((p) => p.tipo === 'TAI' && p.forma === 'teste' && p.conta < NOTA_MINIMA) : []
  const emRecuperacao = provas.some((p) => {
    if (p.tipo !== 'TAI' || p.conta >= NOTA_MINIMA || p.recuperacao !== null) return false
    if (p.pedida) return true
    const a = avaliacoes.find((x) => x.id === p.id)
    return recuperacaoPossivel(a, { nota: p.nota }, agora).pode
  })
  if ((final < NOTA_MINIMA || testesNegativos.length) && emRecuperacao) return { final, situacao: 'recuperacao', mencao: null, provas }
  const aprovado = final >= NOTA_MINIMA && !testesNegativos.length
  return { final, situacao: aprovado ? 'aprovado' : 'reprovado', mencao: aprovado ? mencao(final) : 'Reprovado', provas }
}

// tempos escolares da ESG (Agenda do Discente, horário das aulas): 5 tempos de 50 minutos, das 08h30 às 13h30
export const TEMPOS_ESCOLARES = [['08:30', '09:20'], ['09:30', '10:20'], ['10:30', '11:20'], ['11:40', '12:30'], ['12:40', '13:30']]
// os intervalos de tempos seguidos (do 1.º ao 1.º, do 1.º ao 2.º, …): [{ de, ate, inicio, fim }]
export const BLOCOS_DE_TEMPOS = TEMPOS_ESCOLARES.flatMap((_, i) => TEMPOS_ESCOLARES.slice(i).map((__, k) => ({ de: i + 1, ate: i + k + 1, inicio: TEMPOS_ESCOLARES[i][0], fim: TEMPOS_ESCOLARES[i + k][1] })))

/*
  Os termos de cada curso: quem o frequenta (auditor no CSCD e no CEAO, discente no CEMC e no COAMP) e o
  trabalho final (a UC marcada como TII: «TII — Trabalho de Investigação Individual», ou «TFC — Trabalho
  de Fim do Curso» no COAMP). Sem plano: estudante e trabalho de fim de curso.
*/
export function termosDoPlano(plano, cadeiras = []) {
  const tii = cadeiras.find((c) => c.tii)
  if (!plano) return { termo: 'estudante', pessoa: 'Estudante', pessoas: 'Estudantes', trabalho: { sigla: 'TFC', nome: 'Trabalho de fim de curso' } }
  const auditor = plano.termo === 'auditor'
  return {
    termo: auditor ? 'auditor' : 'discente', pessoa: auditor ? 'Auditor' : 'Discente', pessoas: auditor ? 'Auditores' : 'Discentes',
    trabalho: { sigla: tii?.codigo || 'TII', nome: tii?.nome || 'Trabalho de Investigação Individual' },
  }
}

// ---------- faltas ----------

/*
  Faltas no curso (Plano de Curso: «o limite máximo admissível de faltas justificadas é de 10 % do total de
  tempos escolares previstos»): cada aula registada conta um tempo; o total previsto são as horas de contacto
  das UC. presencas: [{ estado: presente | falta | justificada }].
*/
export function faltasDoCurso(presencas, horasContacto, percentagem = 10) {
  const justificadas = presencas.filter((p) => p.estado === 'justificada').length
  const injustificadas = presencas.filter((p) => p.estado === 'falta').length
  const limite = Math.floor((Number(horasContacto) || 0) * (Number(percentagem) || 0) / 100)
  return { justificadas, injustificadas, limite, previstos: Number(horasContacto) || 0, excedido: limite > 0 && justificadas > limite }
}

// ---------- o curso ----------

/*
  Resultado do curso de um estudante. ucs: [{ codigo, nome, bloco, creditos, final, situacao }] (o TII é uma UC,
  com a nota do trabalho); ajuste: o do Comandante (limitado ao ajusteMaximo do plano).
  Devolve { blocos: [{ sigla, nome, coeficiente, nota, aprovado }], media, final, aprovado, concluido, mencao, emFalta }.
*/
export function resultadoCurso(plano, ucs, { ajuste = 0, faltas = null } = {}) {
  const peso = (u) => (u.creditos > 0 ? u.creditos : 1)
  const media = (lista) => {
    const comNota = lista.filter((u) => u.final !== null && u.final !== undefined)
    if (!comNota.length || comNota.length < lista.length) return null
    const soma = comNota.reduce((s, u) => s + peso(u) * Number(u.final), 0)
    return centesimas(soma / comNota.reduce((s, u) => s + peso(u), 0))
  }
  const emFalta = []
  const exigeUcs = plano.exigirUcs !== false
  const exigeTii = plano.exigirTii !== false
  for (const u of ucs) {
    if (u.situacao === 'aprovado') continue
    // sem nota ou em recuperação conta sempre; reprovada só conta se o plano exigir 10 na UC (ou no TII)
    if (u.situacao === 'reprovado' && u.final !== null && u.final !== undefined && !(u.tii ? exigeTii : exigeUcs)) continue
    emFalta.push(`${u.codigo} ${u.nome}${u.situacao === 'reprovado' ? ' (reprovada)' : u.situacao === 'recuperacao' ? ' (em recuperação)' : ''}`)
  }
  const blocos = plano.blocos.map((b) => {
    const dele = ucs.filter((u) => u.bloco === b.sigla)
    const nota = dele.length ? media(dele) : null
    return { ...b, ucs: dele.length, nota, aprovado: nota !== null && nota >= NOTA_MINIMA }
  })
  const semBloco = ucs.filter((u) => !plano.blocos.some((b) => b.sigla === u.bloco))
  let base = null
  if (plano.formula === 'media' || !plano.blocos.length) base = media(ucs)
  else if (blocos.every((b) => b.nota !== null) && blocos.some((b) => b.ucs)) {
    const usados = blocos.filter((b) => b.ucs)
    base = centesimas(usados.reduce((s, b) => s + b.coeficiente * b.nota, 0) / usados.reduce((s, b) => s + b.coeficiente, 0))
  }
  const limite = Number(plano.ajusteMaximo) || 0
  const a = Math.max(-limite, Math.min(limite, Number(ajuste) || 0))
  const final = base === null ? null : centesimas(Math.min(20, Math.max(0, base + a)))
  if (plano.exigirBlocos) for (const b of blocos) if (b.nota !== null && !b.aprovado) emFalta.push(`Bloco ${b.sigla} — ${b.nome} (média ${String(b.nota).replace('.', ',')})`)
  if (final !== null && final < NOTA_MINIMA) emFalta.push('Média final inferior a 10 valores')
  if (faltas?.excedido) emFalta.push(`Faltas justificadas acima do limite: ${faltas.justificadas} de no máximo ${faltas.limite} tempos (${plano.faltasMaximas ?? 10} %)`)
  const concluido = ucs.length > 0 && !emFalta.length && final !== null
  return {
    blocos, semBloco: semBloco.map((u) => u.codigo), media: base, ajuste: a, final, faltas,
    concluido, aprovado: concluido, mencao: concluido ? mencao(final) : final !== null && final < NOTA_MINIMA ? 'Reprovado' : null, emFalta,
  }
}

/*
  Verificações do plano de estudos (Decreto Presidencial n.º 193/18): créditos = horas / 15; uma UC com
  menos de 15 h não tem crédito; até 40 UCréd e 600 h por semestre; até 80 UCréd e 1200 h por ano.
  cadeiras: [{ codigo, nome, periodo, horasContacto, horasNaoContacto, creditos }]. Devolve avisos em texto.
*/
export function verificarCargaHoraria(cadeiras) {
  const avisos = []
  const horas = (c) => (Number(c.horasContacto) || 0) + (Number(c.horasNaoContacto) || 0)
  for (const c of cadeiras) {
    const h = horas(c)
    if (h && h < LIMITES.horasMinimasUc) avisos.push(`${c.codigo} ${c.nome}: ${h} h (uma UC precisa de pelo menos 15 h para ter crédito).`)
    if (h && c.creditos && Math.abs(c.creditos - h / CREDITO_HORAS) >= 1) avisos.push(`${c.codigo} ${c.nome}: ${c.creditos} UCréd para ${h} h (1 UCréd = 15 h, seriam ${Math.round(h / CREDITO_HORAS)}).`)
  }
  for (const s of ['1', '2']) {
    const doSemestre = cadeiras.filter((c) => c.periodo === s)
    const cr = doSemestre.reduce((t, c) => t + (Number(c.creditos) || 0), 0)
    const h = doSemestre.reduce((t, c) => t + horas(c), 0)
    if (cr > LIMITES.creditosSemestre) avisos.push(`${s}.º semestre: ${cr} UCréd (máximo ${LIMITES.creditosSemestre}).`)
    if (h > LIMITES.horasSemestre) avisos.push(`${s}.º semestre: ${h} h (máximo ${LIMITES.horasSemestre}).`)
  }
  const cr = cadeiras.reduce((t, c) => t + (Number(c.creditos) || 0), 0)
  const h = cadeiras.reduce((t, c) => t + horas(c), 0)
  if (cr > LIMITES.creditosAno) avisos.push(`Total do ano: ${cr} UCréd (máximo ${LIMITES.creditosAno}).`)
  if (h > LIMITES.horasAno) avisos.push(`Total do ano: ${h} h (máximo ${LIMITES.horasAno}).`)
  return avisos
}

/*
  Modelos dos planos 2026/2027 da ESG (os que vieram com os documentos): os blocos, os coeficientes e as UC
  com as horas e os créditos. Carregam-se no painel para uma turma; depois ajustam-se lá.
*/
const uc = (bloco, codigo, nome, hc, hnc, creditos, periodo = '1') => ({ bloco, codigo, nome, horasContacto: hc, horasNaoContacto: hnc, creditos, periodo })
export const MODELOS_PLANO = {
  'cscd-2026': {
    plano: {
      nome: '32.º Curso Superior de Comando e Direcção — Plano de Curso 2026/2027', anoLetivo: '2026/2027', termo: 'auditor', formula: 'ponderada', ajusteMaximo: 0,
      blocos: [{ sigla: 'ADM', nome: 'Administração', coeficiente: 2 }, { sigla: 'TAC', nome: 'Táctica', coeficiente: 3 }, { sigla: 'OCC', nome: 'Operações Conjuntas e Combinadas', coeficiente: 1 }, { sigla: 'ESTR', nome: 'Estratégia', coeficiente: 2 }, { sigla: 'TII', nome: 'Trabalho de Investigação Individual', coeficiente: 2 }],
    },
    cadeiras: [
      uc('ADM', 'CEO', 'Comunicação Estratégica nas Organizações', 33, 12, 3), uc('ADM', 'GP', 'Gestão de Pessoas', 33, 12, 3), uc('ADM', 'EFP', 'Economia e Finanças Públicas', 10, 5, 1),
      uc('ADM', 'DAM', 'Direito Administrativo Militar', 8, 7, 1), uc('ADM', 'LE', 'Liderança Estratégica', 35, 10, 3), uc('ADM', 'AL', 'Apoio Logístico', 31, 14, 3),
      uc('TAC', 'MQAD', 'Métodos Quantitativos de Apoio à Decisão', 15, 0, 1), uc('TAC', 'PDO', 'Planeamento e Doutrina de Operações', 73, 23, 6), uc('TAC', 'ODEF', 'Operações Defensivas – Componente', 67, 23, 6),
      uc('TAC', 'OOF', 'Operações Ofensivas – Divisão', 50, 25, 5, '2'), uc('TAC', 'OEST', 'Operações de Estabilização – Divisão', 75, 15, 6, '2'), uc('TAC', 'OAC', 'Operações de Apoio Civil', 32, 13, 3, '2'),
      uc('OCC', 'DOCC', 'Doutrina de Operações Conjuntas e Combinadas', 43, 17, 4, '2'), uc('OCC', 'POCC', 'Planeamento de Operações Conjuntas e Combinadas', 78, 12, 6, '2'),
      uc('ESTR', 'GA', 'Geopolítica Aplicada', 42, 3, 3), uc('ESTR', 'CONF', 'Conflitualidade', 40, 5, 3), uc('ESTR', 'PPE', 'Pensamento e Planeamento Estratégico', 72, 18, 6, '2'),
      uc('ESTR', 'DIP', 'Direito Internacional Público aplicado às Operações Militares', 23, 7, 2, '2'),
      uc('TII', 'MIC', 'Metodologia da Investigação Científica', 35, 10, 3), { ...uc('TII', 'TII', 'Trabalho de Investigação Individual', 88, 101, 13, 'anual'), tii: true },
    ],
  },
  'cemc-2026': {
    plano: {
      nome: '2.º Curso de Estado-Maior Conjunto — Plano de Curso 2026/2027', anoLetivo: '2026/2027', termo: 'discente', formula: 'ponderada', ajusteMaximo: 0,
      blocos: [{ sigla: 'ADM', nome: 'Administração', coeficiente: 2.5 }, { sigla: 'OCC', nome: 'Operações Conjuntas e Combinadas', coeficiente: 1 }, { sigla: 'ESTR', nome: 'Estratégia', coeficiente: 2 }, { sigla: 'TII', nome: 'Trabalho de Investigação Individual', coeficiente: 1.5 }],
    },
    // Quadro 4 do plano (os semestres não vêm no plano: a distribuição é uma proposta, ajusta-se no painel)
    cadeiras: [
      uc('ADM', 'DC', 'Direito Castrense', 15, 2, 1), uc('ADM', 'JD', 'Justiça e Disciplina', 13, 2, 1), uc('ADM', 'CRPP', 'Comunicação, Relações Públicas e Protocolo', 45, 15, 4),
      uc('ADM', 'PA', 'Protecção Ambiental', 36, 9, 3), uc('ADM', 'IGO', 'Introdução à Gestão das Organizações', 41, 4, 3), uc('ADM', 'GP', 'Gestão de Pessoas', 39, 6, 3),
      uc('ADM', 'EID', 'Economia e Indústria de Defesa', 30, 15, 3), uc('ADM', 'ARF', 'Administração de Recursos Financeiros', 36, 9, 3), uc('ADM', 'LC', 'Logística Conjunta', 37, 8, 3),
      uc('ADM', 'CL', 'Comando e Liderança', 30, 15, 3),
      uc('OCC', 'MQAD', 'Métodos Quantitativos de Apoio à Decisão', 15, 0, 1, '2'), uc('OCC', 'DOCC', 'Doutrina de Operações Conjuntas e Combinadas', 43, 17, 4, '2'),
      uc('OCC', 'POCC', 'Planeamento de Operações Conjuntas e Combinadas', 78, 27, 7, '2'), uc('OCC', 'PCE', 'Planeamento e Condução de Exercícios', 30, 15, 3, '2'),
      uc('ESTR', 'GEOP', 'Geopolítica', 47, 13, 4), uc('ESTR', 'EST', 'Estratégia', 49, 11, 4), uc('ESTR', 'HM', 'História Militar', 43, 17, 4, '2'),
      uc('ESTR', 'DIP', 'Direito Internacional Público aplicado às Operações Militares', 40, 20, 4, '2'), uc('ESTR', 'POL', 'Polemologia', 64, 26, 6, '2'),
      uc('TII', 'MIC', 'Metodologia da Investigação Científica', 35, 10, 3), { ...uc('TII', 'TII', 'Trabalho de Investigação Individual', 88, 120, 14, 'anual'), tii: true },
    ],
  },
  'ceao-2026': {
    plano: {
      nome: '18.º Curso de Estratégia e Arte Operativa — Plano 2026/2027', anoLetivo: '2026/2027', termo: 'auditor', formula: 'percentagem', ajusteMaximo: 0, exigirUcs: false, exigirTesteEscrito: false,
      blocos: [{ sigla: 'NUC', nome: 'Disciplinas Nucleares', coeficiente: 60 }, { sigla: 'COMP', nome: 'Disciplinas Complementares', coeficiente: 15 }, { sigla: 'TII', nome: 'Trabalho de Investigação Individual', coeficiente: 25 }],
    },
    // o plano dá a carga horária total de cada UC (sem separar contacto e não contacto) e não indica semestres
    cadeiras: [
      uc('NUC', 'EM', 'Estratégia Militar', 60, 0, 4, 'anual'), uc('NUC', 'AOT', 'Arte Operativa e Táctica e Jogo de Comando e Estado-Maior', 642, 0, 43, 'anual'),
      uc('NUC', 'DT', 'Direcção de Tropas', 90, 0, 6, 'anual'), uc('NUC', 'EMF', 'Edificação Militar e das FAA', 72, 0, 5, 'anual'), uc('NUC', 'SN', 'Segurança Nacional', 126, 0, 8, 'anual'),
      uc('NUC', 'LE', 'Liderança Estratégica', 45, 0, 3, 'anual'), uc('NUC', 'MIC', 'Metodologia de Investigação Científica', 18, 0, 1, 'anual'),
      uc('COMP', 'AMP', 'Asseguramento Moral e Psicológico', 30, 0, 2, 'anual'), uc('COMP', 'DIP', 'Direito Internacional Público', 34, 0, 2, 'anual'), uc('COMP', 'ET', 'Ética', 30, 0, 2, 'anual'),
      { ...uc('TII', 'TII', 'Trabalho de Investigação Individual', 60, 0, 4, 'anual'), tii: true },
    ],
  },
  'coamp-2026': {
    // média das UC (o plano não pondera blocos); os blocos servem só para agrupar
    plano: {
      nome: '12.º Curso de Organização do Asseguramento Moral e Psicológico — Plano 2026/2027', anoLetivo: '2026/2027', termo: 'discente', formula: 'media', ajusteMaximo: 0.25, exigirBlocos: false, exigirUcs: false, exigirTii: false, exigirTesteEscrito: false,
      factoresJuizo: ['culturaMilitar', 'autoconfianca', 'adaptabilidade', 'iniciativa', 'comunicacao', 'senso', 'decisao', 'planeamento', 'analise', 'trabalhoGrupo'],
      blocos: [{ sigla: 'NUC', nome: 'Matérias Nucleares', coeficiente: 1 }, { sigla: 'COMP', nome: 'Matérias Complementares', coeficiente: 1 }, { sigla: 'TAC', nome: 'Matérias de Táctica', coeficiente: 1 }, { sigla: 'GER', nome: 'Matérias Gerais', coeficiente: 1 }],
    },
    cadeiras: [
      uc('NUC', 'PM', 'Psicologia Militar', 45, 0, 3, 'anual'), uc('NUC', 'AP', 'Acção Psicológica', 180, 0, 12, 'anual'), uc('NUC', 'TPAMP', 'Teoria e Prática do Asseguramento Moral e Psicológico', 30, 0, 2, 'anual'),
      uc('NUC', 'OTOAMP', 'Organização Táctico-Operacional do Asseguramento Moral e Psicológico', 116, 0, 7, 'anual'), uc('NUC', 'TPEM', 'Teoria e Prática da Educação dos Militares', 30, 0, 2, 'anual'),
      uc('NUC', 'OTCL', 'Organização do Trabalho de Cultura e Lazer nas FAA', 30, 0, 2, 'anual'), uc('NUC', 'PCOM', 'Psicologia da Comunicação e Oratória Militar', 30, 0, 2, 'anual'),
      uc('NUC', 'RPFA', 'Relações Públicas nas Forças Armadas', 45, 0, 3, 'anual'),
      uc('COMP', 'CP', 'Cerimonial e Protocolo', 30, 0, 2, 'anual'), uc('COMP', 'HMA', 'História Militar de Angola', 32, 0, 2, 'anual'), uc('COMP', 'TFDM', 'Tecnologia do Fortalecimento da Disciplina Militar', 30, 0, 2, 'anual'),
      uc('COMP', 'PRI', 'Psicologia de Relações Interpessoais', 17, 0, 1, 'anual'), uc('COMP', 'TPTSM', 'Teoria e Prática do Trabalho Social Militar', 30, 0, 2, 'anual'), uc('COMP', 'PMU', 'Psicologia das Multidões', 16, 0, 1, 'anual'),
      uc('TAC', 'TOP', 'Topografia', 21, 0, 1, 'anual'), uc('TAC', 'DO', 'Doutrina das Operações', 38, 0, 2, 'anual'), uc('TAC', 'TEM', 'Técnica de Estado-Maior', 57, 0, 3, 'anual'), uc('TAC', 'BD', 'Brigada na Defesa', 64, 0, 4, 'anual'),
      uc('GER', 'DIP', 'Direito Internacional Público', 30, 0, 2, 'anual'), uc('GER', 'GA', 'Geopolítica Aplicada', 30, 0, 2, 'anual'), uc('GER', 'CL', 'Comando e Liderança', 30, 0, 2, 'anual'), uc('GER', 'PE', 'Pensamento Estratégico', 45, 0, 3, 'anual'),
      // Quadro Resumo do plano: o TII/TFC tem 156 tempos escolares e 10 UCréd
      { ...uc('GER', 'TFC', 'Trabalho de Fim do Curso', 156, 0, 10, 'anual'), tii: true },
    ],
  },
}

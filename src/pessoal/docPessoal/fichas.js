import { LARGURA, M, MARGEM, TAM, assinatura, cabecalho, dataPt, paragrafo, foto, garantir, linhaCampos, linhasEmBranco, novaPagina, secao, tabela, titulo } from './base'

/*
  Fichas (modelos da ESG), já preenchidas com os dados da ficha. O que o sistema não tem fica em branco,
  para preencher à mão.
*/
const ESTADOS_CIVIS = { solteiro: 'Solteiro(a)', casado: 'Casado(a)', uniao_facto: 'União de facto', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)' }
const HAB = { base: 'Ensino de base', medio: 'Ensino médio', bacharelato: 'Bacharelato', licenciatura: 'Licenciatura', mestrado: 'Mestrado', doutoramento: 'Doutoramento' }
const ec = (p) => ESTADOS_CIVIS[p.estadoCivil] ?? p.estadoCivil ?? ''
const idade = (iso) => { if (!iso) return ''; const n = new Date(iso); const h = new Date(); let a = h.getFullYear() - n.getFullYear(); if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate())) a--; return `${a} anos` }
const residencia = (p) => [p.provincia, p.municipio, p.bairro, p.rua, p.casa && `Casa n.º ${p.casa}`].filter(Boolean).join(', ') || p.morada || ''
const habilitacoes = (p) => [HAB[p.habilitacao], p.areaFormacao].filter(Boolean).join(' — ')
const promocoes = (p) => (p.eventos ?? []).filter((e) => e.tipo === 'promocao').sort((a, b) => String(a.data).localeCompare(String(b.data)))
const funcoes = (p) => (p.eventos ?? []).filter((e) => e.tipo === 'nomeacao' && e.cargoNome).sort((a, b) => String(a.data).localeCompare(String(b.data)))
const cursosMil = (p) => (p.cursos ?? []).filter((c) => c.tipo !== 'academico')
const tempoServico = (p) => (p.tempoServico !== null && p.tempoServico !== undefined ? `${Math.floor(p.tempoServico)} anos` : '')

// lista numerada a), b), c)… com o valor sobre a linha
function listaAlineas(d, valores, y, n = 6, x = MARGEM + 4, w = LARGURA - 8) {
  for (let i = 0; i < Math.max(n, valores.length); i++) y = linhaCampos(d, [[`${String.fromCharCode(97 + i)})`, valores[i] ?? '']], y, { x, w })
  return y
}

// ---------- militar: ficha individual (I dados gerais, II serviço militar), mecanográfica e anexo ----------
export async function fichaIndividualMilitar(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  y = titulo(d, 'FICHA INDIVIDUAL', y + 4)
  doc.setLineWidth(0.4).rect(MARGEM, y - 4, LARGURA, 250)
  y = secao(d, 'I – DADOS GERAIS', y + 2, { centrada: true, sublinhado: false })
  await foto(d, p, 160, y, 26, 32)
  doc.setFontSize(TAM - 3).text(`Grupo Sang.: ${M(p.grupoSanguineo) || '____'}`, 173, y + 38, { align: 'center' }).setFontSize(TAM)
  const w = 132
  const xi = MARGEM + 4
  y = linhaCampos(d, [['1. NOME COMPLETO', p.nome]], y + 6, { x: xi, w: w - 4 })
  y = linhaCampos(d, [['2. ALCUNHA', p.nomeGuerra]], y, { x: xi, w: w - 4 })
  y = linhaCampos(d, [['3. FILHO DE', p.pai]], y, { x: xi, w: w - 4 })
  y = linhaCampos(d, [['4. E DE', p.mae]], y, { x: xi, w: w - 4 })
  y += 6
  doc.text('5. NOME DA ESPOSA, DOS FILHOS E SUAS IDADES', MARGEM + 3, y)
  y += 7
  const familia = [...(p.conjuge ? [`${p.conjuge} (cônjuge)`] : []), ...(p.agregado ?? []).map((a) => `${a.nome}${a.parentesco ? ` (${a.parentesco})` : ''}${a.dataNascimento ? ` — ${idade(a.dataNascimento)}` : ''}`)]
  for (let i = 0; i < Math.max(5, familia.length); i++) y = linhaCampos(d, [['', familia[i] ?? '']], y, { x: MARGEM + 3, w: LARGURA - 6, alto: 8 })
  y = linhaCampos(d, [['6. RESIDÊNCIA', residencia(p)]], y + 2, { x: MARGEM + 3, w: LARGURA - 6 })
  doc.setFontSize(TAM - 1.5)
  y = secao(d, 'II – SITUAÇÃO RELACIONADA COM O CUMPRIMENTO DO SERVIÇO MILITAR', y + 4, { x: MARGEM + 3, sublinhado: false })
  doc.setFontSize(TAM)
  const o = { x: MARGEM + 4, w: LARGURA - 8 }
  y = linhaCampos(d, [['7. LOCAL DE INCORPORAÇÃO', p.localIncorporacao]], y, o)
  y = linhaCampos(d, [['8. DATA DE INCORPORAÇÃO', dataPt(p.dataIngresso)]], y, o)
  const vol = p.voluntario === true ? 'VOLUNTÁRIO' : p.voluntario === false ? 'NÃO VOLUNTÁRIO' : ''
  y = linhaCampos(d, [['9. CONDIÇÕES DE INCORPORAÇÃO', vol]], y, o)
  y = linhaCampos(d, [['10. INSPECÇÃO MÉDICA', p.aptidaoFisica ? 'FEZ' : '']], y, o)
  y = linhaCampos(d, [['11. ESPECIALIDADE MILITAR', p.especialidade || p.quadroNome, 1.3], ['12. PATENTE', p.postoNome, 1]], y, o)
  linhaCampos(d, [['RAMO', p.ramoNome], ['NIP', p.nip], ['FORMA DE SERVIÇO', p.fps]], y, o)
}

export function fichaMecanografica(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  doc.setFont('times', 'bold').setFontSize(TAM + 1)
  doc.setLineWidth(0.3).rect(65, y - 1, 80, 9).text('FICHA MECANOGRÁFICA', 105, y + 5.5, { align: 'center' })
  doc.setFont('times', 'normal').setFontSize(TAM)
  y += 18
  doc.setLineWidth(0.4).rect(MARGEM, y - 6, LARGURA, 205)
  const x = MARGEM + 4
  const w = LARGURA - 8
  const L = (campos) => { y = linhaCampos(d, campos, y, { x, w, alto: 10 }) }
  L([['1. NIP', p.nip]])
  L([['2. Nome Completo', p.nome]])
  L([['3. Nome do Pai', p.pai]])
  L([['4. Nome da Mãe', p.mae]])
  L([['5. Data de Nascimento', dataPt(p.dataNascimento)]])
  L([['6. Local de Nascimento', p.naturalidade, 1], ['Província', p.provincia, 1]])
  L([['7. Estado Civil', ec(p)]])
  L([['8. Nome do Cônjuge', p.conjuge]])
  L([['9. Habilitações Literárias', habilitacoes(p)]])
  const cursos = p.cursos ?? []
  const fimDe = (tipo) => dataPt(cursos.find((c) => c.tipo === tipo)?.fim)
  L([['a) Ensino Médio ou PUNIV', ['medio', 'bacharelato', 'licenciatura', 'mestrado', 'doutoramento'].includes(p.habilitacao) ? 'SIM' : '']])
  L([['b) Ensino Superior', ['bacharelato', 'licenciatura', 'mestrado', 'doutoramento'].includes(p.habilitacao) ? HAB[p.habilitacao] : '', 1.4], ['Data', fimDe('academico'), 0.6]])
  L([['c) Especialização', p.areaFormacao]])
  L([['10. Data de início do Serviço Militar', dataPt(p.dataIngresso)]])
  L([['11. Data de ingresso nas F.A.A', dataPt(p.dataIngressoQP || p.dataIngresso)]])
  // continuação: cursos, funções e promoções
  y = novaPagina(d) + 4
  doc.setLineWidth(0.4).rect(MARGEM, y - 6, LARGURA, 250)
  y = secao(d, '12. Cursos Militares que possui', y, { x, sublinhado: false })
  y = listaAlineas(d, cursosMil(p).map((c) => `${c.nome}${c.fim ? ` (${dataPt(c.fim)})` : ''}`), y)
  y = secao(d, '13. Funções mais importantes que exerceu', y + 2, { x, sublinhado: false })
  y = listaAlineas(d, [...funcoes(p).map((e) => `${e.cargoNome} (${dataPt(e.data)})`), ...(p.cargoNome && !funcoes(p).some((e) => e.cargoNome === p.cargoNome) ? [`${p.cargoNome} (actual)`] : [])], y)
  y = secao(d, '14. Promoções', y + 2, { x, sublinhado: false })
  y = listaAlineas(d, promocoes(p).map((e) => `${e.postoNovoNome} — ${dataPt(e.data)}${e.documento ? ` (${e.documento})` : ''}`), y)
  y = linhaCampos(d, [['Assinatura', '']], y + 6, { x, w })
  linhaCampos(d, [['Data', dataPt(new Date().toISOString())]], y, { x, w: 80 })
}

export function anexoFichaIndividual(d, p) {
  let y = novaPagina(d)
  y = cabecalho(d, ['ESTADO MAIOR GENERAL', 'ESCOLA SUPERIOR DE GUERRA'], y)
  y = titulo(d, '(Anexo à Ficha Individual)', y + 4, { sublinhado: false, tam: TAM })
  y = linhaCampos(d, [['1. NIP', p.nip, 0.8], ['PATENTE', p.postoNome, 1]], y + 4)
  y = linhaCampos(d, [['NOME COMPLETO', p.nome]], y)
  y += 4
  d.doc.text('2. Cursos Militares Feitos na E.S.G/E.M.G/F.A.A., ou em outra Instituição;', MARGEM, y)
  d.doc.text('Especialidade tempo e data de Término:', MARGEM, y + 6)
  y = listaAlineas(d, cursosMil(p).map((c) => [c.nome, c.local, c.fim && dataPt(c.fim)].filter(Boolean).join(' — ')), y + 14, 5, MARGEM, LARGURA)
  y = secao(d, '3. FUNÇÃO OU CARGO ACTUAL', y + 4, { sublinhado: true })
  y = linhaCampos(d, [['', [p.cargoNome, p.unidadeNome].filter(Boolean).join(' — ')]], y)
  y = linhaCampos(d, [['', '']], y)
  y = linhaCampos(d, [['Nº TELEFONE', p.telefone]], y + 6)
  d.doc.text('ANEXAR O CURRICULUM VITAE', MARGEM, y + 6)
  d.doc.text('ASSINATURA', 105, y + 24, { align: 'center' })
  d.doc.line(65, y + 36, 145, y + 36)
}

// ---------- civil: ficha individual (duas páginas) ----------
export async function fichaIndividualCivil(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  y = cabecalho(d, ['FORÇAS ARMADAS ANGOLANAS', 'ESTADO MAIOR GENERAL', 'ESCOLA SUPERIOR DE GUERRA'], y)
  await foto(d, p, 160, y - 2, 28, 34)
  y = titulo(d, 'FICHA INDIVIDUAL', y + 10)
  y = linhaCampos(d, [['PROCESSO Nº', p.processo?.numero ?? '']], y + 26, { x: 110, w: 80 })
  y += 2
  const L = (campos) => { y = linhaCampos(d, campos, y) }
  L([['NOME', p.nome, 2], ['ESTADO CIVIL', ec(p), 1]])
  L([['FILIAÇÃO', p.pai]])
  L([['E DE', p.mae]])
  L([['DATA DE NASCIMENTO', dataPt(p.dataNascimento), 1], ['LOCAL DE NASCIMENTO', [p.naturalidade, p.provincia].filter(Boolean).join(', '), 1.2]])
  L([['BILHETE DE IDENTIDADE Nº', p.bi, 1.3], ['EMITIDO EM', p.biLocalEmissao, 1]])
  L([['AOS', dataPt(p.biEmitidoEm), 0.8], ['LOCAL DE TRABALHO', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 1.6]])
  L([['DATA DE ADMISSÃO', dataPt(p.dataAdmissao), 1], ['FUNÇÃO/CATEGORIA', [p.cargoNome, p.categoriaCivil].filter(Boolean).join(' — '), 1.5]])
  L([['MORADA', p.morada || p.provincia, 1.3], ['MUNICÍPIO', p.municipio, 1]])
  L([['BAIRRO', p.bairro, 1.2], ['RUA', p.rua, 1]])
  L([['CASA Nº', p.casa, 0.6], ['TELEFONE', p.telefone, 1], ['CAIXA POSTAL', p.caixaPostal, 0.8]])
  y = secao(d, 'AGREGADO FAMILIAR', y + 4, { centrada: true })
  const ag = [...(p.conjuge ? [{ nome: p.conjuge, parentesco: 'Cônjuge' }] : []), ...(p.agregado ?? [])]
  const linhas = Array.from({ length: Math.max(3, ag.length) }, (_, i) => { const a = ag[i]; return a ? [M(a.nome), M(a.parentesco), idade(a.dataNascimento), M(a.nacionalidade), M(a.profissao)] : ['', '', '', '', ''] })
  tabela(d, y, ['NOME', 'G.PARENTESCO', 'IDADE', 'NACIONALIDADE', 'PROFISSÃO'], linhas, { alto: 8 })
  // 2.ª página
  y = novaPagina(d) + 2
  doc.setLineWidth(0.3).rect(MARGEM, y - 6, LARGURA, 10)
  doc.setFont('times', 'bold').text('FICHA INDIVIDUAL', 105, y + 0.5, { align: 'center' }).setFont('times', 'normal')
  doc.rect(MARGEM, y + 6, LARGURA, 245)
  y += 15
  const x = MARGEM + 3
  const w = LARGURA - 6
  const P = (r, v) => { y = linhaCampos(d, [[r, v]], y, { x, w, alto: 8.5 }) }
  P('NOME COMPLETO', p.nome)
  P('DATA DE NASCIMENTO', dataPt(p.dataNascimento))
  P('LOCAL DE NASCIMENTO', p.naturalidade)
  P('PROVÍNCIA', p.provincia)
  P('MUNICÍPIO', p.municipio)
  P('HABILITAÇÕES LITERÁRIAS', HAB[p.habilitacao] ?? '')
  P('HABILITAÇÕES PROFISSIONAIS', p.areaFormacao)
  P('OCUPAÇÃO LABORAL', [p.cargoNome, p.categoriaCivil].filter(Boolean).join(' — '))
  P('SALÁRIO MENSAL', p.vencimento ? `${Number(p.vencimento).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} KZ` : '')
  P('DATA DE ADMISSÃO NO LOCAL DE SERVIÇO', dataPt(p.dataAdmissao))
  P('TEMPO DE SERVIÇO', tempoServico(p))
  P('OUTRAS EMPRESAS ONDE JÁ TRABALHOU', '')
  y = linhasEmBranco(d, 1, y + 1, { x, w })
  P('MOTIVO DA SUA DEMISSÃO', '')
  P('AGREGADO FAMILIAR (IDADE E PROFISSÃO)', '')
  for (const a of ag.slice(0, 4)) P('', [a.nome, idade(a.dataNascimento), a.profissao].filter(Boolean).join(' — '))
  P('ESTADO CIVIL', ec(p))
  P('LOCAL DE SERVIÇO (ESPOSA) MARIDO', p.conjugeLocalServico)
  P('ENDEREÇO FAMILIAR', residencia(p))
  P('OUTROS DADOS (REGISTO DO RESUMO DISCIPLINAR LABORAL)', '')
  y = linhasEmBranco(d, 2, y + 1, { x, w })
  doc.text('ASSINATURA', 105, Math.min(y + 8, 262), { align: 'center' })
  doc.line(70, Math.min(y + 20, 274), 140, Math.min(y + 20, 274))
}

// ---------- ficha de registo biográfico (civil) ----------
export function fichaRegistoBiografico(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  y = titulo(d, 'FICHA DE REGISTO BIOGRÁFICO', y + 4)
  y = linhaCampos(d, [['Nº do Processo', p.processo?.numero ?? '', 1], ['Nº do Registo', p.numeroAgente, 1], ['NIF / INSS', p.inss, 1]], y)
  y = secao(d, '1. IDENTIFICAÇÃO', y + 2, { sublinhado: false })
  const L = (c) => { y = linhaCampos(d, c, y) }
  L([['NOME COMPLETO', p.nome]])
  L([['FILIAÇÃO — PAI', p.pai]])
  L([['MÃE', p.mae]])
  L([['SEXO', p.genero === 'F' ? 'F' : p.genero === 'M' ? 'M' : '', 0.5], ['DATA E LOCAL DE NASCIMENTO', [dataPt(p.dataNascimento), p.naturalidade].filter(Boolean).join(' — '), 1.8]])
  L([['MUNICÍPIO', p.municipio], ['PROVÍNCIA', p.provincia], ['NACIONALIDADE', p.nacionalidade]])
  L([['B.I. Nº', p.bi, 1.2], ['LOCAL DE EMISSÃO', p.biLocalEmissao, 1], ['DATA', dataPt(p.biEmitidoEm), 0.7]])
  L([['RESIDÊNCIA', residencia(p)]])
  L([['PROFISSÃO', p.areaFormacao, 1], ['CARGO ACTUAL', p.cargoNome, 1]])
  y = secao(d, '2. ESTADO CIVIL', y + 2, { sublinhado: false })
  L([['ESTADO CIVIL', ec(p), 1], ['NOME DO(A) CÔNJUGE', p.conjuge, 1.6]])
  L([['DATA DE NASCIMENTO DO CÔNJUGE', '', 1.3], ['LOCAL DE TRABALHO', p.conjugeLocalServico, 1]])
  y = secao(d, '3. VÍNCULO JURÍDICO LABORAL', y + 2, { sublinhado: false })
  L([['VÍNCULO', p.vinculoCivilNome, 1], ['DATA DE ENTRADA', dataPt(p.dataAdmissao), 1]])
  L([['CATEGORIA OCUPACIONAL', p.categoriaCivil, 1.3], ['DESPACHO Nº', '', 0.7]])
  y = secao(d, '4. COLOCAÇÕES', y + 2, { sublinhado: false })
  y = tabela(d, y, ['Categoria Ocupacional', 'Despacho Nº', 'Data', 'Início de função', 'Colocação'], [[M(p.categoriaCivil), '', '', dataPt(p.dataCategoria || p.dataAdmissao), M(p.unidadeNome)], ['', '', '', '', ''], ['', '', '', '', '']])
  y = secao(d, '5. ESTUDOS REALIZADOS', y, { sublinhado: false })
  y = tabela(d, y, ['Curso / Habilitação', 'Escola, Instituto ou Universidade', 'Terminado em'], [[M(habilitacoes(p)), '', ''], ...(p.cursos ?? []).map((c) => [M(c.nome), M(c.local), dataPt(c.fim)]), ['', '', '']])
  y = secao(d, '6. PROCESSO DISCIPLINAR', y, { sublinhado: false })
  const disc = (p.eventos ?? []).filter((e) => e.tipo === 'punicao')
  y = tabela(d, y, ['Infracção cometida', 'Pena aplicada', 'Data'], [...disc.map((e) => [M(e.descricao), '', dataPt(e.data)]), ['', '', ''], ['', '', '']])
  y = secao(d, '7. DISTINÇÕES OU LOUVORES', y, { sublinhado: false })
  const lv = (p.eventos ?? []).filter((e) => e.tipo === 'louvor' || e.tipo === 'condecoracao')
  y = tabela(d, y, ['Distinção / louvor', 'Data'], [...lv.map((e) => [M(e.descricao || e.tipoNome), dataPt(e.data)]), ['', ''], ['', '']])
  y = secao(d, '8. SITUAÇÃO MÉDICA', y, { sublinhado: false })
  L([['GRUPO SANGUÍNEO', p.grupoSanguineo, 1], ['DOENÇAS/ALERGIAS DE QUE SOFRE', '', 1.8]])
  y = secao(d, '9. AGREGADO FAMILIAR', y + 2, { sublinhado: false })
  const ag = [...(p.conjuge ? [{ nome: p.conjuge, parentesco: 'Cônjuge' }] : []), ...(p.agregado ?? [])]
  y = tabela(d, y, ['Nome', 'Grau de parentesco', 'Data de nascimento', 'Profissão'], [...ag.map((a) => [M(a.nome), M(a.parentesco), dataPt(a.dataNascimento), M(a.profissao)]), ['', '', '', ''], ['', '', '', '']])
  y = secao(d, '10. ASSIDUIDADE (faltas justificadas e injustificadas)', y, { sublinhado: false })
  const ano = new Date().getFullYear()
  y = tabela(d, y, ['ANO', 'Nº DE FALTAS JUSTIFICADAS', 'Nº DE FALTAS INJUSTIFICADAS'], Array.from({ length: 5 }, (_, i) => [String(ano - 4 + i), '', '']))
  y = secao(d, 'OBSERVAÇÕES (incluir distinções ou louvores, prémios e bónus)', y, { sublinhado: false })
  y = linhasEmBranco(d, 4, y + 2)
  y = linhaCampos(d, [['DATA DE SAÍDA DO SERVIÇO', '', 1], ['MOTIVO', '', 1.5]], y + 2)
  doc.setFontSize(TAM - 3)
  y = garantir(d, y + 2, 20)
  doc.text(doc.splitTextToSize('Anexar: I. Certidão de nascimento; II. Certidão de registo criminal; III. Certificado de habilitações literárias; IV. Certificado de habilitações profissionais; V. Declaração sobre o compromisso de honra; VI. Documentação militar; VII. Atestado médico; VIII. Proposta de admissão; IX. Fotocópia do bilhete de identidade; X. Cópia do certificado dos cursos que possui; XI. Resultado do teste de admissão; XII. Duas fotografias tipo passe.', LARGURA), MARGEM, y)
  doc.setFontSize(TAM)
}

// ---------- ficha disciplinar ----------
export function fichaDisciplinar(d, p) {
  let y = novaPagina(d)
  y = cabecalho(d, undefined, y)
  y = titulo(d, 'FICHA DISCIPLINAR', y + 6)
  y = linhaCampos(d, [['NOME', p.nome]], y + 4)
  y = linhaCampos(d, [['CATEGORIA', p.tipo === 'militar' ? p.postoNome : p.categoriaCivil]], y)
  y = linhaCampos(d, [['LOCAL DE TRABALHO', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA']], y)
  const oc = (p.eventos ?? []).filter((e) => ['punicao', 'louvor', 'condecoracao'].includes(e.tipo))
  const linhas = oc.map((e, i) => [String(i + 1), M(`${e.tipoNome}${e.descricao ? `: ${e.descricao}` : ''}`), dataPt(e.data), '', ''])
  while (linhas.length < 16) linhas.push(['', '', '', '', ''])
  tabela(d, y + 4, ['N/O', 'REGISTO DE OCORRÊNCIAS', 'DATA', 'ASSIN.DA ENT.EMPR.', 'ASSIN.DO TRABALHADOR'], linhas, { alto: 9, extra: { columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 25 }, 3: { cellWidth: 28 }, 4: { cellWidth: 30 } } } })
}

// ---------- ficha de avaliação individual (FAI) ----------
export function fichaAvaliacao(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  doc.setFontSize(TAM - 1)
  ;['FORÇAS ARMADAS ANGOLANAS', 'FICHA DE AVALIAÇÃO INDIVIDUAL', '(FAI)'].forEach((l, i) => doc.text(l, 105, y + i * 5.5, { align: 'center' }))
  y += 20
  doc.setFontSize(TAM)
  y = secao(d, '01 — IDENTIFICAÇÃO DO AVALIADO', y, { sublinhado: false })
  y = linhaCampos(d, [['UNIDADE', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA']], y)
  y = linhaCampos(d, [['POSTO', p.postoNome, 1], ['NIP', p.nip, 0.8], ['ASC', p.quadroEspecial, 0.6]], y)
  y = linhaCampos(d, [['NOME', p.nome]], y)
  y = linhaCampos(d, [['FUNÇÃO', p.cargoNome, 2], ['QE', p.quadroEspecial, 0.6]], y)
  y = secao(d, '02 — DATA E FORMA DE AVALIAÇÃO', y + 2, { sublinhado: false })
  y = linhaCampos(d, [['DATA DE REFERÊNCIA DA AVALIAÇÃO', '', 1.5], ['A', '', 0.6]], y)
  y = linhaCampos(d, [['AVALIAÇÃO PERIÓDICA  [   ]', '', 1], ['AVALIAÇÃO EXTRAORDINÁRIA  [   ]', '', 1]], y)
  y = secao(d, '03 — GRELHA DE AVALIAÇÃO', y + 2, { sublinhado: false })
  const FAT = ['Integridade de Carácter', 'Relações Humanas e Cooperação', 'Auto Confiança', 'Iniciativa', 'Sentido do dever e da Disciplina', 'Poder de Comunicação', 'Dedicação e empenho na Função', 'Planeamento e Organização', 'Aptidão Técnico Profissional', 'Julgamento', 'Decisão', 'Condição Física', 'Cultura Geral', 'Cultura Militar', 'Determinação e Perseverança', 'Adaptabilidade']
  const vazio = Array(12).fill('')
  y = tabela(d, y, ['', 'FACTORES', '5', '10', '15', '20', '5', '10', '15', '20', '5', '10', '15', '20'], [...FAT.map((f, i) => [`F${i + 1}`, f, ...vazio]), ['04', 'MÉDIA FINAL', ...vazio]], { tam: 10, alto: 6, extra: { columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 } }, didDrawPage: undefined } })
  doc.setFontSize(9).text('Colunas: 1.º avaliador | 2.º avaliador | Cmdte-Dir-Ch', MARGEM, y - 3).setFontSize(TAM)
  const bloco = (n, t, linhas = 4) => {
    y = secao(d, `${n} — ${t}`, garantir(d, y, 50), { sublinhado: false })
    y = linhasEmBranco(d, linhas, y + 2)
    y = linhaCampos(d, [['POSTO, NIP, NOME, DATA', '']], y)
    y += 2
  }
  bloco('05', 'PARECER DO CONSELHO DA ASC')
  bloco('06', '1.º AVALIADOR — FUNÇÃO')
  bloco('07', '2.º AVALIADOR — FUNÇÃO')
  bloco('08', 'COMANDANTE/DIRECTOR/CHEFE')
  y = secao(d, '09 — ÁREAS PREFERENCIAIS DE EMPREGO DO AVALIADO (assinale a 1.ª, 2.ª e 3.ª opção)', garantir(d, y, 70), { sublinhado: false })
  y = tabela(d, y, ['Preferência', 'Área', '1.º Avaliador', '2.º Avaliador', 'Cmdte'], ['Comando/Direcção/Chefia', 'Pessoal', 'Informações/Segurança', 'Operações/Planeamento', 'Logística', 'Docência/Instrução', 'Técnicas', 'Administrativo'].map((a) => ['', a, '', '', '']), { tam: 11 })
  bloco('10', 'O AVALIADO')
  bloco('11', 'O CHEFE DO ÓRGÃO DE PESSOAL E QUADROS')
}

// ---------- proposta de nomeação ----------
export function propostaNomeacao(d, p, o, quem) {
  let y = novaPagina(d)
  y = cabecalho(d, undefined, y)
  y = titulo(d, 'PROPOSTA DE NOMEAÇÃO', y + 6)
  const L = (c) => { y = linhaCampos(d, c, y) }
  L([['1. NIP', p.nip, 1], ['2. POSTO', p.postoNome, 1.4]])
  L([['3. APELIDO', p.nomeGuerra || p.nome.split(' ').at(-1)]])
  L([['4. NOME COMPLETO', p.nome]])
  L([['5. CARGO QUE OCUPA/SITUAÇÃO', [p.cargoNome, p.situacaoNome].filter(Boolean).join(' — ')]])
  L([['CÓD.', '']])
  L([['6. ARMA/ESPECIALIDADE/CLASSE', p.quadroNome || p.especialidade]])
  L([['7. U/E/O', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA']])
  L([['8. CARGO PROPOSTO', o.cargoProposto]])
  L([['9. ARMA/ESPECIALIDADE/CLASSE', o.especialidadeProposta || p.quadroNome || p.especialidade]])
  L([['10. U/E/O', o.unidadeProposta || 'ESCOLA SUPERIOR DE GUERRA']])
  d.doc.text('11.', MARGEM, y)
  const mil = cursosMil(p).map((c) => c.nome)
  const linhas = Array.from({ length: Math.max(4, mil.length) }, (_, i) => [i === 0 ? M(habilitacoes(p)) : '', M(mil[i] ?? ''), ''])
  y = tabela(d, y + 3, ['LITERÁRIAS', 'MILITARES', 'OUTRAS'], linhas)
  y = linhaCampos(d, [['FUNDAMENTO DA PROPOSTA', o.fundamento]], y)
  y = linhasEmBranco(d, 2, y + 1)
  y = assinatura(d, y + 2, quem.comandante, { local: quem.local })
  y = linhaCampos(d, [['12. PARECER DO CONSELHO DE ARMA/ESPECIALIDADE/CLASSE', '']], y)
  y = linhasEmBranco(d, 2, y + 1)
  y = linhaCampos(d, [['13. CONCLUSÃO DO ÓRGÃO DE PESSOAL E QUADROS', '']], y)
  y = linhasEmBranco(d, 2, y + 1)
  d.doc.setFont('times', 'bold').text('O CHEFE', 150, garantir(d, y + 10, 20), { align: 'center' }).setFont('times', 'normal')
}

// ---------- processo individual de promoção (PIP) ----------
export async function processoPromocao(d, p) {
  const { doc } = d
  let y = novaPagina(d)
  await foto(d, p, 166, y - 6, 24, 29)
  doc.setFont('times', 'bold').setFontSize(TAM + 1).text('PROCESSO INDIVIDUAL DE PROMOÇÃO (PIP)', MARGEM, y + 8)
  const tw = doc.getTextWidth('PROCESSO INDIVIDUAL DE PROMOÇÃO (PIP)')
  doc.setLineWidth(0.3).line(MARGEM, y + 9.2, MARGEM + tw, y + 9.2).setFont('times', 'normal').setFontSize(TAM)
  y = linhaCampos(d, [['', `${M(p.postoNome)} — ${M(p.nome)} — NIP ${M(p.nip)}`]], y + 30)
  const B = (t) => { y = secao(d, t, garantir(d, y + 2, 30)) }
  B('BLOCO 1 – Dados Pessoais')
  y = linhaCampos(d, [['Data de Nascimento:', dataPt(p.dataNascimento), 1], ['Local de Nascimento:', p.naturalidade, 1.2]], y)
  y = linhaCampos(d, [['Pai:', p.pai]], y)
  y = linhaCampos(d, [['Mãe:', p.mae]], y)
  B('BLOCO 2 – Situação Militar')
  y = linhaCampos(d, [['Tempo de SVC Militar:', tempoServico(p)]], y)
  y = linhaCampos(d, [['Situação de Serviço:', p.situacaoCaminho || p.situacaoNome]], y)
  y = linhaCampos(d, [['Cargo:', p.cargoNome]], y)
  B(`BLOCO 3 – Síntese da Avaliação Individual Referente ao Ano de ${new Date().getFullYear() - 1}/${String(new Date().getFullYear()).slice(-2)}`)
  const F = ['F1 – Integridade de Carácter', 'F2 – Relação Humana e Cooperação', 'F3 – Auto Confiança e Autodomínio', 'F4 – Iniciativa', 'F5 – Sentido do Dever e da Disciplina', 'F6 – Poder de Comunicação', 'F7 – Dedicação e Empenho na Função', 'F8 – Planeamento e Organização', 'F9 – Aptidão Técnico Profissional', 'F10 – Julgamento', 'F11 – Decisão', 'F12 – Condição Física', 'F13 – Cultura Geral', 'F14 – Cultura Militar', 'F15 – Determinação e Perseverança', 'F16 – Adaptabilidade']
  y = tabela(d, y, ['Factor', '5', '10', '15', '20', 'Factor', '5', '10', '15', '20'], F.slice(0, 8).map((f, i) => [f, '', '', '', '', F[i + 8], '', '', '', '']), { tam: 10, alto: 6 })
  y = linhaCampos(d, [['Média:', '']], y, { w: 70 })
  B('BLOCO 4 – Dados do Quadro Especial')
  y = linhaCampos(d, [['Vacatura no Quadro Especial de:', p.quadroNome]], y)
  y = linhaCampos(d, [['Previsto no QE:', '', 1], ['Existente no QE:', '', 1], ['Vagas no QE:', '', 1]], y)
  y = linhaCampos(d, [['Posição na Lista de Antiguidade:', '', 1.4], ['Nº na ASC:', '', 0.8], ['Nº no Posto:', '', 0.8]], y)
  B('BLOCO 5 – Histórico de Promoção')
  const pr = promocoes(p)
  for (let i = 0; i < Math.max(6, pr.length); i++) y = linhaCampos(d, [[`${i + 1}.`, pr[i] ? `${pr[i].postoNovoNome} — ${dataPt(pr[i].data)}${pr[i].documento ? ` (${pr[i].documento})` : ''}` : '']], y, { alto: 8 })
  B('BLOCO 6 – Curso de Promoção ou outro que se equipare')
  const cp = (p.cursos ?? []).filter((c) => c.tipo === 'promocao' || c.chave)
  for (let i = 0; i < Math.max(3, cp.length); i++) y = linhaCampos(d, [['', cp[i] ? `${cp[i].nome}${cp[i].fim ? ` — ${dataPt(cp[i].fim)}` : ''}${cp[i].aproveitamento === false ? ' (sem aproveitamento)' : ''}` : '']], y, { alto: 8 })
  B('BLOCO 7 – Desempenho de Funções Obrigatórias')
  y = paragrafo(d, ['1. Comando de companhia ou outro cargo que se equipare no QE, num período mínimo de um ano:   SIM [   ]   NÃO [   ]'], y, { recuo: 0, justificar: false })
  y = paragrafo(d, ['2. Professor, instrutor ou outro cargo que se equipare dentro do QE, pelo menos dois anos:   SIM [   ]   NÃO [   ]'], y + 2, { recuo: 0, justificar: false })
  B('BLOCO 8 – Avaliação Médica')
  y = linhaCampos(d, [['', p.aptidaoFisica ? 'APTO' : '']], y)
  y = linhasEmBranco(d, 2, y + 1)
  B('BLOCO 9 – Antecedentes Disciplinares e/ou Criminais')
  const pu = (p.eventos ?? []).filter((e) => e.tipo === 'punicao')
  y = linhaCampos(d, [['', pu.length ? pu.map((e) => `${e.descricao} (${dataPt(e.data)})`).join('; ') : p.processoPendente ? 'PROCESSO PENDENTE' : 'NADA CONSTA']], y)
  y = linhasEmBranco(d, 1, y + 1)
  B('BLOCO 10 – Conclusão')
  y = linhaCampos(d, [['', p.promocao?.elegivel ? `EM CONDIÇÕES DE PROMOÇÃO A ${M(p.promocao.postoPropostoNome)}` : '']], y)
  y = linhasEmBranco(d, 1, y + 1)
  y = linhaCampos(d, [['DATA', dataPt(new Date().toISOString())]], garantir(d, y + 6, 40), { x: 120, w: 70 })
  doc.setFont('times', 'bold').text('O OFICIAL RESPONSÁVEL', 105, y + 10, { align: 'center' }).setFont('times', 'normal')
  doc.line(70, y + 26, 140, y + 26)
}

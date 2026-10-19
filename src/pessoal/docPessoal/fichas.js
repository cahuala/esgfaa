import { emblema } from '../documentos'
import { fotoBase64 } from '../fotos'
import { M, dataPt, logoEsg, novaPagina } from './base'

/*
  Fichas desenhadas como os modelos da ESG (as medidas vêm dos modelos digitalizados): ficha individual,
  mecanográfica e anexo (militar), ficha individual e registo biográfico (civil), ficha disciplinar, FAI,
  proposta de nomeação e PIP. O que o sistema sabe vai escrito (maiúsculas, negrito), sempre dentro da
  caixa ou da linha: se não couber, a letra diminui. O resto fica em branco, para preencher à mão.
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
const familia = (p) => (p.agregado ?? []).map((a) => ({ ...a, idade: idade(a.dataNascimento) }))
// «AUXILIAR DE SERVIÇOS GERAIS DE 1.ª CLASSE» (sem repetir o cargo quando a classe já o diz)
const funcaoCategoria = (p) => { const c = p.cargoNome ?? ''; const k = p.categoriaCivil ?? ''; return !c ? k : !k || k.toLowerCase().startsWith(c.toLowerCase()) ? k || c : c.toLowerCase().startsWith(k.toLowerCase()) ? c : `${c} / ${k}` }
const partesData = (iso) => { const t = dataPt(iso); return t ? t.split('/') : ['', '', ''] }

// ---------- peças de desenho ----------
const H = (doc, tam = 8, estilo = 'normal') => doc.setFont('helvetica', estilo).setFontSize(tam)
const T = (doc, tam = 9, estilo = 'normal') => doc.setFont('times', estilo).setFontSize(tam)
const traco = (doc, l = 0.3) => doc.setLineWidth(l).setDrawColor(0)

// o valor (maiúsculas, negrito) dentro da largura w: a letra diminui até caber (e, no limite, corta)
function valor(doc, v, x, y, w, { tam = 9, fonte = 'helvetica', centrar = false } = {}) {
  let t = M(v)
  if (!t) return
  let s = tam
  doc.setFont(fonte, 'bold')
  while (s > 5.5 && doc.setFontSize(s).getTextWidth(t) > w) s -= 0.25
  if (doc.getTextWidth(t) > w) { while (t.length > 1 && doc.getTextWidth(`${t}…`) > w) t = t.slice(0, -1); t += '…' }
  doc.text(t, centrar ? x + w / 2 : x, y, { align: centrar ? 'center' : 'left' })
}
// caixa do formulário com o valor lá dentro
function caixa(doc, x, y, w, h, v, op = {}) {
  traco(doc).rect(x, y, w, h)
  valor(doc, v, x + 1.5, y + h / 2 + 1.2, w - 3, op)
}
// caixas seguidas (um algarismo do NIP, ou dia/mês/ano em cada)
function celulas(doc, x, y, w, h, partes, op = {}) {
  partes.forEach((v, i) => caixa(doc, x + i * w, y, w, h, v, { centrar: true, ...op }))
}
// «RÓTULO ________» com o valor por cima da linha
function linha(doc, rotulo, v, x, y, xf, { tam = 8, fonte = 'helvetica', tamV } = {}) {
  doc.setFont(fonte, 'normal').setFontSize(tam)
  const lx = rotulo ? x + doc.getTextWidth(rotulo) + 1 : x
  if (rotulo) doc.text(rotulo, x, y)
  doc.setLineWidth(0.2).setDrawColor(60).line(lx, y + 0.8, xf, y + 0.8).setDrawColor(0)
  valor(doc, v, lx + 1, y - 0.3, xf - lx - 2, { tam: tamV ?? tam + 1, fonte })
}
// texto sublinhado e centrado
function sublinhado(doc, t, cx, y) {
  doc.text(t, cx, y, { align: 'center' })
  const w = doc.getTextWidth(t)
  doc.setLineWidth(0.25).line(cx - w / 2, y + 0.9, cx + w / 2, y + 0.9)
}
async function fotoEm(doc, p, x, y, w, h) {
  const f = p.fotoId ? await fotoBase64(p.id, p.fotoId).catch(() => null) : null
  if (f) doc.addImage(f, 'JPEG', x + 0.3, y + 0.3, w - 0.6, h - 0.6)
  return Boolean(f)
}
function nova(d, orientacao = 'portrait') {
  const { doc } = d
  if (d.paginas++ > 0) doc.addPage('a4', orientacao)
  else if (orientacao === 'landscape') {
    // o primeiro documento do PDF já tem a página: se for deitado, troca-a
    doc.deletePage(1)
    doc.addPage('a4', 'landscape')
  }
  doc.setTextColor(0).setDrawColor(0).setLineWidth(0.3)
}

// ---------- militar: ficha individual (I dados gerais, II serviço militar) ----------
export async function fichaIndividualMilitar(d, p) {
  const { doc } = d
  novaPagina(d)
  H(doc, 10.5).text('FICHA INDIVIDUAL', 99.7, 14, { align: 'center' })
  traco(doc, 0.4).rect(18.3, 22.8, 173.4, 260.9)
  H(doc, 8).text('I – DADOS GERAIS', 101.3, 28.8, { align: 'center' })
  const campos = [['1. NOME COMPLETO', p.nome, 42.2], ['2. ALCUNHA', p.nomeGuerra, 58.6], ['3. FILHO DE', p.pai, 74.8], ['4. E DE', p.mae, 90.7]]
  for (const [r, v, y] of campos) { H(doc, 7.5).text(r, 27.4, y); caixa(doc, 26.8, y + 2.2, 111, 7, v) }
  // fotografia, grupo sanguíneo, indicador direito e assinatura
  traco(doc).rect(141.6, 34.9, 41.8, 69.4)
  doc.line(171.4, 34.9, 171.4, 104.3).line(141.6, 65, 171.4, 65).line(141.6, 73.9, 171.4, 73.9)
  if (!(await fotoEm(doc, p, 141.6, 34.9, 29.8, 30.1))) H(doc, 7.5).text('Foto', 156.5, 49.8, { align: 'center' })
  H(doc, 7).text('Grupo. Sang', 156.5, 67.8, { align: 'center' })
  valor(doc, p.grupoSanguineo, 142.6, 72.6, 27.8, { centrar: true, tam: 8 })
  H(doc, 7).text('Indicador', 156.5, 88.6, { align: 'center' }).text('Direito', 156.5, 92, { align: 'center' }).text('Ass', 177.4, 102.6, { align: 'center' })
  // 5. esposa e filhos
  H(doc, 7.5).text('5. NOME DA ESPOSA, DOS FILHOS E SUAS IDADES', 27.4, 111.3)
  traco(doc).rect(27.4, 114.8, 156.3, 66)
  const fam = [...(p.conjuge ? [`${p.conjuge} (cônjuge)`] : []), ...familia(p).map((a) => `${a.nome}${a.parentesco ? ` (${a.parentesco})` : ''}${a.idade ? ` — ${a.idade}` : ''}`)]
  for (let i = 0; i < 10; i++) {
    if (i) doc.setLineWidth(0.2).line(27.4, 114.8 + i * 6.6, 183.7, 114.8 + i * 6.6)
    valor(doc, fam[i], 29, 114.8 + i * 6.6 + 4.6, 153, { tam: 8.5 })
  }
  H(doc, 7.5).text('6. RESIDÊNCIA (PROVÍNCIA, LOCALIDADE, BAIRRO RUA/LARGO, NÚMERO)', 28.1, 183.9)
  traco(doc).rect(28.1, 186.4, 156.6, 16.5).line(28.1, 194.6, 184.7, 194.6)
  const res = doc.setFont('helvetica', 'bold').setFontSize(8.5).splitTextToSize(M(residencia(p)), 152)
  valor(doc, res[0], 29.6, 192, 153, { tam: 8.5 })
  valor(doc, res.slice(1).join(' '), 29.6, 200.2, 153, { tam: 8.5 })
  // II
  H(doc, 7.5).text('II – SITUAÇÃO RELACIONADA COM O CUMPRIMENTO DO SERVIÇO MILITAR', 28.7, 206)
  H(doc, 7.5).text('7. LOCAL DE INCORPORAÇÃO', 28.7, 217.5).text('8. DATA DE INCORPORAÇÃO', 120, 215.4)
  caixa(doc, 28.7, 220.4, 55.8, 6.6, p.localIncorporacao, { tam: 8.5 })
  celulas(doc, 115, 218.4, 23.4, 6.6, partesData(p.dataIngresso), { tam: 8.5 })
  H(doc, 7.5).text('10. INSPECÇÃO MÉDICA', 126, 229.6).text('9. CONDIÇÕES DE INCORPORAÇÃO', 28.7, 235.6)
  H(doc, 7.5).text('VOLUNTÁRIO', 29, 244.4).text('N/VOLUNTÁRIO', 79.4, 244.4).text('FEZ', 129, 244.4).text('N/FEZ', 156.2, 244.4)
  const x = (cond) => (cond ? 'X' : '')
  caixa(doc, 28.1, 246.2, 31.1, 6.6, x(p.voluntario === true), { centrar: true })
  caixa(doc, 79.1, 246.2, 30.5, 6.6, x(p.voluntario === false), { centrar: true })
  caixa(doc, 117.2, 246.2, 30.8, 6.6, x(p.aptidaoFisica === true), { centrar: true })
  caixa(doc, 155.8, 246.2, 30.2, 6.6, x(p.aptidaoFisica === false), { centrar: true })
  H(doc, 7.5).text('11. ESPECIALIDADE MILITAR', 29.4, 261.4).text('12. PATENTE', 143.5, 261.4)
  caixa(doc, 30.3, 264.2, 64, 6.8, p.especialidade || p.quadroNome, { tam: 8.5 })
  caixa(doc, 122.6, 264.2, 63, 6.8, p.postoNome, { tam: 8.5 })
}

// ---------- militar: ficha mecanográfica (duas páginas) ----------
export function fichaMecanografica(d, p) {
  const { doc } = d
  novaPagina(d)
  traco(doc).rect(69.7, 21.2, 74.5, 9.5).rect(70.5, 22, 72.9, 7.9)
  H(doc, 10.5).text('FICHA MECANOGRÁFICA', 107, 27.6, { align: 'center' })
  traco(doc, 0.4).rect(19.9, 39, 170.2, 241.5)
  const L = (t, y) => H(doc, 8.5).text(t, 32.6, y)
  L('1. NIP', 51.4)
  const nip = String(p.nip ?? '').replace(/\s/g, '')
  const n = Math.max(8, nip.length)
  celulas(doc, 45.9, 49.1, 95.1 / n, 7, Array.from({ length: n }, (_, i) => nip[i] ?? ''), { tam: 9 })
  L('2. Nome Completo', 65.3); caixa(doc, 70.3, 63.1, 116.7, 7.6, p.nome)
  L('3. Nome do Pai', 78.6); caixa(doc, 64, 76.4, 123, 7, p.pai)
  L('4. Nome da Mãe', 92.9); caixa(doc, 64.6, 91, 122.4, 7, p.mae)
  L('5. Data de Nascimento', 105.9); celulas(doc, 79.2, 102.4, 19.1, 7, partesData(p.dataNascimento))
  L('6. Local de Nascimento', 118.6)
  valor(doc, p.naturalidade, 70, 118.6, 100, { tam: 8.5 })
  H(doc, 8.5).text('Província', 38.9, 128); caixa(doc, 63, 124.9, 90.7, 7.6, p.provincia)
  L('7. Estado Civil', 140.7); caixa(doc, 63, 137.6, 90.7, 7.6, ec(p))
  L('8. Nome do Cônjuge', 153.4); caixa(doc, 75.7, 150.3, 90.3, 7.6, p.conjuge)
  L('9. Habilitações Literárias', 166.1); caixa(doc, 83.9, 163.6, 90.7, 7.6, habilitacoes(p))
  H(doc, 8.5).text('Dia', 108.5, 182.6, { align: 'center' }).text('Mês', 127.9, 182.6, { align: 'center' }).text('Ano', 147.3, 182.6, { align: 'center' })
  const curso = (tipos) => (p.cursos ?? []).find((c) => c.tipo === 'academico' && tipos.some((t) => new RegExp(t, 'i').test(c.nome)))
  const medio = ['medio', 'bacharelato', 'licenciatura', 'mestrado', 'doutoramento'].includes(p.habilitacao)
  H(doc, 8.5).text('a)  Ensino Médio ou PUNIV', 37.3, 188.9); celulas(doc, 98.8, 185.8, 19.4, 7.2, medio ? partesData(curso(['médio', 'puniv'])?.fim) : ['', '', ''])
  H(doc, 8.5).text('b)  Ensino Superior', 37.3, 212.7); celulas(doc, 98.8, 209.2, 19.4, 7.2, partesData(curso(['licenc', 'bachar', 'mestr', 'doutor', 'superior'])?.fim))
  H(doc, 8.5).text('c)  Especialização', 37.3, 236.5); celulas(doc, 98.8, 233, 19.4, 7.2, partesData(curso(['especial', 'pós', 'pos-'])?.fim))
  L('10. Data de início do Serviço Militar', 255.5); celulas(doc, 103.6, 252, 19.3, 7, partesData(p.dataIngresso))
  doc.setLineWidth(0.3).line(19.9, 262.2, 190.1, 262.2)
  L('11. Data de ingresso nas F.A.A', 268.6); celulas(doc, 103.6, 265.6, 19.3, 7, partesData(p.dataIngressoQP || p.dataIngresso))
  // 2.ª página: cursos, funções, promoções
  novaPagina(d)
  traco(doc, 0.4).rect(18.3, 9.5, 173.7, 259.3)
  const lista = (titulo, y, valores) => {
    H(doc, 8.5).text(titulo, 32.6, y)
    for (let i = 0; i < 6; i++) {
      const yy = y + 5.4 + i * 8.1
      H(doc, 8.5).text(`${String.fromCharCode(97 + i)})`, 39.9, yy + 4.2)
      caixa(doc, 44.6, yy, 143.3, 5.8, valores[i], { tam: 8.5 })
    }
  }
  lista('12. Cursos Militares que possui', 24.4, cursosMil(p).map((c) => `${c.nome}${c.fim ? ` (${dataPt(c.fim)})` : ''}`))
  const fn = funcoes(p).map((e) => `${e.cargoNome} (${dataPt(e.data)})`)
  if (p.cargoNome && !funcoes(p).some((e) => e.cargoNome === p.cargoNome)) fn.push(`${p.cargoNome} (actual)`)
  lista('13. Funções mais importantes que exerceu', 92.2, fn)
  lista('14. Promoções', 155, promocoes(p).map((e) => `${e.postoNovoNome} — ${dataPt(e.data)}${e.documento ? ` (${e.documento})` : ''}`))
  linha(doc, 'Assinatura', '', 32.6, 223.2, 184, { tam: 8.5 })
  const [dd, mm, aa] = partesData(new Date().toISOString())
  H(doc, 8.5).text(`Data   ${dd} / ${mm} / ${aa}`, 32.6, 237.4)
}

// ---------- militar: anexo à ficha individual ----------
export function anexoFichaIndividual(d, p) {
  const { doc } = d
  novaPagina(d)
  logoEsg(d, 105, 15.9, 28.5)
  H(doc, 9).text('ESTADO MAIOR GENERAL', 105, 48.5, { align: 'center' })
  H(doc, 9, 'bold'); sublinhado(doc, 'ESCOLA SUPERIOR DE GUERRA', 105, 53.6)
  H(doc, 9).text('(Anexo à Ficha Individual)', 105, 81.5, { align: 'center' })
  linha(doc, '1. NIP', p.nip, 26.7, 96.7, 86, { tam: 9 })
  linha(doc, 'PATENTE', p.postoNome, 87.4, 96.7, 151.6, { tam: 9 })
  H(doc, 9).text('NOME COMPLETO', 152.9, 96.7)
  linha(doc, '', p.nome, 26.7, 104, 188.4, { tam: 9 })
  H(doc, 8.5).text('2. Cursos Militares Feitos na E.S.G/E.M.G/F.A.A., ou em outra Instituição;', 26.7, 118.2).text('Especialidade tempo e data de Término:', 26.7, 123.6)
  const cursos = cursosMil(p).map((c) => [c.nome, c.local, c.fim && dataPt(c.fim)].filter(Boolean).join(' — '))
  for (let i = 0; i < 5; i++) {
    const y = 128 + i * 13.7
    H(doc, 9).text(`${String.fromCharCode(97 + i)})`, 38.8, y + 6.5)
    traco(doc).rect(43.8, y, 141.7, 10)
    doc.setLineDashPattern([0.4, 0.8], 0).setLineWidth(0.15).line(45, y + 8, 184.3, y + 8).setLineDashPattern([], 0)
    valor(doc, cursos[i], 45.3, y + 6.6, 138.5, { tam: 8.5 })
  }
  H(doc, 8.5, 'bold')
  doc.text('3. FUNÇÃO OU CARGO ACTUAL', 27.4, 203.5)
  doc.setLineWidth(0.25).line(33.5, 204.4, 27.4 + doc.getTextWidth('3. FUNÇÃO OU CARGO ACTUAL'), 204.4)
  const cargo = doc.setFont('helvetica', 'bold').setFontSize(8.5).splitTextToSize(M([p.cargoNome, p.unidadeNome].filter(Boolean).join(' — ')), 138)
  for (const [i, y] of [209.2, 221.9].entries()) {
    traco(doc).rect(42.9, y, 142, 9.5)
    doc.setLineDashPattern([0.4, 0.8], 0).setLineWidth(0.15).line(44, y + 7.6, 184, y + 7.6).setLineDashPattern([], 0)
    valor(doc, i ? cargo.slice(1).join(' ') : cargo[0], 44.4, y + 6.2, 139, { tam: 8.5 })
  }
  linha(doc, 'Nº TELEFONE', p.telefone, 28, 246.3, 177.3, { tam: 9 })
  H(doc, 9).text('ANEXAR O CURRICULUM VITAE', 28, 255.5).text('ASSINATURA', 105, 268.8, { align: 'center' })
  doc.setLineWidth(0.25).line(66.4, 279, 153.5, 279)
}

// ---------- civil: ficha individual (duas páginas) ----------
export async function fichaIndividualCivil(d, p) {
  const { doc } = d
  novaPagina(d)
  emblema(doc, d.brasao, 105, 14.3, 20.6)
  H(doc, 8.5).text('FORÇAS ARMADAS ANGOLANAS', 105, 39.3, { align: 'center' }).text('ESTADO MAIOR GENERAL', 105, 44.4, { align: 'center' })
  sublinhado(doc, 'REPARTIÇÃO DE PESSOAL CIVIL', 105, 49.8)
  H(doc, 9.5, 'bold'); sublinhado(doc, 'FICHA INDIVIDUAL', 105, 69.4)
  traco(doc).rect(160.2, 53.3, 27.6, 34.2)
  await fotoEm(doc, p, 160.2, 53.3, 27.6, 34.2)
  const o = { fonte: 'times', tam: 8.5, tamV: 9 }
  const R = (t, x, y) => T(doc, 8.5).text(t, x, y)
  linha(doc, 'PROCESSO Nº', p.processo?.numero ?? '', 120.9, 98.3, 186.2, o)
  linha(doc, 'NOME', p.nome, 23, 108.1, 119.3, o); linha(doc, 'ESTADO CIVIL', ec(p), 120.9, 108.1, 186.5, o)
  linha(doc, 'FILIAÇÃO', p.pai, 23, 115.4, 186.5, o)
  linha(doc, 'E DE', p.mae, 23, 122.4, 186.5, o)
  const [d1, m1, a1] = partesData(p.dataNascimento)
  R('DATA DE NASCIMENTO', 23, 129.3)
  valor(doc, `${d1} / ${m1} / ${a1}`, 62, 129, 52, { fonte: 'times', tam: 9 })
  doc.setLineWidth(0.2).line(61, 130.1, 114, 130.1)
  const local = [p.naturalidade, p.provincia].filter(Boolean).join(', ')
  linha(doc, 'LOCAL DE NASCIMENTO', local, 115.8, 129.3, 186.5, o)
  linha(doc, '', '', 23, 136.6, 56.5, o)
  linha(doc, 'BILHETE DE IDENTIDADE Nº', p.bi, 57.5, 136.6, 161.1, o)
  R('EMITIDO EM', 162.7, 136.6)
  linha(doc, '', p.biLocalEmissao, 23, 143.9, 76.5, o)
  const [d2, m2, a2] = partesData(p.biEmitidoEm)
  linha(doc, 'AOS', d2 ? `${d2}/${m2}/${a2}` : '', 77.8, 143.9, 142, o)
  R('LOCAL DE TRABALHO', 143.7, 143.9)
  linha(doc, '', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 23, 150.9, 167.5, o)
  R('DATA DE', 168.4, 150.9)
  const [d3, m3, a3] = partesData(p.dataAdmissao)
  linha(doc, 'ADMISSÃO', d3 ? `${d3}/${m3}/${a3}` : '', 23, 158.2, 92, o)
  linha(doc, 'FUNÇÃO/CATEGORIA', funcaoCategoria(p), 93, 158.2, 186.5, o)
  linha(doc, 'MORADA', p.morada || p.provincia, 23, 165.5, 113.6, o); linha(doc, 'MUNICÍPIO', p.municipio, 114.5, 165.5, 186.5, o)
  linha(doc, 'BAIRRO', p.bairro, 23, 172.8, 112.6, o); linha(doc, 'RUA', p.rua, 113.6, 172.8, 186.5, o)
  linha(doc, 'CASA Nº', p.casa, 23, 179.7, 72.4, o); linha(doc, 'TELEFONE', p.telefone, 73.3, 179.7, 133.9, o); linha(doc, 'CAIXA POSTAL', p.caixaPostal, 134.8, 179.7, 186.5, o)
  T(doc, 8.5); sublinhado(doc, 'AGREGADO FAMILIAR', 105, 188.1)
  // tabela do agregado
  const cx = [12.8, 65.4, 100, 116.8, 157.3, 189.4]
  traco(doc).rect(12.8, 198.9, 176.6, 70.3).line(12.8, 211.9, 189.4, 211.9)
  for (const xx of cx.slice(1, -1)) doc.line(xx, 198.9, xx, 269.2)
  T(doc, 6.5, 'bold')
  ;['NOME', 'G.PARENTESCO', 'IDADE', 'NACIONALIDADE', 'PROFISSÃO'].forEach((t, i) => doc.text(t, (cx[i] + cx[i + 1]) / 2, 207, { align: 'center', charSpace: 0.4 }))
  const ag = [...(p.conjuge ? [{ nome: p.conjuge, parentesco: 'Cônjuge' }] : []), ...familia(p)]
  for (let i = 0; i < 8; i++) {
    const y = 211.9 + i * 7.16
    if (i) doc.setLineWidth(0.2).line(12.8, y, 189.4, y)
    const a = ag[i]
    if (a) [a.nome, a.parentesco, a.idade, a.nacionalidade, a.profissao].forEach((v, k) => valor(doc, v, cx[k] + 1.2, y + 4.8, cx[k + 1] - cx[k] - 2.4, { fonte: 'times', tam: 8, centrar: k > 0 }))
  }
  // 2.ª página
  novaPagina(d)
  traco(doc).rect(22, 16.8, 169.6, 11.7)
  H(doc, 9).text('FICHA INDIVIDUAL', 106.8, 24.2, { align: 'center' })
  traco(doc).rect(20, 32.7, 170, 241.5)
  const P = (r, v, y) => linha(doc, r, v, 24.5, y, 187.8, { tam: 7.5, tamV: 8 })
  const B = (y) => doc.setLineWidth(0.2).setDrawColor(60).line(24.5, y, 187.8, y).setDrawColor(0)
  P('NOME COMPLETO', p.nome, 37.1)
  P('DATA DE NASCIMENTO', dataPt(p.dataNascimento), 41.8)
  P('LOCAL DE NASCIMENTO', p.naturalidade, 46.6)
  P('PROVÍNCIA', p.provincia, 51.4)
  P('MUNICÍPIO', p.municipio, 56.1)
  P('HABILITAÇÕES LITERÁRIAS', HAB[p.habilitacao] ?? '', 60.5)
  P('HABILITAÇÕES PROFISSIONAIS', p.areaFormacao, 65.3)
  P('OCUPAÇÃO LABORAL', funcaoCategoria(p), 70)
  P('SALÁRIO MENSAL', p.vencimento ? `${Number(p.vencimento).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} KZ` : '', 74.8)
  P('DATA DE ADMISSÃO NO LOCAL DE SERVIÇO', dataPt(p.dataAdmissao), 79.3)
  P('TEMPO DE SERVIÇO', tempoServico(p), 84)
  P('OUTRAS EMPRESAS ONDE JÁ TRABALHOU', '', 88.8); B(95.3); B(100.1)
  P('OCUPAÇÃO LABORAL', '', 104.8); B(109.6); B(114.6)
  P('MOTIVO DA SUA DEMISSÃO', '', 119.3); B(124.2); B(129)
  P('AGREGADO FAMILIAR (IDADE E PROFISSÃO)', '', 133.8)
  const af = familia(p)
  ;[139, 144.2, 149.4].forEach((y, i) => { B(y); valor(doc, af[i] && [af[i].nome, af[i].idade, af[i].profissao].filter(Boolean).join(' — '), 25.5, y - 1, 160, { tam: 8 }) })
  P('ESTADO CIVIL', ec(p), 155)
  P('LOCAL DE SERVIÇO (ESPOSA) MARIDO', p.conjugeLocalServico, 159.8); B(165.6)
  P('ENDEREÇO FAMILIAR', residencia(p), 174); B(179.4); B(184.2)
  P('OUTROS DADOS (REGISTO DO RESUMO DISCIPLINAR LABORAL)', '', 188.3)
  for (const y of [193.6, 198.6, 203.6, 208.6, 213.6]) B(y)
  H(doc, 8).text('ASSINATURA', 105, 240.6, { align: 'center' })
  doc.setLineWidth(0.25).line(69, 247.3, 141, 247.3)
}

// ---------- ficha disciplinar ----------
export function fichaDisciplinar(d, p) {
  const { doc } = d
  novaPagina(d)
  emblema(doc, d.brasao, 105, 19, 22)
  H(doc, 8.5).text('FORÇAS ARMADAS ANGOLANAS', 105, 46.3, { align: 'center' }).text('ESTADO MAIOR GENERAL', 105, 51.4, { align: 'center' })
  H(doc, 8.5, 'bold'); sublinhado(doc, 'ESCOLA SUPERIOR DE GUERRA', 105, 56.4)
  H(doc, 9.5, 'bold'); sublinhado(doc, 'FICHA DISCIPLINAR', 105, 75.1)
  linha(doc, 'NOME', p.nome, 22.3, 81.5, 185.8, { tam: 8.5 })
  linha(doc, 'CATEGORIA', p.tipo === 'militar' ? p.postoNome : p.categoriaCivil || p.carreiraNome, 22.3, 88.8, 185.8, { tam: 8.5 })
  linha(doc, 'LOCAL DE TRABALHO', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 22.3, 96.4, 185.8, { tam: 8.5 })
  const cx = [19.1, 30.8, 98.3, 119.3, 150.3, 190.9]
  traco(doc, 0.4).rect(19.1, 107.8, 171.8, 169.6)
  traco(doc).line(19.1, 127.4, 190.9, 127.4)
  for (const x of cx.slice(1, -1)) doc.line(x, 107.8, x, 277.4)
  T(doc, 7.5, 'bold')
  doc.text('N/O', 24.95, 113, { align: 'center' })
  doc.text('REGISTO DE OCORRÊNCIAS', 64.5, 114, { align: 'center' })
  doc.text('DATA', 108.8, 116, { align: 'center' })
  doc.text(['ASSIN.DA', 'ENT.EMPR.'], 134.8, 113.5, { align: 'center', lineHeightFactor: 1.6 })
  doc.text(['ASSIN.DO', 'TRABALHADOR'], 170.6, 113.5, { align: 'center', lineHeightFactor: 1.6 })
  const oc = (p.eventos ?? []).filter((e) => ['punicao', 'louvor', 'condecoracao'].includes(e.tipo))
  for (let i = 0; i < 19; i++) {
    const y = 127.4 + i * 7.895
    if (i) doc.setLineWidth(0.25).line(19.1, y, 190.9, y)
    const e = oc[i]
    if (e) {
      valor(doc, String(i + 1), cx[0] + 1, y + 5.2, cx[1] - cx[0] - 2, { fonte: 'times', tam: 8, centrar: true })
      valor(doc, `${e.tipoNome}${e.descricao ? `: ${e.descricao}` : ''}`, cx[1] + 1.2, y + 5.2, cx[2] - cx[1] - 2.4, { fonte: 'times', tam: 8 })
      valor(doc, dataPt(e.data), cx[2] + 1, y + 5.2, cx[3] - cx[2] - 2, { fonte: 'times', tam: 8, centrar: true })
    }
  }
}

// ---------- ficha de avaliação individual (FAI), duas páginas ----------
const FACTORES = ['Integridade de Carácter', 'Relações Humanas e Cooperação', 'Auto Confiança', 'Iniciativa', 'Sentido do dever e da Disciplina', 'Poder de Comunicação', 'Dedicação e empenho na Função', 'Planeamento e Organização', 'Aptidão Técnico Profissional', 'Julgamento', 'Decisão', 'Condição Física', 'Cultura Geral', 'Cultura Militar', 'Determinação e Perseverança', 'Adaptabilidade']
// bloco numerado da FAI: «06 | 1º AVALIADOR - FUNÇÃO:», linhas em branco e «POSTO, NIP, NOME, DATA» ao fundo
function blocoFai(doc, n, titulo, y0, y1, { centrar = false } = {}) {
  const x0 = 25
  const x1 = 185
  traco(doc).rect(x0, y0, x1 - x0, y1 - y0).line(x0, y0 + 4, x1, y0 + 4).line(x0 + 19, y0, x0 + 19, y0 + 4)
  H(doc, 6.3).text(n, x0 + 9.5, y0 + 3, { align: 'center' })
  H(doc, 6.3).text(titulo, centrar ? (x0 + 19 + x1) / 2 : x0 + 20.5, y0 + 3, { align: centrar ? 'center' : 'left' })
  for (let y = y0 + 8; y < y1 - 5; y += 4) doc.setLineWidth(0.15).line(x0, y, x1, y)
  H(doc, 6).text('POSTO, NIP, NOME, DATA', (x0 + x1) / 2, y1 - 1.3, { align: 'center' })
}
export function fichaAvaliacao(d, p) {
  const { doc } = d
  novaPagina(d)
  const x0 = 25
  const x1 = 185
  H(doc, 6.8).text('FORÇAS ARMADAS ANGOLANAS', 105, 14, { align: 'center' }).text('FICHA DE AVALIAÇÃO INDIVIDUAL', 105, 17.5, { align: 'center' }).text('(FAI)', 105, 21, { align: 'center' })
  // 01 identificação
  traco(doc).rect(x0, 23.1, 160, 34.9)
  H(doc, 6.3).text('01', x0 + 9.5, 25.6, { align: 'center' }).text('IDENTIFICAÇÃO DO AVALIADO', 105, 25.6, { align: 'center' })
  const o = { tam: 6.5, tamV: 8 }
  linha(doc, 'UNIDADE:', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', x0 + 0.8, 30.2, x1 - 1, o)
  linha(doc, 'POSTO:', p.postoNome, x0 + 0.8, 37.8, 77, o); linha(doc, 'NIP:', p.nip, 78.8, 37.8, 127.5, o); linha(doc, 'ASC:', p.quadroEspecial, 129, 37.8, x1 - 1, o)
  linha(doc, 'NOME:', p.nome, x0 + 0.8, 45.4, x1 - 1, o)
  linha(doc, 'FUNÇÃO:', p.cargoNome, x0 + 0.8, 53, 148, o); linha(doc, 'QE:', p.quadroEspecial, 149.5, 53, x1 - 1, o)
  // 02 data e forma
  traco(doc).rect(x0, 61.8, 160, 29.2)
  H(doc, 6.3).text('02', x0 + 9.5, 64.3, { align: 'center' }).text('DATA E FORMA DE AVALIAÇÃO', 105, 64.3, { align: 'center' })
  H(doc, 6.5).text('DATA DE REFERÊNCIA DA AVALIAÇÃO ______/______/________  a  ______/______/________', x0 + 0.8, 70)
  H(doc, 6.5).text('AVALIAÇÃO PERIÓDICA', x0 + 0.8, 77.5).text('AVALIAÇÃO EXTRAORDINÁRIA', 95.6, 77.5)
  traco(doc).rect(63.6, 74.9, 7.6, 3.5).rect(146, 74.9, 8, 3.5)
  linha(doc, 'OBS:', '', x0 + 0.8, 81.5, x1 - 1, o)
  doc.setLineWidth(0.2).line(x0 + 0.8, 86.6, x1 - 1, 86.6)
  // 03 grelha
  const g0 = 95.1
  const cF = x0 + 19
  const cN = 95.3
  const wc = (x1 - cN) / 12
  traco(doc).rect(x0, g0, 160, 78.6)
  doc.line(x0, g0 + 3.9, x1, g0 + 3.9).line(cN, g0 + 7.6, x1, g0 + 7.6).line(x0, g0 + 11.4, x1, g0 + 11.4)
  doc.line(cF, g0, cF, g0 + 78.6).line(cN, g0 + 3.9, cN, g0 + 78.6)
  for (let i = 1; i < 12; i++) doc.setLineWidth(i % 4 ? 0.15 : 0.3).line(cN + i * wc, g0 + (i % 4 ? 7.6 : 3.9), cN + i * wc, g0 + 78.6)
  H(doc, 6.3).text('03', x0 + 9.5, g0 + 2.9, { align: 'center' }).text('GRELHA DE AVALIAÇÃO', (cF + x1) / 2, g0 + 2.9, { align: 'center' })
  H(doc, 6.3).text('FACTORES', (cF + cN) / 2, g0 + 8.6, { align: 'center' })
  ;['1º AVALIADOR', '2º AVALIADOR', 'CMDTE-DIR-CH'].forEach((t, i) => doc.text(t, cN + (i * 4 + 2) * wc, g0 + 6.6, { align: 'center' }))
  for (let i = 0; i < 12; i++) H(doc, 5.8).text(String([5, 10, 15, 20][i % 4]), cN + (i + 0.5) * wc, g0 + 10.4, { align: 'center' })
  const fr = 3.925
  FACTORES.forEach((f, i) => {
    const y = g0 + 11.4 + i * fr
    doc.setLineWidth(0.15).line(x0, y + fr, x1, y + fr)
    H(doc, 6).text(`F${i + 1}`, x0 + 9.5, y + 2.9, { align: 'center' }).text(f, cF + 1, y + 2.9)
  })
  H(doc, 6.3).text('04', x0 + 9.5, g0 + 76.4, { align: 'center' }).text('MÉDIA FINAL', (cF + cN) / 2, g0 + 76.4, { align: 'center' })
  // 05 parecer do conselho
  traco(doc).rect(x0, 177.5, 160, 50.7).line(x0, 181.5, x1, 181.5).line(cF, 177.5, cF, 181.5)
  H(doc, 6.3).text('05', x0 + 9.5, 180.4, { align: 'center' }).text('PARECER DO CONSELHO DA ASC:', cF + 1.5, 180.4)
  for (let y = 185.5; y < 214; y += 4) doc.setLineWidth(0.15).line(x0, y, x1, y)
  H(doc, 6.3).text('O PRESIDENTE', 62, 218.7, { align: 'center' }).text('O SECRETÁRIO', 150, 218.7, { align: 'center' })
  doc.setLineWidth(0.2).line(30, 223.5, 95, 223.5).line(117, 223.5, 182, 223.5)
  H(doc, 6).text('POSTO, NIP, NOME, DATA', 62, 226.6, { align: 'center' }).text('POSTO, NIP, NOME, DATA', 150, 226.6, { align: 'center' })
  blocoFai(doc, '06', '1º AVALIADOR - FUNÇÃO:', 232.4, 263.1)
  // 2.ª página
  novaPagina(d)
  blocoFai(doc, '07', '2º AVALIADOR - FUNÇÃO:', 12.7, 50)
  blocoFai(doc, '08', 'COMANDANTE/DIRECTOR/CHEFE', 51.7, 88.8, { centrar: true })
  // 09 áreas preferenciais
  const a0 = 91
  const cols = [x0, x0 + 18.7, x0 + 27.7, x0 + 68.5, x0 + 98.1, x0 + 128.3, x1]
  traco(doc).rect(x0, a0, 160, 61.2)
  doc.line(x0, a0 + 3.5, x1, a0 + 3.5).line(cols[4] - 29.6, a0 + 7, x1, a0 + 7).line(x0, a0 + 10.5, x1, a0 + 10.5)
  doc.line(cols[1], a0 + 3.5, cols[1], a0 + 61.2).line(cols[2], a0 + 10.5, cols[2], a0 + 61.2).line(cols[3], a0 + 3.5, cols[3], a0 + 61.2).line(cols[4], a0 + 7, cols[4], a0 + 61.2).line(cols[5], a0 + 7, cols[5], a0 + 61.2)
  doc.line(x0 + 19, a0, x0 + 19, a0 + 3.5)
  H(doc, 6.3).text('09', x0 + 9.5, a0 + 2.6, { align: 'center' }).text('ÁREAS PREFERENCIAIS DE EMPREGO DO AVALIADO', (x0 + 19 + x1) / 2, a0 + 2.6, { align: 'center' })
  H(doc, 5.8).text('(ASSINALE A 1ª, 2ª E 3ª OPÇÃO)', (cols[1] + cols[3]) / 2, a0 + 6.3, { align: 'center' }).text('INDICAÇÃO', (cols[3] + x1) / 2, a0 + 5.8, { align: 'center' })
  H(doc, 5.8).text('PREFERÊNCIA', (cols[0] + cols[1]) / 2, a0 + 6.3, { align: 'center' })
  ;['1º Avaliador', '2º Avaliador', 'Cmdte'].forEach((t, i) => doc.text(t, (cols[3 + i] + cols[4 + i]) / 2, a0 + 9.5, { align: 'center' }))
  const areas = ['COMANDO/DIRECÇÃO/CHEFIA', 'PESSOAL', 'INFORMAÇÕES/SEGURANÇA', 'OPERAÇÕES/PLANEAMENTO', 'LOGÍSTICA', 'DOCÊNCIA/INSTRUÇÃO', 'TÉCNICAS', 'ADMINISTRATIVO', 'LOGÍSTICA']
  const ar = (61.2 - 10.5) / 9
  areas.forEach((t, i) => {
    const y = a0 + 10.5 + i * ar
    if (i) doc.setLineWidth(0.15).line(i === 5 ? cols[1] : cols[2], y, x1, y)
    H(doc, 5.8).text(t, (cols[2] + cols[3]) / 2, y + ar / 2 + 1, { align: 'center' })
    traco(doc, 0.2).rect(cols[0] + 6, y + 1.3, 6, 3)
    for (let k = 3; k < 6; k++) doc.rect((cols[k] + cols[k + 1]) / 2 - 3, y + 1.3, 6, 3)
  })
  doc.setLineWidth(0.3).line(cols[0], a0 + 10.5 + 5 * ar, cols[2], a0 + 10.5 + 5 * ar)
  H(doc, 5.8).text('ESTADO', cols[1] + 3.2, a0 + 10.5 + 2.5 * ar + 4, { angle: 90 }).text('MAIOR', cols[1] + 6.4, a0 + 10.5 + 2.5 * ar + 3.4, { angle: 90 })
  H(doc, 5.8).text('EXECUÇÃO', cols[1] + 5.4, a0 + 10.5 + 7 * ar + 5, { angle: 90 })
  blocoFai(doc, '10', 'O AVALIADO', 153.7, 206, { centrar: true })
  blocoFai(doc, '11', 'O CHEFE DO ORGÃO DE PESSOAL E QUADROS', 207.6, 260, { centrar: true })
}

// ---------- proposta de nomeação ----------
export function propostaNomeacao(d, p, o, quem) {
  const { doc } = d
  novaPagina(d)
  const x = 29.6
  const xf = 183
  T(doc, 8.5).text('FORÇAS ARMADAS ANGOLANAS', 105, 27, { align: 'center' }).text('ESTADO MAIOR GENERAL', 105, 31.1, { align: 'center' })
  sublinhado(doc, 'ESCOLA SUPERIOR DE GUERRA', 105, 35.2)
  sublinhado(doc, 'PROPOSTA DE NOMEAÇÃO', 105, 43.1)
  const op = { fonte: 'times', tam: 8.5, tamV: 9 }
  linha(doc, '1.NIP:', p.nip, x, 54.5, 66, op); linha(doc, '2. POSTO:', p.postoNome, 66.7, 54.5, 130.7, op)
  linha(doc, '3. APELIDO', p.nomeGuerra || p.nome.split(' ').at(-1), x, 60.5, xf, op)
  linha(doc, '4. NOME COMPLETO', p.nome, x, 66.9, xf, op)
  linha(doc, '5. CARGO QUE OCUPA/SITUAÇÃO:', [p.cargoNome, p.situacaoNome].filter(Boolean).join(' — '), x, 72.9, xf, op)
  linha(doc, '', '', x, 79.3, xf, op)
  linha(doc, 'CÓD.', '', x, 85, xf, op)
  linha(doc, '6.ARMA/ESPECIALIDADE/CLASSE:', p.quadroNome || p.especialidade, x, 91.3, xf, op)
  linha(doc, '7. U/E/', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', x, 97.3, xf, op)
  linha(doc, '8.CARGO PROPOSTO:', o.cargoProposto, x, 103.3, xf, op)
  linha(doc, '9.ARMA/ESPECIALIDADE/CLASSE:', o.especialidadeProposta || p.quadroNome || p.especialidade, x, 109.7, xf, op)
  linha(doc, '10. U/E/O', o.unidadeProposta || 'ESCOLA SUPERIOR DE GUERRA', x, 115.4, xf, op)
  T(doc, 8.5).text('11', x, 121.7)
  // habilitações
  const t0 = 126.8
  const tx = [27, 70.8, 154.1, xf]
  traco(doc).rect(27, t0, xf - 27, 30.7).line(27, t0 + 5.1, xf, t0 + 5.1).line(27, t0 + 10.5, xf, t0 + 10.5)
  doc.line(tx[1], t0 + 5.1, tx[1], t0 + 30.7).line(tx[2], t0 + 5.1, tx[2], t0 + 30.7)
  T(doc, 8).text('HABILITAÇÕES', 105, t0 + 3.7, { align: 'center' })
  ;['LITERARIAS', 'MILITARES', 'OUTRAS'].forEach((t, i) => doc.text(t, (tx[i] + tx[i + 1]) / 2, t0 + 8.8, { align: 'center' }))
  const mil = cursosMil(p).map((c) => c.nome)
  for (let i = 0; i < 4; i++) {
    const y = t0 + 10.5 + i * 5.05
    if (i) doc.setLineWidth(0.15).line(27, y, xf, y)
    valor(doc, i === 0 ? habilitacoes(p) : '', tx[0] + 1, y + 3.7, tx[1] - tx[0] - 2, { fonte: 'times', tam: 7.5 })
    valor(doc, mil[i], tx[1] + 1, y + 3.7, tx[2] - tx[1] - 2, { fonte: 'times', tam: 7.5 })
  }
  linha(doc, 'FUNDAMENTO DA PROPOSTA', o.fundamento, x, 165.2, xf, op)
  linha(doc, '', '', x, 172.8, xf, op); linha(doc, '', '', x, 179.7, xf, op)
  T(doc, 8.5).text('_____/_____/______', 151.5, 185.4, { align: 'center' })
  const c = quem.comandante ?? {}
  doc.text(M(c.cargo || 'O COMANDANTE DA ESG'), 151.5, 194.6, { align: 'center' })
  doc.setLineWidth(0.2).line(135, 201.6, 168, 201.6)
  if (c.nome) T(doc, 8.5, 'bold').text(M(c.nome), 151.5, 206.7, { align: 'center' })
  if (c.posto) T(doc, 8.5, 'bold').text(`*** ${M(c.posto)} ***`, 151.5, 210.8, { align: 'center' })
  linha(doc, '12. PARECER DO CONSELHO DE ARMA/ESPECIALIDADE/CLASSE:', '', x, 220.3, xf, op)
  linha(doc, '', '', x, 227.6, xf, op)
  linha(doc, '13. CONCLUSÃO DO ÓRGÃO DE PESSOAL E QUADROS:', '', x, 238.4, xf, op)
  linha(doc, '', '', x, 245.7, xf, op)
  T(doc, 8.5).text('_____/_____/______', 163, 257.7, { align: 'center' }).text('O CHEFE', 163, 269.5, { align: 'center' })
  doc.setLineWidth(0.2).line(148, 276.4, 178, 276.4)
}

// ---------- processo individual de promoção (PIP), duas páginas ----------
function blocoPip(doc, titulo, x, y) {
  T(doc, 8.5, 'bold').text(titulo, x, y)
  doc.setLineWidth(0.25).line(x, y + 0.9, x + doc.getTextWidth(titulo), y + 0.9)
}
export async function processoPromocao(d, p) {
  const { doc } = d
  novaPagina(d)
  const x0 = 18.6
  const x1 = 191.3
  T(doc, 9, 'bold'); sublinhado(doc, 'PROCESSO INDIVIDUAL DE PROMOÇÃO (PIP)', 103.8, 22.8)
  traco(doc).roundedRect(163.4, 14.3, 27.9, 28.5, 3, 3)
  await fotoEm(doc, p, 164, 15, 26.7, 27.1)
  doc.setLineWidth(0.25).line(30.6, 33, 159, 33)
  valor(doc, [p.postoNome, p.nome, p.nip && `NIP ${p.nip}`].filter(Boolean).join(' — '), 31, 32, 127, { fonte: 'times', tam: 9 })
  const L = (r, v, x, y, xf) => { H(doc, 7.5).text(r, x, y); const w = doc.getTextWidth(r); valor(doc, v, x + w + 1.5, y, xf - x - w - 2.5, { tam: 8 }) }
  blocoPip(doc, 'BLOCO 1 – Dados Pessoais', 30.6, 40.6)
  traco(doc).rect(x0, 44.4, x1 - x0, 25.3)
  L('Data de Nascimento:', dataPt(p.dataNascimento), 21.1, 48.2, 107)
  L('Local de Nascimento:', [p.naturalidade, p.provincia].filter(Boolean).join(', '), 108.9, 48.2, x1 - 1)
  L('Pai:', p.pai, 21.1, 55.2, x1 - 1)
  L('Mãe:', p.mae, 21.1, 62.1, x1 - 1)
  blocoPip(doc, 'BLOCO 2 – Situação Militar', 30.6, 75.4)
  traco(doc).rect(x0, 77.7, x1 - x0, 26.9)
  L('Tempo de SVC Militar:', tempoServico(p), 21.1, 81.5, x1 - 1)
  L('Situação de Serviço:', p.situacaoCaminho || p.situacaoNome, 21.1, 88.4, x1 - 1)
  L('Cargo:', p.cargoNome, 21.1, 95.4, x1 - 1)
  blocoPip(doc, 'BLOCO 3 – Síntese da Avaliação Individual Referente ao Ano de Introdução 20____/20____', 30.6, 110)
  traco(doc).rect(x0, 116.3, x1 - x0, 44.4).line(109.5, 116.3, 109.5, 160.7)
  const F = ['F1- Integridade de Carácter:', 'F2 – Relação Humana e Cooperação', 'F3 – Auto Confiança e Autodomínio', 'F4 – Iniciativa:', 'F5  - Sentido do Dever e de Disciplina', 'F6 – Poder de Comunicação', 'F7 – Dedicação e Empenho na Função', 'F8 – Planeamento e Organização:', 'F9 - Aptidão Técnico Profissional:', 'F10 – Julgamento:', 'F11– Decisão:', 'F12 – Condição Física:', 'F13  - Cultura Geral:', 'F14 – Cultura Militar:', 'F15 – Determinação e Perseverança:', 'F16 – Adaptabilidade:']
  for (const [lado, xt, xg] of [[0, 20.5, 84.2], [1, 111, 163.4]]) {
    H(doc, 6.5).text('5  10  15  20', xg + 7.6, 121.4, { align: 'center' })
    for (let i = 0; i < 8; i++) {
      H(doc, 6).text(F[lado * 8 + i], xt, 125.5 + i * 3.65 + 1.2)
      for (let k = 0; k < 4; k++) doc.setLineWidth(0.15).rect(xg + k * 3.8, 123.6 + i * 3.65, 3.8, 3.65)
    }
  }
  H(doc, 6.5, 'bolditalic').text('Média:', 20.5, 156.6); doc.setLineWidth(0.15).line(29, 156.8, 60, 156.8)
  blocoPip(doc, 'BLOCO 4 – Dados do quadro Especial', 30.6, 167.7)
  traco(doc).rect(x0, 170.5, x1 - x0, 38.7)
  L('Vacatura no Quadro Especial de:', p.quadroNome, 21.4, 174.4, x1 - 1)
  H(doc, 7.5, 'bold').text('Previsto no QE:', 74.7, 181.4, { align: 'right' }).text('Existente no QE:', 74.7, 188.4, { align: 'right' }).text('Vagas no QE:', 74.7, 195.4, { align: 'right' })
  H(doc, 7.5, 'bold').text('- Posição na Lista de Antiguidade:', 21.4, 202.4).text('Nº NA ASC:', 101.6, 202.4).text('Nº NO POSTO:', 149.5, 202.4)
  blocoPip(doc, 'BLOCO 5 – Histórico de Promoção', 30.6, 212.7)
  traco(doc).rect(x0, 216.8, x1 - x0, 59.6)
  const pr = promocoes(p)
  for (let i = 0; i < 8; i++) {
    const y = 220.6 + i * 6.98
    H(doc, 7.5).text(String(i + 1), 21.7, y)
    doc.setLineWidth(0.15).line(24, y + 0.8, 188.8, y + 0.8)
    if (pr[i]) valor(doc, `${pr[i].postoNovoNome} — ${dataPt(pr[i].data)}${pr[i].documento ? ` (${pr[i].documento})` : ''}`, 25, y, 162, { tam: 8 })
  }
  // 2.ª página
  novaPagina(d)
  const caixaLinhas = (y0, y1, linhas, valores = []) => {
    traco(doc).rect(17.1, y0, 175.9, y1 - y0)
    linhas.forEach((y, i) => { doc.setLineWidth(0.15).line(19.5, y, 190.5, y); valor(doc, valores[i], 20.5, y - 1, 168, { tam: 8 }) })
  }
  blocoPip(doc, 'BLOCO 6 – Curso de Promoção ou outro que se equipare', 16.4, 21.6)
  const cp = (p.cursos ?? []).filter((c) => c.tipo === 'promocao' || c.chave).map((c) => `${c.nome}${c.fim ? ` — ${dataPt(c.fim)}` : ''}${c.aproveitamento === false ? ' (sem aproveitamento)' : ''}`)
  caixaLinhas(29.2, 52.9, [34.2, 39.6, 44.4], cp)
  blocoPip(doc, 'BLOCO 7 – Desempenho de Funções Obrigatórias', 16.4, 57.4)
  traco(doc).rect(17.1, 63.1, 175.9, 26.6)
  H(doc, 6.8).text('1 Comando de companhia e de outro cargo que se equipare no QE, num período mínimo de um ano', 19.6, 67.8).text('SIM  NÃO', 186.6, 67.8, { align: 'right' })
  H(doc, 6.8).text('2 Professor, instrutor ou outro cargo cargo que se equipare dentro do QE, pelo menos dois anos', 19.6, 78.6)
  for (const y of [72.3, 78]) traco(doc, 0.2).rect(175.6, y, 4.3, 3.2).rect(183.4, y, 4.3, 3.2)
  blocoPip(doc, 'BLOCO 8 – Avaliação Médica', 18.3, 93.5)
  caixaLinhas(98.9, 122.4, [104.3, 110.6, 116], [p.aptidaoFisica ? 'APTO' : ''])
  blocoPip(doc, 'BLOCO 9 – Antecedentes Disciplinares e/ou Criminais', 30.4, 130.3)
  const pu = (p.eventos ?? []).filter((e) => e.tipo === 'punicao')
  caixaLinhas(134.4, 157.9, [139.6, 145, 150.4], [pu.length ? pu.map((e) => `${e.descricao} (${dataPt(e.data)})`).join('; ') : p.processoPendente ? 'PROCESSO PENDENTE' : 'NADA CONSTA'])
  blocoPip(doc, 'BLOCO 10 – Conclusão:', 17.1, 165.8)
  caixaLinhas(171.5, 197.2, [176.9, 182.6, 188.3, 194], [p.promocao?.elegivel ? `EM CONDIÇÕES DE PROMOÇÃO A ${M(p.promocao.postoPropostoNome)}` : ''])
  T(doc, 8.5).text('DATA ____/__________/20____', 124.2, 211.8)
  T(doc, 8.5).text('O OFICIAL RESPONSAVEL', 102.6, 229.5, { align: 'center' })
  doc.setLineWidth(0.2).line(70.9, 236.2, 134.3, 236.2).line(83.6, 242.5, 121.7, 242.5)
}

// ---------- ficha de registo biográfico (civil): cinco páginas deitadas ----------
// grelha de quadrículas com uma letra em cada (o nome completo, os nomes dos pais)
function quadriculas(doc, texto, x0, x1, y0, h, linhas) {
  const w = 5.94
  const n = Math.floor((x1 - x0) / w)
  const letras = [...M(texto)]
  for (let r = 0; r < linhas; r++) {
    for (let i = 0; i < n; i++) {
      doc.setLineWidth(0.12).rect(x0 + i * w, y0 + r * h, w, h)
      const c = letras[r * n + i]
      if (c && c !== ' ') H(doc, Math.min(8, h * 1.8), 'bold').text(c, x0 + i * w + w / 2, y0 + r * h + h / 2 + 1.2, { align: 'center' })
    }
  }
}
// tabela simples: colunas [x…], cabeçalho (textos centrados, com quebras «\n») e n linhas vazias
function grelha(doc, xs, y0, hCab, cabecalhos, n, hl, { tam = 6.5 } = {}) {
  const y1 = y0 + hCab + n * hl
  traco(doc).rect(xs[0], y0, xs.at(-1) - xs[0], y1 - y0).line(xs[0], y0 + hCab, xs.at(-1), y0 + hCab)
  xs.slice(1, -1).forEach((x) => doc.line(x, y0, x, y1))
  cabecalhos.forEach((t, i) => {
    const l = String(t).split('\n')
    H(doc, tam).text(l, (xs[i] + xs[i + 1]) / 2, y0 + hCab / 2 - (l.length - 1) * 1.3 + 1, { align: 'center', lineHeightFactor: 1.15 })
  })
  for (let i = 1; i < n; i++) doc.setLineWidth(0.15).line(xs[0], y0 + hCab + i * hl, xs.at(-1), y0 + hCab + i * hl)
  return (i, k) => [xs[k] + 1, y0 + hCab + i * hl + hl / 2 + 1.1, xs[k + 1] - xs[k] - 2]
}

export function fichaRegistoBiografico(d, p) {
  const { doc } = d
  nova(d, 'landscape')
  const L = (v) => v * 0.1485
  H(doc, 10, 'bold').text('FICHA DE REGISTO BIOGRÁFICO', 153, 16.6, { align: 'center' })
  const fx0 = 18.6
  const fx1 = 287.3
  traco(doc, 0.4).rect(fx0, 26.7, fx1 - fx0, 170.1)
  // fotografias (actualizar sempre que renovar o BI)
  traco(doc).line(81, 26.7, 81, 79.5).line(46.8, 26.7, 46.8, 79.5).line(53.5, 26.7, 53.5, 79.5).line(fx0, 55.7, 46.8, 55.7).line(53.5, 55.7, 81, 55.7)
  for (const [cx, cy] of [[32.7, 41], [67.2, 41], [32.7, 67.6], [67.2, 67.6]]) H(doc, 6.5).text('Foto (actualizada)', cx - 7, cy + 5, { angle: 45 })
  H(doc, 6.5).text('Actualizar sempre que renovar o BI', 51.3, 75, { angle: 90 })
  // 1. nome e filiação (uma letra em cada quadrícula)
  H(doc, 7, 'bold').text('1.', 82, 29.6)
  H(doc, 8, 'bold').text('NOME COMPLETO', 84.6, 34.9)
  traco(doc).line(81, 43.8, fx1, 43.8)
  quadriculas(doc, p.nome, L(810), fx1, 26.7, 5.7, 3)
  H(doc, 8, 'bold').text('FILIAÇÃO', 84.2, 50.9)
  traco(doc).line(103.2, 43.8, 103.2, 55.7).line(103.2, 49.7, L(810), 49.7)
  H(doc, 7).text('PAI', 110.6, 48, { align: 'center' }).text('MÃE', 110.6, 54, { align: 'center' })
  quadriculas(doc, p.pai, L(810), fx1, 43.8, 5.95, 1)
  quadriculas(doc, p.mae, L(810), fx1, 49.75, 5.95, 1)
  // sexo, nascimento, comuna | n.º processo, registo, CIF, residência
  traco(doc).line(81, 55.7, fx1, 55.7)
  H(doc, 8, 'bold').text('SEXO', 84.6, 62.6)
  doc.line(98, 55.7, 98, 67.6).line(103.2, 55.7, 103.2, 67.6).line(109.2, 55.7, 109.2, 67.6).line(98, 61.6, 199.7, 61.6)
  H(doc, 7).text('M', 100.6, 59.8, { align: 'center' }).text('F', 100.6, 65.8, { align: 'center' })
  H(doc, 8, 'bold').text(p.genero === 'M' ? 'X' : '', 106.2, 59.9, { align: 'center' }).text(p.genero === 'F' ? 'X' : '', 106.2, 65.9, { align: 'center' })
  const [dn, mn, an] = partesData(p.dataNascimento)
  H(doc, 7).text('Data e Local de Nascimento', 110, 59.8)
  valor(doc, `${dn || '   '} / ${mn || '   '} / ${an || '      '}  ${M(p.naturalidade)}`, 146, 59.8, 52, { tam: 7.5 })
  H(doc, 7).text('Comuna', 110, 65.8)
  doc.line(199.7, 55.7, 199.7, 79.5)
  const direita = [['Nº do Processo', p.processo?.numero], ['Nº do Registo', p.numeroAgente], ['C I F', p.inss], ['Residência', residencia(p)]]
  direita.forEach(([r, v], i) => {
    const y = 55.7 + i * 5.95
    if (i) doc.setLineWidth(0.2).line(199.7, y, fx1, y)
    H(doc, 7).text(r, 200.8, y + 4.2)
    valor(doc, v, 200.8 + doc.getTextWidth(r) + 2, y + 4.2, fx1 - 203 - doc.getTextWidth(r), { tam: 7 })
  })
  traco(doc).line(81, 67.6, 199.7, 67.6).line(81, 73.5, 199.7, 73.5).line(137.4, 67.6, 137.4, 79.5)
  const cel = (r, v, x, y, xf) => { H(doc, 7).text(r, x, y); valor(doc, v, x + doc.getTextWidth(r) + 2, y, xf - x - doc.getTextWidth(r) - 3, { tam: 7 }) }
  cel('Município', p.municipio, 81.6, 72, 137)
  cel('Província', p.provincia, 138.1, 72, 199)
  cel('País', 'Angola', 81.6, 78, 137)
  cel('Nacionalidade', p.nacionalidade, 138.1, 78, 199)
  // 2. estado civil | BI, profissão, cargo
  traco(doc, 0.4).line(fx0, 79.5, fx1, 79.5).line(144, 79.5, 144, 109.2).line(fx0, 109.2, fx1, 109.2)
  H(doc, 7.5, 'bold').text('2. Estado Civil:', 19.3, 84)
  const ecv = { solteiro: 0, casado: 1, uniao_facto: 1, divorciado: 2, viuvo: 3 }[p.estadoCivil]
  ;[['Solteiro', 56, 69.8], ['Casado', 76, 92.8], ['Divorciado', 101, 121], ['Viuvo', 128, 138.1]].forEach(([t, x, bx], i) => {
    H(doc, 7.5).text(t, x, 84)
    traco(doc, 0.2).rect(bx, 80.5, 5.2, 5)
    if (ecv === i) H(doc, 8, 'bold').text('X', bx + 2.6, 84.2, { align: 'center' })
  })
  traco(doc, 0.2).line(fx0, 85.8, 144, 85.8).line(fx0, 91.3, 144, 91.3).line(fx0, 97.3, 144, 97.3).line(fx0, 102.5, 144, 102.5)
  cel('Nome do(a) Cônjuge:', p.conjuge, 19.3, 89.8, 143)
  H(doc, 7.5).text('Data de Nascimento  ______/______/__________', 20.3, 101.3)
  cel('Local de trabalho', p.conjugeLocalServico, 19.3, 107.2, 143)
  doc.line(199.7, 79.5, 199.7, 85.8)
  const [de, me, ae] = partesData(p.biEmitidoEm)
  ;[['B.I. Nº', p.bi, 82.6], ['Local de emissão', p.biLocalEmissao, 89.3], ['Data de emissão', de ? `${de} / ${me} / ${ae}` : '', 95.1], ['Profissão', p.areaFormacao, 100.8], ['Cargo actual', p.cargoNome, 106.6]].forEach(([r, v, y], i) => {
    if (i) doc.setLineWidth(0.2).line(144, [85.8, 91.3, 97.3, 102.5][i - 1], fx1, [85.8, 91.3, 97.3, 102.5][i - 1])
    cel(r, v, 144.8, y, i === 0 ? 199 : fx1 - 1)
  })
  cel('Endereço', p.morada, 200.8, 83.6, fx1 - 1)
  // 3. U/E/O e últimos locais de trabalho
  H(doc, 7.5, 'bold').text('3. U/E/O', 19.3, 113.5)
  valor(doc, p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 33, 113.5, 123, { tam: 7 })
  traco(doc, 0.2).line(158.2, 109.2, 158.2, 115).line(fx0, 115, fx1, 115)
  cel('Vínculo Juridico Laboral', p.vinculoCivilNome, 158.6, 113.5, fx1 - 1)
  H(doc, 7.5).text('3 Últimos Locais de trabalho antes de entrar para :', 19.3, 119.6)
  for (const [i, y] of [121.8, 127.7, 133.7].entries()) {
    doc.setLineWidth(0.2).line(fx0, y, fx1, y)
    H(doc, 7.5).text('de        /        /        a        /        /', 102.5, y + 4.6).text('com a profissão de', 167.1, y + 4.6)
    void i
  }
  // 4. colocações
  traco(doc, 0.4).line(fx0, 138.8, fx1, 138.8)
  H(doc, 7.5, 'bold').text('4. COLOCAÇÕES', 19.3, 142.9)
  H(doc, 7.5).text('DATA DE ENTRADA Nº', 150.7, 142.4)
  valor(doc, dataPt(p.dataAdmissao), 182, 142.4, 30, { tam: 7 })
  traco(doc, 0.2).line(150, 138.8, 150, 144.1)
  const xs = [fx0, 70.2, 93.3, 109.9, 132.5, 158.6, 194.5, 229.9, fx1]
  const cab = ['Categoria Ocupacional', 'Despacho Nº', 'Data', 'D.R.nº', 'Inicio de função', 'Situação na\nFunção Pública', 'Colocação', 'Responsabilidade ou\nfunções ESP.\nComissões de Serviços']
  const pos = grelha(doc, xs, 144.1, 14.8, cab, 6, 6.3, { tam: 7 })
  H(doc, 4.5).text(['(Indicar também a especialidade e', 'começar pelo cargo actual)'], 19.5, 154.5)
  const [pX, pY, pW] = pos(0, 0)
  valor(doc, p.categoriaCivil, pX, pY, pW, { tam: 7 })
  valor(doc, dataPt(p.dataCategoria || p.dataAdmissao), ...[pos(0, 4)[0], pos(0, 4)[1], pos(0, 4)[2]], { tam: 7 })
  valor(doc, p.unidadeNome, pos(0, 6)[0], pos(0, 6)[1], pos(0, 6)[2], { tam: 7 })
  valor(doc, p.cargoNome, pos(0, 7)[0], pos(0, 7)[1], pos(0, 7)[2], { tam: 7 })

  // página 2: estudos, processo disciplinar, distinções, situação militar, médica, classificação, agregado
  nova(d, 'landscape')
  const X2 = (v) => v * 0.1485 + 6
  H(doc, 8, 'bold').text('5. ESTUDOS REALIZADOS', X2(108), 14.9)
  traco(doc, 0.4).rect(X2(100), 17.1, X2(1895) - X2(100), 45.3)
  // classes e datas
  const c5 = [X2(100), X2(290), X2(443), X2(630), X2(780)]
  traco(doc, 0.2)
  c5.slice(1, 4).forEach((x) => doc.line(x, 17.1, x, 34.2))
  ;[21.5, 26, 30.1, 34.2].forEach((y) => doc.line(c5[0], y, c5[4], y))
  H(doc, 7).text('DATA/ANO', (c5[1] + c5[2]) / 2, 20.2, { align: 'center' }).text('DATA/ANO', (c5[3] + c5[4]) / 2, 20.2, { align: 'center' })
  for (const y of [24.9, 29.1, 33.2]) H(doc, 7).text('Classe', c5[1] - 1, y, { align: 'right' }).text('Classe', c5[3] - 1, y, { align: 'right' })
  H(doc, 7).text('Conhecimento de Linguas Internacionais', (c5[0] + c5[4]) / 2, 39.6, { align: 'center' })
  doc.line(c5[0], 43.4, c5[4], 43.4)
  const lx = [X2(100), X2(250), X2(475), X2(628), X2(780)]
  lx.slice(1, 4).forEach((x) => doc.line(x, 43.4, x, 62.4))
  H(doc, 7).text('INGLÊS', (lx[0] + lx[1]) / 2, 47, { align: 'center' }).text('FRANCÊS', (lx[1] + lx[2]) / 2, 47, { align: 'center' })
  doc.line(c5[0], 56.6, c5[4], 56.6)
  for (let k = 0; k < 4; k++) {
    const w = (lx[k + 1] - lx[k]) / 3
    ;['MB', 'B', 'R'].forEach((t, i) => { H(doc, 6.5).text(t, lx[k] + w * (i + 0.5), 60.7, { align: 'center' }); if (i) doc.line(lx[k] + w * i, 56.6, lx[k] + w * i, 62.4) })
  }
  doc.setLineWidth(0.3).line(c5[4], 17.1, c5[4], 62.4)
  const oc = [X2(780), X2(1310), X2(1695), X2(1895)]
  const est = [[HAB[p.habilitacao] && `${HAB[p.habilitacao]}${p.areaFormacao ? ` — ${p.areaFormacao}` : ''}`, '', ''], ...(p.cursos ?? []).map((c) => [c.nome, c.local, dataPt(c.fim)])].filter((l) => l[0])
  const posE = grelha(doc, oc, 17.1, 11.1, ['Outros Cursos ( de base, superações\nespecialização pós-graduação )', 'Escola Instituto\nou Universidade', 'Terminado em'], 8, 4.27, { tam: 7 })
  for (let i = 0; i < 8; i++) {
    if (est[i]) est[i].forEach((v, k) => { const [a, b, c] = posE(i, k); valor(doc, v, a, b - 0.2, c, { tam: 6.5, centrar: k === 2 }) })
    else H(doc, 6.5).text('/            /20', (oc[2] + oc[3]) / 2, posE(i, 2)[1] - 0.2, { align: 'center' })
  }
  // 6. processo disciplinar
  const c6 = [X2(87), X2(325), X2(545), X2(775)]
  traco(doc, 0.4).rect(c6[0], 62.4, c6[3] - c6[0], 24.5)
  H(doc, 7.5, 'bold').text('6. PROCESSO DISCIPLINAR', c6[0] + 1, 66.5)
  const posD = grelha(doc, c6, 69, 4.5, ['Infração cometida', 'Pena Aplicada', 'Data'], 3, 4.47, { tam: 7 })
  const disc = (p.eventos ?? []).filter((e) => e.tipo === 'punicao')
  for (let i = 0; i < 3; i++) {
    if (disc[i]) { valor(doc, disc[i].descricao, ...posD(i, 0), { tam: 6.5 }); valor(doc, dataPt(disc[i].data), ...posD(i, 2), { tam: 6.5, centrar: true }) } else H(doc, 6.5).text('/            /20', (c6[2] + c6[3]) / 2, posD(i, 2)[1], { align: 'center' })
  }
  // 7. distinções ou louvores
  const c7 = [X2(775), X2(1140)]
  traco(doc, 0.4).rect(c7[0], 61.6, c7[1] - c7[0], 52)
  H(doc, 7.5, 'bold').text('7.DISTINÇÃO OU LOUVORES', (c7[0] + c7[1]) / 2, 65.1, { align: 'center' })
  const lv = (p.eventos ?? []).filter((e) => e.tipo === 'louvor' || e.tipo === 'condecoracao')
  for (let i = 0; i < 11; i++) {
    const y = 66.1 + i * 4.32
    doc.setLineWidth(0.15).line(c7[0], y, c7[1], y)
    if (lv[i]) valor(doc, `${dataPt(lv[i].data)} ${lv[i].descricao || lv[i].tipoNome}`, c7[0] + 1, y + 3.2, c7[1] - c7[0] - 2, { tam: 6.5 })
    else H(doc, 6.5).text('/                         /20', (c7[0] + c7[1]) / 2, y + 3.2, { align: 'center' })
  }
  // 8. situação militar
  const c8 = [X2(1140), X2(1890)]
  traco(doc, 0.4).rect(c8[0], 62.4, c8[1] - c8[0], 51.2)
  H(doc, 7.5, 'bold').text('8. SITUAÇÃO MILITAR', (c8[0] + c8[1]) / 2, 66, { align: 'center' })
  ;['Adiado', 'Disponibilidade', 'Isento', 'Não Apto', 'Refratário', 'Militar', 'desde                       /                                       /', 'Reiniciou a função a  ________/______________________/__________'].forEach((t, i) => {
    const y = 66.8 + i * 4.38
    doc.setLineWidth(0.15).line(c8[0], y, c8[1], y)
    H(doc, 7).text(t, c8[0] + 1, y + 3.3)
  })
  // 9. situação médica
  const c9 = [X2(87), X2(322)]
  traco(doc, 0.4).rect(c9[0], 86.9, c9[1] - c9[0], 26.7)
  H(doc, 6.5, 'bold').text('9.Situação Médica', (c9[0] + c9[1]) / 2, 89.8, { align: 'center' })
  doc.setLineWidth(0.15).line(c9[0], 90.9, c9[1], 90.9)
  cel('Grupo Sang:', p.grupoSanguineo, c9[0] + 0.8, 94.2, c9[1] - 1)
  H(doc, 6.5).text('Dador', c9[0] + 2, 98.4).text('sim', c9[0] + 18, 98.4).text('não', c9[0] + 29, 98.4)
  traco(doc, 0.2).rect(c9[0] + 12, 95.6, 5, 3.6).rect(c9[0] + 23, 95.6, 5, 3.6)
  H(doc, 6.8).text('Defeito físico:', c9[0] + 0.8, 102.6).text('Doenças/alergias de', c9[0] + 0.8, 107).text('que sofra', c9[0] + 0.8, 111)
  // 10. classificação de serviço
  const c10 = [X2(322), X2(467), X2(620), X2(770)]
  traco(doc, 0.4).rect(c10[0], 87.6, c10[3] - c10[0], 26)
  H(doc, 6.5, 'bold').text('10.Classificação de Serviço prestado', (c10[0] + c10[3]) / 2, 90.5, { align: 'center' })
  const posC = grelha(doc, c10, 91.3, 9, ['Ano', 'Valor de\nPonderação', 'Total de\nPontos'], 3, 4.43, { tam: 7 })
  for (let i = 0; i < 3; i++) H(doc, 6.5).text('20', posC(i, 0)[0], posC(i, 0)[1])
  // 11. agregado familiar
  const c11 = [X2(85), X2(238), X2(690), X2(842), X2(1002), X2(1055), X2(1217), X2(1530), X2(1880)]
  const posA = grelha(doc, c11, 113.6, 8.5, ['11.Agregado\nFamiliar', 'Nome (Excluir o próprio, trabalhador\ne o cônjuge inscrito neste registo)', 'Grau\nParentesco', 'Data de\nNascimento', 'Sexo', 'Estado civil', 'Profissão', 'Local de trabalho'], 17, 4.37, { tam: 7 })
  familia(p).slice(0, 17).forEach((a, i) => [null, a.nome, a.parentesco, dataPt(a.dataNascimento), '', '', a.profissao, ''].forEach((v, k) => { if (v) valor(doc, v, ...posA(i, k), { tam: 6.5, centrar: k > 1 }) }))

  // página 3: averbamentos e observações (assiduidade e outras informações)
  nova(d, 'landscape')
  H(doc, 9, 'bold').text('AVERBAMENTOS E OBSERVAÇÕES', 153, 18.6, { align: 'center' })
  const fa0 = L(120)
  const fa1 = L(1920) + 2
  traco(doc, 0.4).rect(fa0, 22.3, fa1 - fa0, 178.2)
  H(doc, 7.5, 'bold').text('1. ASSIDUIDADE', fa0 + 1, 26)
  const ca = [L(120), L(355), L(578), L(806), L(1040), L(1218), L(1457), L(1685), fa1]
  H(doc, 7).text('FALTAS JUSTIFICADAS', (ca[0] + ca[4]) / 2, 29, { align: 'center' }).text('FALTAS INJUSTIFICADAS', (ca[4] + ca[8]) / 2, 26.2, { align: 'center' })
  traco(doc, 0.2).line(ca[4], 22.3, ca[4], 72.3)
  const posF = grelha(doc, ca, 30.4, 5.2, ['ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS'], 8, 4.6, { tam: 7 })
  for (let i = 0; i < 8; i++) for (const k of [0, 2, 4, 6]) H(doc, 6.5).text('20', posF(i, k)[0], posF(i, k)[1])
  doc.setLineWidth(0.4).line(fa0, 72.3, fa1, 72.3)
  H(doc, 7.5, 'bold').text('2   Outras informações relevantes', fa0 + 2, 76.3)
  for (let y = 79.4; y < 199; y += 4.6) doc.setLineWidth(0.15).line(fa0, y, fa1, y)

  // página 4: observações, saída do serviço e anexos
  nova(d, 'landscape')
  const X4 = (v) => v * 0.1485 + 6.4
  traco(doc, 0.4).rect(X4(82), 13.4, X4(1885) - X4(82), 124)
  H(doc, 7.5, 'bold').text('3   OBSERVAÇÕES', X4(127), 20.8)
  H(doc, 7.5).text('(Incluir distinções ou louvores, prémios e bónus)', X4(127) + 27, 20.8)
  for (let y = 25.2; y < 92; y += 4.68) doc.setLineWidth(0.15).line(X4(82), y, X4(1885), y)
  doc.setLineWidth(0.4).line(X4(82), 94.3, X4(1885), 94.3)
  H(doc, 7.5, 'bold').text('4   Data de saída do serviço', X4(108), 98.6).text('Motivo', X4(137), 103.2)
  H(doc, 7.5).text('/                               /', X4(480), 98.6)
  doc.setLineWidth(0.2).line(X4(82), 99.6, X4(1885), 99.6)
  for (let y = 104.2; y < 136; y += 4.6) doc.setLineWidth(0.15).line(X4(82), y, X4(1885), y)
  H(doc, 6.8, 'bold').text('Anexar:', X4(85), 134.3 + 5)
  H(doc, 6.8).text(doc.splitTextToSize('i. Certidão de nascimento(cópia); ii. Certidão de registo criminal; iii. Certificado de habilitações literárias; iv. Certificado de habilitações profissionais; v. Declaração sobre o compromisso de honra; vi. Documentação militar; vii.Atestado médico; viii. Proposta de admissão; ix. Fotocópia do bilhete de identidade civil; x. Cópia de certificado dos cursos que possui; xi. Resultado do teste de admissão; xii. Duas fotografias tipo passe.', 245), X4(170), 134.3 + 5, { lineHeightFactor: 1.5 })
  H(doc, 5.5).text('Pag 15-regiblog', X4(82), 152)

  // página 5: registo criminal e disciplinar
  nova(d, 'landscape')
  const cr = [L(195), L(868), L(1316), L(1587), L(1682), L(1787), L(1895)]
  traco(doc, 0.4).rect(cr[0], 26.4, cr[6] - cr[0], 5.2)
  H(doc, 9, 'bold').text('REGISTO CRIMINAL E DISCIPLINAR', (cr[0] + cr[6]) / 2, 30.3, { align: 'center' })
  const posR = grelha(doc, cr, 31.6, 5.2, ['Crime ou infracção', 'Pena imposta', 'Tribunal ou Autoridade', 'Dia', 'Mês', 'Ano'], 26, 5.77, { tam: 7.5 })
  disc.slice(0, 26).forEach((e, i) => {
    const [dd, mm, aa] = partesData(e.data)
    valor(doc, e.descricao, ...posR(i, 0), { tam: 7 })
    ;[dd, mm, aa].forEach((v, k) => valor(doc, v, ...posR(i, 3 + k), { tam: 7, centrar: true }))
  })
}

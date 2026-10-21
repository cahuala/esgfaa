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
// como valor(), mas o que não cabe numa linha vai em duas linhas de letra pequena (células baixas e estreitas)
function valor2(doc, v, x, y, w, { tam = 8.5 } = {}) {
  const t = M(v)
  if (!t) return
  if (doc.setFont('helvetica', 'bold').setFontSize(tam).getTextWidth(t) <= w) return valor(doc, t, x, y, w, { tam })
  const l = doc.setFontSize(6).splitTextToSize(t, w)
  if (l.length > 2) l[1] = `${l[1].slice(0, -1)}…`
  doc.text(l.slice(0, 2), x, y - 2, { lineHeightFactor: 1.05 })
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
  H(doc, 13).text('FICHA INDIVIDUAL', 99.7, 14, { align: 'center' })
  traco(doc, 0.4).rect(18.3, 22.8, 173.4, 260.9)
  H(doc, 10.5).text('I – DADOS GERAIS', 101.3, 28.8, { align: 'center' })
  const campos = [['1. NOME COMPLETO', p.nome, 42.2], ['2. ALCUNHA', p.nomeGuerra, 58.6], ['3. FILHO DE', p.pai, 74.8], ['4. E DE', p.mae, 90.7]]
  for (const [r, v, y] of campos) { H(doc, 10).text(r, 27.4, y); caixa(doc, 26.8, y + 2.2, 111, 7, v) }
  // fotografia, grupo sanguíneo, indicador direito e assinatura
  traco(doc).rect(141.6, 34.9, 41.8, 69.4)
  doc.line(171.4, 34.9, 171.4, 104.3).line(141.6, 65, 171.4, 65).line(141.6, 73.9, 171.4, 73.9)
  if (!(await fotoEm(doc, p, 141.6, 34.9, 29.8, 30.1))) H(doc, 10).text('Foto', 156.5, 49.8, { align: 'center' })
  H(doc, 9.5).text('Grupo. Sang', 156.5, 67.8, { align: 'center' })
  valor(doc, p.grupoSanguineo, 142.6, 72.6, 27.8, { centrar: true, tam: 8 })
  H(doc, 9.5).text('Indicador', 156.5, 88.6, { align: 'center' }).text('Direito', 156.5, 92, { align: 'center' }).text('Ass', 177.4, 102.6, { align: 'center' })
  // 5. esposa e filhos
  H(doc, 10).text('5. NOME DA ESPOSA, DOS FILHOS E SUAS IDADES', 27.4, 111.3)
  traco(doc).rect(27.4, 114.8, 156.3, 66)
  const fam = [...(p.conjuge ? [`${p.conjuge} (cônjuge)`] : []), ...familia(p).map((a) => `${a.nome}${a.parentesco ? ` (${a.parentesco})` : ''}${a.idade ? ` — ${a.idade}` : ''}`)]
  for (let i = 0; i < 10; i++) {
    if (i) doc.setLineWidth(0.2).line(27.4, 114.8 + i * 6.6, 183.7, 114.8 + i * 6.6)
    valor(doc, fam[i], 29, 114.8 + i * 6.6 + 4.6, 153, { tam: 8.5 })
  }
  H(doc, 10).text('6. RESIDÊNCIA (PROVÍNCIA, LOCALIDADE, BAIRRO RUA/LARGO, NÚMERO)', 28.1, 183.9)
  traco(doc).rect(28.1, 186.4, 156.6, 16.5).line(28.1, 194.6, 184.7, 194.6)
  const res = doc.setFont('helvetica', 'bold').setFontSize(8.5).splitTextToSize(M(residencia(p)), 152)
  valor(doc, res[0], 29.6, 192, 153, { tam: 8.5 })
  valor(doc, res.slice(1).join(' '), 29.6, 200.2, 153, { tam: 8.5 })
  // II
  H(doc, 10).text('II – SITUAÇÃO RELACIONADA COM O CUMPRIMENTO DO SERVIÇO MILITAR', 28.7, 206)
  H(doc, 10).text('7. LOCAL DE INCORPORAÇÃO', 28.7, 217.5).text('8. DATA DE INCORPORAÇÃO', 120, 215.4)
  caixa(doc, 28.7, 220.4, 55.8, 6.6, p.localIncorporacao, { tam: 8.5 })
  celulas(doc, 115, 218.4, 23.4, 6.6, partesData(p.dataIngresso), { tam: 8.5 })
  H(doc, 10).text('10. INSPECÇÃO MÉDICA', 126, 229.6).text('9. CONDIÇÕES DE INCORPORAÇÃO', 28.7, 235.6)
  H(doc, 10).text('VOLUNTÁRIO', 29, 244.4).text('N/VOLUNTÁRIO', 79.4, 244.4).text('FEZ', 129, 244.4).text('N/FEZ', 156.2, 244.4)
  const x = (cond) => (cond ? 'X' : '')
  caixa(doc, 28.1, 246.2, 31.1, 6.6, x(p.voluntario === true), { centrar: true })
  caixa(doc, 79.1, 246.2, 30.5, 6.6, x(p.voluntario === false), { centrar: true })
  caixa(doc, 117.2, 246.2, 30.8, 6.6, x(p.aptidaoFisica === true), { centrar: true })
  caixa(doc, 155.8, 246.2, 30.2, 6.6, x(p.aptidaoFisica === false), { centrar: true })
  H(doc, 10).text('11. ESPECIALIDADE MILITAR', 29.4, 261.4).text('12. PATENTE', 143.5, 261.4)
  caixa(doc, 30.3, 264.2, 64, 6.8, p.especialidade || p.quadroNome, { tam: 8.5 })
  caixa(doc, 122.6, 264.2, 63, 6.8, p.postoNome, { tam: 8.5 })
}

// ---------- militar: ficha mecanográfica (duas páginas) ----------
export function fichaMecanografica(d, p) {
  const { doc } = d
  novaPagina(d)
  traco(doc).rect(69.7, 21.2, 74.5, 9.5).rect(70.5, 22, 72.9, 7.9)
  H(doc, 12.5).text('FICHA MECANOGRÁFICA', 107, 27.6, { align: 'center' })
  traco(doc, 0.4).rect(19.9, 39, 170.2, 241.5)
  // o rótulo ao nível da caixa ao lado (como no modelo)
  const L = (t, y) => H(doc, 11).text(t, 32.6, y + 3)
  L('1. NIP', 51.4)
  const nip = String(p.nip ?? '').replace(/\s/g, '')
  const n = Math.max(8, nip.length)
  celulas(doc, 45.9, 49.1, 95.1 / n, 7, Array.from({ length: n }, (_, i) => nip[i] ?? ''), { tam: 9 })
  L('2. Nome Completo', 65.3); caixa(doc, 70.3, 63.1, 116.7, 7.6, p.nome)
  L('3. Nome do Pai', 78.6); caixa(doc, 64, 76.4, 123, 7, p.pai)
  L('4. Nome da Mãe', 92.9); caixa(doc, 64.6, 91, 122.4, 7, p.mae)
  L('5. Data de Nascimento', 105.9); celulas(doc, 79.2, 102.4, 19.1, 7, partesData(p.dataNascimento))
  L('6. Local de Nascimento', 116.6)
  valor(doc, p.naturalidade, 80, 119.6, 100, { tam: 8.5 })
  H(doc, 11).text('Província', 38.9, 131); caixa(doc, 63, 124.9, 90.7, 7.6, p.provincia)
  L('7. Estado Civil', 140.7); caixa(doc, 63, 137.6, 90.7, 7.6, ec(p))
  L('8. Nome do Cônjuge', 153.4); caixa(doc, 75.7, 150.3, 90.3, 7.6, p.conjuge)
  L('9. Habilitações Literárias', 166.1); caixa(doc, 83.9, 163.6, 90.7, 7.6, habilitacoes(p))
  H(doc, 11).text('Dia', 108.5, 182.6, { align: 'center' }).text('Mês', 127.9, 182.6, { align: 'center' }).text('Ano', 147.3, 182.6, { align: 'center' })
  const curso = (tipos) => (p.cursos ?? []).find((c) => c.tipo === 'academico' && tipos.some((t) => new RegExp(t, 'i').test(c.nome)))
  const medio = ['medio', 'bacharelato', 'licenciatura', 'mestrado', 'doutoramento'].includes(p.habilitacao)
  H(doc, 11).text('a)  Ensino Médio ou PUNIV', 37.3, 191); celulas(doc, 98.8, 185.8, 19.4, 7.2, medio ? partesData(curso(['médio', 'puniv'])?.fim) : ['', '', ''])
  H(doc, 11).text('b)  Ensino Superior', 37.3, 214.8); celulas(doc, 98.8, 209.2, 19.4, 7.2, partesData(curso(['licenc', 'bachar', 'mestr', 'doutor', 'superior'])?.fim))
  H(doc, 11).text('c)  Especialização', 37.3, 238.6); celulas(doc, 98.8, 233, 19.4, 7.2, partesData(curso(['especial', 'pós', 'pos-'])?.fim))
  L('10. Data de início do Serviço Militar', 255.5); celulas(doc, 103.6, 252, 19.3, 7, partesData(p.dataIngresso))
  doc.setLineWidth(0.3).line(19.9, 262.2, 190.1, 262.2)
  L('11. Data de ingresso nas F.A.A', 268.6); celulas(doc, 103.6, 265.6, 19.3, 7, partesData(p.dataIngressoQP || p.dataIngresso))
  // 2.ª página: cursos, funções, promoções
  novaPagina(d)
  traco(doc, 0.4).rect(18.3, 9.5, 173.7, 259.3)
  const lista = (titulo, y, valores) => {
    H(doc, 11).text(titulo, 32.6, y)
    for (let i = 0; i < 6; i++) {
      const yy = y + 5.4 + i * 8.1
      H(doc, 11).text(`${String.fromCharCode(97 + i)})`, 39.9, yy + 4.2)
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
  H(doc, 11).text(`Data   ${dd} / ${mm} / ${aa}`, 32.6, 237.4)
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
  H(doc, 11).text('FORÇAS ARMADAS ANGOLANAS', 105, 41.8, { align: 'center' }).text('ESTADO MAIOR GENERAL', 105, 47, { align: 'center' })
  H(doc, 11); sublinhado(doc, 'REPARTIÇÃO DE PESSOAL CIVIL', 105, 52.4)
  H(doc, 12, 'bold'); sublinhado(doc, 'FICHA INDIVIDUAL', 105, 72)
  traco(doc).rect(160.2, 55.2, 27.6, 34.2)
  await fotoEm(doc, p, 160.2, 55.2, 27.6, 34.2)
  const o = { fonte: 'times', tam: 10.5, tamV: 10 }
  // as linhas do formulário como no modelo: a primeira a 101 mm e 7,5 mm entre elas
  const Y = (y) => 101 + (y - 98.3) * 1.035
  const lin = (r, v, x, y, xf, op) => linha(doc, r, v, x, Y(y), xf, op)
  const R = (t, x, y) => T(doc, 10.5).text(t, x, Y(y))
  lin('PROCESSO Nº', p.processo?.numero ?? '', 120.9, 98.3, 186.2, o)
  lin('NOME', p.nome, 23, 108.1, 119.3, o); lin('ESTADO CIVIL', ec(p), 120.9, 108.1, 186.5, o)
  lin('FILIAÇÃO', p.pai, 23, 115.4, 186.5, o)
  lin('E DE', p.mae, 23, 122.4, 186.5, o)
  const [d1, m1, a1] = partesData(p.dataNascimento)
  R('DATA DE NASCIMENTO', 23, 129.3)
  valor(doc, `${d1} / ${m1} / ${a1}`, 68, Y(129), 46, { fonte: 'times', tam: 10 })
  doc.setLineWidth(0.2).line(67, Y(130.1), 114, Y(130.1))
  const local = [p.naturalidade, p.provincia].filter(Boolean).join(', ')
  lin('LOCAL DE NASCIMENTO', local, 115.8, 129.3, 186.5, o)
  lin('', '', 23, 136.6, 56.5, o)
  lin('BILHETE DE IDENTIDADE Nº', p.bi, 57.5, 136.6, 161.1, o)
  R('EMITIDO EM', 162.7, 136.6)
  lin('', p.biLocalEmissao, 23, 143.9, 76.5, o)
  const [d2, m2, a2] = partesData(p.biEmitidoEm)
  lin('AOS', d2 ? `${d2}/${m2}/${a2}` : '', 77.8, 143.9, 142, o)
  R('LOCAL DE TRABALHO', 143.7, 143.9)
  lin('', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 23, 150.9, 167.5, o)
  R('DATA DE', 168.4, 150.9)
  const [d3, m3, a3] = partesData(p.dataAdmissao)
  lin('ADMISSÃO', d3 ? `${d3}/${m3}/${a3}` : '', 23, 158.2, 92, o)
  lin('FUNÇÃO/CATEGORIA', funcaoCategoria(p), 93, 158.2, 186.5, o)
  lin('MORADA', p.morada || p.provincia, 23, 165.5, 113.6, o); lin('MUNICÍPIO', p.municipio, 114.5, 165.5, 186.5, o)
  lin('BAIRRO', p.bairro, 23, 172.8, 112.6, o); lin('RUA', p.rua, 113.6, 172.8, 186.5, o)
  lin('CASA Nº', p.casa, 23, 179.7, 72.4, o); lin('TELEFONE', p.telefone, 73.3, 179.7, 133.9, o); lin('CAIXA POSTAL', p.caixaPostal, 134.8, 179.7, 186.5, o)
  T(doc, 10.5); sublinhado(doc, 'AGREGADO FAMILIAR', 105, 197)
  // tabela do agregado
  const cx = [12.8, 65.4, 100, 116.8, 157.3, 189.4]
  const t0 = 208
  const t1 = t0 + 13.3
  traco(doc).rect(12.8, t0, 176.6, 13.3 + 8 * 7.4).line(12.8, t1, 189.4, t1)
  for (const xx of cx.slice(1, -1)) doc.line(xx, t0, xx, t1 + 8 * 7.4)
  T(doc, 8, 'bold')
  ;['NOME', 'G.PARENTESCO', 'IDADE', 'NACIONALIDADE', 'PROFISSÃO'].forEach((t, i) => doc.text(t, (cx[i] + cx[i + 1]) / 2, t0 + 8.3, { align: 'center', charSpace: 0.4 }))
  const ag = [...(p.conjuge ? [{ nome: p.conjuge, parentesco: 'Cônjuge' }] : []), ...familia(p)]
  for (let i = 0; i < 8; i++) {
    const y = t1 + i * 7.4
    if (i) doc.setLineWidth(0.2).line(12.8, y, 189.4, y)
    const a = ag[i]
    if (a) [a.nome, a.parentesco, a.idade, a.nacionalidade, a.profissao].forEach((v, k) => valor(doc, v, cx[k] + 1.2, y + 5, cx[k + 1] - cx[k] - 2.4, { fonte: 'times', tam: 9, centrar: k > 0 }))
  }
  // 2.ª página
  novaPagina(d)
  traco(doc).rect(22, 16.8, 169.6, 11.7)
  H(doc, 11).text('FICHA INDIVIDUAL', 106.8, 24.6, { align: 'center' })
  traco(doc).rect(20, 32.7, 170, 241.5)
  const P = (r, v, y) => linha(doc, r, v, 24.5, y, 187.8, { tam: 10.5, tamV: 9.5 })
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
  ;[139, 144.2, 149.4].forEach((y, i) => { B(y); valor(doc, af[i] && [af[i].nome, af[i].idade, af[i].profissao].filter(Boolean).join(' — '), 25.5, y - 1, 160, { tam: 9.5 }) })
  P('ESTADO CIVIL', ec(p), 155)
  P('LOCAL DE SERVIÇO (ESPOSA) MARIDO', p.conjugeLocalServico, 159.8); B(165.6)
  P('ENDEREÇO FAMILIAR', residencia(p), 174); B(179.4); B(184.2)
  P('OUTROS DADOS (REGISTO DO RESUMO DISCIPLINAR LABORAL)', '', 188.3)
  for (const y of [193.6, 198.6, 203.6, 208.6, 213.6]) B(y)
  H(doc, 10.5).text('ASSINATURA', 105, 240.6, { align: 'center' })
  doc.setLineWidth(0.25).line(69, 247.3, 141, 247.3)
}

// ---------- ficha disciplinar ----------
export function fichaDisciplinar(d, p) {
  const { doc } = d
  novaPagina(d)
  emblema(doc, d.brasao, 105, 19, 22)
  H(doc, 11).text('FORÇAS ARMADAS ANGOLANAS', 105, 46.3, { align: 'center' }).text('ESTADO MAIOR GENERAL', 105, 51.4, { align: 'center' })
  H(doc, 11, 'bold'); sublinhado(doc, 'ESCOLA SUPERIOR DE GUERRA', 105, 56.4)
  H(doc, 12.5, 'bold'); sublinhado(doc, 'FICHA DISCIPLINAR', 105, 75.1)
  linha(doc, 'NOME', p.nome, 22.3, 84.5, 185.8, { tam: 11 })
  linha(doc, 'CATEGORIA', p.tipo === 'militar' ? p.postoNome : p.categoriaCivil || p.carreiraNome, 22.3, 92, 185.8, { tam: 11 })
  linha(doc, 'LOCAL DE TRABALHO', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 22.3, 99.6, 185.8, { tam: 11 })
  const cx = [19.1, 30.8, 98.3, 119.3, 150.3, 190.9]
  traco(doc, 0.4).rect(19.1, 107.8, 171.8, 169.6)
  traco(doc).line(19.1, 127.4, 190.9, 127.4)
  for (const x of cx.slice(1, -1)) doc.line(x, 107.8, x, 277.4)
  T(doc, 11, 'bold')
  doc.text('N/O', 24.95, 116, { align: 'center' })
  doc.text('REGISTO DE OCORRÊNCIAS', 64.5, 117, { align: 'center' })
  doc.text('DATA', 108.8, 119, { align: 'center' })
  doc.text(['ASSIN.DA', 'ENT.EMPR.'], 134.8, 116, { align: 'center', lineHeightFactor: 1.7 })
  doc.text(['ASSIN.DO', 'TRABALHADOR'], 170.6, 116, { align: 'center', lineHeightFactor: 1.7 })
  const oc = (p.eventos ?? []).filter((e) => ['punicao', 'condenacao', 'louvor', 'condecoracao'].includes(e.tipo))
  for (let i = 0; i < 19; i++) {
    const y = 127.4 + i * 7.895
    if (i) doc.setLineWidth(0.25).line(19.1, y, 190.9, y)
    const e = oc[i]
    if (e) {
      valor(doc, String(i + 1), cx[0] + 1, y + 5.2, cx[1] - cx[0] - 2, { fonte: 'times', tam: 8, centrar: true })
      valor(doc, `${e.tipoNome}${e.descricao ? `: ${e.descricao}` : ''}${e.pena ? ` — ${e.pena}` : ''}`, cx[1] + 1.2, y + 5.2, cx[2] - cx[1] - 2.4, { fonte: 'times', tam: 8 })
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
  H(doc, 8).text(n, x0 + 9.5, y0 + 3, { align: 'center' })
  H(doc, 8).text(titulo, centrar ? (x0 + 19 + x1) / 2 : x0 + 20.5, y0 + 3, { align: centrar ? 'center' : 'left' })
  for (let y = y0 + 8; y < y1 - 5; y += 4) doc.setLineWidth(0.15).line(x0, y, x1, y)
  H(doc, 8).text('POSTO, NIP, NOME, DATA', (x0 + x1) / 2, y1 - 1.3, { align: 'center' })
}
export function fichaAvaliacao(d, p) {
  const { doc } = d
  novaPagina(d)
  const x0 = 25
  const x1 = 185
  H(doc, 9).text('FORÇAS ARMADAS ANGOLANAS', 105, 14, { align: 'center' }).text('FICHA DE AVALIAÇÃO INDIVIDUAL', 105, 17.5, { align: 'center' }).text('(FAI)', 105, 21, { align: 'center' })
  // 01 identificação
  traco(doc).rect(x0, 23.1, 160, 34.9)
  H(doc, 8).text('01', x0 + 9.5, 25.6, { align: 'center' }).text('IDENTIFICAÇÃO DO AVALIADO', 105, 25.6, { align: 'center' })
  const o = { tam: 8.5, tamV: 9 }
  linha(doc, 'UNIDADE:', p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', x0 + 0.8, 30.2, x1 - 1, o)
  linha(doc, 'POSTO:', p.postoNome, x0 + 0.8, 37.8, 77, o); linha(doc, 'NIP:', p.nip, 78.8, 37.8, 127.5, o); linha(doc, 'ASC:', p.quadroEspecial, 129, 37.8, x1 - 1, o)
  linha(doc, 'NOME:', p.nome, x0 + 0.8, 45.4, x1 - 1, o)
  linha(doc, 'FUNÇÃO:', p.cargoNome, x0 + 0.8, 53, 148, o); linha(doc, 'QE:', p.quadroEspecial, 149.5, 53, x1 - 1, o)
  // 02 data e forma
  traco(doc).rect(x0, 61.8, 160, 29.2)
  H(doc, 8).text('02', x0 + 9.5, 64.3, { align: 'center' }).text('DATA E FORMA DE AVALIAÇÃO', 105, 64.3, { align: 'center' })
  H(doc, 8.5).text('DATA DE REFERÊNCIA DA AVALIAÇÃO ______/______/________  a  ______/______/________', x0 + 0.8, 70)
  H(doc, 8.5).text('AVALIAÇÃO PERIÓDICA', x0 + 0.8, 77.5).text('AVALIAÇÃO EXTRAORDINÁRIA', 95.6, 77.5)
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
  H(doc, 8).text('03', x0 + 9.5, g0 + 2.9, { align: 'center' }).text('GRELHA DE AVALIAÇÃO', (cF + x1) / 2, g0 + 2.9, { align: 'center' })
  H(doc, 8).text('FACTORES', (cF + cN) / 2, g0 + 8.6, { align: 'center' })
  ;['1º AVALIADOR', '2º AVALIADOR', 'CMDTE-DIR-CH'].forEach((t, i) => doc.text(t, cN + (i * 4 + 2) * wc, g0 + 6.6, { align: 'center' }))
  for (let i = 0; i < 12; i++) H(doc, 7.5).text(String([5, 10, 15, 20][i % 4]), cN + (i + 0.5) * wc, g0 + 10.4, { align: 'center' })
  const fr = 3.925
  FACTORES.forEach((f, i) => {
    const y = g0 + 11.4 + i * fr
    doc.setLineWidth(0.15).line(x0, y + fr, x1, y + fr)
    H(doc, 8).text(`F${i + 1}`, x0 + 9.5, y + 2.9, { align: 'center' }).text(f, cF + 1, y + 2.9)
  })
  H(doc, 8).text('04', x0 + 9.5, g0 + 76.4, { align: 'center' }).text('MÉDIA FINAL', (cF + cN) / 2, g0 + 76.4, { align: 'center' })
  // 05 parecer do conselho
  traco(doc).rect(x0, 177.5, 160, 50.7).line(x0, 181.5, x1, 181.5).line(cF, 177.5, cF, 181.5)
  H(doc, 8).text('05', x0 + 9.5, 180.4, { align: 'center' }).text('PARECER DO CONSELHO DA ASC:', cF + 1.5, 180.4)
  for (let y = 185.5; y < 214; y += 4) doc.setLineWidth(0.15).line(x0, y, x1, y)
  H(doc, 8).text('O PRESIDENTE', 62, 218.7, { align: 'center' }).text('O SECRETÁRIO', 150, 218.7, { align: 'center' })
  doc.setLineWidth(0.2).line(30, 223.5, 95, 223.5).line(117, 223.5, 182, 223.5)
  H(doc, 8).text('POSTO, NIP, NOME, DATA', 62, 226.6, { align: 'center' }).text('POSTO, NIP, NOME, DATA', 150, 226.6, { align: 'center' })
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
  H(doc, 8).text('09', x0 + 9.5, a0 + 2.6, { align: 'center' }).text('ÁREAS PREFERENCIAIS DE EMPREGO DO AVALIADO', (x0 + 19 + x1) / 2, a0 + 2.6, { align: 'center' })
  H(doc, 7.5).text('(ASSINALE A 1ª, 2ª E 3ª OPÇÃO)', (cols[1] + cols[3]) / 2, a0 + 6.3, { align: 'center' }).text('INDICAÇÃO', (cols[3] + x1) / 2, a0 + 5.8, { align: 'center' })
  H(doc, 7.5).text('PREFERÊNCIA', (cols[0] + cols[1]) / 2, a0 + 6.3, { align: 'center' })
  ;['1º Avaliador', '2º Avaliador', 'Cmdte'].forEach((t, i) => doc.text(t, (cols[3 + i] + cols[4 + i]) / 2, a0 + 9.5, { align: 'center' }))
  const areas = ['COMANDO/DIRECÇÃO/CHEFIA', 'PESSOAL', 'INFORMAÇÕES/SEGURANÇA', 'OPERAÇÕES/PLANEAMENTO', 'LOGÍSTICA', 'DOCÊNCIA/INSTRUÇÃO', 'TÉCNICAS', 'ADMINISTRATIVO', 'LOGÍSTICA']
  const ar = (61.2 - 10.5) / 9
  areas.forEach((t, i) => {
    const y = a0 + 10.5 + i * ar
    if (i) doc.setLineWidth(0.15).line(i === 5 ? cols[1] : cols[2], y, x1, y)
    H(doc, 7.5).text(t, (cols[2] + cols[3]) / 2, y + ar / 2 + 1, { align: 'center' })
    traco(doc, 0.2).rect(cols[0] + 6, y + 1.3, 6, 3)
    for (let k = 3; k < 6; k++) doc.rect((cols[k] + cols[k + 1]) / 2 - 3, y + 1.3, 6, 3)
  })
  doc.setLineWidth(0.3).line(cols[0], a0 + 10.5 + 5 * ar, cols[2], a0 + 10.5 + 5 * ar)
  H(doc, 7.5).text('ESTADO', cols[1] + 3.2, a0 + 10.5 + 2.5 * ar + 4, { angle: 90 }).text('MAIOR', cols[1] + 6.4, a0 + 10.5 + 2.5 * ar + 3.4, { angle: 90 })
  H(doc, 7.5).text('EXECUÇÃO', cols[1] + 5.4, a0 + 10.5 + 7 * ar + 5, { angle: 90 })
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
  T(doc, 11.5, 'bold'); sublinhado(doc, 'PROCESSO INDIVIDUAL DE PROMOÇÃO (PIP)', 103.8, 22.8)
  traco(doc).roundedRect(163.4, 14.3, 27.9, 28.5, 3, 3)
  await fotoEm(doc, p, 164, 15, 26.7, 27.1)
  doc.setLineWidth(0.25).line(30.6, 33, 159, 33)
  valor(doc, [p.postoNome, p.nome, p.nip && `NIP ${p.nip}`].filter(Boolean).join(' — '), 31, 32, 127, { fonte: 'times', tam: 11.5 })
  const L = (r, v, x, y, xf) => { H(doc, 10).text(r, x, y); const w = doc.getTextWidth(r); valor(doc, v, x + w + 1.5, y, xf - x - w - 2.5, { tam: 10.5 }) }
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
    H(doc, 8.5).text('5  10  15  20', xg + 7.6, 121.4, { align: 'center' })
    for (let i = 0; i < 8; i++) {
      H(doc, 8).text(F[lado * 8 + i], xt, 125.5 + i * 3.65 + 1.2)
      for (let k = 0; k < 4; k++) doc.setLineWidth(0.15).rect(xg + k * 3.8, 123.6 + i * 3.65, 3.8, 3.65)
    }
  }
  H(doc, 8.5, 'bolditalic').text('Média:', 20.5, 156.6); doc.setLineWidth(0.15).line(29, 156.8, 60, 156.8)
  blocoPip(doc, 'BLOCO 4 – Dados do quadro Especial', 30.6, 167.7)
  traco(doc).rect(x0, 170.5, x1 - x0, 38.7)
  L('Vacatura no Quadro Especial de:', p.quadroNome, 21.4, 174.4, x1 - 1)
  H(doc, 10, 'bold').text('Previsto no QE:', 74.7, 181.4, { align: 'right' }).text('Existente no QE:', 74.7, 188.4, { align: 'right' }).text('Vagas no QE:', 74.7, 195.4, { align: 'right' })
  H(doc, 10, 'bold').text('- Posição na Lista de Antiguidade:', 21.4, 202.4).text('Nº NA ASC:', 101.6, 202.4).text('Nº NO POSTO:', 149.5, 202.4)
  blocoPip(doc, 'BLOCO 5 – Histórico de Promoção', 30.6, 212.7)
  traco(doc).rect(x0, 216.8, x1 - x0, 59.6)
  const pr = promocoes(p)
  for (let i = 0; i < 8; i++) {
    const y = 220.6 + i * 6.98
    H(doc, 10).text(String(i + 1), 21.7, y)
    doc.setLineWidth(0.15).line(24, y + 0.8, 188.8, y + 0.8)
    if (pr[i]) valor(doc, `${pr[i].postoNovoNome} — ${dataPt(pr[i].data)}${pr[i].documento ? ` (${pr[i].documento})` : ''}`, 25, y, 162, { tam: 10.5 })
  }
  // 2.ª página
  novaPagina(d)
  const caixaLinhas = (y0, y1, linhas, valores = []) => {
    traco(doc).rect(17.1, y0, 175.9, y1 - y0)
    linhas.forEach((y, i) => { doc.setLineWidth(0.15).line(19.5, y, 190.5, y); valor(doc, valores[i], 20.5, y - 1, 168, { tam: 10.5 }) })
  }
  blocoPip(doc, 'BLOCO 6 – Curso de Promoção ou outro que se equipare', 16.4, 21.6)
  const cp = (p.cursos ?? []).filter((c) => c.tipo === 'promocao' || c.chave).map((c) => `${c.nome}${c.fim ? ` — ${dataPt(c.fim)}` : ''}${c.aproveitamento === false ? ' (sem aproveitamento)' : ''}`)
  caixaLinhas(29.2, 52.9, [34.2, 39.6, 44.4], cp)
  blocoPip(doc, 'BLOCO 7 – Desempenho de Funções Obrigatórias', 16.4, 57.4)
  traco(doc).rect(17.1, 63.1, 175.9, 26.6)
  H(doc, 9).text('1 Comando de companhia e de outro cargo que se equipare no QE, num período mínimo de um ano', 19.6, 67.8).text('SIM  NÃO', 186.6, 67.8, { align: 'right' })
  H(doc, 9).text('2 Professor, instrutor ou outro cargo cargo que se equipare dentro do QE, pelo menos dois anos', 19.6, 78.6)
  for (const y of [72.3, 78]) traco(doc, 0.2).rect(175.6, y, 4.3, 3.2).rect(183.4, y, 4.3, 3.2)
  blocoPip(doc, 'BLOCO 8 – Avaliação Médica', 18.3, 93.5)
  caixaLinhas(98.9, 122.4, [104.3, 110.6, 116], [p.aptidaoFisica ? 'APTO' : ''])
  blocoPip(doc, 'BLOCO 9 – Antecedentes Disciplinares e/ou Criminais', 30.4, 130.3)
  const pu = (p.eventos ?? []).filter((e) => e.tipo === 'punicao' || e.tipo === 'condenacao')
  caixaLinhas(134.4, 157.9, [139.6, 145, 150.4], [pu.length ? pu.map((e) => `${e.descricao}${e.pena ? ` — ${e.pena}` : ''} (${dataPt(e.data)})`).join('; ') : p.processoPendente ? 'PROCESSO PENDENTE' : 'NADA CONSTA'])
  blocoPip(doc, 'BLOCO 10 – Conclusão:', 17.1, 165.8)
  caixaLinhas(171.5, 197.2, [176.9, 182.6, 188.3, 194], [p.promocao?.elegivel ? `EM CONDIÇÕES DE PROMOÇÃO A ${M(p.promocao.postoPropostoNome)}` : ''])
  T(doc, 11).text('DATA ____/__________/20____', 124.2, 211.8)
  T(doc, 11).text('O OFICIAL RESPONSAVEL', 102.6, 229.5, { align: 'center' })
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

// texto corrido escrito por cima das linhas em branco do formulário (outras informações, observações)
function sobreLinhas(doc, texto, x, y0, passo, largura, n, tam = 9.5) {
  if (!texto) return
  const linhas = doc.setFont('helvetica', 'normal').setFontSize(tam).splitTextToSize(String(texto), largura).slice(0, n)
  linhas.forEach((l, i) => doc.text(l, x, y0 + i * passo - 1))
}
const dma = (iso) => { const [a, b, c] = partesData(iso); return a ? `${a}/${b}/${c}` : '' }
const SIT_MIL = ['adiado', 'disponibilidade', 'isento', 'nao_apto', 'refratario', 'militar']

/*
  Ficha de registo biográfico (cinco páginas deitadas), pelo modelo: as medidas vêm do modelo digitalizado
  (L = píxel do modelo → mm) e a letra tem o tamanho do modelo (~10,5 pt). Leva os dados da ficha, do registo
  biográfico (estudos, línguas, locais, colocações, situação militar e médica, classificação de serviço,
  assiduidade, outras informações) e da disciplina (processos, condenações, louvores).
*/
export function fichaRegistoBiografico(d, p) {
  const { doc } = d
  const L = (v) => v * 0.1485
  const R = p.registo ?? {}
  const F = 10 // rótulos
  const FV = 9.5 // valores
  nova(d, 'landscape')
  H(doc, 13, 'bold').text('FICHA DE REGISTO BIOGRÁFICO', 153, 16.6, { align: 'center' })
  const fx0 = 18.6
  const fx1 = 287.3
  traco(doc, 0.4).rect(fx0, 26.7, fx1 - fx0, 170.1)
  // fotografias (actualizar sempre que renovar o BI)
  traco(doc).line(81, 26.7, 81, 79.5).line(46.8, 26.7, 46.8, 79.5).line(53.5, 26.7, 53.5, 79.5).line(fx0, 55.7, 46.8, 55.7).line(53.5, 55.7, 81, 55.7)
  for (const [cx, cy] of [[32.7, 41], [67.2, 41], [32.7, 67.6], [67.2, 67.6]]) H(doc, 8.5).text('Foto (actualizada)', cx - 9, cy + 6, { angle: 45 })
  H(doc, 8).text('Actualizar sempre que renovar o BI', 51.6, 77, { angle: 90 })
  // 1. nome e filiação (uma letra em cada quadrícula)
  H(doc, F, 'bold').text('1.', 82, 30.2)
  H(doc, 11, 'bold').text('NOME COMPLETO', 84.6, 35.6)
  traco(doc).line(81, 43.8, fx1, 43.8)
  quadriculas(doc, p.nome, L(810), fx1, 26.7, 5.7, 3)
  H(doc, 11, 'bold').text('FILIAÇÃO', 84.2, 51.4)
  traco(doc).line(103.2, 43.8, 103.2, 55.7).line(103.2, 49.7, L(810), 49.7)
  H(doc, F).text('PAI', 113.5, 48.2, { align: 'center' }).text('MÃE', 113.5, 54.2, { align: 'center' })
  quadriculas(doc, p.pai, L(810), fx1, 43.8, 5.95, 1)
  quadriculas(doc, p.mae, L(810), fx1, 49.75, 5.95, 1)
  // sexo, nascimento, comuna | n.º processo, registo, CIF, residência
  traco(doc).line(81, 55.7, fx1, 55.7)
  H(doc, 11, 'bold').text('SEXO', 84.6, 63.2)
  doc.line(98, 55.7, 98, 67.6).line(103.2, 55.7, 103.2, 67.6).line(109.2, 55.7, 109.2, 67.6).line(98, 61.6, 199.7, 61.6)
  H(doc, F).text('M', 100.6, 60, { align: 'center' }).text('F', 100.6, 66, { align: 'center' })
  H(doc, 11, 'bold').text(p.genero === 'M' ? 'X' : '', 106.2, 60.1, { align: 'center' }).text(p.genero === 'F' ? 'X' : '', 106.2, 66.1, { align: 'center' })
  // «rótulo valor», o valor depois do rótulo, sem passar de xf
  const cel = (r, v, x, y, xf, tam = F) => { H(doc, tam).text(r, x, y); const w = doc.getTextWidth(r); valor(doc, v, x + w + 2, y, xf - x - w - 3, { tam: FV }) }
  cel('Data e Local de Nascimento', [dma(p.dataNascimento), M(p.naturalidade)].filter(Boolean).join('  '), 110, 60, 199)
  cel('Comuna', R.comuna, 110, 66, 199)
  doc.line(199.7, 55.7, 199.7, 79.5)
  ;[['Nº do Processo', p.processo?.numero], ['Nº do Registo', p.numeroAgente], ['C I F', p.inss], ['Residência', residencia(p)]].forEach(([r, v], i) => {
    const y = 55.7 + i * 5.95
    if (i) doc.setLineWidth(0.2).line(199.7, y, fx1, y)
    cel(r, v, 200.8, y + 4.4, fx1 - 1)
  })
  traco(doc).line(81, 67.6, 199.7, 67.6).line(81, 73.5, 199.7, 73.5).line(137.4, 67.6, 137.4, 79.5)
  cel('Município', p.municipio, 81.6, 72.2, 137)
  cel('Província', p.provincia, 138.1, 72.2, 199)
  cel('País', p.paisNascimento || 'Angola', 81.6, 78.1, 137)
  cel('Nacionalidade', p.nacionalidade, 138.1, 78.1, 199)
  // 2. estado civil | BI, profissão, cargo
  traco(doc, 0.4).line(fx0, 79.5, fx1, 79.5).line(144, 79.5, 144, 109.2).line(fx0, 109.2, fx1, 109.2)
  H(doc, 10.5, 'bold').text('2. Estado Civil:', 19.3, 84.3)
  const ecv = { solteiro: 0, casado: 1, uniao_facto: 1, divorciado: 2, viuvo: 3 }[p.estadoCivil]
  ;[['Solteiro', 56, 69.8], ['Casado', 76, 92.8], ['Divorciado', 99.5, 121], ['Viuvo', 128, 138.1]].forEach(([t, x, bx], i) => {
    H(doc, 10.5).text(t, x, 84.3)
    traco(doc, 0.2).rect(bx, 80.5, 5.2, 5)
    if (ecv === i) H(doc, 10.5, 'bold').text('X', bx + 2.6, 84.4, { align: 'center' })
  })
  traco(doc, 0.2).line(fx0, 85.8, 144, 85.8).line(fx0, 91.3, 144, 91.3).line(fx0, 97.3, 144, 97.3).line(fx0, 102.5, 144, 102.5)
  cel('Nome do(a) Cônjuge:', p.conjuge, 19.3, 89.9, 143)
  H(doc, F).text('Data de Nascimento  ______/______/__________', 20.3, 101.4)
  cel('Local de trabalho', p.conjugeLocalServico, 19.3, 107.3, 143)
  doc.line(199.7, 79.5, 199.7, 85.8)
  ;[['B.I. Nº', p.bi, 84.3], ['Local de emissão', p.biLocalEmissao, 89.9], ['Data de emissão', dma(p.biEmitidoEm), 95.6], ['Profissão', p.areaFormacao, 101.2], ['Cargo actual', p.cargoNome, 107]].forEach(([r, v, y], i) => {
    if (i) doc.setLineWidth(0.2).line(144, [85.8, 91.3, 97.3, 102.5][i - 1], fx1, [85.8, 91.3, 97.3, 102.5][i - 1])
    cel(r, v, 144.8, y, i === 0 ? 199 : fx1 - 1)
  })
  cel('Endereço', p.morada, 200.8, 84.3, fx1 - 1)
  // 3. U/E/O e últimos locais de trabalho
  H(doc, 10.5, 'bold').text('3. U/E/O', 19.3, 113.6)
  valor(doc, p.unidadeNome || 'ESCOLA SUPERIOR DE GUERRA', 37, 113.6, 120, { tam: FV })
  traco(doc, 0.2).line(158.2, 109.2, 158.2, 115).line(fx0, 115, fx1, 115)
  cel('Vínculo Jurídico Laboral', p.vinculoCivilNome, 158.9, 113.6, fx1 - 1)
  H(doc, 10.5).text('3 Últimos Locais de trabalho antes de entrar para :', 19.3, 119.8)
  const locais = R.locaisAnteriores ?? []
  for (const [i, y] of [121.8, 127.7, 133.7].entries()) {
    doc.setLineWidth(0.2).line(fx0, y, fx1, y)
    const l = locais[i] ?? {}
    valor(doc, l.local, 20, y + 4.7, 80, { tam: FV })
    H(doc, F).text(`de  ${dma(l.de) || '____/____/______'}  a  ${dma(l.ate) || '____/____/______'}`, 102.5, y + 4.7)
    H(doc, F).text('com a profissão de', 167.1, y + 4.7)
    valor(doc, l.profissao, 167.1 + doc.getTextWidth('com a profissão de') + 2, y + 4.7, 85, { tam: FV })
  }
  // 4. colocações
  traco(doc, 0.4).line(fx0, 138.8, fx1, 138.8)
  H(doc, 10.5, 'bold').text('4. COLOCAÇÕES', 19.3, 143)
  traco(doc, 0.2).line(150, 138.8, 150, 144.1)
  cel('DATA DE ENTRADA Nº', dma(p.dataEntradaEscola || p.dataAdmissao), 151.5, 142.9, fx1 - 1)
  const xs = [fx0, 70.2, 93.3, 109.9, 132.5, 158.6, 194.5, 229.9, fx1]
  const cab = ['Categoria Ocupacional', 'Despacho Nº', 'Data', 'D.R.nº', 'Inicio de função', 'Situação na\nFunção Pública', 'Colocação', 'Responsabilidade ou\nfunções ESP.\nComissões de Serviços']
  const pos = grelha(doc, xs, 144.1, 14.8, cab, 6, 6.3, { tam: 9.5 })
  H(doc, 6).text(['(Indicar também a especialidade e', 'começar pelo cargo actual)'], 19.5, 155.6)
  const col = R.colocacoes?.length ? R.colocacoes : [{ categoria: p.categoriaCivil, inicio: p.dataCategoria || p.dataAdmissao, colocacao: p.unidadeNome, responsabilidade: p.cargoNome, situacao: p.vinculoCivilNome }]
  col.slice(0, 6).forEach((c, i) => [c.categoria, c.despacho, dma(c.data), c.dr, dma(c.inicio), c.situacao, c.colocacao, c.responsabilidade].forEach((v, k) => valor(doc, v, ...pos(i, k), { tam: 8.5, centrar: k > 0 && k < 6 })))

  // página 2: estudos, processo disciplinar, distinções, situação militar, médica, classificação, agregado
  nova(d, 'landscape')
  H(doc, 10.5, 'bold').text('5. ESTUDOS REALIZADOS', L(108), 15.4)
  traco(doc, 0.4).rect(L(100), 17.1, L(1895) - L(100), 45.3)
  const c5 = [L(100), L(290), L(443), L(630), L(780)]
  traco(doc, 0.2)
  c5.slice(1, 4).forEach((x) => doc.line(x, 17.1, x, 34.2))
  ;[21.5, 26, 30.1, 34.2].forEach((y) => doc.line(c5[0], y, c5[4], y))
  H(doc, F).text('DATA/ANO', (c5[1] + c5[2]) / 2, 20.6, { align: 'center' }).text('DATA/ANO', (c5[3] + c5[4]) / 2, 20.6, { align: 'center' })
  const estudos = R.estudos ?? []
  ;[24.9, 29.1, 33.2].forEach((y, i) => {
    H(doc, F).text('Classe', c5[1] - 1, y, { align: 'right' }).text('Classe', c5[3] - 1, y, { align: 'right' })
    for (const [lado, e] of [[0, estudos[i]], [1, estudos[i + 3]]]) {
      if (!e) continue
      valor(doc, e.classe, c5[lado * 2] + 1, y, 14, { tam: FV })
      valor(doc, e.ano, c5[lado * 2 + 1] + 1, y, c5[lado * 2 + 2] - c5[lado * 2 + 1] - 2, { tam: FV, centrar: true })
    }
  })
  H(doc, F).text('Conhecimento de Linguas Internacionais', (c5[0] + c5[4]) / 2, 40, { align: 'center' })
  doc.line(c5[0], 43.4, c5[4], 43.4)
  const lx = [L(100), L(250), L(475), L(628), L(780)]
  lx.slice(1, 4).forEach((x) => doc.line(x, 43.4, x, 62.4))
  const linguas = R.linguas?.length ? R.linguas : [{ lingua: 'Inglês' }, { lingua: 'Francês' }]
  doc.line(c5[0], 57.6, c5[4], 57.6)
  for (let k = 0; k < 4; k++) {
    const g = linguas[k] ?? (k < 2 ? { lingua: ['Inglês', 'Francês'][k] } : {})
    H(doc, F).text(M(g.lingua || ''), (lx[k] + lx[k + 1]) / 2, 47.6, { align: 'center' })
    const w = (lx[k + 1] - lx[k]) / 3
    ;['MB', 'B', 'R'].forEach((t, i) => {
      H(doc, 9).text(t, lx[k] + w * (i + 0.5), 61.2, { align: 'center' })
      if (i) doc.line(lx[k] + w * i, 52.6, lx[k] + w * i, 62.4)
      if (g.nivel === t) H(doc, 10.5, 'bold').text('X', lx[k] + w * (i + 0.5), 56.4, { align: 'center' })
    })
  }
  doc.setLineWidth(0.2).line(c5[0], 52.6, c5[4], 52.6)
  doc.setLineWidth(0.3).line(c5[4], 17.1, c5[4], 62.4)
  const oc = [L(780), L(1310), L(1695), L(1895)]
  const est = [[HAB[p.habilitacao] && `${HAB[p.habilitacao]}${p.areaFormacao ? ` — ${p.areaFormacao}` : ''}`, '', ''], ...(p.cursos ?? []).map((c) => [c.nome, c.local, dataPt(c.fim)])].filter((l) => l[0])
  const posE = grelha(doc, oc, 17.1, 11.1, ['Outros Cursos ( de base, superações\nespecialização pós-graduação )', 'Escola Instituto\nou Universidade', 'Terminado em'], 8, 4.27, { tam: 9.5 })
  for (let i = 0; i < 8; i++) {
    if (est[i]) est[i].forEach((v, k) => { const [a, b2, c] = posE(i, k); valor(doc, v, a, b2 - 0.2, c, { tam: 8.5, centrar: k === 2 }) })
    else H(doc, 9).text('/            /20', (oc[2] + oc[3]) / 2, posE(i, 2)[1] - 0.2, { align: 'center' })
  }
  // 6. processo disciplinar
  const c6 = [L(87), L(325), L(545), L(775)]
  traco(doc, 0.4).rect(c6[0], 62.4, c6[3] - c6[0], 24.5)
  H(doc, 10.5, 'bold').text('6. PROCESSO DISCIPLINAR', c6[0] + 1, 67)
  const posD = grelha(doc, c6, 69, 4.5, ['Infração cometida', 'Pena Aplicada', 'Data'], 3, 4.47, { tam: 9.5 })
  const disc = (p.eventos ?? []).filter((e) => e.tipo === 'punicao').sort((a, b2) => String(b2.data).localeCompare(String(a.data)))
  for (let i = 0; i < 3; i++) {
    if (disc[i]) { valor2(doc, disc[i].descricao, ...posD(i, 0)); valor2(doc, disc[i].pena, ...posD(i, 1)); valor(doc, dma(disc[i].data), ...posD(i, 2), { tam: 8.5, centrar: true }) } else H(doc, 9).text('/            /20', (c6[2] + c6[3]) / 2, posD(i, 2)[1], { align: 'center' })
  }
  // 7. distinções ou louvores
  const c7 = [L(775), L(1140)]
  traco(doc, 0.4).rect(c7[0], 61.6, c7[1] - c7[0], 52)
  H(doc, 10.5, 'bold').text('7.DISTINÇÃO OU LOUVORES', (c7[0] + c7[1]) / 2, 65.4, { align: 'center' })
  const lv = (p.eventos ?? []).filter((e) => e.tipo === 'louvor' || e.tipo === 'condecoracao')
  for (let i = 0; i < 11; i++) {
    const y = 66.1 + i * 4.32
    doc.setLineWidth(0.15).line(c7[0], y, c7[1], y)
    if (lv[i]) valor(doc, `${dma(lv[i].data)} ${lv[i].descricao || lv[i].tipoNome}`, c7[0] + 1, y + 3.3, c7[1] - c7[0] - 2, { tam: 8.5 })
    else H(doc, 9).text('/                         /20', (c7[0] + c7[1]) / 2, y + 3.3, { align: 'center' })
  }
  // 8. situação militar (do civil)
  const c8 = [L(1140), L(1890)]
  traco(doc, 0.4).rect(c8[0], 62.4, c8[1] - c8[0], 51.2)
  H(doc, 10.5, 'bold').text('8. SITUAÇÃO MILITAR', (c8[0] + c8[1]) / 2, 66.3, { align: 'center' })
  const sm = R.situacaoMilitar ?? {}
  ;['Adiado', 'Disponibilidade', 'Isento', 'Não Apto', 'Refratário', 'Militar'].forEach((t, i) => {
    const y = 66.8 + i * 4.38
    doc.setLineWidth(0.15).line(c8[0], y, c8[1], y)
    H(doc, F).text(t, c8[0] + 1, y + 3.5)
    if (sm.tipo === SIT_MIL[i]) H(doc, 10.5, 'bold').text('X', c8[0] + 40, y + 3.5)
  })
  doc.setLineWidth(0.15).line(c8[0], 66.8 + 6 * 4.38, c8[1], 66.8 + 6 * 4.38).line(c8[0], 66.8 + 7 * 4.38, c8[1], 66.8 + 7 * 4.38)
  H(doc, F).text(`desde   ${dma(sm.desde) || '______/______________/______'}`, c8[0] + 1, 66.8 + 6 * 4.38 + 3.5)
  H(doc, F).text(`Reiniciou a função a   ${dma(sm.reiniciou) || '________/______________________/__________'}`, c8[0] + 1, 66.8 + 7 * 4.38 + 3.5)
  // 9. situação médica
  const c9 = [L(87), L(322)]
  traco(doc, 0.4).rect(c9[0], 86.9, c9[1] - c9[0], 26.7)
  H(doc, 9, 'bold').text('9.Situação Médica', (c9[0] + c9[1]) / 2, 90.1, { align: 'center' })
  doc.setLineWidth(0.15).line(c9[0], 90.9, c9[1], 90.9)
  const sd = R.saude ?? {}
  cel('Grupo Sang:', p.grupoSanguineo, c9[0] + 0.8, 94.6, c9[1] - 1, 9)
  H(doc, 8.5).text('Dador', c9[0] + 1.5, 98.7).text('sim', c9[0] + 17.8, 98.7).text('não', c9[0] + 29, 98.7)
  traco(doc, 0.2).rect(c9[0] + 11.6, 95.8, 5.4, 3.6).rect(c9[0] + 23.3, 95.8, 5.4, 3.6)
  if (sd.dador === true) H(doc, 9, 'bold').text('X', c9[0] + 14.3, 98.6, { align: 'center' })
  if (sd.dador === false) H(doc, 9, 'bold').text('X', c9[0] + 26, 98.6, { align: 'center' })
  cel('Defeito físico:', sd.defeitoFisico, c9[0] + 0.8, 102.9, c9[1] - 1, 9)
  H(doc, 9).text(['Doenças/alergias de', 'que sofra'], c9[0] + 0.8, 107.2, { lineHeightFactor: 1.35 })
  valor(doc, sd.doencas, c9[0] + 14, 111.4, c9[1] - c9[0] - 15, { tam: 8 })
  // 10. classificação de serviço
  const c10 = [L(322), L(467), L(620), L(770)]
  traco(doc, 0.4).rect(c10[0], 87.6, c10[3] - c10[0], 26)
  H(doc, 9, 'bold').text('10.Classificação de Serviço prestado', (c10[0] + c10[3]) / 2, 90.6, { align: 'center' })
  const posC = grelha(doc, c10, 91.3, 9, ['Ano', 'Valor de\nPonderação', 'Total de\nPontos'], 3, 4.43, { tam: 9.5 })
  const cls = [...(R.classificacoes ?? [])].sort((a, b2) => String(b2.ano).localeCompare(String(a.ano))).slice(0, 3)
  for (let i = 0; i < 3; i++) {
    const c = cls[i]
    if (c) [c.ano, c.ponderacao, c.pontos].forEach((v, k) => valor(doc, v, ...posC(i, k), { tam: 9, centrar: true }))
    else H(doc, 9).text('20', posC(i, 0)[0], posC(i, 0)[1])
  }
  // 11. agregado familiar
  const c11 = [L(85), L(238), L(690), L(842), L(1002), L(1055), L(1217), L(1530), L(1880)]
  const posA = grelha(doc, c11, 113.6, 8.5, ['11.Agregado\nFamiliar', 'Nome (Excluir o próprio, trabalhador\ne o cônjuge inscrito neste registo)', 'Grau\nParentesco', 'Data de\nNascimento', 'Sexo', 'Estado civil', 'Profissão', 'Local de trabalho'], 17, 4.37, { tam: 9.5 })
  familia(p).slice(0, 17).forEach((a, i) => [null, a.nome, a.parentesco, dma(a.dataNascimento), a.genero, { solteiro: 'Solteiro', casado: 'Casado', uniao_facto: 'União de facto', divorciado: 'Divorciado', viuvo: 'Viúvo' }[a.estadoCivil] ?? '', a.profissao, a.localTrabalho].forEach((v, k) => { if (v) valor(doc, v, ...posA(i, k), { tam: 8.5, centrar: k > 1 }) }))

  // página 3: averbamentos e observações (assiduidade e outras informações)
  nova(d, 'landscape')
  H(doc, 12, 'bold').text('AVERBAMENTOS E OBSERVAÇÕES', 153, 18.6, { align: 'center' })
  const fa0 = L(120)
  const fa1 = L(1920) + 2
  traco(doc, 0.4).rect(fa0, 22.3, fa1 - fa0, 178.2)
  H(doc, 10.5, 'bold').text('1. ASSIDUIDADE', fa0 + 1, 26.4)
  const ca = [L(120), L(355), L(578), L(806), L(1040), L(1218), L(1457), L(1685), fa1]
  H(doc, F).text('FALTAS JUSTIFICADAS', (ca[0] + ca[4]) / 2, 29.3, { align: 'center' }).text('FALTAS INJUSTIFICADAS', (ca[4] + ca[8]) / 2, 29.3, { align: 'center' })
  traco(doc, 0.2).line(ca[4], 22.3, ca[4], 72.3)
  const posF = grelha(doc, ca, 30.4, 5.2, ['ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS', 'ANO', 'Nº DE FALTAS'], 8, 4.6, { tam: 9.5 })
  // 16 anos em cada lado: as justificadas à esquerda, as injustificadas à direita (do mais recente)
  const as = [...(R.assiduidade ?? [])].sort((a, b2) => String(b2.ano).localeCompare(String(a.ano))).slice(0, 16)
  for (let i = 0; i < 8; i++) {
    for (const [lado, chave] of [[0, 'justificadas'], [4, 'injustificadas']]) {
      for (const metade of [0, 1]) {
        const a = as[metade * 8 + i]
        const k = lado + metade * 2
        if (a) { valor(doc, a.ano, ...posF(i, k), { tam: 9, centrar: true }); valor(doc, a[chave], ...posF(i, k + 1), { tam: 9, centrar: true }) } else H(doc, 9).text('20', posF(i, k)[0], posF(i, k)[1])
      }
    }
  }
  doc.setLineWidth(0.4).line(fa0, 72.3, fa1, 72.3)
  H(doc, 10.5, 'bold').text('2   Outras informações relevantes', fa0 + 2, 76.6)
  for (let y = 79.4; y < 199; y += 4.6) doc.setLineWidth(0.15).line(fa0, y, fa1, y)
  sobreLinhas(doc, R.outrasInformacoes, fa0 + 2, 79.4 + 4.6, 4.6, fa1 - fa0 - 4, 25)

  // página 4: observações, saída do serviço e anexos (tudo dentro da moldura, como no modelo)
  nova(d, 'landscape')
  const X4 = (v) => v * 0.1485
  const e4 = X4(95)
  const d4 = X4(1888)
  traco(doc, 0.4).rect(e4, 13.4, d4 - e4, 126)
  H(doc, 10.5, 'bold').text('3   OBSERVAÇÕES', X4(127), 21.2)
  H(doc, F).text('(Incluir distinções ou louvores, prémios e bónus)', X4(127) + 36, 21.2)
  for (let y = 25.2; y < 92; y += 4.68) doc.setLineWidth(0.15).line(e4, y, d4, y)
  const obs = [p.observacoes, ...lv.map((e) => `${dma(e.data)} — ${e.tipoNome}: ${e.descricao}${e.entidade ? ` (${e.entidade})` : ''}`)].filter(Boolean).join('\n')
  sobreLinhas(doc, obs, e4 + 2, 25.2 + 4.68, 4.68, d4 - e4 - 4, 14)
  doc.setLineWidth(0.4).line(e4, 93.2, d4, 93.2)
  H(doc, 10.5, 'bold').text('4   Data de saída do serviço', X4(108), 97.4)
  H(doc, F).text(p.dataSaidaEscola ? dma(p.dataSaidaEscola) : '/                               /', X4(480), 97.4)
  H(doc, 10.5, 'bold').text('Motivo', X4(137), 102)
  for (let y = 98.6; y < 126; y += 4.6) doc.setLineWidth(0.15).line(e4, y, d4, y)
  sobreLinhas(doc, [p.motivoSaida, p.destinoSaida && `Destino: ${p.destinoSaida}`].filter(Boolean).join(' — '), X4(240), 103.2, 4.6, d4 - X4(240) - 3, 1)
  H(doc, 8, 'bold').text('Anexar:', e4 + 1, 129.2)
  H(doc, 8).text(doc.splitTextToSize('i. Certidão de nascimento(cópia); ii. Certidão de registo criminal; iii. Certificado de habilitações literárias; iv. Certificado de habilitações profissionais; v. Declaração sobre o compromisso de honra; vi. Documentação militar; vii. Atestado médico; viii. Proposta de admissão; ix. Fotocópia do bilhete de identidade civil; x. Cópia de certificado dos cursos que possui; xi. Resultado do teste de admissão; xii. Duas fotografias tipo passe.', d4 - e4 - 16), e4 + 13, 129.2, { lineHeightFactor: 1.3 })
  H(doc, 7).text('Pag 15-regiblog', e4, 144)

  // página 5: registo criminal e disciplinar
  nova(d, 'landscape')
  const cr = [L(195), L(868), L(1316), L(1587), L(1682), L(1787), L(1895)]
  traco(doc, 0.4).rect(cr[0], 26.4, cr[6] - cr[0], 5.2)
  H(doc, 11, 'bold').text('REGISTO CRIMINAL E DISCIPLINAR', (cr[0] + cr[6]) / 2, 30.4, { align: 'center' })
  const posR = grelha(doc, cr, 31.6, 5.2, ['Crime ou infracção', 'Pena imposta', 'Tribunal ou Autoridade', 'Dia', 'Mês', 'Ano'], 26, 5.77, { tam: 10 })
  const crimDisc = (p.eventos ?? []).filter((e) => e.tipo === 'punicao' || e.tipo === 'condenacao').sort((a, b2) => String(a.data).localeCompare(String(b2.data)))
  crimDisc.slice(0, 26).forEach((e, i) => {
    const [dd, mm, aa] = partesData(e.data)
    ;[e.descricao, e.pena, e.entidade].forEach((v, k) => valor(doc, v, ...posR(i, k), { tam: 9 }))
    ;[dd, mm, aa].forEach((v, k) => valor(doc, v, ...posR(i, 3 + k), { tam: 9, centrar: true }))
  })
}

// ---------- ficha para cadastramento dos docentes (efectivos e colaboradores, militares e civis) ----------
export function fichaDocente(d, p) {
  const { doc } = d
  novaPagina(d)
  const x = 35.5
  const xf = 182
  const o = { fonte: 'times', tam: 10.5, tamV: 10.5 }
  T(doc, 11).text('FICHA PARA CADASTRAMENTO DOS DOCENTES.', 108, 41.5, { align: 'center' })
  T(doc, 10.5).text('DADOS PESSOAIS', x, 50.6)
  const mil = p.tipo === 'militar'
  linha(doc, 'NOME COMPLETO', p.nome, x, 59.5, xf, o)
  linha(doc, 'FILHO DE', p.pai, x, 67.6, xf, o)
  linha(doc, 'E DE', p.mae, x, 76, xf, o)
  linha(doc, 'BI Nº', p.bi, x, 84.5, xf, o)
  linha(doc, 'DATA DE EMISSÃO', dataPt(p.biEmitidoEm), x, 93, xf, o)
  linha(doc, 'DATA DE VALIDAÇÃO', dataPt(p.biValidade), x, 101.5, xf, o)
  linha(doc, 'LOCAL DE EMISSÃO', p.biLocalEmissao, x, 110, xf, o)
  linha(doc, 'PAÍS DE NASCIMENTO', p.paisNascimento || 'Angola', x, 118.4, xf, o)
  linha(doc, 'PROVÍNCIA', p.provincia, x, 126.7, 104, o); linha(doc, 'MUNICÍPIO', p.naturalidade || p.municipio, 105, 126.7, xf, o)
  linha(doc, 'RESIDÊNCIA', p.morada || p.municipio, x, 135.4, 100, o); linha(doc, 'DATA DE NASCIMENTO', dataPt(p.dataNascimento), 101, 135.4, xf, o)
  linha(doc, 'ESTADO CIVIL', ec(p), x, 143.4, 104, o); linha(doc, 'SEXO', p.genero === 'F' ? 'Feminino' : p.genero === 'M' ? 'Masculino' : '', 105, 143.4, xf, o)
  linha(doc, 'GRUPO SANGUÍNEO', p.grupoSanguineo, x, 152, 91, o); linha(doc, 'HABILITAÇÃO LITERÁRIA', HAB[p.habilitacao] ?? '', 92, 152, xf, o)
  linha(doc, 'TEL PRINCIPAL', p.telefone, x, 160.4, 104, o); linha(doc, 'TEL ALTERNATIVO', p.telefoneAlternativo, 105, 160.4, xf, o)
  T(doc, 10.5).text('E-MAIL', x, 169)
  doc.setLineWidth(0.2).setDrawColor(60).line(x + doc.getTextWidth('E-MAIL') + 1, 169.8, xf, 169.8).setDrawColor(0)
  // o e-mail vai em minúsculas
  if (p.email) T(doc, 10.5, 'bold').text(p.email, x + doc.setFont('times', 'normal').getTextWidth('E-MAIL') + 2, 168.7)
  const marca = (t, xx, y, sim) => { T(doc, 10.5).text(t, xx, y); const bx = xx + doc.getTextWidth(t) + 1.5; traco(doc, 0.25).rect(bx, y - 3.2, 3.6, 3.6); if (sim) T(doc, 10, 'bold').text('X', bx + 1.8, y - 0.2, { align: 'center' }) }
  T(doc, 10.5).text('CONDIÇÃO:', x, 177.3)
  marca('MILITAR', x + 21, 177.3, mil); marca('CIVIL', x + 47, 177.3, !mil)
  linha(doc, 'NIP', mil ? p.nip : '', x, 185.8, 78, o); linha(doc, 'RAMO', mil ? p.ramoNome : '', 79, 185.8, 131, o); linha(doc, 'PATENTE', mil ? p.postoNome : '', 132, 185.8, xf, o)
  linha(doc, 'DATA DE INCORPORAÇÃO', mil ? dataPt(p.dataIngresso) : '', x, 194.5, 136, o)
  // colaborador: a função lá fora; efectivo: o cargo na Escola
  linha(doc, 'FUNÇÃO OU CARGO ACTUAL', p.funcaoActual || p.cargoNome, x, 203, xf, o)
  T(doc, 10.5).text('DADOS ACADEMICOS', x, 212)
  T(doc, 10.5).text('TIPO DE DOCENTE:', x, 220.3)
  marca('EFECTIVO', x + 34, 220.3, p.tipoDocente === 'efectivo'); marca('COLABORADOR', x + 72, 220.3, p.tipoDocente === 'colaborador')
  linha(doc, 'CATEGORIA DO DOCENTE', p.categoriaDocente, x, 228.8, xf, o)
}

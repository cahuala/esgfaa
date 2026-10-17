import { api } from './api'
import { fotoBase64 } from './fotos'
import Brasao from '../assets/Logo.png'

const pt = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : '—')
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const dataPorExtenso = (d = new Date()) => `Luanda, aos ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
const registar = (tabela) => api('/auditoria/exportacao', { metodo: 'POST', corpo: { tabela: tabela.slice(0, 120), formato: 'pdf', linhas: 1 } }).catch(() => {})

let brasao = null
async function imagem(url) {
  return new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      // o brasão vai pequeno (o original é grande e repetia-se em cada página)
      const k = Math.min(1, 240 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      ok(c.toDataURL('image/png'))
    }
    img.onerror = () => ok(null)
    img.src = url
  })
}

async function novoDocumento() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  brasao ??= await imagem(Brasao)
  return { doc: new jsPDF({ unit: 'mm', format: 'a4' }), autoTable }
}

// cabeçalho institucional: brasão ao centro e a cadeia hierárquica
function cabecalho(doc, titulo) {
  const w = doc.internal.pageSize.getWidth()
  if (brasao) doc.addImage(brasao, 'PNG', w / 2 - 9, 8, 18, 18)
  doc.setFont('helvetica', 'bold').setFontSize(9.5)
  doc.text('REPÚBLICA DE ANGOLA', w / 2, 31, { align: 'center' })
  doc.text('FORÇAS ARMADAS ANGOLANAS', w / 2, 35.5, { align: 'center' })
  doc.text('ESCOLA SUPERIOR DE GUERRA', w / 2, 40, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(8.5).text('Repartição de Pessoal e Quadros', w / 2, 44.5, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(13).text(titulo, w / 2, 54, { align: 'center' })
  doc.setLineWidth(0.4).line(14, 57, w - 14, 57)
  return 63
}

async function foto(doc, p, x, y) {
  const f = await fotoBase64(p.id, p.fotoId)
  if (f) doc.addImage(f, 'JPEG', x, y, 30, 36)
  else {
    doc.setDrawColor(160).rect(x, y, 30, 36)
    doc.setFontSize(7).setTextColor(130).text('Fotografia', x + 15, y + 19, { align: 'center' }).setTextColor(0)
  }
}

function rodape(doc) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7).setTextColor(120).text('Documento interno — Escola Superior de Guerra', 14, h - 7)
    doc.text(`Página ${i} de ${n}`, w - 14, h - 7, { align: 'right' }).setTextColor(0)
  }
}

function assinaturas(doc, y, cargos) {
  const w = doc.internal.pageSize.getWidth()
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 25 }
  doc.setFontSize(9).text(dataPorExtenso(), w - 14, y, { align: 'right' })
  const larg = (w - 28) / cargos.length
  cargos.forEach((c, i) => {
    const x = 14 + larg * i + larg / 2
    doc.setFont('helvetica', 'bold').setFontSize(8.5).text(c, x, y + 12, { align: 'center' })
    doc.setFont('helvetica', 'normal').line(x - 30, y + 30, x + 30, y + 30)
  })
}

const tabelaDados = (autoTable, doc, y, titulo, pares) => {
  const linhas = []
  for (let i = 0; i < pares.length; i += 2) linhas.push([pares[i][0], pares[i][1] || '—', pares[i + 1]?.[0] ?? '', pares[i + 1] ? pares[i + 1][1] || '—' : ''])
  autoTable(doc, {
    startY: y, head: [[{ content: titulo, colSpan: 4 }]], body: linhas, theme: 'grid', margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [31, 58, 45] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 36, fillColor: [244, 246, 244] }, 2: { fontStyle: 'bold', cellWidth: 36, fillColor: [244, 246, 244] } },
  })
  return doc.lastAutoTable.finalY + 4
}

const identificacao = (p) => (p.tipo === 'militar' ? `${p.postoNome} · ${p.ramoNome} · NIP ${p.nip ?? '—'}` : `${p.categoriaCivil ?? 'Civil'} · N.º de agente ${p.numeroAgente ?? '—'}`)

/*
  Síntese biográfica (como no SIGP): identificação, filiação, carreira, cursos, cargos e louvores,
  com fotografia. p = ficha completa (GET /pessoas/:id).
*/
export async function sinteseBiografica(p) {
  const { doc, autoTable } = await novoDocumento()
  await desenharSintese(doc, autoTable, p)
  rodape(doc)
  doc.save(`sintese-biografica-${(p.nip || p.numeroAgente || p.id).toString().replace(/[^\w-]/g, '')}.pdf`)
  registar(`Síntese biográfica: ${p.nome}`)
}

async function desenharSintese(doc, autoTable, p) {
  let y = cabecalho(doc, 'SÍNTESE BIOGRÁFICA')
  const w = doc.internal.pageSize.getWidth()
  await foto(doc, p, w - 44, y)
  doc.setFont('helvetica', 'bold').setFontSize(12).text(p.nome, 14, y + 6, { maxWidth: w - 64 })
  doc.setFont('helvetica', 'normal').setFontSize(9.5).text(identificacao(p), 14, y + 13)
  doc.text(`${p.unidadeNome || 'Sem unidade'}${p.cargoNome ? ` — ${p.cargoNome}` : ''}`, 14, y + 19, { maxWidth: w - 64 })
  y += 42
  y = tabelaDados(autoTable, doc, y, 'Dados pessoais', [
    ['Nascimento', `${pt(p.dataNascimento)}${p.idade !== null ? ` (${p.idade} anos)` : ''}`], ['Naturalidade', [p.naturalidade, p.provincia].filter(Boolean).join(', ')],
    ['Filiação', [p.pai, p.mae].filter(Boolean).join(' e ')], ['Estado civil', p.estadoCivil ?? ''], ['B.I.', p.bi ?? ''], ['Habilitações', [p.habilitacaoNome, p.areaFormacao].filter(Boolean).join(' — ')],
  ])
  if (p.tipo === 'militar') {
    y = tabelaDados(autoTable, doc, y, 'Situação militar', [
      ['Posto', p.postoNome], ['Categoria', p.categoriaNome], ['Forma de serviço', p.fpsNome], ['Quadro especial', p.quadroNome],
      ['Ingresso nas FAA', pt(p.dataIngresso)], ['Antiguidade no posto', pt(p.dataAntiguidadePosto)], ['Situação', p.situacaoNome], ['Tempo de serviço', p.tempoServico !== null ? `${Math.floor(p.tempoServico)} anos` : ''],
    ])
  } else {
    y = tabelaDados(autoTable, doc, y, 'Situação profissional', [['Carreira', p.carreiraNome], ['Categoria', p.categoriaCivil ?? ''], ['Admissão', pt(p.dataAdmissao)], ['Vínculo', p.vinculoCivilNome]])
  }
  const tabela = (titulo, cab, corpo) => {
    if (!corpo.length) return
    autoTable(doc, { startY: y, head: [[{ content: titulo, colSpan: cab.length }], cab], body: corpo, theme: 'striped', styles: { fontSize: 8, cellPadding: 1.4 }, headStyles: { fillColor: [31, 58, 45] }, margin: { left: 14, right: 14 } })
    y = doc.lastAutoTable.finalY + 4
  }
  const carreira = p.eventos.filter((e) => ['ingresso', 'admissao', 'promocao', 'graduacao', 'nomeacao', 'exoneracao', 'situacao', 'progressao', 'colocacao', 'transferencia'].includes(e.tipo)).reverse()
  tabela('Percurso na carreira', ['Data', 'Acto', 'Descrição', 'Documento'], carreira.map((e) => [pt(e.data), e.tipoNome, [e.postoNovoNome && `${e.postoAnteriorNome ? `${e.postoAnteriorNome} → ` : ''}${e.postoNovoNome}`, e.cargoNome, e.descricao].filter(Boolean).join(' · '), e.documento]))
  tabela('Cursos', ['Curso', 'Local', 'Conclusão', 'Resultado'], p.cursos.map((c) => [c.nome, c.local, pt(c.fim), c.aproveitamento === false ? 'Sem aproveitamento' : c.classificacao ? `${c.classificacao} valores` : 'Com aproveitamento']))
  tabela('Louvores e condecorações', ['Data', 'Registo', 'Descrição'], p.eventos.filter((e) => ['louvor', 'condecoracao'].includes(e.tipo)).map((e) => [pt(e.data), e.tipoNome, e.descricao]))
  assinaturas(doc, y + 6, ['O Chefe da Repartição de Pessoal e Quadros'])
}

const ESTADO = { ok: 'Cumpre', falta: 'Não cumpre', confirmar: 'A confirmar' }

/*
  Ficha de proposta (promoção, nomeação, graduação…) de cada pessoa da proposta, com fotografia, a situação
  actual, o que se propõe e as condições da Lei n.º 13/18 — é o que a Escola envia ao escalão superior.
  Para cada pessoa saem os dois documentos, prontos a assinar: a ficha de proposta e a síntese biográfica,
  tudo num só PDF (comSintese = false: só as fichas).
*/
export async function fichasDeProposta(proposta, cargos = [], { comSintese = true } = {}) {
  const { doc, autoTable } = await novoDocumento()
  const w = doc.internal.pageSize.getWidth()
  const titulo = { promocao: 'FICHA DE PROPOSTA DE PROMOÇÃO', nomeacao: 'FICHA DE PROPOSTA DE NOMEAÇÃO', graduacao: 'FICHA DE PROPOSTA DE GRADUAÇÃO', exoneracao: 'FICHA DE PROPOSTA DE EXONERAÇÃO', progressao: 'FICHA DE PROPOSTA DE PROGRESSÃO' }[proposta.tipo] ?? 'FICHA DE PROPOSTA'
  for (const [n, i] of proposta.itens.entries()) {
    if (n) doc.addPage()
    const p = await api(`/pessoas/${i.pessoaId}`)
    let y = cabecalho(doc, titulo)
    doc.setFontSize(8.5).text(`Proposta n.º ${proposta.id} — ${proposta.titulo}`, 14, y)
    y += 4
    await foto(doc, p, w - 44, y)
    doc.setFont('helvetica', 'bold').setFontSize(12).text(p.nome, 14, y + 6, { maxWidth: w - 64 })
    doc.setFont('helvetica', 'normal').setFontSize(9.5).text(identificacao(p), 14, y + 13)
    y += 42
    y = tabelaDados(autoTable, doc, y, 'Situação actual', p.tipo === 'militar' ? [
      ['Posto', p.postoNome], ['Antiguidade no posto', pt(p.dataAntiguidadePosto)], ['Tempo no posto', p.tempoNoPosto !== null ? `${String(p.tempoNoPosto).replace('.', ',')} anos` : ''], ['Forma de serviço', p.fpsNome],
      ['Quadro especial', p.quadroNome], ['Idade', p.idade !== null ? `${p.idade} anos` : ''], ['Unidade', p.unidadeNome], ['Cargo', p.cargoNome],
    ] : [['Categoria', p.categoriaCivil ?? ''], ['Na categoria desde', pt(p.dataCategoria)], ['Unidade', p.unidadeNome], ['Cargo', p.cargoNome]])
    const cargo = cargos.find((c) => c.id === i.cargoId)
    y = tabelaDados(autoTable, doc, y, 'O que se propõe', [
      ...(['promocao', 'graduacao'].includes(proposta.tipo) ? [['Posto proposto', i.postoPropostoNome], ['Modalidade', i.modalidadeNome]] : []),
      ...(proposta.tipo === 'progressao' ? [['Categoria proposta', i.categoriaProposta]] : []),
      ...(['nomeacao', 'exoneracao'].includes(proposta.tipo) ? [['Cargo', cargo ? `${cargo.nome}${cargo.unidadeNome ? ` — ${cargo.unidadeNome}` : ''}` : ''], ['Posto do cargo', cargo?.postoRequeridoNome ?? '']] : []),
      ...(i.inicio ? [['A partir de', pt(i.inicio)]] : []), ...(i.fim ? [['Até', pt(i.fim)]] : []),
    ])
    autoTable(doc, {
      startY: y, head: [[{ content: 'Condições da Lei n.º 13/18, de 29 de Outubro', colSpan: 3 }], ['Condição', 'Artigo', 'Situação']],
      body: (i.verificacao?.condicoes ?? []).map((c) => [c.texto + (c.detalhe ? `\n${c.detalhe}` : ''), c.artigo, ESTADO[c.estado] ?? c.estado]),
      theme: 'grid', margin: { left: 14, right: 14 }, styles: { fontSize: 7.8, cellPadding: 1.4 }, headStyles: { fillColor: [31, 58, 45] },
      columnStyles: { 1: { cellWidth: 34 }, 2: { cellWidth: 24, fontStyle: 'bold' } },
    })
    y = doc.lastAutoTable.finalY + 5
    const texto = [i.justificacao, proposta.fundamentacao].filter(Boolean).join('\n\n')
    if (texto) {
      doc.setFont('helvetica', 'bold').setFontSize(9).text('Fundamentação', 14, y)
      const linhas = doc.setFont('helvetica', 'normal').setFontSize(8.5).splitTextToSize(texto, w - 28)
      doc.text(linhas, 14, y + 5)
      y += 8 + linhas.length * 4
    }
    assinaturas(doc, y + 4, ['O Chefe da Repartição de Pessoal e Quadros', 'O Director da Escola Superior de Guerra'])
    if (comSintese) {
      doc.addPage()
      await desenharSintese(doc, autoTable, p)
    }
  }
  rodape(doc)
  doc.save(`proposta-${proposta.id}-documentos.pdf`)
  registar(`Documentos da proposta n.º ${proposta.id} (fichas${comSintese ? ' e sínteses' : ''})`)
}

// etiqueta para a lombada da pasta do processo individual
export async function etiquetaProcesso(p) {
  const { doc } = await novoDocumento()
  const x = 20
  const y = 20
  doc.setLineWidth(0.6).rect(x, y, 60, 250)
  if (brasao) doc.addImage(brasao, 'PNG', x + 20, y + 6, 20, 20)
  doc.setFont('helvetica', 'bold').setFontSize(9).text(['FAA', 'ESCOLA SUPERIOR', 'DE GUERRA', 'R. PESSOAL E QUADROS'], x + 30, y + 34, { align: 'center' })
  doc.setFontSize(20).text(p.processo?.numero ?? 'PI-_____', x + 30, y + 64, { align: 'center' })
  doc.setFontSize(11).text(doc.splitTextToSize(p.nome.toUpperCase(), 54), x + 30, y + 84, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(10).text(doc.splitTextToSize([p.tipo === 'militar' ? p.postoNome : p.categoriaCivil, p.nip ? `NIP ${p.nip}` : p.numeroAgente ? `Agente ${p.numeroAgente}` : '', p.fps, p.situacaoNome].filter(Boolean).join('\n'), 54), x + 30, y + 120, { align: 'center' })
  const loc = p.processo ? [p.processo.estante && `Estante ${p.processo.estante}`, p.processo.prateleira && `Prateleira ${p.processo.prateleira}`, p.processo.posicao && `Posição ${p.processo.posicao}`].filter(Boolean) : []
  doc.setFontSize(9).text(loc.length ? loc : ['Localização: ____'], x + 30, y + 225, { align: 'center' })
  doc.save(`etiqueta-${p.processo?.numero ?? p.id}.pdf`)
}

// credenciais das contas novas (para imprimir e entregar em mão)
export async function credenciaisPdf(contas) {
  const { doc, autoTable } = await novoDocumento()
  const y = cabecalho(doc, 'CONTAS DO SISTEMA INTERNO')
  doc.setFontSize(8.5).text('Entre com o NIP (ou o n.º de agente / e-mail) e a palavra-passe abaixo; na primeira entrada escolhe uma nova. Recorte e entregue a cada um.', 14, y, { maxWidth: 182 })
  autoTable(doc, { startY: y + 8, head: [['Nome', 'Entrar com', 'Palavra-passe inicial']], body: contas.map((c) => [c.nome, c.entrar, c.senha]), theme: 'grid', styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: [31, 58, 45] }, columnStyles: { 2: { font: 'courier', fontStyle: 'bold' } }, margin: { left: 14, right: 14 } })
  rodape(doc)
  doc.save('contas-sistema-interno.pdf')
}

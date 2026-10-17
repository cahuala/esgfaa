import { api } from './api'
import { brasaoPng } from './documentos'

const pt = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-PT') : '—')
const imagemBase64 = (url) => new Promise((ok) => {
  if (!url) return ok(null)
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    ok(c.toDataURL('image/jpeg', 0.9))
  }
  img.onerror = () => ok(null)
  img.src = url
})

// ficha individual em PDF (perfil do militar ou do civil), para imprimir ou arquivar
export async function fichaPdf(p, urlFoto) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const brasao = await brasaoPng()
  if (brasao) doc.addImage(brasao, 'PNG', 14, 6, 17, 17)
  doc.setFont('helvetica', 'bold').setFontSize(11).text('ESCOLA SUPERIOR DE GUERRA', w / 2, 13, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(9).text('Repartição de Pessoal e Quadros', w / 2, 18, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(14).text(p.tipo === 'militar' ? 'FICHA INDIVIDUAL DO MILITAR' : 'FICHA INDIVIDUAL DO FUNCIONÁRIO CIVIL', w / 2, 28, { align: 'center' })
  const foto = await imagemBase64(urlFoto)
  if (foto) doc.addImage(foto, 'JPEG', w - 44, 34, 30, 36)
  else doc.setDrawColor(180).rect(w - 44, 34, 30, 36).setFontSize(7).text('Fotografia', w - 29, 53, { align: 'center' })
  doc.setFontSize(12).setFont('helvetica', 'bold').text(p.nome, 14, 40)
  doc.setFontSize(9.5).setFont('helvetica', 'normal')
  const linha1 = p.tipo === 'militar' ? `${p.postoNome} · ${p.ramoNome} · NIP ${p.nip ?? '—'}` : `${p.categoriaCivil ?? 'Civil'} · N.º de agente ${p.numeroAgente ?? '—'}`
  doc.text(linha1, 14, 46)
  doc.text(`${p.unidadeNome || 'Sem unidade'}${p.cargoNome ? ` · ${p.cargoNome}` : ''}`, 14, 51)
  doc.text(`${p.vinculoNome}${p.situacaoCaminho ? ` · ${p.situacaoCaminho}` : ''}${p.estadoNome ? ` · ${p.estadoNome}` : ''}`, 14, 56)

  const secao = (titulo, linhas, y) => {
    autoTable(doc, {
      startY: y, head: [[{ content: titulo, colSpan: 4 }]],
      body: linhas.reduce((r, x, i) => { if (i % 2 === 0) r.push([...x]); else r[r.length - 1].push(...x); return r }, []).map((l) => (l.length === 2 ? [...l, '', ''] : l)),
      theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5 }, headStyles: { fillColor: [31, 58, 45] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38, fillColor: [244, 246, 244] }, 2: { fontStyle: 'bold', cellWidth: 38, fillColor: [244, 246, 244] } }, margin: { left: 14, right: 14 },
    })
    return doc.lastAutoTable.finalY + 4
  }
  let y = secao('Dados pessoais', [
    ['Nome de guerra', p.nomeGuerra || '—'], ['Bilhete de identidade', p.bi || '—'], ['Data de nascimento', `${pt(p.dataNascimento)}${p.idade !== null ? ` (${p.idade} anos)` : ''}`], ['Género', p.generoNome || '—'],
    ['Estado civil', p.estadoCivil || '—'], ['Naturalidade', [p.naturalidade, p.provincia].filter(Boolean).join(', ') || '—'], ['Filiação', [p.pai, p.mae].filter(Boolean).join(' e ') || '—'], ['Nacionalidade', p.nacionalidade || '—'],
    ['Telefone', p.telefone || '—'], ['E-mail', p.email || '—'], ['Morada', p.morada || '—'], ['Habilitações', [p.habilitacaoNome, p.areaFormacao].filter(Boolean).join(' — ') || '—'],
  ], 74)
  if (p.tipo === 'militar') {
    y = secao('Carreira militar (Lei n.º 13/18)', [
      ['Posto', p.postoNome], ['Categoria', p.categoriaNome], ['Forma de serviço', p.fpsNome], ['Quadro especial', p.quadroNome || '—'],
      ['Especialidade', p.especialidade || '—'], ['Ingresso nas FAA', pt(p.dataIngresso)], ['Antiguidade no posto', pt(p.dataAntiguidadePosto)], ['Tempo de serviço', p.tempoServico !== null ? `${Math.floor(p.tempoServico)} anos` : '—'],
      ['Passagem à reserva', pt(p.reservaReforma?.reserva?.data)], ['Reforma', pt(p.reservaReforma?.reforma?.data)], ['Próximo posto', p.proximoPostoNome || '—'], ['Promoção', p.promocao?.elegivel ? 'Em condições' : 'Não reúne as condições'],
    ], y)
  } else {
    y = secao('Carreira (pessoal civil)', [['Categoria', p.carreiraNome || '—'], ['Classe', p.categoriaCivil || '—'], ['Vínculo', p.vinculoCivilNome || '—'], ['Admissão', pt(p.dataAdmissao)], ['Na classe desde', pt(p.dataCategoria)], ['Classe seguinte', p.proximaCategoria || '—']], y)
  }
  const tabela = (titulo, cab, corpo) => {
    if (!corpo.length) return
    autoTable(doc, { startY: y, head: [[{ content: titulo, colSpan: cab.length }], cab], body: corpo, theme: 'striped', styles: { fontSize: 7.5, cellPadding: 1.4 }, headStyles: { fillColor: [31, 58, 45] }, margin: { left: 14, right: 14 } })
    y = doc.lastAutoTable.finalY + 4
  }
  tabela('Histórico', ['Data', 'Registo', 'Descrição', 'Documento'], p.eventos.map((e) => [pt(e.data), e.tipoNome, [e.postoNovoNome && `${e.postoAnteriorNome ? `${e.postoAnteriorNome} → ` : ''}${e.postoNovoNome}`, e.cargoNome, e.descricao].filter(Boolean).join(' · '), e.documento]))
  tabela('Cursos', ['Curso', 'Local', 'Fim', 'Resultado'], p.cursos.map((c) => [c.nome + (c.chaveNome ? ` (${c.chaveNome})` : ''), c.local, pt(c.fim), c.aproveitamento === false ? 'Sem aproveitamento' : c.classificacao ? `${c.classificacao} valores` : 'Com aproveitamento']))
  tabela('Graduações', ['Posto', 'Início', 'Fim', 'Estado'], p.graduacoes.map((g) => [g.postoNome, pt(g.inicio), pt(g.fim), g.ativa ? 'Em curso' : 'Terminada']))
  tabela('Licenças', ['Tipo', 'Início', 'Fim', 'Dias'], p.licencas.map((l) => [l.tipoNome ?? l.tipo, pt(l.inicio), pt(l.fim), String(l.dias)]))

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7).setTextColor(120).text(`Documento interno — emitido em ${new Date().toLocaleString('pt-PT')}`, 14, h - 7)
    doc.text(`Página ${i} de ${n}`, w - 14, h - 7, { align: 'right' })
  }
  doc.save(`ficha-${(p.nip || p.numeroAgente || p.id).toString().replace(/[^\w-]/g, '')}.pdf`)
  api('/auditoria/exportacao', { metodo: 'POST', corpo: { tabela: `Ficha individual: ${p.nome}`.slice(0, 120), formato: 'pdf', linhas: 1 } }).catch(() => {})
}

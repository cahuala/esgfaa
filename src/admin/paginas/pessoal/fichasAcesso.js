import { t as tx } from '../../../i18n/linguas'

/*
  Fichas de acesso ao Portal Académico (PDF A4, quatro por página, para recortar): nome, número, e-mail e a
  palavra-passe inicial, que o sistema só mostra uma vez. A Repartição entrega a ficha em mão; o portal
  obriga a mudar a palavra-passe na primeira entrada.
  pessoas: [{ nome, numero, email, senhaInicial }]
*/
export async function imprimirFichas(pessoas) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const portal = `${window.location.origin}/portal/`
  const altura = 297 / 4
  pessoas.forEach((p, i) => {
    if (i && i % 4 === 0) doc.addPage()
    const y = (i % 4) * altura
    doc.setLineDashPattern([1.5, 1.5], 0)
    doc.setDrawColor(150)
    if (i % 4) doc.line(8, y, 202, y)
    doc.setLineDashPattern([], 0)
    doc.setDrawColor(0)
    doc.roundedRect(15, y + 8, 180, altura - 16, 2, 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(tx('Escola Superior de Guerra — Portal Académico'), 20, y + 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(tx('Ficha de acesso (pessoal e intransmissível)'), 20, y + 21)
    const linha = (rotulo, valor, yy, grande = false) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(rotulo, 20, yy)
      doc.setFont(grande ? 'courier' : 'helvetica', 'bold')
      doc.setFontSize(grande ? 15 : 10.5)
      doc.text(String(valor ?? '—'), 62, yy)
    }
    linha(tx('Nome'), p.nome, y + 30)
    linha(tx('Número'), p.numero, y + 36)
    linha(tx('E-mail (entrada)'), p.email, y + 42)
    linha(tx('Palavra-passe inicial'), p.senhaInicial, y + 50, true)
    linha(tx('Endereço'), portal, y + 57)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize(tx('Na primeira entrada, o portal pede uma palavra-passe nova, só sua. Não partilhe esta ficha; destrua-a depois de entrar. Problemas no acesso: Repartição de Pessoal e Quadros.'), 170), 20, y + 63)
  })
  doc.save(pessoas.length === 1 ? `ficha-de-acesso-${pessoas[0].numero}.pdf` : `fichas-de-acesso-${pessoas.length}.pdf`)
}

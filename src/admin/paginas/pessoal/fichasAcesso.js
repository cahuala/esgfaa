import { t as tx } from '../../../i18n/linguas'
import Logo from '../../../assets/Logo.png'

/*
  Fichas de acesso ao Portal Académico (PDF A4, quatro por página, para recortar), com a cara do sistema:
  faixa escura com o símbolo da Escola, a risca vermelho-preto-dourado e a palavra-passe em destaque.
  Nome, número, e-mail e a palavra-passe inicial, que o sistema só mostra uma vez. A Repartição entrega a
  ficha em mão; o portal obriga a mudar a palavra-passe na primeira entrada.
  pessoas: [{ nome, numero, email, senhaInicial }]; portal: o endereço do portal (por omissão, o deste site)
*/
const COR = { escuro: [29, 33, 37], vermelho: [229, 57, 23], dourado: [201, 162, 39], texto: [33, 37, 41], suave: [108, 117, 125], tinte: [253, 236, 232] }

// o símbolo da Escola, pequeno (o original é grande e repetia-se em cada ficha)
let simbolo
function carregarSimbolo() {
  simbolo ??= new Promise((ok) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 240 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      ok({ url: c.toDataURL('image/png'), proporcao: img.width / img.height })
    }
    img.onerror = () => ok(null)
    img.src = Logo
  })
  return simbolo
}

export async function imprimirFichas(pessoas, { portal = `${window.location.origin}/portal/` } = {}) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), carregarSimbolo()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const altura = 297 / 4
  const x = 15
  const largura = 180
  const cor = (tipo, c) => (tipo === 'f' ? doc.setFillColor(...c) : tipo === 'd' ? doc.setDrawColor(...c) : doc.setTextColor(...c))

  pessoas.forEach((p, i) => {
    if (i && i % 4 === 0) doc.addPage()
    const y = (i % 4) * altura + 6
    const h = altura - 12

    // linha de corte entre fichas
    if (i % 4) {
      doc.setLineDashPattern([1.5, 1.5], 0)
      cor('d', [170, 170, 170])
      doc.setLineWidth(0.2)
      doc.line(8, y - 6, 202, y - 6)
      doc.setLineDashPattern([], 0)
    }

    // cartão
    cor('d', [222, 226, 230])
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, largura, h, 2.5, 2.5)

    // faixa escura com o símbolo e o nome da Escola
    const faixa = 14
    cor('f', COR.escuro)
    doc.roundedRect(x, y, largura, faixa, 2.5, 2.5, 'F')
    doc.rect(x, y + faixa - 3, largura, 3, 'F')
    if (logo) doc.addImage(logo.url, 'PNG', x + 4, y + 2, 10 * logo.proporcao, 10)
    const tx0 = x + 6 + (logo ? 10 * logo.proporcao : 0)
    cor('t', [255, 255, 255])
    doc.setFont('helvetica', 'bold').setFontSize(11.5)
    doc.text(tx('ESCOLA SUPERIOR DE GUERRA'), tx0, y + 6.6)
    cor('t', COR.dourado)
    doc.setFont('helvetica', 'bold').setFontSize(7.5)
    doc.text(tx('PORTAL ACADÉMICO · FICHA DE ACESSO'), tx0, y + 10.8, { charSpace: 0.3 })
    cor('t', [200, 200, 200])
    doc.setFont('helvetica', 'normal').setFontSize(7)
    doc.text(tx('Pessoal e intransmissível'), x + largura - 4, y + 6.6, { align: 'right' })
    doc.text(new Date().toLocaleDateString('pt-PT'), x + largura - 4, y + 10.8, { align: 'right' })

    // risca vermelho · preto · dourado (como no cabeçalho do sistema)
    const terco = largura / 3
    ;[COR.vermelho, [0, 0, 0], COR.dourado].forEach((c, k) => { cor('f', c); doc.rect(x + k * terco, y + faixa, terco, 1.1, 'F') })

    // dados da pessoa (à esquerda)
    const campo = (rotulo, valor, yy) => {
      cor('t', COR.suave)
      doc.setFont('helvetica', 'bold').setFontSize(6.8)
      doc.text(rotulo.toUpperCase(), x + 6, yy, { charSpace: 0.2 })
      cor('t', COR.texto)
      doc.setFont('helvetica', 'bold').setFontSize(10.5)
      doc.text(doc.splitTextToSize(String(valor ?? '—'), 98)[0], x + 6, yy + 4.6)
    }
    const yc = y + faixa + 7
    campo(tx('Nome'), p.nome, yc)
    campo(tx('Número'), p.numero, yc + 11)
    campo(tx('E-mail (para entrar)'), p.email, yc + 22)

    // a palavra-passe em destaque (à direita)
    const bx = x + 110
    const bw = largura - 116
    cor('f', COR.tinte)
    cor('d', COR.vermelho)
    doc.setLineWidth(0.4)
    doc.roundedRect(bx, yc - 3, bw, 24, 2, 2, 'FD')
    cor('t', COR.vermelho)
    doc.setFont('helvetica', 'bold').setFontSize(6.8)
    doc.text(tx('PALAVRA-PASSE INICIAL'), bx + bw / 2, yc + 2.5, { align: 'center', charSpace: 0.3 })
    cor('t', COR.texto)
    doc.setFont('courier', 'bold').setFontSize(16)
    doc.text(String(p.senhaInicial ?? '—'), bx + bw / 2, yc + 11.5, { align: 'center' })
    cor('t', COR.suave)
    doc.setFont('helvetica', 'normal').setFontSize(6.8)
    doc.text(tx('Muda-se na primeira entrada'), bx + bw / 2, yc + 17.5, { align: 'center' })

    // endereço do portal
    cor('t', COR.suave)
    doc.setFont('helvetica', 'bold').setFontSize(6.8)
    doc.text(tx('ENDEREÇO'), bx, yc + 26, { charSpace: 0.2 })
    cor('t', COR.vermelho)
    doc.setFont('helvetica', 'bold').setFontSize(9)
    doc.text(doc.splitTextToSize(portal, bw)[0], bx, yc + 30.5)

    // rodapé
    cor('d', [233, 236, 239])
    doc.setLineWidth(0.2)
    doc.line(x + 6, y + h - 10, x + largura - 6, y + h - 10)
    cor('t', COR.suave)
    doc.setFont('helvetica', 'normal').setFontSize(7)
    doc.text(doc.splitTextToSize(tx('Na primeira entrada, o portal pede uma palavra-passe nova, só sua. Não partilhe esta ficha; destrua-a depois de entrar. Problemas no acesso: Repartição de Pessoal e Quadros.'), largura - 12), x + 6, y + h - 6.2)
  })
  doc.save(pessoas.length === 1 ? `ficha-de-acesso-${pessoas[0].numero}.pdf` : `fichas-de-acesso-${pessoas.length}.pdf`)
}

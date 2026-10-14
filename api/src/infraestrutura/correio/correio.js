import nodemailer from 'nodemailer'

/*
  Envio de e-mails do portal. Com SMTP_URL configurado usa esse servidor (smtp:// ou smtps://);
  sem ele, guarda os e-mails em memória (desenvolvimento e testes) — nada sai do servidor.
*/
export function criarCorreio({ smtp, remetente, registar = () => {} }) {
  if (!smtp) return new CorreioEmMemoria()
  const transporte = nodemailer.createTransport(smtp)
  return {
    real: true,
    async enviar({ para, assunto, texto, html }) {
      try {
        await transporte.sendMail({ from: remetente, to: para, subject: assunto, text: texto, html })
        return true
      } catch (erro) {
        registar({ nivel: 'erro', mensagem: 'Falha ao enviar e-mail', para, erro: erro.message })
        return false
      }
    },
  }
}

export class CorreioEmMemoria {
  constructor() {
    this.real = false
    this.enviados = []
  }

  async enviar(mensagem) {
    this.enviados.push(mensagem)
    if (this.enviados.length > 500) this.enviados.shift()
    return true
  }
}

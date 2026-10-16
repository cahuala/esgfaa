import { ErroValidacao } from '../comum/erros.js'
import { limparTexto } from '../comum/texto.js'

export const ESTADOS_CONTACTO = { nova: 'Nova', lida: 'Lida', respondida: 'Respondida' }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// valida uma mensagem do formulário de contacto do site
export function novaMensagemContacto({ nome, email, telefone, assunto, mensagem, consentimento }) {
  const n = limparTexto(nome).replace(/\s+/g, ' ')
  const e = limparTexto(email).toLowerCase()
  const tel = limparTexto(telefone)
  const a = limparTexto(assunto).replace(/\s+/g, ' ')
  const m = limparTexto(mensagem)
  if (n.length < 2 || n.length > 120) throw new ErroValidacao('Indique o seu nome.', { campo: 'nome' })
  if (!EMAIL.test(e) || e.length > 254) throw new ErroValidacao('Indique um e-mail válido, para lhe podermos responder.', { campo: 'email' })
  if (tel && !/^[+\d][\d\s()-]{5,30}$/.test(tel)) throw new ErroValidacao('O telefone não parece válido.', { campo: 'telefone' })
  if (a.length > 200) throw new ErroValidacao('O assunto tem até 200 caracteres.', { campo: 'assunto' })
  if (m.length < 10 || m.length > 5000) throw new ErroValidacao('A mensagem deve ter entre 10 e 5000 caracteres.', { campo: 'mensagem' })
  if ((m.match(/https?:\/\//gi) || []).length > 3) throw new ErroValidacao('A mensagem tem demasiadas ligações.', { campo: 'mensagem' })
  if (consentimento !== true) throw new ErroValidacao('Para enviar, aceite que a Escola use estes dados para lhe responder.', { campo: 'consentimento' })
  return { nome: n, email: e, telefone: tel, assunto: a || 'Sem assunto', mensagem: m }
}

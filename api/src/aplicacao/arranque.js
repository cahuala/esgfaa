import crypto from 'node:crypto'
import { motivoSenhaFraca } from '../dominio/identidade/politicaSenha.js'
import { ADMINISTRADOR } from '../dominio/identidade/permissoes.js'
import { Utilizador } from '../dominio/identidade/utilizador.js'

// palavra-passe aleatória legível (sem caracteres ambíguos), sempre com letras e números
export function gerarSenha(tamanho = 16) {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const numeros = '23456789'
  const todos = letras + numeros
  const escolher = (s) => s[crypto.randomInt(s.length)]
  const partes = [escolher(letras), escolher(numeros), ...Array.from({ length: tamanho - 2 }, () => escolher(todos))]
  for (let i = partes.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [partes[i], partes[j]] = [partes[j], partes[i]]
  }
  return partes.join('')
}

/*
  Preparação da base de dados no arranque:
  papéis por omissão e, na primeira vez, o administrador inicial.
  Devolve { administradorCriado: { email, senha, gerada } } para a mensagem de arranque.
*/
export async function prepararSistema({ servicos, repositorios, cifra, config }) {
  servicos.papeis.garantirPadrao()
  if (repositorios.utilizadores.contar() > 0) return {}

  const { nome, email } = config.administrador
  let senha = config.administrador.senha
  const gerada = !senha
  if (gerada) senha = gerarSenha()
  const motivo = motivoSenhaFraca(senha, { email, nome })
  if (motivo && config.producao) throw new Error(`ADMIN_PASSWORD fraca: ${motivo}`)

  const admin = Utilizador.novo({ nome, email, papel: ADMINISTRADOR, senhaCifrada: await cifra.cifrar(senha), deveMudarSenha: gerada || Boolean(motivo) })
  repositorios.utilizadores.criar(admin)
  return { administradorCriado: { email: admin.email, senha: gerada ? senha : null, gerada } }
}

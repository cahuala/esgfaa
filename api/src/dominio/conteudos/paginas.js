import { ErroValidacao } from '../comum/erros.js'
import { validarUrls } from '../comum/urls.js'
import { verificarEstrutura } from '../comum/estrutura.js'

export const PAGINAS = ['home', 'institucional', 'contactos', 'cursos']

export function validarPagina(chave, dados) {
  if (!PAGINAS.includes(chave)) throw new ErroValidacao('Página desconhecida.')
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new ErroValidacao('Dados inválidos.')
  verificarEstrutura(dados)
  if (JSON.stringify(dados).length > 500_000) throw new ErroValidacao('O conteúdo da página é demasiado grande.')
  validarUrls(dados)
  return dados
}

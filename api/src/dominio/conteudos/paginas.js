import { ErroValidacao } from '../comum/erros.js'
import { validarUrls } from '../comum/urls.js'

export const PAGINAS = ['home', 'institucional', 'contactos', 'cursos']

export function validarPagina(chave, dados) {
  if (!PAGINAS.includes(chave)) throw new ErroValidacao('Página desconhecida.')
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new ErroValidacao('Dados inválidos.')
  if (JSON.stringify(dados).length > 500_000) throw new ErroValidacao('O conteúdo da página é demasiado grande.')
  validarUrls(dados)
  return dados
}

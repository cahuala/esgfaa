// erros com código estável; a camada HTTP traduz o código para o estado HTTP
export class ErroDominio extends Error {
  constructor(mensagem, codigo = 'validacao', detalhes) {
    super(mensagem)
    this.codigo = codigo
    this.detalhes = detalhes
  }
}
export const invalido = (mensagem, campo) => new ErroDominio(mensagem, 'validacao', campo ? { campo } : undefined)
export const naoEncontrado = (mensagem = 'Não encontrado.') => new ErroDominio(mensagem, 'nao_encontrado')
export const semPermissao = (mensagem = 'Não tem permissão para esta ação.') => new ErroDominio(mensagem, 'sem_permissao')
export const naoAutenticado = (mensagem = 'Sessão em falta. Entre novamente.') => new ErroDominio(mensagem, 'nao_autenticado')
export const conflito = (mensagem) => new ErroDominio(mensagem, 'conflito')

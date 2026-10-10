import { SemPermissao } from '../comum/erros.js'

/*
  Regras de publicação:
  - quem não tem "{colecao}.publicar" só guarda rascunhos e não altera conteúdos já publicados;
  - quem pode publicar escolhe o estado (por omissão mantém o atual, ou publica se for novo).
*/
export function estadoFinal({ actor, colecao, pedido, atual = null }) {
  if (!actor.pode(`${colecao}.publicar`)) return atual === 'publicado' ? 'publicado' : 'rascunho'
  if (pedido === 'rascunho' || pedido === 'publicado') return pedido
  return atual || 'publicado'
}

export function garantirPodeEditar({ actor, colecao, atual, pedido }) {
  const podePublicar = actor.pode(`${colecao}.publicar`)
  if (atual === 'publicado' && !podePublicar) {
    throw new SemPermissao('Este conteúdo já está publicado. Só quem tem permissão de publicar o pode alterar.')
  }
  // quem só pode publicar (sem editar) pode mudar o estado, mas não os dados
  if (!actor.pode(`${colecao}.editar`) && !podePublicar) throw new SemPermissao()
  if (!actor.pode(`${colecao}.editar`) && pedido === atual) throw new SemPermissao('Não tem permissão para editar este conteúdo.')
}

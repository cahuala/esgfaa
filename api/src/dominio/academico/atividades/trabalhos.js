// Trabalhos: forma de entrega, prazos, atrasos e prorrogações.

export const TIPOS_ENTREGA = { ficheiro: 'Ficheiros', texto: 'Texto escrito no portal', ambos: 'Ficheiros e texto' }

/*
  Estado de um trabalho para um estudante:
  aberto (pode entregar), atrasado (fora de prazo mas aceita atrasos), fechado.
*/
export function estadoPrazo(prazo, agora, aceitaAtraso) {
  if (agora <= new Date(prazo)) return 'aberto'
  return aceitaAtraso ? 'atrasado' : 'fechado'
}

export const entregaAtrasada = (entregueEm, prazo) => new Date(entregueEm) > new Date(prazo)

// prazo de um estudante: o do trabalho, ou o da prorrogação que lhe foi dada
export const prazoDe = (trabalho, prorrogacao) => (prorrogacao ? prorrogacao.prazo : trabalho.prazo)

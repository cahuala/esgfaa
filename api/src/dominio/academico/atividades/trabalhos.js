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

/*
  Fluxo de correção: com notas ocultas (ou correção anónima, que as oculta também), o estudante só vê
  a nota, o comentário e o ficheiro corrigido depois de o docente libertar as notas de todos de uma vez.
*/
export const notasDoTrabalhoVisiveis = (t) => !(t.notasOcultas || t.anonimo) || Boolean(t.notasLibertadasEm)
export const semCorrecao = (e) => e && { ...e, nota: null, correcao: '', correcaoFicheiroId: null, grelha: {}, anotacoes: {}, corrigidaEm: null }

// prazo de um estudante: o do trabalho, ou o da prorrogação que lhe foi dada
export const prazoDe = (trabalho, prorrogacao) => (prorrogacao ? prorrogacao.prazo : trabalho.prazo)

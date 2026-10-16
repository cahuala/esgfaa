/*
  Emblemas (como os "badges" do Moodle), calculados a partir do progresso, sem nada a configurar:
  - primeiros passos: a primeira atividade feita na cadeira;
  - capítulo concluído: todas as atividades de um capítulo;
  - cadeira concluída: todas as atividades da cadeira;
  - sempre a tempo: todos os trabalhos entregues dentro do prazo (pelo menos dois).
  Cada emblema diz se já foi ganho e quanto falta.
*/
export const TIPOS_EMBLEMA = {
  inicio: { nome: 'Primeiros passos', icone: 'fa-shoe-prints' },
  capitulo: { nome: 'Capítulo concluído', icone: 'fa-bookmark' },
  cadeira: { nome: 'Cadeira concluída', icone: 'fa-medal' },
  pontual: { nome: 'Sempre a tempo', icone: 'fa-stopwatch' },
}

export function calcularEmblemas({ cadeira, secoes = [], itens = [], pontualidade = [] }) {
  if (!itens.length) return []
  const r = []
  const novo = (tipo, chave, titulo, descricao, feitas, total) => r.push({
    id: `${cadeira.id}-${chave}`, tipo, titulo, descricao, cadeira, ganho: feitas >= total, feitas: Math.min(feitas, total), total,
  })
  const feitas = itens.filter((i) => i.feita).length
  novo('inicio', 'inicio', 'Primeiros passos', `Fez a primeira atividade de ${cadeira.nome}.`, Math.min(feitas, 1), 1)
  for (const s of secoes) {
    const doCapitulo = itens.filter((i) => i.secaoId === s.id)
    if (!doCapitulo.length) continue
    novo('capitulo', `capitulo-${s.id}`, s.titulo, `Concluiu todas as atividades de «${s.titulo}».`, doCapitulo.filter((i) => i.feita).length, doCapitulo.length)
  }
  novo('cadeira', 'cadeira', `${cadeira.nome}`, `Concluiu todas as atividades da cadeira.`, feitas, itens.length)
  if (pontualidade.length >= 2) {
    novo('pontual', 'pontual', 'Sempre a tempo', `Entregou todos os trabalhos de ${cadeira.nome} dentro do prazo.`,
      pontualidade.filter((p) => p.aTempo).length, pontualidade.length)
    // um trabalho entregue com atraso não se recupera: o emblema deixa de estar ao alcance
    if (pontualidade.some((p) => p.entregue && !p.aTempo)) r.at(-1).perdido = true
  }
  return r
}

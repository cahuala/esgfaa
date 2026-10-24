/*
  Vídeos curtos das actividades realizadas (site e Portal): cada evento ou notícia com «Vídeos curtos»
  é um círculo da fila; os eventos ainda por acontecer ficam de fora. Do mais recente para o mais antigo.
*/
const hojeIso = () => new Date().toISOString().slice(0, 10)

export function gruposDoSite({ eventos = [], noticias = [] } = {}, hoje = hojeIso()) {
  const grupo = (x, tipo, chave) => ({
    id: `${tipo}-${x[chave]}`,
    titulo: x.titulo,
    subtitulo: x.categoria,
    capa: x.capa,
    data: x.data || '',
    ligacao: tipo === 'evento' ? `/Eventos/${x[chave]}` : `/Noticias/${x[chave]}`,
    itens: (x.videosCurtos || []).filter((v) => v?.src).map((v, i) => ({ id: `${tipo}-${x[chave]}-${i}-${v.src.split('/').pop()}`, src: v.src, poster: v.poster || x.capa, legenda: v.legenda, data: x.data })),
  })
  return [
    ...eventos.filter((e) => !e.data || e.data <= hoje).map((e) => grupo(e, 'evento', 'id')),
    ...noticias.map((n) => grupo(n, 'noticia', 'slug')),
  ].filter((g) => g.itens.length).sort((a, b) => b.data.localeCompare(a.data))
}

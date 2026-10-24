/*
  Actividades realizadas como os estados do WhatsApp (site e Portal): cada evento já realizado é um círculo
  da fila. Mostra os vídeos da actividade («Vídeos curtos» e os vídeos carregados no texto); sem vídeos,
  mostra as fotografias (a imagem principal, as imagens e as galerias), cada uma alguns segundos.
  As notícias entram só quando têm vídeos. Da mais recente para a mais antiga.
*/
const hojeIso = () => new Date().toISOString().slice(0, 10)
const MAX_EVENTOS = 15
const MAX_FOTOS = 6

function videosDe(x) {
  const doTexto = (x.conteudo || []).filter((b) => b?.tipo === 'video' && b.src && !b.youtube).map((b) => ({ src: b.src, poster: b.poster, legenda: b.legenda }))
  return [...(x.videosCurtos || []).filter((v) => v?.src), ...doTexto]
}

function fotosDe(x) {
  const l = [{ src: x.capa, legenda: x.resumo }]
  for (const b of x.conteudo || []) {
    if (b?.tipo === 'imagem') l.push({ src: b.src, legenda: b.legenda })
    if (b?.tipo === 'galeria') l.push(...(b.imagens || []).map((i) => ({ src: i.src, legenda: i.legenda || b.legenda })))
  }
  const vistas = new Set()
  return l.filter((f) => f.src && !vistas.has(f.src) && vistas.add(f.src)).slice(0, MAX_FOTOS)
}

export function gruposDoSite({ eventos = [], noticias = [] } = {}, hoje = hojeIso()) {
  const grupo = (x, tipo, chave, { comFotos }) => {
    const base = `${tipo}-${x[chave]}`
    const nome = (src) => String(src).split('/').pop()
    const videos = videosDe(x).map((v, i) => ({ id: `${base}-${i}-${nome(v.src)}`, src: v.src, poster: v.poster || x.capa, legenda: v.legenda, data: x.data }))
    const fotos = !videos.length && comFotos ? fotosDe(x).map((f, i) => ({ id: `${base}-f${i}-${nome(f.src)}`, imagem: true, src: f.src, legenda: f.legenda, data: x.data })) : []
    return {
      id: base, titulo: x.titulo, subtitulo: x.categoria, capa: x.capa, data: x.data || '',
      ligacao: tipo === 'evento' ? `/Eventos/${x[chave]}` : `/Noticias/${x[chave]}`,
      itens: videos.length ? videos : fotos,
    }
  }
  const realizados = eventos.filter((e) => e.data && e.data <= hoje).sort((a, b) => b.data.localeCompare(a.data)).slice(0, MAX_EVENTOS)
  return [
    ...realizados.map((e) => grupo(e, 'evento', 'id', { comFotos: true })),
    ...noticias.map((n) => grupo(n, 'noticia', 'slug', { comFotos: false })),
  ].filter((g) => g.itens.length).sort((a, b) => b.data.localeCompare(a.data))
}

import { describe, expect, it } from 'vitest'
import { gruposDoSite } from '../../src/utils/videosDoSite'

describe('actividades realizadas em vídeo (site)', () => {
  it('um círculo por actividade com vídeos, da mais recente; os eventos futuros e os sem vídeo ficam de fora', () => {
    const v = (src, legenda) => ({ src, legenda })
    const g = gruposDoSite({
      eventos: [
        { id: 'cerimonia', titulo: 'Cerimónia', categoria: 'Cerimónia', data: '2026-10-15', capa: '/c.webp', videosCurtos: [v('/uploads/a.mp4', 'Chegada'), v('/uploads/b.mp4')] },
        { id: 'futuro', titulo: 'Ainda não', data: '2026-12-01', videosCurtos: [v('/uploads/x.mp4')] },
        { id: 'sem', titulo: 'Sem vídeos', data: '2026-10-01' },
      ],
      noticias: [{ slug: 'visita', titulo: 'Visita', data: '2026-10-20', videosCurtos: [v('/uploads/n.mp4'), { legenda: 'sem ficheiro' }] }],
    }, '2026-10-24')
    expect(g.map((x) => [x.id, x.itens.length, x.ligacao])).toEqual([['noticia-visita', 1, '/Noticias/visita'], ['evento-cerimonia', 2, '/Eventos/cerimonia']])
    expect(g[1].itens[0]).toMatchObject({ src: '/uploads/a.mp4', poster: '/c.webp', legenda: 'Chegada' })
  })
})

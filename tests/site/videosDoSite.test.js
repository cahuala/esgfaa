import { describe, expect, it } from 'vitest'
import { gruposDoSite } from '../../src/utils/videosDoSite'

describe('actividades realizadas como os estados do WhatsApp (site)', () => {
  const v = (src, legenda) => ({ src, legenda })
  const dados = {
    eventos: [
      { id: 'cerimonia', titulo: 'Cerimónia', categoria: 'Cerimónia', data: '2026-10-15', capa: '/c.webp', videosCurtos: [v('/uploads/a.mp4', 'Chegada'), v('/uploads/b.mp4')] },
      { id: 'futuro', titulo: 'Ainda não', data: '2026-12-01', capa: '/f.webp', videosCurtos: [v('/uploads/x.mp4')] },
      {
        id: 'conferencia', titulo: 'Conferência', data: '2026-10-08', capa: '/conf.webp', resumo: 'Painel de oradores',
        conteudo: [{ tipo: 'galeria', imagens: [{ src: '/g1.webp', legenda: 'Abertura' }, { src: '/conf.webp' }] }, { tipo: 'imagem', src: '/i1.webp' }],
      },
      { id: 'sem-nada', titulo: 'Sem imagem', data: '2026-10-01' },
    ],
    noticias: [
      { slug: 'visita', titulo: 'Visita', data: '2026-10-20', conteudo: [{ tipo: 'video', src: '/uploads/n.mp4', legenda: 'No quartel' }] },
      { slug: 'so-fotos', titulo: 'Só fotos', data: '2026-10-21', capa: '/n.webp' },
    ],
  }

  it('eventos realizados e notícias (recentes, em destaque ou com vídeo), da mais recente; os futuros e os vazios ficam de fora', () => {
    const g = gruposDoSite(dados, '2026-10-24')
    expect(g.map((x) => [x.id, x.itens.length, x.ligacao])).toEqual([
      ['noticia-so-fotos', 1, '/Noticias/so-fotos'],
      ['noticia-visita', 1, '/Noticias/visita'],
      ['evento-cerimonia', 2, '/Eventos/cerimonia'],
      ['evento-conferencia', 3, '/Eventos/conferencia'],
    ])
    expect(g[2].itens[0]).toMatchObject({ src: '/uploads/a.mp4', poster: '/c.webp', legenda: 'Chegada' })
    expect(g[1].itens[0]).toMatchObject({ src: '/uploads/n.mp4', legenda: 'No quartel' })
  })

  it('as notícias antigas sem destaque nem vídeo ficam de fora', () => {
    const muitas = Array.from({ length: 8 }, (_, i) => ({ slug: `n${i}`, titulo: `N${i}`, data: `2026-09-0${i + 1}`, capa: `/n${i}.webp`, destaque: i === 0 }))
    const ids = gruposDoSite({ noticias: muitas }, '2026-10-24').map((x) => x.id)
    expect(ids).toEqual(['noticia-n7', 'noticia-n6', 'noticia-n5', 'noticia-n4', 'noticia-n3', 'noticia-n2', 'noticia-n0'])
  })

  it('sem vídeos, o evento mostra as fotografias (capa, galeria, imagens) sem repetir', () => {
    const conf = gruposDoSite(dados, '2026-10-24').find((x) => x.id === 'evento-conferencia')
    expect(conf.itens.map((i) => [i.imagem, i.src, i.legenda])).toEqual([[true, '/conf.webp', 'Painel de oradores'], [true, '/g1.webp', 'Abertura'], [true, '/i1.webp', undefined]])
  })
})

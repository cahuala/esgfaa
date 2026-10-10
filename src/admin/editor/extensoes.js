import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { VistaFigura, VistaGaleria, VistaVideo } from './vistas'

/*
  Elementos que vivem dentro do texto. São "átomos" arrastáveis: podem ser colocados
  em qualquer ponto do documento (inserir no cursor, arrastar, largar ficheiros).
  O HTML gerado é o mesmo que o site mostra (ver ConteudoRico).
*/

const dado = (el, nome) => el.getAttribute(`data-${nome}`) || ''
const atributo = (padrao, ler) => ({ default: padrao, parseHTML: ler, rendered: false })

// ---------- imagem ----------

export const Figura = Node.create({
  name: 'figura',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { aoErro: () => {} }
  },

  addAttributes() {
    return {
      src: atributo('', (el) => el.querySelector('img')?.getAttribute('src') || ''),
      legenda: atributo('', (el) => el.querySelector('figcaption')?.textContent || ''),
      posicao: atributo('centro', (el) => dado(el, 'posicao') || 'centro'),
      largura: atributo(null, (el) => Number(dado(el, 'largura')) || null),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-tipo="imagem"]' }]
  },

  renderHTML({ node }) {
    const { src, legenda, posicao, largura } = node.attrs
    const larg = posicao === 'larga' ? null : largura || (['esquerda', 'direita'].includes(posicao) ? 45 : null)
    return [
      'figure',
      { 'data-tipo': 'imagem', 'data-posicao': posicao, 'data-largura': larg ?? undefined, style: larg ? `width:${larg}%` : undefined },
      ['img', { src, alt: legenda }],
      ...(legenda ? [['figcaption', {}, legenda]] : []),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaFigura)
  },
})

// ---------- galeria ----------

export const Galeria = Node.create({
  name: 'galeria',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { aoErro: () => {} }
  },

  addAttributes() {
    return {
      imagens: atributo([], (el) => [...el.querySelectorAll('figure')].map((f) => ({
        src: f.querySelector('img')?.getAttribute('src') || '',
        legenda: f.querySelector('figcaption')?.textContent || '',
      }))),
      legenda: atributo('', (el) => dado(el, 'legenda')),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-tipo="galeria"]' }]
  },

  renderHTML({ node }) {
    const { imagens, legenda } = node.attrs
    return [
      'div',
      { 'data-tipo': 'galeria', 'data-colunas': String(Math.min(3, Math.max(2, imagens.length))), 'data-legenda': legenda || undefined },
      ...imagens.map((i) => ['figure', {}, ['img', { src: i.src, alt: i.legenda || '' }], ...(i.legenda ? [['figcaption', {}, i.legenda]] : [])]),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaGaleria)
  },
})

// ---------- vídeo ----------

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { aoErro: () => {} }
  },

  addAttributes() {
    return {
      youtube: atributo('', (el) => dado(el, 'youtube')),
      src: atributo('', (el) => dado(el, 'src')),
      poster: atributo('', (el) => dado(el, 'poster')),
      legenda: atributo('', (el) => el.querySelector('figcaption')?.textContent || ''),
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-tipo="video"]' }]
  },

  renderHTML({ node }) {
    const { youtube, src, poster, legenda } = node.attrs
    const meio = youtube
      ? ['iframe', { src: `https://www.youtube-nocookie.com/embed/${youtube}`, title: legenda || 'Vídeo', allowfullscreen: 'true', loading: 'lazy' }]
      : ['video', { src, poster: poster || undefined, controls: 'true', preload: 'metadata' }]
    return [
      'figure',
      { 'data-tipo': 'video', 'data-youtube': youtube, 'data-src': src, 'data-poster': poster },
      ['div', { class: 'video' }, meio],
      ...(legenda ? [['figcaption', {}, legenda]] : []),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VistaVideo)
  },
})

// ---------- caixa de destaque (contém texto editável) ----------

export const CaixaDestaque = Node.create({
  name: 'caixaDestaque',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'aside[data-tipo="destaque"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-tipo': 'destaque' }), 0]
  },

  addCommands() {
    return {
      alternarDestaque: () => ({ commands, editor }) => (editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name)),
    }
  },
})

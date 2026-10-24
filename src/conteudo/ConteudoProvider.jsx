import { useEffect, useMemo, useState } from 'react'
import { ConteudoContexto } from './contexto'
import { pedido } from './api'
import { useIdioma } from '../i18n/contexto'
import { aplicarTextos } from '../i18n/aplicar'
import noticias from '../data/noticias'
import artigos from '../data/artigos'
import eventos from '../data/eventos'
import cursos from '../data/cursos'
import pessoas from '../data/pessoas'
import revistas from '../data/revistas'
import paginas from '../data/paginas'
import publicidade from '../data/publicidade'

// conteúdos que vêm com o site: usados até a API responder, ou se ela estiver indisponível
const LOCAL = { noticias, artigos, eventos, cursos, pessoas, revistas, paginas, publicidade, estatisticas: {} }

/*
  As imagens do carregamento inicial existem duas vezes: no site (/assets/Curso1-hash.webp) e na API
  (/uploads/seed/curso1.webp, a cópia feita por api/scripts/semear.js). Quando a API responde, os conteúdos
  passam a usar as do site, que o navegador já descarregou — cada fotografia descarrega-se uma só vez.
  As imagens carregadas no painel não estão no site e vêm da API como sempre.
*/
// o mesmo nome que dá o carregamento inicial (api/scripts/nomes.js): "Escola De Guerra.webp" -> "escola-de-guerra.webp"
const nomeSemente = (f) => f.slice(0, f.lastIndexOf('.')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + f.slice(f.lastIndexOf('.')).toLowerCase()
const DO_SITE = Object.fromEntries(Object.entries(import.meta.glob('../assets/*.{webp,jpg,jpeg,png}', { eager: true, query: '?url', import: 'default' }))
  .map(([caminho, url]) => [nomeSemente(caminho.split('/').pop()), url]))
function comImagensDoSite(x) {
  if (typeof x === 'string') {
    const m = /\/uploads\/seed\/([^/?#]+)$/.exec(x)
    return m && DO_SITE[m[1]] ? DO_SITE[m[1]] : x
  }
  if (Array.isArray(x)) return x.map(comImagensDoSite)
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, comImagensDoSite(v)]))
  return x
}

function ConteudoProvider({ children }) {
  const [dados, setDados] = useState(LOCAL)
  const [online, setOnline] = useState(false)
  // traduções que vêm com o site (src/data/traducoes.json): só se carregam fora do português
  const [traducoesLocais, setTraducoesLocais] = useState(null)
  const { lingua } = useIdioma()

  useEffect(() => {
    if (lingua === 'pt') return undefined
    let ativo = true
    import('../data/traducoes.json').then((m) => { if (ativo) setTraducoesLocais(m.default) }).catch(() => {})
    return () => { ativo = false }
  }, [lingua])

  useEffect(() => {
    let ativo = true
    pedido('/api/publico/conteudo')
      .then((resposta) => {
        if (!ativo) return
        const remoto = comImagensDoSite(resposta)
        // uma página ainda não guardada na API mantém os valores locais
        const paginasJuntas = Object.fromEntries(
          Object.entries(LOCAL.paginas).map(([k, v]) => [k, remoto.paginas?.[k] || v]),
        )
        setDados({ ...remoto, paginas: paginasJuntas })
        setOnline(true)
      })
      .catch(() => {})
    return () => { ativo = false }
  }, [])

  // conteúdos na língua escolhida: a tradução publicada (se houver) por cima do original;
  // cada item fica com _lingua (a língua em que realmente está) para o site poder avisar
  const traduzidos = useMemo(() => {
    if (lingua === 'pt') return dados
    // as da API, se houver; sem API (ou enquanto não responde), as que vêm com o site
    const fonte = dados.traducoes || traducoesLocais
    const itens = fonte?.itens || {}
    const automaticas = fonte?.automaticas || {}
    const traduzir = (colecao, x, chave) => {
      const tr = itens[`${colecao}/${chave}`]?.[lingua]
      return tr ? { ...aplicarTextos(x, tr), _lingua: lingua, _automatica: Boolean(automaticas[`${colecao}/${chave}`]?.includes(lingua)) } : { ...x, _lingua: 'pt' }
    }
    const r = { ...dados }
    for (const [colecao, campo] of [['noticias', 'slug'], ['artigos', 'slug'], ['eventos', 'id'], ['cursos', 'id'], ['pessoas', 'id'], ['revistas', 'slug']]) {
      r[colecao] = (dados[colecao] || []).map((x) => traduzir(colecao, x, x[campo]))
    }
    r.paginas = Object.fromEntries(Object.entries(dados.paginas || {}).map(([k, v]) => [k, aplicarTextos(v, itens[`paginas/${k}`]?.[lingua])]))
    return r
  }, [dados, lingua, traducoesLocais])

  const valor = useMemo(() => {
    const dados = traduzidos
    const procurar = (lista, campo) => (v) => lista.find((x) => x[campo] === v)
    return {
      ...dados,
      online,
      pessoaPorId: procurar(dados.pessoas, 'id'),
      noticiaPorSlug: procurar(dados.noticias, 'slug'),
      artigoPorSlug: procurar(dados.artigos, 'slug'),
      eventoPorId: procurar(dados.eventos, 'id'),
      cursoPorId: procurar(dados.cursos, 'id'),
      revistaPorSlug: procurar(dados.revistas || [], 'slug'),
      estatisticasDe: (colecao, id) => dados.estatisticas?.[`${colecao}/${id}`] || { gostos: 0, comentarios: 0, visualizacoes: 0 },
      // alteração local depois de um gosto/comentário, sem recarregar tudo
      atualizarEstatisticas: (colecao, id, est) => setDados((d) => ({
        ...d,
        estatisticas: { ...d.estatisticas, [`${colecao}/${id}`]: { ...d.estatisticas?.[`${colecao}/${id}`], ...est } },
      })),
    }
  }, [traduzidos, online])

  return <ConteudoContexto.Provider value={valor}>{children}</ConteudoContexto.Provider>
}

export default ConteudoProvider

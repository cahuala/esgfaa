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
import paginas from '../data/paginas'
import publicidade from '../data/publicidade'

// conteúdos que vêm com o site: usados até a API responder, ou se ela estiver indisponível
const LOCAL = { noticias, artigos, eventos, cursos, pessoas, paginas, publicidade, estatisticas: {} }

function ConteudoProvider({ children }) {
  const [dados, setDados] = useState(LOCAL)
  const [online, setOnline] = useState(false)
  const { lingua } = useIdioma()

  useEffect(() => {
    let ativo = true
    pedido('/api/publico/conteudo')
      .then((remoto) => {
        if (!ativo) return
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
    const itens = dados.traducoes?.itens || {}
    if (lingua === 'pt') return dados
    const traduzir = (colecao, x, chave) => {
      const tr = itens[`${colecao}/${chave}`]?.[lingua]
      return tr ? { ...aplicarTextos(x, tr), _lingua: lingua } : { ...x, _lingua: 'pt' }
    }
    const r = { ...dados }
    for (const [colecao, campo] of [['noticias', 'slug'], ['artigos', 'slug'], ['eventos', 'id'], ['cursos', 'id'], ['pessoas', 'id']]) {
      r[colecao] = (dados[colecao] || []).map((x) => traduzir(colecao, x, x[campo]))
    }
    r.paginas = Object.fromEntries(Object.entries(dados.paginas || {}).map(([k, v]) => [k, aplicarTextos(v, itens[`paginas/${k}`]?.[lingua])]))
    return r
  }, [dados, lingua])

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

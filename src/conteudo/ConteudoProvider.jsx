import { useEffect, useMemo, useState } from 'react'
import { ConteudoContexto } from './contexto'
import { pedido } from './api'
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

  const valor = useMemo(() => {
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
  }, [dados, online])

  return <ConteudoContexto.Provider value={valor}>{children}</ConteudoContexto.Provider>
}

export default ConteudoProvider

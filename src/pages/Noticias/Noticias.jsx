import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import CartaoNoticia from './CartaoNoticia'
import noticias from '../../data/noticias'
import { formatarDataLonga } from '../../utils/datas'
import { normalizar, tempoLeitura } from '../../utils/texto'
import Imagem from '../../assets/Curso2.png'
import pagina from '../../styles/pagina.module.css'
import styles from './Noticias.module.css'

const POR_PAGINA = 6
const TODAS = 'Todas'
const categorias = [TODAS, ...new Set(noticias.map((n) => n.categoria))]

function Noticias() {
  const [categoria, setCategoria] = useState(TODAS)
  const [pesquisa, setPesquisa] = useState('')
  const [visiveis, setVisiveis] = useState(POR_PAGINA)

  const termo = normalizar(pesquisa.trim())
  const aFiltrar = categoria !== TODAS || termo !== ''
  const filtradas = noticias.filter(
    (n) =>
      (categoria === TODAS || n.categoria === categoria) &&
      (termo === '' || normalizar(`${n.titulo} ${n.resumo}`).includes(termo)),
  )

  // sem filtros, a notícia marcada como destaque (ou a mais recente) abre a página em grande
  const principal = aFiltrar ? null : noticias.find((n) => n.destaque) || noticias[0]
  const lista = filtradas.filter((n) => n !== principal)

  function escolherCategoria(c) {
    setCategoria(c)
    setVisiveis(POR_PAGINA)
  }

  return (
    <main>
      <CabecalhoPagina
        etiqueta="Notícias"
        titulo="O que está a acontecer na Escola."
        descricao="Cerimónias, cooperação, investigação e a vida académica da Escola Superior de Guerra."
        imagem={Imagem}
        migalhas={[{ label: 'Notícias' }]}
      />

      <section className={pagina.secao}>
        <div className={pagina.container}>
          {principal && (
            <Link to={`/Noticias/${principal.slug}`} className={styles.principal}>
              <div className={styles.principalFoto}>
                <img src={principal.capa} alt="" />
              </div>
              <div className={styles.principalTexto}>
                <span className={pagina.etiqueta}>Em destaque · {principal.categoria}</span>
                <h2>{principal.titulo}</h2>
                <p>{principal.resumo}</p>
                <span className={styles.meta}>
                  {formatarDataLonga(principal.data)} · {tempoLeitura(principal.conteudo)} min de leitura
                </span>
                <span className={styles.ler}>Ler notícia →</span>
              </div>
            </Link>
          )}

          <div className={pagina.barraFiltros}>
            <div className={pagina.chips} role="group" aria-label="Filtrar por categoria">
              {categorias.map((c) => (
                <button
                  key={c}
                  className={`${pagina.chip} ${categoria === c ? pagina.chipAtivo : ''}`}
                  onClick={() => escolherCategoria(c)}
                  aria-pressed={categoria === c}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className={pagina.pesquisa}>
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                placeholder="Pesquisar notícias"
                value={pesquisa}
                onChange={(e) => { setPesquisa(e.target.value); setVisiveis(POR_PAGINA) }}
                aria-label="Pesquisar notícias"
              />
            </label>
          </div>

          {lista.length === 0 ? (
            <div className={pagina.vazio}>
              <strong>Nenhuma notícia encontrada</strong>
              Experimente outra categoria ou outro termo de pesquisa.
            </div>
          ) : (
            <>
              <div className={styles.grelha}>
                {lista.slice(0, visiveis).map((n) => (
                  <CartaoNoticia key={n.slug} noticia={n} />
                ))}
              </div>

              {visiveis < lista.length && (
                <div className={pagina.carregarMais}>
                  <button
                    className={`${pagina.botao} ${pagina.botaoSecundario}`}
                    onClick={() => setVisiveis((v) => v + POR_PAGINA)}
                  >
                    Carregar mais notícias
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default Noticias

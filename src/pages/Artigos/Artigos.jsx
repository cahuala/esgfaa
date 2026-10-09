import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import EntradaArtigo from './EntradaArtigo'
import artigos from '../../data/artigos'
import { pessoaPorId } from '../../data/pessoas'
import { formatarDataLonga } from '../../utils/datas'
import { iniciais, normalizar, tempoLeitura } from '../../utils/texto'
import pagina from '../../styles/pagina.module.css'
import styles from './Artigos.module.css'

const TODOS = 'Todos'
const tipos = [TODOS, ...new Set(artigos.map((a) => a.tipo))]

// { 'Estratégia': 2, ... } para a coluna lateral
const areas = artigos.reduce((acc, a) => ({ ...acc, [a.area]: (acc[a.area] || 0) + 1 }), {})

function Artigos() {
  const [tipo, setTipo] = useState(TODOS)
  const [area, setArea] = useState(null)
  const [pesquisa, setPesquisa] = useState('')

  const termo = normalizar(pesquisa.trim())
  const aFiltrar = tipo !== TODOS || area || termo
  const filtrados = artigos.filter((a) => {
    const autor = pessoaPorId(a.autor)?.nome || ''
    const texto = normalizar(`${a.titulo} ${a.resumo} ${autor} ${a.palavrasChave.join(' ')}`)
    return (tipo === TODOS || a.tipo === tipo) && (!area || a.area === area) && (!termo || texto.includes(termo))
  })

  const principal = aFiltrar ? null : artigos[0]
  const lista = filtrados.filter((a) => a !== principal)
  const autorPrincipal = principal && pessoaPorId(principal.autor)

  return (
    <main>
      <CabecalhoPagina
        etiqueta="Artigos e publicações"
        titulo="Pensamento estratégico, produzido na Escola."
        descricao="Artigos científicos, ensaios e textos de opinião do corpo docente e dos investigadores da Escola Superior de Guerra."
        migalhas={[{ label: 'Artigos' }]}
      />

      <section className={pagina.secao}>
        <div className={pagina.container}>
          {principal && (
            <Link to={`/Artigos/${principal.slug}`} className={styles.principal}>
              {principal.capa && (
                <div className={styles.principalFoto}>
                  <img src={principal.capa} alt="" />
                </div>
              )}
              <div className={styles.principalTexto}>
                <span className={pagina.etiqueta}>Publicação mais recente · {principal.tipo}</span>
                <h2>{principal.titulo}</h2>
                <p>{principal.resumo}</p>
                {autorPrincipal && (
                  <div className={styles.autor}>
                    <span className={pagina.avatar}>
                      {autorPrincipal.foto ? <img src={autorPrincipal.foto} alt="" /> : iniciais(autorPrincipal.nome)}
                    </span>
                    <div>
                      <strong>{autorPrincipal.nome}</strong>
                      <span>{formatarDataLonga(principal.data)} · {tempoLeitura(principal.conteudo)} min de leitura</span>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )}

          <div className={styles.layout}>
            <div>
              <div className={pagina.barraFiltros}>
                <div className={pagina.chips} role="group" aria-label="Filtrar por tipo de publicação">
                  {tipos.map((t) => (
                    <button
                      key={t}
                      className={`${pagina.chip} ${tipo === t ? pagina.chipAtivo : ''}`}
                      onClick={() => setTipo(t)}
                      aria-pressed={tipo === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <label className={pagina.pesquisa}>
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Título, autor ou palavra-chave"
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                    aria-label="Pesquisar artigos"
                  />
                </label>
              </div>

              {area && (
                <p className={styles.filtroArea}>
                  Área: <strong>{area}</strong>
                  <button onClick={() => setArea(null)}>Limpar</button>
                </p>
              )}

              {lista.length === 0 ? (
                <div className={pagina.vazio}>
                  <strong>Nenhum artigo encontrado</strong>
                  Experimente outro tipo, área ou termo de pesquisa.
                </div>
              ) : (
                <div className={styles.indice}>
                  {lista.map((a) => <EntradaArtigo key={a.slug} artigo={a} />)}
                </div>
              )}
            </div>

            <aside className={styles.lateralArtigos}>
              <div className={pagina.cartaoLateral}>
                <h4>Áreas de investigação</h4>
                <ul className={styles.areas}>
                  {Object.entries(areas).map(([nome, total]) => (
                    <li key={nome}>
                      <button
                        className={area === nome ? styles.areaAtiva : ''}
                        onClick={() => setArea(area === nome ? null : nome)}
                        aria-pressed={area === nome}
                      >
                        <span>{nome}</span>
                        <span className={styles.total}>{total}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${pagina.cartaoLateral} ${styles.submeter}`}>
                <h4>Publicar na Escola</h4>
                <p>Docentes, investigadores e alunos podem propor artigos ao Departamento de Investigação.</p>
                <Link to="/Contactos#formulario" className={pagina.botao}>Propor um artigo</Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Artigos

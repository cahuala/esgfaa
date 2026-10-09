import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch, FaSlidersH, FaTimes, FaPlay, FaImages, FaEnvelope } from 'react-icons/fa'
import Miniatura from './Miniatura'
import noticias, { temGaleria, temVideo } from '../../data/noticias'
import contactos from '../../data/contactos'
import { dataPorExtenso, formatarData, formatarDataLonga, formatarMesAno } from '../../utils/datas'
import { normalizar, tempoLeitura } from '../../utils/texto'
import styles from './Noticias.module.css'

const POR_PAGINA = 6
const TODAS = 'Todas'

// contagens para a coluna de pesquisa
const contar = (chave) =>
  noticias.reduce((acc, n) => {
    const k = chave(n)
    acc.set(k, (acc.get(k) || 0) + 1)
    return acc
  }, new Map())
const categorias = [...contar((n) => n.categoria)]
const meses = [...contar((n) => n.data.slice(0, 7))]
const emComunicacao = contactos.departamentos.find((d) => d.nome === 'Gabinete de Comunicação')

// agrupa uma lista já ordenada em [{ mes: 'Agosto de 2026', noticias: [...] }]
function agruparPorMes(lista) {
  return lista.reduce((grupos, n) => {
    const mes = formatarMesAno(n.data)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.mes === mes) ultimo.noticias.push(n)
    else grupos.push({ mes, noticias: [n] })
    return grupos
  }, [])
}

function Noticias() {
  const [pesquisa, setPesquisa] = useState('')
  const [categoria, setCategoria] = useState(TODAS)
  const [mes, setMes] = useState(null)
  const [soVideo, setSoVideo] = useState(false)
  const [soGaleria, setSoGaleria] = useState(false)
  const [visiveis, setVisiveis] = useState(POR_PAGINA)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  // qualquer filtro novo volta a mostrar a primeira "página" no centro
  const filtro = (definir) => (valor) => {
    definir(valor)
    setVisiveis(POR_PAGINA)
  }

  const termo = normalizar(pesquisa.trim())
  const filtradas = noticias.filter(
    (n) =>
      (categoria === TODAS || n.categoria === categoria) &&
      (!mes || n.data.startsWith(mes)) &&
      (!soVideo || temVideo(n)) &&
      (!soGaleria || temGaleria(n)) &&
      (!termo || normalizar(`${n.titulo} ${n.resumo} ${n.categoria}`).includes(termo)),
  )

  // centro: as mais recentes; direita: as mais antigas, em miniatura
  const [principal, ...seguintes] = filtradas.slice(0, visiveis)
  const arquivo = agruparPorMes(filtradas.slice(visiveis))
  const totalArquivo = Math.max(0, filtradas.length - visiveis)

  const ativos = [
    termo && { label: `“${pesquisa.trim()}”`, limpar: () => filtro(setPesquisa)('') },
    categoria !== TODAS && { label: categoria, limpar: () => filtro(setCategoria)(TODAS) },
    mes && { label: formatarMesAno(`${mes}-01`), limpar: () => filtro(setMes)(null) },
    soVideo && { label: 'Com vídeo', limpar: () => filtro(setSoVideo)(false) },
    soGaleria && { label: 'Com galeria', limpar: () => filtro(setSoGaleria)(false) },
  ].filter(Boolean)

  function limparTudo() {
    setPesquisa('')
    setCategoria(TODAS)
    setMes(null)
    setSoVideo(false)
    setSoGaleria(false)
    setVisiveis(POR_PAGINA)
  }

  const ultimas = noticias.slice(0, 5)

  return (
    <main className={styles.pagina}>
      {/* Cabeçalho tipo boletim oficial */}
      <header className={styles.cabecalho}>
        <div className={styles.cabecalhoInterior}>
          <div className={styles.linhaTopo}>
            <span>Escola Superior de Guerra · Forças Armadas Angolanas</span>
            <span>{dataPorExtenso()}</span>
          </div>

          <div className={styles.titulo}>
            <div>
              <span className={styles.sobretitulo}>Boletim informativo</span>
              <h1>Notícias</h1>
            </div>
            <dl className={styles.numeros}>
              <div><dt>Publicadas</dt><dd>{noticias.length}</dd></div>
              <div><dt>Secções</dt><dd>{categorias.length}</dd></div>
              <div><dt>Última edição</dt><dd className={styles.numeroData}>{formatarData(noticias[0].data)}</dd></div>
            </dl>
          </div>
        </div>
      </header>

      {/* Faixa "Última hora" */}
      <div className={styles.faixa}>
        <span className={styles.faixaRotulo}>Última hora</span>
        <div className={styles.faixaPista}>
          <div className={styles.faixaTrilho}>
            {[...ultimas, ...ultimas].map((n, i) => (
              <Link key={`${n.slug}-${i}`} to={`/Noticias/${n.slug}`} tabIndex={i >= ultimas.length ? -1 : undefined}>
                <span>{n.categoria}</span>{n.titulo}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.grelha}>
        {/* Coluna esquerda — formas de pesquisa */}
        <aside className={`${styles.pesquisaColuna} ${filtrosAbertos ? styles.pesquisaAberta : ''}`} aria-label="Pesquisa e filtros">
          <div className={styles.pesquisaTopo}>
            <span className={styles.rotuloColuna}>Pesquisa</span>
            <button className={styles.fecharFiltros} onClick={() => setFiltrosAbertos(false)} aria-label="Fechar filtros">
              <FaTimes />
            </button>
          </div>

          <div className={styles.bloco}>
            <h2 className={styles.blocoTitulo}><span>01</span> Palavra-chave</h2>
            <label className={styles.campoPesquisa}>
              <FaSearch aria-hidden="true" />
              <input
                type="search"
                placeholder="Título, tema ou secção"
                value={pesquisa}
                onChange={(e) => filtro(setPesquisa)(e.target.value)}
                aria-label="Pesquisar notícias"
              />
            </label>
          </div>

          <div className={styles.bloco}>
            <h2 className={styles.blocoTitulo}><span>02</span> Secções</h2>
            <ul className={styles.opcoes}>
              {[[TODAS, noticias.length], ...categorias].map(([nome, total]) => (
                <li key={nome}>
                  <button
                    className={categoria === nome ? styles.opcaoAtiva : ''}
                    onClick={() => filtro(setCategoria)(nome)}
                    aria-pressed={categoria === nome}
                  >
                    <span>{nome}</span>
                    <span className={styles.total}>{String(total).padStart(2, '0')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.bloco}>
            <h2 className={styles.blocoTitulo}><span>03</span> Arquivo mensal</h2>
            <ul className={`${styles.opcoes} ${styles.opcoesCompactas}`}>
              {meses.map(([chave, total]) => (
                <li key={chave}>
                  <button
                    className={mes === chave ? styles.opcaoAtiva : ''}
                    onClick={() => filtro(setMes)(mes === chave ? null : chave)}
                    aria-pressed={mes === chave}
                  >
                    <span>{formatarMesAno(`${chave}-01`)}</span>
                    <span className={styles.total}>{String(total).padStart(2, '0')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.bloco}>
            <h2 className={styles.blocoTitulo}><span>04</span> Conteúdo multimédia</h2>
            <label className={styles.interruptor}>
              <input type="checkbox" checked={soVideo} onChange={(e) => filtro(setSoVideo)(e.target.checked)} />
              <span className={styles.interruptorPista} aria-hidden="true" />
              <FaPlay aria-hidden="true" /> Com vídeo
            </label>
            <label className={styles.interruptor}>
              <input type="checkbox" checked={soGaleria} onChange={(e) => filtro(setSoGaleria)(e.target.checked)} />
              <span className={styles.interruptorPista} aria-hidden="true" />
              <FaImages aria-hidden="true" /> Com galeria de fotos
            </label>
          </div>

          {ativos.length > 0 && (
            <button className={styles.limpar} onClick={limparTudo}>Limpar todos os filtros</button>
          )}

          {emComunicacao && (
            <div className={styles.imprensa}>
              <span className={styles.rotuloColuna}>Imprensa</span>
              <p>Pedidos de informação, entrevistas e acreditação para eventos.</p>
              <a href={`mailto:${emComunicacao.email}`}><FaEnvelope aria-hidden="true" /> {emComunicacao.email}</a>
            </div>
          )}
        </aside>
        {filtrosAbertos && <div className={styles.veu} onClick={() => setFiltrosAbertos(false)} aria-hidden="true" />}

        {/* Coluna central — notícias */}
        <section className={styles.centro} aria-label="Notícias">
          <div className={styles.resultados}>
            <p>
              <strong>{String(filtradas.length).padStart(2, '0')}</strong>
              {filtradas.length === 1 ? 'notícia' : 'notícias'}
              {ativos.length > 0 ? ' encontradas' : ' publicadas'}
            </p>
            <button className={styles.abrirFiltros} onClick={() => setFiltrosAbertos(true)}>
              <FaSlidersH aria-hidden="true" /> Pesquisa e filtros {ativos.length > 0 && <span>{ativos.length}</span>}
            </button>
          </div>

          {ativos.length > 0 && (
            <div className={styles.ativos}>
              {ativos.map((a) => (
                <button key={a.label} onClick={a.limpar} className={styles.ativo}>
                  {a.label} <FaTimes aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {!principal ? (
            <div className={styles.vazio}>
              <span className={styles.vazioNumero}>00</span>
              <strong>Nenhuma notícia corresponde à pesquisa.</strong>
              <button onClick={limparTudo}>Limpar filtros</button>
            </div>
          ) : (
            <>
              <article className={styles.manchete}>
                <Link to={`/Noticias/${principal.slug}`} className={styles.mancheteFoto}>
                  <img src={principal.capa} alt="" />
                  <span className={styles.mancheteSelo}>{principal.destaque && !ativos.length ? 'Manchete' : principal.categoria}</span>
                </Link>
                <div className={styles.mancheteTexto}>
                  <p className={styles.chapeu}>
                    <span>{principal.categoria}</span>
                    <time dateTime={principal.data}>{formatarDataLonga(principal.data)}</time>
                    <span>{tempoLeitura(principal.conteudo)} min de leitura</span>
                  </p>
                  <h2><Link to={`/Noticias/${principal.slug}`}>{principal.titulo}</Link></h2>
                  <p className={styles.mancheteResumo}>{principal.resumo}</p>
                  <Link to={`/Noticias/${principal.slug}`} className={styles.lerMais}>Ler notícia completa</Link>
                </div>
              </article>

              <ol className={styles.lista}>
                {seguintes.map((n, i) => (
                  <li key={n.slug}>
                    <Link to={`/Noticias/${n.slug}`} className={styles.item}>
                      <span className={styles.itemNumero} aria-hidden="true">{String(i + 2).padStart(2, '0')}</span>
                      <span className={styles.itemFoto}>
                        <img src={n.capa} alt="" loading="lazy" />
                        {temVideo(n) && <span className={styles.icone} title="Inclui vídeo"><FaPlay /></span>}
                      </span>
                      <span className={styles.itemTexto}>
                        <span className={styles.chapeu}>
                          <span>{n.categoria}</span>
                          <time dateTime={n.data}>{formatarData(n.data)}</time>
                        </span>
                        <span className={styles.itemTitulo}>{n.titulo}</span>
                        <span className={styles.itemResumo}>{n.resumo}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              {totalArquivo > 0 && (
                <button className={styles.verMais} onClick={() => setVisiveis((v) => v + POR_PAGINA)}>
                  Trazer mais {Math.min(POR_PAGINA, totalArquivo)} notícias do arquivo
                </button>
              )}
            </>
          )}
        </section>

        {/* Coluna direita — arquivo em miniatura */}
        <aside className={styles.arquivo} aria-label="Notícias anteriores">
          <span className={styles.rotuloColuna}>Arquivo</span>
          <h2 className={styles.arquivoTitulo}>Notícias anteriores</h2>

          {arquivo.length === 0 ? (
            <p className={styles.arquivoVazio}>Todas as notícias desta seleção estão na coluna principal.</p>
          ) : (
            arquivo.map((g) => (
              <div key={g.mes} className={styles.arquivoGrupo}>
                <h3>{g.mes}</h3>
                {g.noticias.map((n) => <Miniatura key={n.slug} noticia={n} />)}
              </div>
            ))
          )}
        </aside>
      </div>
    </main>
  )
}

export default Noticias

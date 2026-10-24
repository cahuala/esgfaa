import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaSearch, FaSlidersH, FaTimes, FaPlay, FaImages, FaEnvelope } from 'react-icons/fa'
import { CartaoLista, Etiqueta, Foto } from '../../components/Corporativo/Corporativo'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import Miniatura from './Miniatura'
import Publicidade from '../../components/Publicidade/Publicidade'
import ActividadesEmVideo from '../../components/ActividadesEmVideo/ActividadesEmVideo'
import ResumoInteracoes from '../../components/Interacoes/ResumoInteracoes'
import { temGaleria, temVideo } from '../../data/noticias'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga, formatarMesAno } from '../../utils/datas'
import { normalizar, tempoLeitura } from '../../utils/texto'
import styles from './Noticias.module.css'
import { t } from '../../i18n/linguas'

const POR_PAGINA = 6
const TODAS = 'Todas'

// contagens para a coluna de pesquisa: [[valor, total], ...]
const contar = (lista, chave) => [
  ...lista.reduce((acc, n) => acc.set(chave(n), (acc.get(chave(n)) || 0) + 1), new Map()),
]

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
  const { noticias, paginas } = useConteudo()
  const categorias = contar(noticias, (n) => n.categoria)
  const meses = contar(noticias, (n) => n.data.slice(0, 7))
  const emComunicacao = paginas.contactos.departamentos.find((d) => d.nome === 'Gabinete de Comunicação')
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
    soVideo && { label: t('Com vídeo'), limpar: () => filtro(setSoVideo)(false) },
    soGaleria && { label: t('Com galeria'), limpar: () => filtro(setSoGaleria)(false) },
  ].filter(Boolean)

  function limparTudo() {
    setPesquisa('')
    setCategoria(TODAS)
    setMes(null)
    setSoVideo(false)
    setSoGaleria(false)
    setVisiveis(POR_PAGINA)
  }

  return (
    <main className={styles.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Notícias') }]}
        sobretitulo={t('Boletim informativo')}
        titulo={t('Notícias')}
        entrada={t('Atividade da Escola: cerimónias, cooperação, formação e investigação.')}
      />

      <ActividadesEmVideo />

      <div className={`contentor ${styles.grelha}`}>
        {/* Coluna esquerda — pesquisa e filtros */}
        <aside className={`${styles.lateral} ${filtrosAbertos ? styles.lateralAberta : ''}`} aria-label={t('Pesquisa e filtros')}>
          <div className={styles.lateralTopo}>
            <strong>{t('Pesquisa e filtros')}</strong>
            <button className={styles.fechar} onClick={() => setFiltrosAbertos(false)} aria-label={t('Fechar filtros')}><FaTimes /></button>
          </div>

          <label className={styles.campoPesquisa}>
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              placeholder={t('Pesquisar notícias')}
              value={pesquisa}
              onChange={(e) => filtro(setPesquisa)(e.target.value)}
              aria-label={t('Pesquisar notícias')}
            />
          </label>

          <div className={styles.bloco}>
            <h2>{t('Secções')}</h2>
            <ul>
              {[[TODAS, noticias.length], ...categorias].map(([nome, total]) => (
                <li key={nome}>
                  <button className={categoria === nome ? styles.opcaoAtiva : ''} onClick={() => filtro(setCategoria)(nome)} aria-pressed={categoria === nome}>
                    {nome === TODAS ? t('Todas') : nome} <span>{total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.bloco}>
            <h2>{t('Arquivo')}</h2>
            <ul>
              {meses.map(([chave, total]) => (
                <li key={chave}>
                  <button className={mes === chave ? styles.opcaoAtiva : ''} onClick={() => filtro(setMes)(mes === chave ? null : chave)} aria-pressed={mes === chave}>
                    {formatarMesAno(`${chave}-01`)} <span>{total}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.bloco}>
            <h2>{t('Multimédia')}</h2>
            <label className={styles.caixa}>
              <input type="checkbox" checked={soVideo} onChange={(e) => filtro(setSoVideo)(e.target.checked)} />
              <FaPlay aria-hidden="true" /> {t('Com vídeo')}
            </label>
            <label className={styles.caixa}>
              <input type="checkbox" checked={soGaleria} onChange={(e) => filtro(setSoGaleria)(e.target.checked)} />
              <FaImages aria-hidden="true" /> {t('Com galeria de fotos')}
            </label>
          </div>

          {ativos.length > 0 && <button className={styles.limpar} onClick={limparTudo}>{t('Limpar todos os filtros')}</button>}

          {emComunicacao && (
            <div className={styles.bloco}>
              <h2>{t('Imprensa')}</h2>
              <p className={styles.imprensa}>{t('Pedidos de informação, entrevistas e acreditação para eventos.')}</p>
              <a className={styles.email} href={`mailto:${emComunicacao.email}`}><FaEnvelope aria-hidden="true" /> {emComunicacao.email}</a>
            </div>
          )}
        </aside>
        {filtrosAbertos && <div className={styles.veu} onClick={() => setFiltrosAbertos(false)} aria-hidden="true" />}

        {/* Coluna central — notícias */}
        <section className={styles.centro} aria-label={t('Notícias')}>
          <div className={styles.resultados}>
            <p>{filtradas.length === 1 ? t('1 notícia') : t('{n} notícias', { n: filtradas.length })}{ativos.length > 0 ? ` ${t('encontradas')}` : ''}</p>
            <button className={styles.abrirFiltros} onClick={() => setFiltrosAbertos(true)}>
              <FaSlidersH aria-hidden="true" /> {t('Filtros')} {ativos.length > 0 && <span>{ativos.length}</span>}
            </button>
          </div>

          {ativos.length > 0 && (
            <div className={styles.ativos}>
              {ativos.map((a) => (
                <button key={a.label} onClick={a.limpar}>{a.label} <FaTimes aria-hidden="true" /></button>
              ))}
            </div>
          )}

          {!principal ? (
            <div className={styles.vazio}>
              <strong>{t('Nenhuma notícia corresponde à pesquisa.')}</strong>
              <button onClick={limparTudo}>{t('Limpar filtros')}</button>
            </div>
          ) : (
            <>
              <article className={styles.destaque}>
                <Link to={`/Noticias/${principal.slug}`} className={styles.destaqueFoto}>
                  <Foto src={principal.capa} className={styles.destaqueMoldura} carregar="eager" />
                </Link>
                <div className={styles.destaqueTexto}>
                  <div className={styles.meta}>
                    <Etiqueta>{principal.categoria}</Etiqueta>
                    <span>{t('{n} min de leitura', { n: tempoLeitura(principal.conteudo) })}</span>
                    <ResumoInteracoes colecao="noticias" id={principal.slug} />
                  </div>
                  <h2><Link to={`/Noticias/${principal.slug}`}>{principal.titulo}</Link></h2>
                  <p>{principal.resumo}</p>
                  <time dateTime={principal.data}>{formatarDataLonga(principal.data)}</time>
                </div>
              </article>

              <div className={styles.lista}>
                {seguintes.map((n) => (
                  <CartaoLista
                    key={n.slug}
                    para={`/Noticias/${n.slug}`}
                    imagem={n.capa}
                    etiqueta={n.categoria}
                    titulo={n.titulo}
                    resumo={n.resumo}
                    data={n.data}
                    extra={(temVideo(n) || temGaleria(n)) && (
                      <span className={styles.midia}>
                        {temVideo(n) && <span><FaPlay aria-hidden="true" /> {t('Vídeo')}</span>}
                        {temGaleria(n) && <span><FaImages aria-hidden="true" /> {t('Galeria')}</span>}
                      </span>
                    )}
                  />
                ))}
              </div>

              {totalArquivo > 0 && (
                <button className={styles.verMais} onClick={() => setVisiveis((v) => v + POR_PAGINA)}>
                  {t('Mostrar mais {n} notícias', { n: Math.min(POR_PAGINA, totalArquivo) })}
                </button>
              )}
            </>
          )}
        </section>

        {/* Coluna direita — notícias anteriores em miniatura */}
        <aside className={styles.arquivo} aria-label={t('Notícias anteriores')}>
          <h2>{t('Notícias anteriores')}</h2>
          {arquivo.length === 0 ? (
            <p className={styles.arquivoVazio}>{t('Todas as notícias desta seleção estão na coluna principal.')}</p>
          ) : (
            arquivo.map((g) => (
              <div key={g.mes} className={styles.arquivoGrupo}>
                <h3>{g.mes}</h3>
                {g.noticias.map((n) => <Miniatura key={n.slug} noticia={n} />)}
              </div>
            ))
          )}
          <Publicidade posicao="noticias-lateral" variante="lateral" />
        </aside>
      </div>
    </main>
  )
}

export default Noticias

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FaFilePdf, FaRegCopy, FaCheck } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import EntradaArtigo from './EntradaArtigo'
import artigos, { artigoPorSlug } from '../../data/artigos'
import { pessoaPorId } from '../../data/pessoas'
import { formatarDataLonga, paraData } from '../../utils/datas'
import { iniciais, tempoLeitura } from '../../utils/texto'
import pagina from '../../styles/pagina.module.css'
import styles from './Artigos.module.css'

function ArtigoDetalhe() {
  const { slug } = useParams()
  const artigo = artigoPorSlug(slug)
  const [citacaoCopiada, setCitacaoCopiada] = useState(false)

  if (!artigo) {
    return <NaoEncontrado titulo="Artigo não encontrado" voltarPara="/Artigos" voltarTexto="Ver todos os artigos" />
  }

  const autor = pessoaPorId(artigo.autor)
  const minutos = tempoLeitura(artigo.conteudo)
  const ano = paraData(artigo.data).getFullYear()
  // estilo académico: "Santos, M. (2026). Título. Escola…" (sem a patente)
  const nomes = autor ? autor.nome.split(' ').filter((p) => !p.endsWith('.')) : []
  const autorCitacao = nomes.length ? `${nomes[nomes.length - 1]}, ${nomes[0][0]}. ` : ''
  const citacao = `${autorCitacao}(${ano}). ${artigo.titulo}. Escola Superior de Guerra das Forças Armadas Angolanas.`
  const relacionados = artigos
    .filter((a) => a.slug !== artigo.slug)
    .sort((a, b) => (b.area === artigo.area) - (a.area === artigo.area))
    .slice(0, 3)

  async function copiarCitacao() {
    try {
      await navigator.clipboard.writeText(citacao)
      setCitacaoCopiada(true)
      setTimeout(() => setCitacaoCopiada(false), 2000)
    } catch {
      // sem acesso à área de transferência
    }
  }

  return (
    <main>
      <BarraLeitura />

      <CabecalhoPagina
        etiqueta={`${artigo.tipo} · ${artigo.area}`}
        titulo={artigo.titulo}
        imagem={artigo.capa}
        migalhas={[{ label: 'Artigos', to: '/Artigos' }, { label: artigo.tipo }]}
      >
        {autor && (
          <div className={`${styles.autor} ${styles.autorCabecalho}`}>
            <span className={pagina.avatar}>
              {autor.foto ? <img src={autor.foto} alt="" /> : iniciais(autor.nome)}
            </span>
            <div>
              <strong>{autor.nome}</strong>
              <span>
                {autor.cargo} · <time dateTime={artigo.data}>{formatarDataLonga(artigo.data)}</time> · {tempoLeitura(artigo.conteudo)} min de leitura
              </span>
            </div>
          </div>
        )}
      </CabecalhoPagina>

      <section className={pagina.secao}>
        <div className={pagina.layoutDetalhe}>
          <article>
            <div className={styles.resumoCaixa}>
              <h2>Resumo</h2>
              <p>{artigo.resumo}</p>
              <div className={styles.palavras}>
                <span>Palavras-chave:</span>
                {artigo.palavrasChave.map((p) => <span key={p} className={styles.palavra}>{p}</span>)}
              </div>
            </div>

            <ConteudoRico blocos={artigo.conteudo} />

            {autor && (
              <div className={styles.sobreAutor}>
                <span className={`${pagina.avatar} ${styles.avatarGrande}`}>
                  {autor.foto ? <img src={autor.foto} alt="" /> : iniciais(autor.nome)}
                </span>
                <div>
                  <span className={pagina.etiqueta}>Sobre o autor</span>
                  <h3>{autor.nome}</h3>
                  <p>{autor.cargo}. {autor.destaque}.</p>
                </div>
              </div>
            )}
          </article>

          <aside className={pagina.lateral}>
            <div className={pagina.cartaoLateral}>
              <h4>Sobre esta publicação</h4>
              <dl className={styles.ficha}>
                <dt>Tipo</dt><dd>{artigo.tipo}</dd>
                <dt>Área</dt><dd>{artigo.area}</dd>
                <dt>Publicado</dt><dd>{formatarDataLonga(artigo.data)}</dd>
                <dt>Leitura</dt><dd>{minutos} {minutos === 1 ? 'minuto' : 'minutos'}</dd>
              </dl>
              {artigo.pdf && (
                <a href={artigo.pdf} className={`${pagina.botao} ${styles.botaoPdf}`} download>
                  <FaFilePdf aria-hidden="true" /> Descarregar PDF
                </a>
              )}
            </div>

            <div className={pagina.cartaoLateral}>
              <h4>Como citar</h4>
              <p className={styles.citacao}>{citacao}</p>
              <button className={styles.copiarCitacao} onClick={copiarCitacao}>
                {citacaoCopiada ? <><FaCheck aria-hidden="true" /> Copiado</> : <><FaRegCopy aria-hidden="true" /> Copiar citação</>}
              </button>
            </div>

            <div className={pagina.cartaoLateral}>
              <Partilhar titulo={artigo.titulo} />
            </div>
          </aside>
        </div>
      </section>

      {relacionados.length > 0 && (
        <section className={`${pagina.secao} ${pagina.secaoAlt}`}>
          <div className={pagina.container}>
            <span className={pagina.etiqueta}>Continue a ler</span>
            <h2 className={pagina.tituloSecao}>Outras publicações</h2>
            <div className={`${styles.indice} ${styles.indiceRelacionados}`}>
              {relacionados.map((a) => <EntradaArtigo key={a.slug} artigo={a} />)}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

export default ArtigoDetalhe

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FaFilePdf, FaRegCopy, FaCheck } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import EntradaArtigo from './EntradaArtigo'
import artigos, { artigoPorSlug } from '../../data/artigos'
import { pessoaPorId } from '../../data/pessoas'
import { formatarDataLonga, paraData } from '../../utils/datas'
import { ancora, iniciais, tempoLeitura } from '../../utils/texto'
import ed from '../../styles/editorial.module.css'
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
  const seccoes = artigo.conteudo.filter((b) => b.tipo === 'subtitulo')
  const temReferencias = artigo.conteudo.some((b) => b.tipo === 'referencias')
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
    <main className={ed.pagina}>
      <BarraLeitura />

      <CabecalhoEditorial
        migalhas={[{ label: 'Artigos', to: '/Artigos' }, { label: artigo.tipo }]}
        topo={[`${artigo.area} · ${ano}`]}
        sobretitulo={artigo.tipo}
        titulo={artigo.titulo}
      >
        {autor && (
          <div className={`${ed.pessoa} ${styles.autorCabecalho}`}>
            <span className={ed.avatar}>{autor.foto ? <img src={autor.foto} alt="" /> : iniciais(autor.nome)}</span>
            <div>
              <strong>{autor.nome}</strong>
              <span>{autor.cargo}</span>
            </div>
          </div>
        )}
      </CabecalhoEditorial>

      {/* Ficha da publicação */}
      <dl className={ed.factos}>
        <div><dt>Publicado</dt><dd>{formatarDataLonga(artigo.data)}</dd></div>
        <div><dt>Tipo</dt><dd>{artigo.tipo}</dd></div>
        <div><dt>Área</dt><dd>{artigo.area}</dd></div>
        <div><dt>Leitura</dt><dd>{minutos} {minutos === 1 ? 'minuto' : 'minutos'}</dd></div>
      </dl>

      <div className={styles.grelhaDetalhe}>
        {/* Esquerda: índice e partilha */}
        <aside className={styles.fichaLateral}>
          <span className={ed.rotulo}>Neste artigo</span>
          <ol className={styles.indiceArtigo}>
            <li><a href="#resumo">Resumo</a></li>
            {seccoes.map((s) => <li key={s.texto}><a href={`#${ancora(s.texto)}`}>{s.texto}</a></li>)}
            {temReferencias && <li><a href="#referencias">Referências</a></li>}
          </ol>
          <div className={styles.partilha}><Partilhar titulo={artigo.titulo} /></div>
        </aside>

        {/* Centro: o artigo */}
        <article className={styles.texto}>
          <section id="resumo" className={styles.resumo}>
            <h2>Resumo</h2>
            <p>{artigo.resumo}</p>
            <div className={styles.palavras}>
              <span>Palavras-chave</span>
              {artigo.palavrasChave.map((p) => <span key={p} className={styles.palavra}>{p}</span>)}
            </div>
          </section>

          <ConteudoRico blocos={artigo.conteudo} capitular />

          {autor && (
            <div className={styles.sobreAutor}>
              <span className={ed.avatar}>{autor.foto ? <img src={autor.foto} alt="" /> : iniciais(autor.nome)}</span>
              <div>
                <span className={ed.rotulo}>Sobre o autor</span>
                <h3>{autor.nome}</h3>
                <p>{autor.cargo}. {autor.destaque}.</p>
              </div>
            </div>
          )}
        </article>

        {/* Direita: citar, PDF, relacionados */}
        <aside className={styles.direitaDetalhe}>
          <div className={styles.caixa}>
            <span className={ed.rotulo}>Como citar</span>
            <p className={styles.citacao}>{citacao}</p>
            <button className={styles.copiar} onClick={copiarCitacao}>
              {citacaoCopiada ? <><FaCheck aria-hidden="true" /> Citação copiada</> : <><FaRegCopy aria-hidden="true" /> Copiar citação</>}
            </button>
          </div>

          {artigo.pdf && (
            <a href={artigo.pdf} className={`${ed.botao} ${styles.pdf}`} download>
              <FaFilePdf aria-hidden="true" /> Descarregar PDF
            </a>
          )}

          <span className={ed.rotulo}>Continue a ler</span>
          <h2 className={styles.direitaTitulo}>Publicações relacionadas</h2>
          <div className={styles.relacionados}>
            {relacionados.map((a) => <EntradaArtigo key={a.slug} artigo={a} />)}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default ArtigoDetalhe

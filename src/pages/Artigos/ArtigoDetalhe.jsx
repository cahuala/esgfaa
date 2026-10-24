import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FaFilePdf, FaRegCopy, FaCheck } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import BarraLeitura from '../../components/BarraLeitura/BarraLeitura'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import EntradaArtigo from './EntradaArtigo'
import Interacoes from '../../components/Interacoes/Interacoes'
import AvisoLingua from '../../components/AvisoLingua/AvisoLingua'
import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga, paraData } from '../../utils/datas'
import { ancora, subtitulosDe, iniciais, tempoLeitura } from '../../utils/texto'
import ed from '../../styles/editorial.module.css'
import styles from './Artigos.module.css'
import { t } from '../../i18n/linguas'

function ArtigoDetalhe() {
  const { slug } = useParams()
  const { artigos, artigoPorSlug, pessoaPorId } = useConteudo()
  const artigo = artigoPorSlug(slug)
  const [citacaoCopiada, setCitacaoCopiada] = useState(false)

  if (!artigo) {
    return <NaoEncontrado titulo={t('Artigo não encontrado')} voltarPara="/Artigos" voltarTexto={t('Ver todos os artigos')} />
  }

  const autor = pessoaPorId(artigo.autor)
  const minutos = tempoLeitura(artigo.conteudo)
  const ano = paraData(artigo.data).getFullYear()
  // estilo académico: "Santos, M. (2026). Título. Escola…" (sem a patente)
  const nomes = autor ? autor.nome.split(' ').filter((p) => !p.endsWith('.')) : []
  const autorCitacao = nomes.length ? `${nomes[nomes.length - 1]}, ${nomes[0][0]}. ` : ''
  const citacao = `${autorCitacao}(${ano}). ${artigo.titulo}. ${t('Escola Superior de Guerra das Forças Armadas Angolanas')}.`
  const seccoes = subtitulosDe(artigo.conteudo)
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
        migalhas={[{ label: t('Artigos'), to: '/Artigos' }, { label: artigo.tipo }]}
        sobretitulo={artigo.tipo}
        titulo={artigo.titulo}
      >
        {autor && (
          <div className={`${ed.pessoa} ${styles.autorCabecalho}`}>
            <span className={ed.avatar}>{autor.foto ? <img loading="lazy" decoding="async" src={autor.foto} alt="" /> : iniciais(autor.nome)}</span>
            <div>
              <strong>{autor.nome}</strong>
              <span>{autor.cargo}</span>
            </div>
          </div>
        )}
      </CabecalhoEditorial>

      {/* Ficha da publicação */}
      <dl className={ed.factos}>
        <div><dt>{t('Publicado')}</dt><dd>{formatarDataLonga(artigo.data)}</dd></div>
        <div><dt>{t('Tipo')}</dt><dd>{artigo.tipo}</dd></div>
        <div><dt>{t('Área')}</dt><dd>{artigo.area}</dd></div>
        <div><dt>{t('Leitura')}</dt><dd>{minutos === 1 ? t('1 minuto') : t('{n} minutos', { n: minutos })}</dd></div>
      </dl>

      <div className={`contentor ${styles.grelhaDetalhe}`}>
        {/* Esquerda: índice e partilha */}
        <aside className={styles.fichaLateral}>
          <h2 className={styles.fichaTitulo}>{t('Neste artigo')}</h2>
          <ol className={styles.indiceArtigo}>
            <li><a href="#resumo">{t('Resumo')}</a></li>
            {seccoes.map((s) => <li key={s}><a href={`#${ancora(s)}`}>{s}</a></li>)}
            {temReferencias && <li><a href="#referencias">{t('Referências')}</a></li>}
          </ol>
          <div className={styles.partilha}><Partilhar titulo={artigo.titulo} /></div>
        </aside>

        {/* Centro: o artigo */}
        <article className={styles.texto}>
          <section id="resumo" className={styles.resumo}>
            <AvisoLingua item={artigo} />
            <h2>{t('Resumo')}</h2>
            <p>{artigo.resumo}</p>
            <div className={styles.palavras}>
              <span>{t('Palavras-chave')}</span>
              {artigo.palavrasChave.map((p) => <span key={p} className={styles.palavra}>{p}</span>)}
            </div>
          </section>

          <ConteudoRico blocos={artigo.conteudo} />

          <Interacoes colecao="artigos" id={artigo.slug} titulo={artigo.titulo} />

          {autor && (
            <div className={styles.sobreAutor}>
              <span className={ed.avatar}>{autor.foto ? <img loading="lazy" decoding="async" src={autor.foto} alt="" /> : iniciais(autor.nome)}</span>
              <div>
                <span className={styles.sobreRotulo}>{t('Sobre o autor')}</span>
                <h3>{autor.nome}</h3>
                <p>{autor.cargo}. {autor.destaque}.</p>
              </div>
            </div>
          )}
        </article>

        {/* Direita: citar, PDF, relacionados */}
        <aside className={styles.direitaDetalhe}>
          <div className={styles.caixa}>
            <h2 className={styles.fichaTitulo}>{t('Como citar')}</h2>
            <p className={styles.citacao}>{citacao}</p>
            <button className={styles.copiar} onClick={copiarCitacao}>
              {citacaoCopiada ? <><FaCheck aria-hidden="true" /> {t('Citação copiada')}</> : <><FaRegCopy aria-hidden="true" /> {t('Copiar citação')}</>}
            </button>
          </div>

          {artigo.pdf && (
            <a href={artigo.pdf} className={`${ed.botao} ${styles.pdf}`} download>
              <FaFilePdf aria-hidden="true" /> {t('Descarregar PDF')}
            </a>
          )}

          <h2 className={styles.direitaTitulo}>{t('Publicações relacionadas')}</h2>
          <div className={styles.relacionados}>
            {relacionados.map((a) => <EntradaArtigo key={a.slug} artigo={a} />)}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default ArtigoDetalhe

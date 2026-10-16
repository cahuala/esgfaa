import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import AvisoLingua from '../../components/AvisoLingua/AvisoLingua'
import LeitorPdf from '../../leitor/LeitorPdf'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import { useConteudo } from '../../conteudo/contexto'
import { t } from '../../i18n/linguas'
import { formatarMesAno as mesAno } from '../../utils/datas'
import ed from '../../styles/editorial.module.css'
import styles from './Revista.module.css'

// Um número da revista aberto no leitor; o sumário salta para a página de cada artigo
function RevistaLeitura() {
  const { slug } = useParams()
  const [procura] = useSearchParams()
  const { revistaPorSlug, revistas = [] } = useConteudo()
  const r = revistaPorSlug(slug)
  const leitor = useRef(null)
  const pagina = Number(procura.get('pagina')) || 0

  // vindo do sumário da página da revista: abre já na página do artigo
  useEffect(() => {
    if (!pagina) return undefined
    const id = setTimeout(() => leitor.current?.irPara(pagina), 900)
    return () => clearTimeout(id)
  }, [pagina, slug])

  if (!r) return <NaoEncontrado />
  const outras = revistas.filter((x) => x.slug !== r.slug).slice(0, 4)
  const nomeFicheiro = `Revista ESG ${r.numero} — ${r.titulo}.pdf`.replace(/[\\/:*?"<>|]/g, '')

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Revista'), to: '/Revista' }, { label: r.numero }]}
        sobretitulo={`${r.numero} · ${mesAno(r.data)}`}
        titulo={r.titulo}
        entrada={r.resumo}
      />

      <div className={`contentor ${styles.leitura}`}>
        <AvisoLingua item={r} />
        <div id="leitor" className={styles.ancora}>
          {r.pdf
            ? <LeitorPdf key={r.slug} ref={leitor} fonte={r.pdf} titulo={`${r.numero} — ${r.titulo}`} descarregar={r.pdf} nomeFicheiro={nomeFicheiro} duplaPorOmissao />
            : <p className={styles.vazio}>{t('Este número ainda não tem o PDF.')}</p>}
        </div>

        <div className={styles.depois}>
          {r.sumario?.length > 0 && (
            <section aria-labelledby="sumario-titulo">
              <h2 id="sumario-titulo" className={styles.subtitulo}>{t('Sumário')}</h2>
              <ol className={styles.sumario}>
                {r.sumario.map((s) => (
                  <li key={`${s.pagina}-${s.titulo}`}>
                    <button type="button" onClick={() => { leitor.current?.irPara(s.pagina); document.getElementById('leitor')?.scrollIntoView({ behavior: 'smooth' }) }} disabled={!s.pagina}>
                      <span className={styles.pagina}>{String(s.pagina || '').padStart(2, '0')}</span>
                      <span><strong>{s.titulo}</strong>{s.autor && <em>{s.autor}</em>}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {outras.length > 0 && (
            <section aria-labelledby="outros-titulo">
              <h2 id="outros-titulo" className={styles.subtitulo}>{t('Outros números')}</h2>
              <ul className={styles.outros}>
                {outras.map((x) => (
                  <li key={x.slug}>
                    <Link to={`/Revista/${x.slug}`}>
                      {x.capa && <img src={x.capa} alt="" loading="lazy" />}
                      <span><em>{x.numero} · {mesAno(x.data)}</em><strong>{x.titulo}</strong></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/Revista" className={ed.ligacao}>{t('Ver todos os números')}</Link>
            </section>
          )}
        </div>
      </div>
    </main>
  )
}

export default RevistaLeitura

import { Link } from 'react-router-dom'
import { FaBookOpen, FaDownload } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import { TituloSeccao } from '../../components/Corporativo/Corporativo'
import AvisoLingua from '../../components/AvisoLingua/AvisoLingua'
import CapaPdf from '../../leitor/CapaPdf'
import { useConteudo } from '../../conteudo/contexto'
import { formatarMesAno as mesAno } from '../../utils/datas'
import { t } from '../../i18n/linguas'
import ed from '../../styles/editorial.module.css'
import styles from './Revista.module.css'

// A Revista da Escola: o número mais recente em destaque e a estante com todos os números
function Revista() {
  const { revistas = [] } = useConteudo()
  const recente = revistas.find((r) => r.destaque) || revistas[0]
  const outras = revistas.filter((r) => r !== recente)

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: t('Revista') }]}
        sobretitulo={t('Publicações')}
        titulo={t('Revista da Escola Superior de Guerra')}
        entrada={t('Estratégia, segurança e defesa, pelo corpo docente e pelos oficiais-alunos. Todos os números podem ser lidos aqui, gratuitamente e sem registo.')}
      >
        <dl className={styles.numeros}>
          <div><dt>{t('Números')}</dt><dd>{revistas.length}</dd></div>
          <div><dt>{t('Artigos')}</dt><dd>{revistas.reduce((n, r) => n + (r.sumario || []).filter((s) => !/^editorial/i.test(s.titulo)).length, 0)}</dd></div>
        </dl>
      </CabecalhoEditorial>

      {!recente && (
        <section className={`contentor ${styles.vazio}`}>
          <p>{t('Ainda não há números publicados.')}</p>
        </section>
      )}

      {recente && (
        <section className={`contentor ${styles.destaque}`} aria-label={t('Número mais recente')}>
          <Link to={`/Revista/${recente.slug}`} className={styles.capaGrande} aria-label={t('Ler {numero}', { numero: recente.numero })}>
            <CapaPdf capa={recente.capa} pdf={recente.pdf} className={styles.capaImagem} />
          </Link>
          <div className={styles.destaqueTexto}>
            <span className={styles.rotulo}>{t('Número mais recente')}</span>
            <p className={styles.edicao}>{recente.numero} · {mesAno(recente.data)}</p>
            <h2>{recente.titulo}</h2>
            <AvisoLingua item={recente} />
            {recente.resumo && <p className={styles.resumo}>{recente.resumo}</p>}
            {recente.sumario?.length > 0 && (
              <ol className={styles.sumario} aria-label={t('Sumário')}>
                {recente.sumario.map((s) => (
                  <li key={`${s.pagina}-${s.titulo}`}>
                    <Link to={`/Revista/${recente.slug}${s.pagina ? `?pagina=${s.pagina}` : ''}`}>
                      <span className={styles.pagina}>{String(s.pagina || '').padStart(2, '0')}</span>
                      <span><strong>{s.titulo}</strong>{s.autor && <em>{s.autor}</em>}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <div className={styles.acoes}>
              <Link to={`/Revista/${recente.slug}`} className={ed.botao}><FaBookOpen aria-hidden="true" /> {t('Ler agora')}</Link>
              {recente.pdf && <a href={recente.pdf} download className={styles.secundario}><FaDownload aria-hidden="true" /> {t('Descarregar PDF')}</a>}
            </div>
          </div>
        </section>
      )}

      {outras.length > 0 && (
        <section className={`contentor ${styles.bloco}`}>
          <TituloSeccao rotulo={t('Arquivo')} titulo={t('Todos os números')} />
          <ul className={styles.estante}>
            {outras.map((r) => (
              <li key={r.slug}>
                <Link to={`/Revista/${r.slug}`} className={styles.numero}>
                  <span className={styles.capaPequena}><CapaPdf capa={r.capa} pdf={r.pdf} className={styles.capaImagem} /></span>
                  <span className={styles.edicao}>{r.numero} · {mesAno(r.data)}</span>
                  <strong>{r.titulo}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`contentor ${styles.bloco}`}>
        <div className={styles.autores}>
          <div>
            <TituloSeccao rotulo={t('Para autores')} titulo={t('Publicar na Revista')} />
            <p>{t('A Revista aceita artigos originais de docentes, oficiais-alunos e investigadores convidados, em português, inglês, francês ou espanhol. Cada proposta é lida por dois revisores do conselho editorial.')}</p>
          </div>
          <Link to="/Contactos#formulario" className={ed.botao}>{t('Enviar uma proposta')}</Link>
        </div>
      </section>
    </main>
  )
}

export default Revista

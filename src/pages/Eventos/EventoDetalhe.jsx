import { Link, useParams } from 'react-router-dom'
import { FaArrowLeft, FaRegCalendarPlus } from 'react-icons/fa'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import Contagem from './Contagem'
import LinhaAgenda from './LinhaAgenda'
import Interacoes from '../../components/Interacoes/Interacoes'
import AvisoLingua from '../../components/AvisoLingua/AvisoLingua'
import { Etiqueta } from '../../components/Corporativo/Corporativo'
import { useConteudo } from '../../conteudo/contexto'
import { diaDaSemana, diaDoMes, hoje, mesLongo, paraData } from '../../utils/datas'
import { descarregarCalendario } from '../../utils/calendario'
import ed from '../../styles/editorial.module.css'
import styles from './Eventos.module.css'
import { t } from '../../i18n/linguas'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'

function EventoDetalhe() {
  const { id } = useParams()
  const { eventos, eventoPorId } = useConteudo()
  const evento = eventoPorId(id)

  if (!evento) {
    return <NaoEncontrado titulo={t('Evento não encontrado')} voltarPara="/Eventos" voltarTexto={t('Ver a agenda')} />
  }

  const realizado = paraData(evento.data) < hoje()
  const ano = paraData(evento.data).getFullYear()
  const outros = eventos.filter((e) => e.id !== evento.id && paraData(e.data) >= hoje()).slice(0, 3)

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial faixa migalhas={[{ label: t('Agenda'), to: '/Eventos' }, { label: evento.categoria || t('Evento') }]} titulo={t('Agenda')} />
      <div className={`contentor ${styles.evento}`}>
        <article>
          <Link to="/Eventos" className={styles.voltar}>
            <span><FaArrowLeft aria-hidden="true" /></span> {t('Voltar à agenda')}
          </Link>
          <AvisoLingua item={evento} />
          <Etiqueta>{evento.categoria}</Etiqueta>
          <h1>{evento.titulo}</h1>
          {evento.resumo && <p className={styles.entrada}>{evento.resumo}</p>}

          {evento.capa && (
            <figure className={styles.imagem}>
              <img src={evento.capa} alt="" />
            </figure>
          )}

          <ConteudoRico blocos={evento.conteudo} />

          {evento.programa?.length > 0 && (
            <>
              <h2 className={styles.subtitulo}>{t('Programa')}</h2>
              <ol className={styles.programa}>
                {evento.programa.map((p) => (
                  <li key={`${p.hora}-${p.atividade}`}>
                    <time>{p.hora}</time>
                    <span>{p.atividade}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          <Interacoes colecao="eventos" id={evento.id} titulo={evento.titulo} />
        </article>

        {/* ficha com a informação essencial */}
        <aside className={styles.bilhete} aria-label={t('Informação do evento')}>
          <div className={styles.bilheteData}>
            <strong>{diaDoMes(evento.data)}</strong>
            <span>
              {mesLongo(evento.data)} {ano}
              <small>{diaDaSemana(evento.data)}</small>
            </span>
          </div>
          <dl className={styles.bilheteFactos}>
            <div><dt>{t('Horário')}</dt><dd>{evento.horaInicio}{evento.horaFim ? ` – ${evento.horaFim}` : ''}</dd></div>
            <div><dt>{t('Local')}</dt><dd>{evento.local}</dd></div>
            <div>
              <dt>{realizado ? t('Estado') : t('Começa dentro de')}</dt>
              <dd>{realizado ? t('Realizado') : <Contagem data={evento.data} hora={evento.horaInicio} compacta />}</dd>
            </div>
          </dl>
          {!realizado && (
            <div className={styles.bilheteAcoes}>
              {evento.inscricoes && <Link to="/Contactos#formulario" className={ed.botao}>{t('Inscrever-me')}</Link>}
              <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarCalendario(evento)}>
                <FaRegCalendarPlus aria-hidden="true" /> {t('Adicionar ao calendário')}
              </button>
            </div>
          )}
          <div className={styles.partilha}><Partilhar titulo={evento.titulo} /></div>
        </aside>
      </div>

      {outros.length > 0 && (
        <section className={styles.outros}>
          <div className="contentor">
            <span className={ed.rotulo}>{t('Agenda')}</span>
            <h2 className={styles.outrosTitulo}>{t('Outros eventos')}</h2>
            <ul className={styles.lista}>
              {outros.map((e) => <li key={e.id}><LinhaAgenda evento={e} /></li>)}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}

export default EventoDetalhe

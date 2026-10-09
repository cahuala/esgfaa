import { Link, useParams } from 'react-router-dom'
import { FaRegCalendarAlt, FaRegClock, FaMapMarkerAlt, FaTag, FaRegCalendarPlus } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import LinhaEvento from './LinhaEvento'
import eventos, { eventoPorId } from '../../data/eventos'
import { contagem, formatarDataLonga, paraData, hoje } from '../../utils/datas'
import { descarregarCalendario } from '../../utils/calendario'
import pagina from '../../styles/pagina.module.css'
import styles from './Eventos.module.css'

function EventoDetalhe() {
  const { id } = useParams()
  const evento = eventoPorId(id)

  if (!evento) {
    return <NaoEncontrado titulo="Evento não encontrado" voltarPara="/Eventos" voltarTexto="Ver a agenda" />
  }

  const realizado = paraData(evento.data) < hoje()
  const outros = eventos
    .filter((e) => e.id !== evento.id && paraData(e.data) >= hoje())
    .slice(0, 3)

  return (
    <main>
      <CabecalhoPagina
        etiqueta={realizado ? `${evento.categoria} · Evento realizado` : evento.categoria}
        titulo={evento.titulo}
        descricao={evento.resumo}
        imagem={evento.capa}
        migalhas={[{ label: 'Eventos', to: '/Eventos' }, { label: evento.categoria }]}
      >
        {!realizado && <span className={styles.contagemCabecalho}>{contagem(evento.data)}</span>}
      </CabecalhoPagina>

      <section className={pagina.secao}>
        <div className={pagina.layoutDetalhe}>
          <div>
            <ConteudoRico blocos={evento.conteudo} />

            {evento.programa && (
              <div className={styles.programa}>
                <h2 className={pagina.tituloSecao}>Programa</h2>
                <ol className={styles.cronologia}>
                  {evento.programa.map((p) => (
                    <li key={p.hora}>
                      <span className={styles.hora}>{p.hora}</span>
                      <span>{p.atividade}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <aside className={pagina.lateral}>
            <div className={pagina.cartaoLateral}>
              <h4>Informações</h4>
              <ul className={styles.informacoes}>
                <li><FaRegCalendarAlt aria-hidden="true" /><div><small>Data</small>{formatarDataLonga(evento.data)}</div></li>
                <li><FaRegClock aria-hidden="true" /><div><small>Horário</small>{evento.horaInicio} – {evento.horaFim}</div></li>
                <li><FaMapMarkerAlt aria-hidden="true" /><div><small>Local</small>{evento.local}</div></li>
                <li><FaTag aria-hidden="true" /><div><small>Tipo</small>{evento.categoria}</div></li>
              </ul>

              {!realizado && (
                <div className={styles.acoesLateral}>
                  {evento.inscricoes && (
                    <Link to="/Contactos#formulario" className={pagina.botao}>Inscrever-me</Link>
                  )}
                  <button
                    className={`${pagina.botao} ${pagina.botaoSecundario}`}
                    onClick={() => descarregarCalendario(evento)}
                  >
                    <FaRegCalendarPlus aria-hidden="true" /> Adicionar ao calendário
                  </button>
                </div>
              )}
            </div>

            <div className={pagina.cartaoLateral}>
              <Partilhar titulo={evento.titulo} />
            </div>
          </aside>
        </div>
      </section>

      {outros.length > 0 && (
        <section className={`${pagina.secao} ${pagina.secaoAlt}`}>
          <div className={pagina.container}>
            <span className={pagina.etiqueta}>Agenda</span>
            <h2 className={pagina.tituloSecao}>Outros eventos</h2>
            <ul className={`${styles.lista} ${styles.listaOutros}`}>
              {outros.map((e) => <li key={e.id}><LinhaEvento evento={e} /></li>)}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}

export default EventoDetalhe

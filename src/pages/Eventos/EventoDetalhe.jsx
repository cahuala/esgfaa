import { Link, useParams } from 'react-router-dom'
import { FaRegCalendarPlus } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import ConteudoRico from '../../components/ConteudoRico/ConteudoRico'
import Partilhar from '../../components/Partilhar/Partilhar'
import NaoEncontrado from '../NaoEncontrado/NaoEncontrado'
import Contagem from './Contagem'
import LinhaAgenda from './LinhaAgenda'
import Interacoes from '../../components/Interacoes/Interacoes'
import { useConteudo } from '../../conteudo/contexto'
import { diaDaSemana, diaDoMes, hoje, mesLongo, paraData } from '../../utils/datas'
import { descarregarCalendario } from '../../utils/calendario'
import ed from '../../styles/editorial.module.css'
import styles from './Eventos.module.css'

function EventoDetalhe() {
  const { id } = useParams()
  const { eventos, eventoPorId } = useConteudo()
  const evento = eventoPorId(id)

  if (!evento) {
    return <NaoEncontrado titulo="Evento não encontrado" voltarPara="/Eventos" voltarTexto="Ver a agenda" />
  }

  const realizado = paraData(evento.data) < hoje()
  const ano = paraData(evento.data).getFullYear()
  const outros = eventos.filter((e) => e.id !== evento.id && paraData(e.data) >= hoje()).slice(0, 3)

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        migalhas={[{ label: 'Eventos', to: '/Eventos' }, { label: evento.categoria }]}
        sobretitulo={evento.categoria}
        titulo={evento.titulo}
        entrada={evento.resumo}
      />

      {/* "Bilhete" com a informação essencial */}
      <section className={styles.bilhete} aria-label="Informação do evento">
        <div className={styles.bilheteData}>
          <strong>{diaDoMes(evento.data)}</strong>
          <span>{mesLongo(evento.data)} {ano}</span>
          <small>{diaDaSemana(evento.data)}</small>
        </div>
        <dl className={styles.bilheteFactos}>
          <div><dt>Horário</dt><dd>{evento.horaInicio} – {evento.horaFim}</dd></div>
          <div><dt>Local</dt><dd>{evento.local}</dd></div>
          <div>
            <dt>{realizado ? 'Estado' : 'Começa dentro de'}</dt>
            <dd>{realizado ? 'Realizado' : <Contagem data={evento.data} hora={evento.horaInicio} compacta />}</dd>
          </div>
        </dl>
        {!realizado && (
          <div className={styles.bilheteAcoes}>
            {evento.inscricoes && <Link to="/Contactos#formulario" className={ed.botao}>Inscrever-me</Link>}
            <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarCalendario(evento)}>
              <FaRegCalendarPlus aria-hidden="true" /> Calendário
            </button>
          </div>
        )}
      </section>

      <figure className={styles.imagem}>
        <img src={evento.capa} alt="" />
      </figure>

      <div className={ed.grelha}>
        <aside className={ed.indice}>
          <div className={styles.partilha}><Partilhar titulo={evento.titulo} /></div>
          <Link to="/Eventos" className={ed.ligacao}>Voltar à agenda</Link>
        </aside>

        <div className={ed.conteudo}>
          <section className={ed.seccao}>
            <div className={ed.tituloSeccao}>
              <span className={ed.numeroSeccao} aria-hidden="true">01</span>
              <div>
                <span className={ed.rotulo}>Sobre</span>
                <h2>O evento.</h2>
              </div>
            </div>
            <ConteudoRico blocos={evento.conteudo} />
          </section>

          {evento.programa && (
            <section className={ed.seccao}>
              <div className={ed.tituloSeccao}>
                <span className={ed.numeroSeccao} aria-hidden="true">02</span>
                <div>
                  <span className={ed.rotulo}>Programa</span>
                  <h2>Horário do dia.</h2>
                </div>
              </div>
              <ol className={styles.programa}>
                {evento.programa.map((p) => (
                  <li key={p.hora}>
                    <time>{p.hora}</time>
                    <span>{p.atividade}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Interacoes colecao="eventos" id={evento.id} titulo={evento.titulo} />
        </div>
      </div>

      {outros.length > 0 && (
        <section className={styles.outros}>
          <div className={ed.largura}>
            <span className={ed.rotulo}>Agenda</span>
            <h2 className={styles.outrosTitulo}>Outros eventos</h2>
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

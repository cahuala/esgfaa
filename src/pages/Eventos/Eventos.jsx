import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaRegCalendarPlus, FaRegClock, FaMapMarkerAlt } from 'react-icons/fa'
import CabecalhoPagina from '../../components/CabecalhoPagina/CabecalhoPagina'
import LinhaEvento from './LinhaEvento'
import eventos from '../../data/eventos'
import { contagem, formatarDataLonga, formatarMesAno, paraData, hoje } from '../../utils/datas'
import { descarregarCalendario } from '../../utils/calendario'
import Imagem from '../../assets/Auditorio.png'
import pagina from '../../styles/pagina.module.css'
import styles from './Eventos.module.css'

const TODOS = 'Todos'
const categorias = [TODOS, ...new Set(eventos.map((e) => e.categoria))]

// agrupa uma lista já ordenada em [{ mes: 'Outubro de 2026', eventos: [...] }]
function agruparPorMes(lista) {
  return lista.reduce((grupos, e) => {
    const mes = formatarMesAno(e.data)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.mes === mes) ultimo.eventos.push(e)
    else grupos.push({ mes, eventos: [e] })
    return grupos
  }, [])
}

function Eventos() {
  const [separador, setSeparador] = useState('proximos')
  const [categoria, setCategoria] = useState(TODOS)

  const inicioDoDia = hoje()
  const proximos = eventos.filter((e) => paraData(e.data) >= inicioDoDia)
  const realizados = eventos.filter((e) => paraData(e.data) < inicioDoDia).reverse()
  const seguinte = proximos[0]

  const base = separador === 'proximos' ? proximos : realizados
  const lista = base.filter((e) => categoria === TODOS || e.categoria === categoria)
  const grupos = agruparPorMes(lista)

  return (
    <main>
      <CabecalhoPagina
        etiqueta="Eventos"
        titulo="Agenda da Escola."
        descricao="Conferências, seminários, cerimónias e visitas oficiais. Consulte o que aí vem e o que já aconteceu."
        imagem={Imagem}
        migalhas={[{ label: 'Eventos' }]}
      />

      <section className={pagina.secao}>
        <div className={pagina.container}>
          {seguinte && (
            <article className={styles.seguinte}>
              <div className={styles.seguinteFoto}>
                <img src={seguinte.capa} alt="" />
                <span className={styles.contagem}>{contagem(seguinte.data)}</span>
              </div>
              <div className={styles.seguinteTexto}>
                <span className={pagina.etiqueta}>Próximo evento · {seguinte.categoria}</span>
                <h2>{seguinte.titulo}</h2>
                <p>{seguinte.resumo}</p>
                <ul className={styles.factos}>
                  <li><FaRegCalendarPlus aria-hidden="true" /> {formatarDataLonga(seguinte.data)}</li>
                  <li><FaRegClock aria-hidden="true" /> {seguinte.horaInicio} – {seguinte.horaFim}</li>
                  <li><FaMapMarkerAlt aria-hidden="true" /> {seguinte.local}</li>
                </ul>
                <div className={styles.acoes}>
                  <Link to={`/Eventos/${seguinte.id}`} className={pagina.botao}>Ver detalhes</Link>
                  <button
                    className={`${pagina.botao} ${pagina.botaoSecundario}`}
                    onClick={() => descarregarCalendario(seguinte)}
                  >
                    Adicionar ao calendário
                  </button>
                </div>
              </div>
            </article>
          )}

          <div className={styles.separadores} role="tablist" aria-label="Eventos">
            <button
              role="tab"
              aria-selected={separador === 'proximos'}
              className={`${styles.separador} ${separador === 'proximos' ? styles.separadorAtivo : ''}`}
              onClick={() => setSeparador('proximos')}
            >
              Próximos <span>{proximos.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={separador === 'realizados'}
              className={`${styles.separador} ${separador === 'realizados' ? styles.separadorAtivo : ''}`}
              onClick={() => setSeparador('realizados')}
            >
              Realizados <span>{realizados.length}</span>
            </button>
          </div>

          <div className={pagina.barraFiltros}>
            <div className={pagina.chips} role="group" aria-label="Filtrar por tipo de evento">
              {categorias.map((c) => (
                <button
                  key={c}
                  className={`${pagina.chip} ${categoria === c ? pagina.chipAtivo : ''}`}
                  onClick={() => setCategoria(c)}
                  aria-pressed={categoria === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {grupos.length === 0 ? (
            <div className={pagina.vazio}>
              <strong>{separador === 'proximos' ? 'Sem eventos agendados' : 'Sem eventos realizados'}</strong>
              {categoria !== TODOS ? 'Experimente outro tipo de evento.' : 'Volte a consultar a agenda em breve.'}
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.mes} className={styles.grupo}>
                <h3 className={styles.mesTitulo}>{g.mes}</h3>
                <ul className={styles.lista}>
                  {g.eventos.map((e) => (
                    <li key={e.id}>
                      <LinhaEvento evento={e} realizado={separador === 'realizados'} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

export default Eventos

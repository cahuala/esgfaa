import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaRegCalendarPlus, FaMapMarkerAlt, FaRegClock } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import Contagem from './Contagem'
import Calendario from './Calendario'
import LinhaAgenda from './LinhaAgenda'
import MiniaturaEvento from './MiniaturaEvento'
import eventos from '../../data/eventos'
import {
  dataPorExtenso, diaDaSemana, diaDoMes, formatarDataLonga, formatarMesAno, hoje, mesLongo, paraData,
} from '../../utils/datas'
import { descarregarAgenda, descarregarCalendario } from '../../utils/calendario'
import ed from '../../styles/editorial.module.css'
import styles from './Eventos.module.css'

const TODOS = 'Todos'

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
  const inicioDoDia = hoje()
  const hojeIso = `${inicioDoDia.getFullYear()}-${String(inicioDoDia.getMonth() + 1).padStart(2, '0')}-${String(inicioDoDia.getDate()).padStart(2, '0')}`
  const proximos = eventos.filter((e) => paraData(e.data) >= inicioDoDia)
  const realizados = eventos.filter((e) => paraData(e.data) < inicioDoDia).reverse()
  const seguinte = proximos[0]
  const tipos = [...new Set(eventos.map((e) => e.categoria))]

  const [tipo, setTipo] = useState(TODOS)
  const [dia, setDia] = useState(null)
  const [mes, setMes] = useState(() => {
    const ref = seguinte ? paraData(seguinte.data) : inicioDoDia
    return { ano: ref.getFullYear(), mes: ref.getMonth() }
  })

  // com um dia escolhido mostra os eventos desse dia (mesmo já realizados)
  const base = dia ? eventos.filter((e) => e.data === dia) : proximos
  const lista = base.filter((e) => tipo === TODOS || e.categoria === tipo)
  const grupos = agruparPorMes(lista)
  const esteMes = proximos.filter((e) => e.data.startsWith(hojeIso.slice(0, 7))).length

  return (
    <main className={ed.pagina}>
      <CabecalhoEditorial
        topo={['Agenda institucional', dataPorExtenso()]}
        sobretitulo="Agenda"
        titulo="Eventos"
      >
        <dl className={styles.numeros}>
          <div><dt>Próximos</dt><dd>{String(proximos.length).padStart(2, '0')}</dd></div>
          <div><dt>Este mês</dt><dd>{String(esteMes).padStart(2, '0')}</dd></div>
          <div><dt>Realizados</dt><dd>{String(realizados.length).padStart(2, '0')}</dd></div>
        </dl>
      </CabecalhoEditorial>

      {/* Próximo evento em destaque */}
      {seguinte && (
        <section className={styles.destaque} aria-label="Próximo evento">
          <div className={styles.destaqueInterior}>
            <div className={styles.destaqueData}>
              <span className={styles.destaqueRotulo}>Próximo evento</span>
              <strong>{diaDoMes(seguinte.data)}</strong>
              <span className={styles.destaqueMes}>{mesLongo(seguinte.data)}</span>
              <span className={styles.destaqueSemana}>{diaDaSemana(seguinte.data)}</span>
            </div>

            <div className={styles.destaqueTexto}>
              <span className={ed.rotulo}>{seguinte.categoria}</span>
              <h2><Link to={`/Eventos/${seguinte.id}`}>{seguinte.titulo}</Link></h2>
              <ul className={styles.destaqueFactos}>
                <li><FaRegClock aria-hidden="true" /> {seguinte.horaInicio} – {seguinte.horaFim}</li>
                <li><FaMapMarkerAlt aria-hidden="true" /> {seguinte.local}</li>
              </ul>
              <Contagem data={seguinte.data} hora={seguinte.horaInicio} />
              <div className={styles.destaqueAcoes}>
                <Link to={`/Eventos/${seguinte.id}`} className={ed.botao}>Ver programa</Link>
                <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarCalendario(seguinte)}>
                  <FaRegCalendarPlus aria-hidden="true" /> Adicionar ao calendário
                </button>
              </div>
            </div>

            <Link to={`/Eventos/${seguinte.id}`} className={styles.destaqueFoto} tabIndex={-1} aria-hidden="true">
              <img src={seguinte.capa} alt="" />
            </Link>
          </div>
        </section>
      )}

      <div className={styles.grelha}>
        {/* Esquerda: calendário e filtros */}
        <aside className={styles.lateral} aria-label="Calendário e filtros">
          <span className={ed.rotulo}>Calendário</span>
          <Calendario
            mes={mes}
            onMudarMes={setMes}
            datas={new Set(eventos.map((e) => e.data))}
            selecionado={dia}
            onSelecionar={setDia}
            hojeIso={hojeIso}
          />

          <div className={styles.filtro}>
            <span className={ed.rotulo}>Tipo de evento</span>
            <ul>
              {[TODOS, ...tipos].map((t) => {
                const total = t === TODOS ? proximos.length : proximos.filter((e) => e.categoria === t).length
                return (
                  <li key={t}>
                    <button className={tipo === t ? styles.filtroAtivo : ''} onClick={() => setTipo(t)} aria-pressed={tipo === t}>
                      <span>{t}</span>
                      <span className={styles.total}>{String(total).padStart(2, '0')}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {proximos.length > 0 && (
            <div className={ed.caixaLateral}>
              <span className={ed.rotulo}>Subscrever</span>
              <p>Descarregue todos os próximos eventos para o seu calendário (Google, Outlook ou iPhone).</p>
              <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarAgenda(proximos)}>
                <FaRegCalendarPlus aria-hidden="true" /> Agenda completa
              </button>
            </div>
          )}
        </aside>

        {/* Centro: agenda */}
        <section className={styles.centro} aria-label="Agenda">
          <div className={styles.centroTopo}>
            <h2>{dia ? `Eventos de ${formatarDataLonga(dia)}` : 'Próximos eventos'}</h2>
            {(dia || tipo !== TODOS) && (
              <button className={styles.limpar} onClick={() => { setDia(null); setTipo(TODOS) }}>Ver toda a agenda</button>
            )}
          </div>

          {grupos.length === 0 ? (
            <div className={styles.vazio}>
              <strong>Sem eventos para esta seleção.</strong>
              <button onClick={() => { setDia(null); setTipo(TODOS) }}>Ver toda a agenda</button>
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.mes} className={styles.grupo}>
                <h3 className={styles.grupoMes}>{g.mes}</h3>
                <ul className={styles.lista}>
                  {g.eventos.map((e) => (
                    <li key={e.id}><LinhaAgenda evento={e} realizado={paraData(e.data) < inicioDoDia} /></li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {/* Direita: realizados */}
        <aside className={styles.arquivo} aria-label="Eventos realizados">
          <span className={ed.rotulo}>Arquivo</span>
          <h2 className={styles.arquivoTitulo}>Eventos realizados</h2>
          {realizados.length === 0 ? (
            <p className={styles.arquivoVazio}>Ainda não há eventos realizados.</p>
          ) : (
            realizados.map((e) => <MiniaturaEvento key={e.id} evento={e} />)
          )}
        </aside>
      </div>
    </main>
  )
}

export default Eventos

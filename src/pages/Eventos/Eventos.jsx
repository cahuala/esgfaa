import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaRegCalendarPlus, FaMapMarkerAlt, FaRegClock } from 'react-icons/fa'
import CabecalhoEditorial from '../../components/CabecalhoEditorial/CabecalhoEditorial'
import Contagem from './Contagem'
import Calendario from './Calendario'
import LinhaAgenda from './LinhaAgenda'
import MiniaturaEvento from './MiniaturaEvento'
import ActividadesEmVideo from '../../components/ActividadesEmVideo/ActividadesEmVideo'
import { useConteudo } from '../../conteudo/contexto'
import {
  diaDaSemana, diaDoMes, formatarDataLonga, formatarMesAno, hoje, mesLongo, paraData,
} from '../../utils/datas'
import { descarregarAgenda, descarregarCalendario } from '../../utils/calendario'
import { Etiqueta } from '../../components/Corporativo/Corporativo'
import ed from '../../styles/editorial.module.css'
import styles from './Eventos.module.css'
import { t } from '../../i18n/linguas'

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
  const { eventos } = useConteudo()
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
        migalhas={[{ label: t('Eventos') }]}
        sobretitulo={t('Agenda')}
        titulo={t('Eventos')}
        entrada={t('Cerimónias, conferências, seminários e visitas oficiais da Escola.')}
      >
        <dl className={styles.numeros}>
          <div><dt>{t('Próximos')}</dt><dd>{proximos.length}</dd></div>
          <div><dt>{t('Este mês')}</dt><dd>{esteMes}</dd></div>
          <div><dt>{t('Realizados')}</dt><dd>{realizados.length}</dd></div>
        </dl>
      </CabecalhoEditorial>

      <ActividadesEmVideo />

      {/* Próximo evento em destaque: cartão branco com a fotografia ao lado */}
      {seguinte && (
        <section className={`contentor ${styles.destaque}`} aria-label={t('Próximo evento')}>
          <div className={styles.destaqueInterior}>
            <Link to={`/Eventos/${seguinte.id}`} className={styles.destaqueFoto} tabIndex={-1} aria-hidden="true">
              <img src={seguinte.capa} alt="" />
            </Link>
            <div className={styles.destaqueTexto}>
              <div className={styles.destaqueRotulo}>
                <span>{t('Próximo evento')}</span>
                <Etiqueta>{seguinte.categoria}</Etiqueta>
              </div>
              <h2><Link to={`/Eventos/${seguinte.id}`}>{seguinte.titulo}</Link></h2>
              <ul className={styles.destaqueFactos}>
                <li><FaRegCalendarPlus aria-hidden="true" /> {t('{semana}, {dia} de {mes}', { semana: diaDaSemana(seguinte.data), dia: diaDoMes(seguinte.data), mes: mesLongo(seguinte.data) })}</li>
                <li><FaRegClock aria-hidden="true" /> {seguinte.horaInicio}{seguinte.horaFim ? ` – ${seguinte.horaFim}` : ''}</li>
                <li><FaMapMarkerAlt aria-hidden="true" /> {seguinte.local}</li>
              </ul>
              <Contagem data={seguinte.data} hora={seguinte.horaInicio} />
              <div className={styles.destaqueAcoes}>
                <Link to={`/Eventos/${seguinte.id}`} className={ed.botao}>{t('Ver programa')}</Link>
                <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarCalendario(seguinte)}>
                  <FaRegCalendarPlus aria-hidden="true" /> {t('Adicionar ao calendário')}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={`contentor ${styles.grelha}`}>
        {/* Esquerda: calendário e filtros */}
        <aside className={styles.lateral} aria-label={t('Calendário e filtros')}>
          <h2 className={styles.lateralTitulo}>{t('Calendário')}</h2>
          <Calendario
            mes={mes}
            onMudarMes={setMes}
            datas={new Set(eventos.map((e) => e.data))}
            selecionado={dia}
            onSelecionar={setDia}
            hojeIso={hojeIso}
          />

          <div className={styles.filtro}>
            <h2 className={styles.lateralTitulo}>{t('Tipo de evento')}</h2>
            <ul>
              {[TODOS, ...tipos].map((x) => {
                const total = x === TODOS ? proximos.length : proximos.filter((e) => e.categoria === x).length
                return (
                  <li key={x}>
                    <button className={tipo === x ? styles.filtroAtivo : ''} onClick={() => setTipo(x)} aria-pressed={tipo === x}>
                      <span>{x === TODOS ? t('Todos') : x}</span>
                      <span className={styles.total}>{total}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {proximos.length > 0 && (
            <div className={ed.caixaLateral}>
              <h2 className={styles.lateralTitulo}>{t('Subscrever')}</h2>
              <p>{t('Descarregue todos os próximos eventos para o seu calendário (Google, Outlook ou iPhone).')}</p>
              <button className={`${ed.botao} ${ed.botaoContorno}`} onClick={() => descarregarAgenda(proximos)}>
                <FaRegCalendarPlus aria-hidden="true" /> {t('Agenda completa')}
              </button>
            </div>
          )}
        </aside>

        {/* Centro: agenda */}
        <section className={styles.centro} aria-label={t('Agenda')}>
          <div className={styles.centroTopo}>
            <h2>{dia ? t('Eventos de {data}', { data: formatarDataLonga(dia) }) : t('Próximos eventos')}</h2>
            {(dia || tipo !== TODOS) && (
              <button className={styles.limpar} onClick={() => { setDia(null); setTipo(TODOS) }}>{t('Ver toda a agenda')}</button>
            )}
          </div>

          {grupos.length === 0 ? (
            <div className={styles.vazio}>
              <strong>{t('Sem eventos para esta seleção.')}</strong>
              <button onClick={() => { setDia(null); setTipo(TODOS) }}>{t('Ver toda a agenda')}</button>
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
        <aside className={styles.arquivo} aria-label={t('Eventos realizados')}>
          <h2 className={styles.arquivoTitulo}>{t('Eventos realizados')}</h2>
          {realizados.length === 0 ? (
            <p className={styles.arquivoVazio}>{t('Ainda não há eventos realizados.')}</p>
          ) : (
            realizados.map((e) => <MiniaturaEvento key={e.id} evento={e} />)
          )}
        </aside>
      </div>
    </main>
  )
}

export default Eventos

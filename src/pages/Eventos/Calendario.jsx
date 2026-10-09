import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import styles from './Eventos.module.css'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

const iso = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

/*
  Calendário mensal: os dias com eventos ficam marcados e podem ser escolhidos.
  `mes` é { ano, mes } (mes de 0 a 11); `datas` é um Set de datas "AAAA-MM-DD".
*/
function Calendario({ mes, onMudarMes, datas, selecionado, onSelecionar, hojeIso }) {
  const primeiro = new Date(mes.ano, mes.mes, 1)
  const deslocamento = (primeiro.getDay() + 6) % 7 // semana começa à segunda-feira
  const totalDias = new Date(mes.ano, mes.mes + 1, 0).getDate()
  const celulas = [...Array(deslocamento).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)]

  const mudar = (delta) => {
    const d = new Date(mes.ano, mes.mes + delta, 1)
    onMudarMes({ ano: d.getFullYear(), mes: d.getMonth() })
  }

  return (
    <div className={styles.calendario}>
      <div className={styles.calendarioTopo}>
        <button onClick={() => mudar(-1)} aria-label="Mês anterior"><FaChevronLeft /></button>
        <strong>{MESES[mes.mes]} {mes.ano}</strong>
        <button onClick={() => mudar(1)} aria-label="Mês seguinte"><FaChevronRight /></button>
      </div>
      <div className={styles.calendarioGrelha}>
        {SEMANA.map((d, i) => <span key={i} className={styles.calendarioSemana}>{d}</span>)}
        {celulas.map((dia, i) => {
          if (!dia) return <span key={`v${i}`} />
          const data = iso(mes.ano, mes.mes, dia)
          const temEvento = datas.has(data)
          const classes = [
            styles.dia,
            temEvento && styles.diaComEvento,
            data === selecionado && styles.diaSelecionado,
            data === hojeIso && styles.diaHoje,
            data < hojeIso && styles.diaPassado,
          ].filter(Boolean).join(' ')
          return temEvento ? (
            <button
              key={data}
              className={classes}
              onClick={() => onSelecionar(data === selecionado ? null : data)}
              aria-pressed={data === selecionado}
              aria-label={`${dia} de ${MESES[mes.mes]}, com eventos`}
            >
              {dia}
            </button>
          ) : (
            <span key={data} className={classes}>{dia}</span>
          )
        })}
      </div>
    </div>
  )
}

export default Calendario

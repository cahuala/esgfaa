import { useEffect, useState } from 'react'
import { paraData } from '../../utils/datas'
import styles from './Eventos.module.css'

// Contagem decrescente ao segundo até ao início de um evento
function Contagem({ data, hora = '00:00', compacta = false }) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const alvo = paraData(data)
  const [h, m] = hora.split(':').map(Number)
  alvo.setHours(h, m, 0, 0)
  const falta = Math.max(0, alvo - agora)
  if (falta === 0) return <p className={styles.aDecorrer}>Em curso ou já realizado</p>

  const partes = [
    { valor: Math.floor(falta / 86400000), rotulo: 'dias' },
    { valor: Math.floor(falta / 3600000) % 24, rotulo: 'horas' },
    { valor: Math.floor(falta / 60000) % 60, rotulo: 'min' },
    { valor: Math.floor(falta / 1000) % 60, rotulo: 'seg' },
  ]

  return (
    <div className={`${styles.contagem} ${compacta ? styles.contagemCompacta : ''}`} role="timer" aria-label="Tempo até ao início">
      {partes.map((p) => (
        <span key={p.rotulo}>
          <strong>{String(p.valor).padStart(2, '0')}</strong>
          <small>{p.rotulo}</small>
        </span>
      ))}
    </div>
  )
}

export default Contagem

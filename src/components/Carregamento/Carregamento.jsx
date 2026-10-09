import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Brasao from '../../assets/Logo.png'
import styles from './Carregamento.module.css'

// tempo total do ecrã: barra a encher (0,75 s) + desvanecer (0,35 s)
const DURACAO_MS = 1100

/*
  Ecrã de carregamento mostrado ao abrir o site e ao mudar de página.
  Fica visível até o temporizador marcar o endereço atual como "terminado";
  âncoras na mesma página (#secção) não mudam o pathname e não o mostram.
*/
function Carregamento() {
  const { pathname } = useLocation()
  const [terminado, setTerminado] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => setTerminado(pathname), DURACAO_MS)
    return () => clearTimeout(id)
  }, [pathname])

  if (terminado === pathname) return null

  return (
    // a key recria o elemento a cada página, o que reinicia as animações
    <div key={pathname} className={styles.ecra} aria-hidden="true">
      <div className={styles.centro}>
        <img src={Brasao} alt="" className={styles.brasao} />
        <span className={styles.nome}>Escola Superior de Guerra</span>
        <span className={styles.barra}><span /></span>
      </div>
    </div>
  )
}

export default Carregamento


import { useState, useEffect, useRef } from 'react'
import styles from './FormacaoDestaque.module.css'
import { Link } from 'react-router-dom'
import { useConteudo } from '../../conteudo/contexto'

const INTERVALO_MS = 7000

function FormacaoDestaque() {
  const { cursos, paginas } = useConteudo()
  const textos = paginas.home.formacao
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const timerRef = useRef(null)
  // o intervalo lê o total por referência (a lista pode mudar quando a API responde)
  const totalRef = useRef(cursos.length)
  useEffect(() => {
    totalRef.current = cursos.length
  }, [cursos.length])
  const curso = cursos[indiceAtivo % Math.max(1, cursos.length)]

  function iniciarAutoRotacao() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndiceAtivo((atual) => (atual + 1) % Math.max(1, totalRef.current))
    }, INTERVALO_MS)
  }

  useEffect(() => {
    iniciarAutoRotacao()
    return () => clearInterval(timerRef.current)
  }, [])

  function handleClickAba(index) {
    setIndiceAtivo(index)
    iniciarAutoRotacao() // reinicia a contagem para não trocar logo a seguir ao clique manual
  }

  if (!curso) return null

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>{textos.etiqueta}</span>
        <h2>{textos.titulo}</h2>
        <p>{textos.texto}</p>
      </div>

      <div className={styles.corpo}>
        <div className={styles.listaAbas}>
          {cursos.map((c, index) => (
            <button
              key={c.id}
              className={`${styles.aba} ${indiceAtivo === index ? styles.abaAtiva : ''}`}
              onClick={() => handleClickAba(index)}
            >
              {c.nome}
              {indiceAtivo === index && (
                <span className={styles.progresso} key={indiceAtivo}>
                  <span className={styles.progressoBarra} />
                </span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.painel}>
          <div className={styles.painelMidia}>
            <img
              key={curso.id}
              src={curso.imagem}
              alt={curso.nome}
              className={styles.midiaFundo}
            />
            <div className={styles.painelOverlay} />
          </div>

          <div className={styles.painelConteudo}>
            <div className={styles.painelInfo}>
              <span className={styles.tagInfo}>{curso.duracao}</span>
              <span className={styles.tagInfo}>{curso.regime}</span>
            </div>

            <h3>{curso.nome}</h3>
            <p className={styles.resumo}>{curso.resumo}</p>

            <span className={styles.subtitulo}>Plano curricular</span>
            <ul className={styles.plano}>
              {curso.plano.flatMap((p) => p.unidades).slice(0, 4).map((u) => (
                <li key={u.nome}>{u.nome}</li>
              ))}
            </ul>

            <Link to={`/Cursos/${curso.id}`} className={styles.cta}>Conhecer o curso</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default FormacaoDestaque

import { useState } from 'react'
import { useConteudo } from '../../conteudo/contexto'
import styles from './Faq.module.css'

function Faq() {
  const { paginas } = useConteudo()
  const { etiqueta, titulo } = paginas.home.faq
  const perguntas = paginas.home.faq.perguntas.map((p, i) => ({ ...p, id: i + 1 }))
  const [abertaId, setAbertaId] = useState(null)

  function alternar(id) {
    setAbertaId((atual) => (atual === id ? null : id))
  }

  return (
    <section className={styles.secao}>
      <div className={styles.container}>
        <div className={styles.cabecalho}>
          <span className={styles.etiqueta}>{etiqueta}</span>
          <h2>{titulo}</h2>
        </div>

        <div className={styles.lista}>
          {perguntas.map((p) => {
            const aberta = abertaId === p.id
            return (
              <div className={`${styles.item} ${aberta ? styles.itemAberto : ''}`} key={p.id}>
                <button
                  className={styles.pergunta}
                  onClick={() => alternar(p.id)}
                  aria-expanded={aberta}
                >
                  <span>{p.pergunta}</span>
                  <span className={styles.icone} aria-hidden="true">
                    <span className={styles.linhaH} />
                    <span className={styles.linhaV} />
                  </span>
                </button>

                <div className={styles.respostaWrapper}>
                  <p className={styles.resposta}>{p.resposta}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Faq
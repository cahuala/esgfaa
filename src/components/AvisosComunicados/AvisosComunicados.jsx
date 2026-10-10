import { useConteudo } from '../../conteudo/contexto'
import { formatarDataLonga, paraData } from '../../utils/datas'
import { Etiqueta, TituloSeccao } from '../Corporativo/Corporativo'
import styles from './AvisosComunicados.module.css'

function AvisosComunicados() {
  const { paginas } = useConteudo()
  const { etiqueta, titulo, lista } = paginas.home.avisos
  const ordenados = [...lista].sort((a, b) => paraData(b.data) - paraData(a.data)).slice(0, 5)

  return (
    <section className="seccao">
      <div className="contentor">
        <TituloSeccao rotulo={etiqueta || 'Comunicados'} titulo={titulo} />
        {ordenados.length === 0 ? (
          <p className={styles.vazio}>Não há comunicados publicados neste momento.</p>
        ) : (
          <ul className={styles.lista}>
            {ordenados.map((a) => (
              <li key={`${a.data}-${a.titulo}`} className={styles.item}>
                <div className={styles.etiquetas}>
                  {a.tipo && <Etiqueta cor="cinzento">{a.tipo}</Etiqueta>}
                  {a.importante && <Etiqueta cor="vermelho">Importante</Etiqueta>}
                </div>
                <div className={styles.texto}>
                  <h3>{a.titulo}</h3>
                  <p>{a.resumo}</p>
                </div>
                <time className={styles.data} dateTime={a.data}>{formatarDataLonga(a.data)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default AvisosComunicados

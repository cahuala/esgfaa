
import { Link } from 'react-router-dom'
import styles from './NoticiaDestaque.module.css'
import CarlosVieira from '../../assets/CarlosVieira.png'
import Foto2 from '../../assets/Foto2.jpg'
import Foto5 from '../../assets/Foto5.jpg'
import Foto6 from '../../assets/Zé Grande.jpg'




const noticias = [
  {
    id: 1,
    categoria: 'Institucional',
    titulo: 'Cerimónia de abertura do ano académico 2026',
    resumo: 'A Escola recebeu mais de 200 novos alunos na cerimónia oficial de abertura do ano letivo.',
    data: '12 Set 2026',
    imagem: CarlosVieira,
  },
  {
    id: 2,
    categoria: 'Cooperação',
    titulo: 'Novo acordo de cooperação assinado com escola parceira',
    resumo: 'Protocolo prevê intercâmbio de docentes e alunos a partir do próximo ano letivo.',
    data: '28 Ago 2026',
    imagem: Foto2,
  },
  {
    id: 3,
    categoria: 'Cerimónias',
    titulo: 'Formatura da turma de Estado-Maior 2026',
    resumo: 'Mais de 60 oficiais concluíram o curso numa cerimónia presidida pelo Comandante.',
    data: '15 Ago 2026',
    imagem: Foto5,
  },
  {
    id: 4,
    categoria: 'Conferências',
    titulo: 'Conferência sobre segurança regional reúne especialistas',
    resumo: 'Evento contou com a participação de convidados de escolas militares de vários países.',
    data: '02 Ago 2026',
    imagem: Foto6,
  },
]

function NoticiaDestaque() {
  const noticiasDuplicadas = [...noticias, ...noticias]

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>Notícias</span>
        <h2>O que está a acontecer na Escola.</h2>
      </div>

      <div className={styles.pista}>
        <div className={styles.trilho}>
          {noticiasDuplicadas.map((n, index) => (
            <Link to={`/noticias/${n.id}`} className={styles.cartao} key={`${n.id}-${index}`}>
              <div className={styles.fotoWrapper}>
                <img src={n.imagem} alt={n.titulo} className={styles.foto} />
                <span className={styles.tagCategoria}>{n.categoria}</span>
              </div>
              <div className={styles.info}>
                <span className={styles.data}>{n.data}</span>
                <h3>{n.titulo}</h3>
                <p>{n.resumo}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default NoticiaDestaque
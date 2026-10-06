
import styles from './CorpoDestaque.module.css'

const pessoas = [
  {
    id: 1,
    nome: 'Gen. Carlos Vieira',
    cargo: 'Comandante da Escola',
    destaque: 'Mais de 30 anos de carreira militar, à frente da Escola desde 2021',
    foto: '/assets/pessoas/carlos-vieira.jpg',
  },
  {
    id: 2,
    nome: 'Cor. Ana Baptista',
    cargo: 'Subdiretora Académica',
    destaque: 'Responsável pela coordenação de todos os programas de formação',
    foto: '/assets/pessoas/ana-baptista.jpg',
  },
  {
    id: 3,
    nome: 'Cor. Miguel Santos',
    cargo: 'Diretor do Departamento de Investigação',
    destaque: 'Autor de mais de 15 publicações em estratégia e defesa',
    foto: '/assets/pessoas/miguel-santos.jpg',
  },
  {
    id: 4,
    nome: 'Ten-Cor. Isabel Fortunato',
    cargo: 'Chefe do Corpo Docente',
    destaque: 'Doutorada em Relações Internacionais, docente há 12 anos',
    foto: '/assets/pessoas/isabel-fortunato.jpg',
  },
  {
    id: 5,
    nome: 'Cor. José Manuel',
    cargo: 'Diretor de Cooperação Internacional',
    destaque: 'Responsável por mais de 20 acordos de cooperação com escolas parceiras',
    foto: '/assets/pessoas/jose-manuel.jpg',
  },
  {
    id: 6,
    nome: 'Maj. Teresa Lopes',
    cargo: 'Coordenadora do Curso de Estado-Maior',
    destaque: 'Formou mais de 300 oficiais ao longo da carreira docente',
    foto: '/assets/pessoas/teresa-lopes.jpg',
  },
]

function CorpoDestaque() {
  // duplica a lista para o loop do carrossel ficar contínuo, sem salto visível
  const pessoasDuplicadas = [...pessoas, ...pessoas]

  return (
    <section className={styles.secao}>
      <div className={styles.cabecalho}>
        <span className={styles.etiqueta}>Comando e Corpo Docente</span>
        <h2>Quem forma, também lidera.</h2>
      </div>

      <div className={styles.pista}>
        <div className={styles.trilho}>
          {pessoasDuplicadas.map((p, index) => (
            <div className={styles.cartao} key={`${p.id}-${index}`}>
              <div className={styles.fotoWrapper}>
                <img src={p.foto} alt={p.nome} className={styles.foto} />
              </div>
              <h3>{p.nome}</h3>
              <span className={styles.cargo}>{p.cargo}</span>
              <p>{p.destaque}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default CorpoDestaque
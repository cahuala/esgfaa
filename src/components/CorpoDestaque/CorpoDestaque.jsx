
import styles from './CorpoDestaque.module.css'
import FotoCarlosVieira from '../../assets/Comandante3.png'

const pessoas = [
  {
    id: 1,
    nome: 'Gen. Carlos Vieira',
    cargo: 'Comandante da Escola',
    destaque: 'Mais de 30 anos de carreira militar, à frente da Escola desde 2021',
    foto: FotoCarlosVieira,
  },
  {
    id: 2,
    nome: 'Cor. Ana Baptista',
    cargo: 'Subdiretora Académica',
    destaque: 'Responsável pela coordenação de todos os programas de formação',
  },
  {
    id: 3,
    nome: 'Cor. Miguel Santos',
    cargo: 'Diretor do Departamento de Investigação',
    destaque: 'Autor de mais de 15 publicações em estratégia e defesa',
  },
  {
    id: 4,
    nome: 'Ten-Cor. Isabel Fortunato',
    cargo: 'Chefe do Corpo Docente',
    destaque: 'Doutorada em Relações Internacionais, docente há 12 anos',
  },
  {
    id: 5,
    nome: 'Cor. José Manuel',
    cargo: 'Diretor de Cooperação Internacional',
    destaque: 'Responsável por mais de 20 acordos de cooperação com escolas parceiras',
  },
  {
    id: 6,
    nome: 'Maj. Teresa Lopes',
    cargo: 'Coordenadora do Curso de Estado-Maior',
    destaque: 'Formou mais de 300 oficiais ao longo da carreira docente',
  },
]

// "Gen. Carlos Vieira" -> "CV" (ignora a patente abreviada)
function iniciais(nome) {
  const partes = nome.split(' ').filter((p) => !p.endsWith('.'))
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

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
                {p.foto ? (
                  <img src={p.foto} alt={p.nome} className={styles.foto} />
                ) : (
                  <span className={styles.iniciais} aria-hidden="true">{iniciais(p.nome)}</span>
                )}
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